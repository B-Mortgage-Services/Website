/**
 * BMS mortgage maths — pure functions, no DOM, no globals.
 *
 * Every function here takes its inputs and its configuration as arguments and
 * returns a value. Nothing reads an element, nothing reads a page-level
 * variable, nothing writes to the page. That is what makes these usable from
 * both the affordability calculator page and the first-time buyer wizard
 * without either one depending on the other's markup.
 *
 * Configuration comes from data/affordability.json and data/annual_rates.json,
 * injected into the page by layouts/partials/calc-config.html as
 * AFFORDABILITY_CONFIG and TAX_CONFIG. Callers pass those in. Rates and stamp
 * duty bands change, and they must only ever be changed in the data files.
 *
 * Used by:
 *   themes/bms-theme/layouts/affordability-calculator/list.html
 *   themes/bms-theme/layouts/partials/ftb-wizard.html
 */
(function (global) {
  'use strict';

  /**
   * "1,234" -> 1234. Returns 0 for anything unparseable, because these read
   * comma-formatted text inputs that are routinely empty or mid-edit.
   */
  function parseFormattedNumber(str) {
    if (!str) return 0;
    return parseInt(String(str).replace(/,/g, '')) || 0;
  }

  function formatCurrency(num) {
    return '£' + num.toLocaleString('en-GB', { maximumFractionDigits: 0 });
  }

  /**
   * Annual take-home after Income Tax and National Insurance.
   * England/NI rates. Includes the personal allowance taper above £100k.
   */
  function calculateNetPay(grossAnnual, tax) {
    if (grossAnnual <= 0) return 0;

    // The personal allowance is withdrawn £1 for every £2 over the taper start.
    var adjustedAllowance = tax.personalAllowance;
    if (grossAnnual > tax.taperStart) {
      adjustedAllowance = Math.max(
        0,
        tax.personalAllowance - ((grossAnnual - tax.taperStart) * tax.taperRate)
      );
    }

    var taxableIncome = Math.max(0, grossAnnual - adjustedAllowance);
    var incomeTax = 0;

    if (taxableIncome > 0) {
      var basicBandLimit = tax.basicRateLimit - adjustedAllowance;
      var basicTaxable = Math.min(taxableIncome, basicBandLimit);
      incomeTax += basicTaxable * tax.basicRate;

      if (taxableIncome > basicBandLimit) {
        var higherBandLimit = tax.higherRateLimit - adjustedAllowance;
        var higherTaxable = Math.min(taxableIncome - basicBandLimit, higherBandLimit - basicBandLimit);
        incomeTax += higherTaxable * tax.higherRate;

        if (taxableIncome > higherBandLimit) {
          incomeTax += (taxableIncome - higherBandLimit) * tax.additionalRate;
        }
      }
    }

    var nationalInsurance = 0;
    if (grossAnnual > tax.niThreshold) {
      nationalInsurance += (Math.min(grossAnnual, tax.niUpperLimit) - tax.niThreshold) * tax.niMainRate;
      if (grossAnnual > tax.niUpperLimit) {
        nationalInsurance += (grossAnnual - tax.niUpperLimit) * tax.niAdditionalRate;
      }
    }

    return grossAnnual - incomeTax - nationalInsurance;
  }

  /** Capital repayment: M = P * [r(1+r)^n] / [(1+r)^n - 1] */
  function calculateMonthlyRepayment(principal, annualRate, years) {
    if (principal <= 0) return 0;
    var monthlyRate = annualRate / 100 / 12;
    var numPayments = years * 12;
    var payment = principal * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
      (Math.pow(1 + monthlyRate, numPayments) - 1);
    return Math.round(payment);
  }

  /** The same formula rearranged: P = M * [(1+r)^n - 1] / [r(1+r)^n] */
  function calculateMaxMortgageFromPayment(monthlyPayment, annualRate, years) {
    if (monthlyPayment <= 0) return 0;
    var monthlyRate = annualRate / 100 / 12;
    var numPayments = years * 12;
    var principal = monthlyPayment * (Math.pow(1 + monthlyRate, numPayments) - 1) /
      (monthlyRate * Math.pow(1 + monthlyRate, numPayments));
    return Math.round(principal);
  }

  /**
   * Stamp Duty Land Tax. England & Northern Ireland only — Scotland (LBTT) and
   * Wales (LTT) are different taxes with different bands and are not handled.
   *
   * First-time buyer relief applies only if EVERY buyer is a first-time buyer,
   * and is lost entirely above the ceiling, at which point standard rates apply
   * to the whole price rather than just the excess. Callers must establish that
   * every buyer qualifies before passing isFirstTimeBuyer.
   */
  function calculateStampDuty(price, isFirstTimeBuyer, sdConfig) {
    if (price <= 0) return 0;

    var stampDuty = 0;

    if (isFirstTimeBuyer) {
      var ftb = sdConfig.firstTimeBuyer;
      if (price <= ftb.reliefMaxPrice) {
        if (price > ftb.nilRateThreshold) {
          stampDuty = (price - ftb.nilRateThreshold) * ftb.rateAboveThreshold;
        }
        return Math.round(stampDuty);
      }
      // Over the ceiling the relief is gone, so fall through to standard rates.
    }

    // Band 0 is the nil-rate band, so there is nothing to charge on it.
    var bands = sdConfig.standard.bands;
    for (var i = 1; i < bands.length; i++) {
      var bandFrom = bands[i].from - 1;
      var bandTo = bands[i].to || Infinity;
      if (price > bandFrom) {
        stampDuty += (Math.min(price, bandTo) - bandFrom) * bands[i].rate;
      }
    }

    return Math.round(stampDuty);
  }

  /**
   * How much could be borrowed, three ways.
   *
   * @param {object} o
   * @param {number} o.yourIncome        gross annual
   * @param {number} o.partnerIncome     gross annual; ignored unless joint
   * @param {string} o.applicationType   'single' | 'joint'
   * @param {number} o.creditCards       outstanding balance, not a payment
   * @param {number} o.loansHP           monthly
   * @param {number} o.otherOutgoings    monthly
   * @param {number} o.termYears
   * @param {object} o.config            AFFORDABILITY_CONFIG
   * @param {object} o.taxConfig         TAX_CONFIG
   */
  function computeAffordability(o) {
    var config = o.config;
    var isJoint = o.applicationType === 'joint';
    var yourIncome = o.yourIncome || 0;
    var partnerIncome = isJoint ? (o.partnerIncome || 0) : 0;
    var termYears = o.termYears > 0 ? o.termYears : 30;

    var totalIncome = yourIncome + partnerIncome;

    var yourNetAnnual = calculateNetPay(yourIncome, o.taxConfig);
    var partnerNetAnnual = isJoint ? calculateNetPay(partnerIncome, o.taxConfig) : 0;
    var totalNetMonthly = (yourNetAnnual + partnerNetAnnual) / 12;

    // A credit card balance is treated as a monthly commitment at the
    // configured rate, which is how lenders assess revolving credit.
    var cardCommitment = (o.creditCards || 0) * config.creditCardCommitmentRate;
    var totalCommitments = (o.loansHP || 0) + (o.otherOutgoings || 0) + cardCommitment;

    var conservative = totalIncome * config.multipliers[0].multiplier;
    var standard = totalIncome * config.multipliers[1].multiplier;
    var incomeMultiplierMax = totalIncome * config.multipliers[2].multiplier;

    // The top figure is capped by what the monthly budget actually supports,
    // not just by the income multiple.
    var disposableIncome = totalNetMonthly - totalCommitments;
    var maxAffordablePayment = disposableIncome * config.maxPaymentRatio;
    var affordabilityMax = calculateMaxMortgageFromPayment(
      maxAffordablePayment, config.rates.repaymentHigh, termYears
    );
    var maximum = Math.min(affordabilityMax, incomeMultiplierMax);

    return {
      conservative: conservative,
      standard: standard,
      maximum: maximum,
      totalIncome: totalIncome,
      yourNetAnnual: yourNetAnnual,
      partnerNetAnnual: partnerNetAnnual,
      totalNetMonthly: totalNetMonthly,
      totalCommitments: totalCommitments,
      cardCommitment: cardCommitment,
      termYears: termYears
    };
  }

  /**
   * The one-off costs of buying, plus the resulting mortgage.
   *
   * @param {object} o
   * @param {number}  o.housePrice
   * @param {number}  o.salePrice         ignored unless isMover
   * @param {number}  o.deposit
   * @param {number}  o.rate              annual %, falls back to config default
   * @param {number}  o.termYears
   * @param {boolean} o.isFirstTimeBuyer  every buyer qualifies for FTB relief
   * @param {boolean} o.isMover           has a property to sell
   * @param {object}  o.config            AFFORDABILITY_CONFIG
   */
  function computeMovingCosts(o) {
    var config = o.config;
    var mc = config.movingCosts;
    var housePrice = o.housePrice || 0;
    var deposit = o.deposit || 0;
    var salePrice = o.salePrice || 0;
    var rate = o.rate > 0 ? o.rate : config.rates.movingCostDefault;
    var termYears = o.termYears > 0 ? o.termYears : 30;

    var mortgageAmount = Math.max(0, housePrice - deposit);
    var ltvPercent = housePrice > 0 ? Math.round((mortgageAmount / housePrice) * 100) : 0;
    var depositPercent = housePrice > 0 ? Math.round((deposit / housePrice) * 100) : 0;

    var monthlyPayment = calculateMonthlyRepayment(mortgageAmount, rate, termYears);
    var stampDuty = calculateStampDuty(housePrice, o.isFirstTimeBuyer, config.stampDuty);

    // Only someone with a property to sell pays an agent or a second set of
    // conveyancing fees.
    var estateAgentFees = 0;
    var sellingLegalFees = 0;
    if (o.isMover) {
      estateAgentFees = Math.round(salePrice * mc.estateAgentFeePercent * mc.estateAgentVatMultiplier);
      sellingLegalFees = mc.sellingLegalFees;
    }

    var purchaseLegalFees = mc.purchaseLegalFees;
    var surveyCost = mc.surveyCost;

    return {
      mortgageAmount: mortgageAmount,
      ltvPercent: ltvPercent,
      depositPercent: depositPercent,
      monthlyPayment: monthlyPayment,
      stampDuty: stampDuty,
      estateAgentFees: estateAgentFees,
      sellingLegalFees: sellingLegalFees,
      purchaseLegalFees: purchaseLegalFees,
      surveyCost: surveyCost,
      totalCosts: stampDuty + estateAgentFees + sellingLegalFees + purchaseLegalFees + surveyCost,
      rate: rate,
      termYears: termYears
    };
  }

  global.BMSCalcs = {
    parseFormattedNumber: parseFormattedNumber,
    formatCurrency: formatCurrency,
    calculateNetPay: calculateNetPay,
    calculateMonthlyRepayment: calculateMonthlyRepayment,
    calculateMaxMortgageFromPayment: calculateMaxMortgageFromPayment,
    calculateStampDuty: calculateStampDuty,
    computeAffordability: computeAffordability,
    computeMovingCosts: computeMovingCosts
  };
})(window);
