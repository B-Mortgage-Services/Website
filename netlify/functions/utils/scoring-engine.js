/**
 * Scoring Engine for Financial Wellness Check
 *
 * This module contains the proprietary scoring algorithm for B Mortgage Services
 * wellness check. It evaluates mortgage readiness across 4 key pillars:
 *
 * 1. Mortgage Eligibility (35%): Employment + credit + LTI ratio + DTI ratio
 * 2. Affordability & Budget (30%): Deposit/LTV + monthly surplus
 * 3. Financial Resilience (20%): Emergency fund coverage
 * 4. Protection Readiness (15%): Life, income, and critical illness insurance
 *
 * Maximum raw score: 90 points (scaled to 0-100, dynamic max when DTI/LTI unavailable)
 *
 * Enhanced features:
 * - Financial runway calculation (deadline to breadline)
 * - Perception gap analysis
 * - Income waterfall projection (6 months)
 * - Risk probability assessment
 */

const riskData = require('./risk-data');

// ========== MORTGAGE ELIGIBILITY METRICS ==========

/**
 * Resolve gross annual income from available data sources
 * Priority: 1) Explicit gross annual, 2) Estimate from net monthly (×12 × 1.3)
 * The 1.3 multiplier is conservative — errs toward a worse LTI (safer advice)
 * @param {number} grossAnnual - Explicitly provided gross annual income
 * @param {number} monthlyNet - Net monthly take-home income
 * @returns {Object} { grossAnnual, grossMonthly, source, isEstimated }
 */
function resolveGrossIncome(grossAnnual, monthlyNet) {
  if (grossAnnual && grossAnnual > 0) {
    return {
      grossAnnual: grossAnnual,
      grossMonthly: grossAnnual / 12,
      source: 'provided',
      isEstimated: false
    };
  }

  if (monthlyNet && monthlyNet > 0) {
    const estimatedGross = Math.round(monthlyNet * 12 * 1.3);
    return {
      grossAnnual: estimatedGross,
      grossMonthly: estimatedGross / 12,
      source: 'estimated',
      isEstimated: true
    };
  }

  return {
    grossAnnual: 0,
    grossMonthly: 0,
    source: 'unavailable',
    isEstimated: false
  };
}

/**
 * Calculate Loan-to-Income ratio and score
 * UK FCA/PRA cap: banks must limit >4.5x LTI lending to ~15% of new mortgages
 * @param {number} mortgageAmount - Loan amount (propertyValue - deposit)
 * @param {number} grossAnnualIncome - Total household gross annual income
 * @returns {Object} { ratio, score, tier, description, maxScore, ratioFormatted, fcaCap }
 */
function calculateLTI(mortgageAmount, grossAnnualIncome) {
  if (!grossAnnualIncome || grossAnnualIncome <= 0 || !mortgageAmount || mortgageAmount <= 0) {
    return {
      ratio: null,
      score: null,
      tier: 'unavailable',
      description: 'Insufficient data to calculate LTI',
      maxScore: 10,
      ratioFormatted: null,
      fcaCap: 4.5
    };
  }

  const ratio = mortgageAmount / grossAnnualIncome;
  let score, tier, description;

  if (ratio < 3.5) {
    score = 10; tier = 'excellent';
    description = 'Well within standard lending limits';
  } else if (ratio < 4.0) {
    score = 8; tier = 'good';
    description = 'Comfortable borrowing level for most lenders';
  } else if (ratio < 4.5) {
    score = 6; tier = 'acceptable';
    description = 'Within FCA cap but approaching the limit';
  } else if (ratio < 5.0) {
    score = 3; tier = 'stretched';
    description = 'Above standard FCA cap — specialist lender may be required';
  } else {
    score = 1; tier = 'difficult';
    description = 'Significantly above standard lending multiples';
  }

  return {
    ratio: Math.round(ratio * 100) / 100,
    score,
    tier,
    description,
    maxScore: 10,
    ratioFormatted: ratio.toFixed(1) + 'x',
    fcaCap: 4.5
  };
}

/**
 * Calculate Debt-to-Income ratio and score
 * Uses user's rate for primary DTI, and BoE 6.5% stress test for comparison
 * @param {number} mortgageAmount - Loan amount
 * @param {number} grossMonthlyIncome - Household gross monthly income
 * @param {number} monthlyCommitments - Other monthly debt commitments
 * @param {number} mortgageTerm - Mortgage term in years (default 25)
 * @param {number} userRate - User's interest rate from calculator (default 4.5%)
 * @returns {Object} DTI result with ratio, stress-tested ratio, score, and breakdown
 */
function calculateDTI(mortgageAmount, grossMonthlyIncome, monthlyCommitments, mortgageTerm, userRate) {
  // Skip if no income OR no debt data to assess
  if (!grossMonthlyIncome || grossMonthlyIncome <= 0 ||
      ((!mortgageAmount || mortgageAmount <= 0) && (!monthlyCommitments || monthlyCommitments <= 0))) {
    return {
      ratio: null,
      score: null,
      tier: 'unavailable',
      description: 'Insufficient data to calculate DTI',
      maxScore: 8,
      ratioFormatted: null,
      stressTestedRatio: null,
      stressTestedFormatted: null,
      estimatedMortgagePayment: 0,
      stressTestedPayment: 0,
      monthlyCommitments: 0,
      totalMonthlyDebt: 0,
      rateUsed: 0,
      stressRate: 6.5,
      termUsed: 25
    };
  }

  const STRESS_RATE = 6.5;
  const DEFAULT_RATE = 4.5;
  const DEFAULT_TERM = 25;
  const rate = userRate && userRate > 0 ? userRate : DEFAULT_RATE;
  const term = mortgageTerm || DEFAULT_TERM;
  const commitments = monthlyCommitments || 0;

  // Calculate monthly mortgage payment at user's rate
  let estimatedMortgagePayment = 0;
  let stressTestedPayment = 0;
  if (mortgageAmount && mortgageAmount > 0) {
    const monthlyRate = rate / 100 / 12;
    const numPayments = term * 12;
    estimatedMortgagePayment = mortgageAmount *
      (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
      (Math.pow(1 + monthlyRate, numPayments) - 1);

    // Also calculate at stress test rate
    const stressMonthlyRate = STRESS_RATE / 100 / 12;
    stressTestedPayment = mortgageAmount *
      (stressMonthlyRate * Math.pow(1 + stressMonthlyRate, numPayments)) /
      (Math.pow(1 + stressMonthlyRate, numPayments) - 1);
  }

  const totalMonthlyDebt = estimatedMortgagePayment + commitments;
  const ratio = (totalMonthlyDebt / grossMonthlyIncome) * 100;

  const stressTotalDebt = stressTestedPayment + commitments;
  const stressTestedRatio = (stressTotalDebt / grossMonthlyIncome) * 100;

  let score, tier, description;

  if (ratio < 25) {
    score = 8; tier = 'excellent';
    description = 'Very comfortable debt servicing capacity';
  } else if (ratio < 35) {
    score = 6; tier = 'good';
    description = 'Within standard lender comfort zone';
  } else if (ratio < 45) {
    score = 3; tier = 'stretched';
    description = 'Approaching lender limits — some flexibility concerns';
  } else {
    score = 1; tier = 'high';
    description = 'Above typical lender thresholds — may restrict options';
  }

  return {
    ratio: Math.round(ratio * 10) / 10,
    score,
    tier,
    description,
    maxScore: 8,
    ratioFormatted: ratio.toFixed(1) + '%',
    stressTestedRatio: Math.round(stressTestedRatio * 10) / 10,
    stressTestedFormatted: stressTestedRatio.toFixed(1) + '%',
    estimatedMortgagePayment: Math.round(estimatedMortgagePayment),
    stressTestedPayment: Math.round(stressTestedPayment),
    monthlyCommitments: Math.round(commitments),
    totalMonthlyDebt: Math.round(totalMonthlyDebt),
    rateUsed: rate,
    stressRate: STRESS_RATE,
    termUsed: term
  };
}

/**
 * Calculate wellness score from user input data
 * @param {Object} data - User's wellness check data
 * @returns {Object} Scoring result with breakdown, strengths, and improvements
 */
function calculate(data) {
  const {
    employment,
    credit,
    propertyValue = 0,
    deposit = 0,
    surplus,
    emergency,
    life,
    income,
    critical,
    // Enhanced fields
    age,
    smoker,
    monthlyIncome,
    partnerIncome,
    accessibleSavings,
    monthlyEssentials,
    perceptionMonths,
    employerSickPay,
    sickPayDuration,
    employerDeathInService,
    // Income protection details
    ipMonthlyBenefit,
    ipDeferredPeriod,
    ipBenefitPeriod,
    // Mortgage eligibility metrics (DTI/LTI)
    grossAnnualIncome,
    partnerGrossAnnualIncome,
    totalMonthlyCommitments,
    mortgageTerm,
    interestRate,
    mortgageAmount
  } = data;

  let rawScore = 0;
  const pillarScores = {
    mortgageEligibility: 0,
    affordabilityBudget: 0,
    financialResilience: 0,
    protectionReadiness: 0
  };

  const strengths = [];
  const improvements = [];

  // Parse property and deposit values early (used by both Pillar 1 DTI/LTI and Pillar 2 LTV)
  const propertyVal = parseFloat(propertyValue) || 0;
  const depositVal = parseFloat(deposit) || 0;
  const ltv = propertyVal > 0 ? ((propertyVal - depositVal) / propertyVal) * 100 : 100;

  // Calculate runway early for use in Financial Resilience pillar scoring
  // Now accounts for SSP and Income Protection
  const runway = calculateRunway(
    accessibleSavings,
    monthlyEssentials,
    ipMonthlyBenefit,
    ipDeferredPeriod,
    income,     // 'full', 'partial', or 'none'
    employment  // employment type for correct state benefit
  );

  // PILLAR 1: Mortgage Eligibility (35% - max 35 points with DTI/LTI, 17 without)
  // Employment Status (max 10 points)
  const employmentScores = {
    'paye-12': 10,
    'paye-under': 8,
    'self-2': 8,
    'self-under': 4,
    'contractor': 7,
    'irregular': 3
  };
  const employmentScore = employmentScores[employment] || 0;
  rawScore += employmentScore;
  pillarScores.mortgageEligibility += employmentScore;

  if (employmentScore >= 8) {
    strengths.push('Stable income');
  } else {
    improvements.push('Employment stability');
  }

  // Credit History (max 7 points)
  const creditScores = {
    'clean': 7,
    'minor': 5,
    'recent': 2,
    'severe': 1
  };
  const creditScore = creditScores[credit] || 0;
  rawScore += creditScore;
  pillarScores.mortgageEligibility += creditScore;

  if (creditScore >= 5) {
    strengths.push('Good credit profile');
  } else {
    improvements.push('Credit history');
  }

  // --- LTI & DTI Scoring (max 10 + 8 = 18 points) ---

  // Resolve gross income (explicit > estimated from net > unavailable)
  const incomeResolution = resolveGrossIncome(
    parseFloat(grossAnnualIncome) || 0,
    parseFloat(monthlyIncome) || 0
  );

  let totalGrossAnnual = incomeResolution.grossAnnual;
  let partnerGrossResolution = null;
  if (parseFloat(partnerGrossAnnualIncome) > 0 || parseFloat(partnerIncome) > 0) {
    partnerGrossResolution = resolveGrossIncome(
      parseFloat(partnerGrossAnnualIncome) || 0,
      parseFloat(partnerIncome) || 0
    );
    totalGrossAnnual += partnerGrossResolution.grossAnnual;
  }

  // Derive mortgage/loan amount
  const loanAmount = (parseFloat(mortgageAmount) > 0)
    ? parseFloat(mortgageAmount)
    : Math.max(0, propertyVal - depositVal);

  // Track dynamic max score (adjusts when DTI/LTI data unavailable)
  let maxPossibleScore = 90; // 35 + 30 + 10 + 15

  // LTI Scoring (max 10 points)
  const ltiResult = calculateLTI(loanAmount, totalGrossAnnual);
  if (ltiResult.score !== null) {
    rawScore += ltiResult.score;
    pillarScores.mortgageEligibility += ltiResult.score;
    if (ltiResult.score >= 8) {
      strengths.push('Healthy loan-to-income ratio');
    } else if (ltiResult.score <= 3) {
      improvements.push('Loan-to-income ratio');
    }
  } else {
    maxPossibleScore -= 10;
  }

  // DTI Scoring (max 8 points)
  const dtiResult = calculateDTI(
    loanAmount,
    totalGrossAnnual / 12,
    parseFloat(totalMonthlyCommitments) || 0,
    parseInt(mortgageTerm) || 25,
    parseFloat(interestRate) || 0
  );
  if (dtiResult.score !== null) {
    rawScore += dtiResult.score;
    pillarScores.mortgageEligibility += dtiResult.score;
    if (dtiResult.score >= 6) {
      strengths.push('Comfortable debt-to-income ratio');
    } else if (dtiResult.score <= 3) {
      improvements.push('Debt-to-income ratio');
    }
  } else {
    maxPossibleScore -= 8;
  }

  // PILLAR 2: Affordability & Budget (30% - max 30 points)
  // Deposit/LTV (max 10 points) — propertyVal, depositVal, ltv already parsed above
  let depositScore = 0;
  if (ltv <= 75) {
    depositScore = 10;
    strengths.push('Strong deposit');
  } else if (ltv <= 85) {
    depositScore = 8;
    strengths.push('Solid deposit');
  } else if (ltv <= 90) {
    depositScore = 6;
    improvements.push('Deposit size');
  } else {
    depositScore = 3;
    improvements.push('Deposit size');
  }
  rawScore += depositScore;
  pillarScores.affordabilityBudget += depositScore;

  // Monthly Surplus (max 20 points)
  const surplusScores = {
    'surplus': 20,
    'breakeven': 12,
    'occasional': 6,
    'reliant': 0
  };
  const surplusScore = surplusScores[surplus] || 0;
  rawScore += surplusScore;
  pillarScores.affordabilityBudget += surplusScore;

  if (surplusScore >= 12) {
    strengths.push('Good budget control');
  } else {
    improvements.push('Monthly budget');
  }

  // PILLAR 3: Financial Resilience (20% - max 10 points)
  // Emergency Fund Coverage (max 10 points)
  let emergencyScore = 0;

  if (emergency) {
    // Use old dropdown value if provided (backward compatibility)
    const emergencyScores = {
      '6plus': 10,
      '3-6': 7,
      '1-3': 4,
      'under1': 0
    };
    emergencyScore = emergencyScores[emergency] || 0;
  } else if (accessibleSavings && monthlyEssentials) {
    // Calculate from runway (new enhanced approach)
    // runway is already calculated at top of function
    const runwayMonths = runway.months;

    if (runwayMonths >= 6) {
      emergencyScore = 10;  // 6+ months
    } else if (runwayMonths >= 3) {
      emergencyScore = 7;   // 3-6 months
    } else if (runwayMonths >= 1) {
      emergencyScore = 4;   // 1-3 months
    } else {
      emergencyScore = 0;   // Under 1 month
    }
  }

  rawScore += emergencyScore;
  pillarScores.financialResilience += emergencyScore;

  if (emergencyScore >= 7) {
    strengths.push('Emergency savings');
  } else {
    improvements.push('Emergency fund');
  }

  // PILLAR 4: Protection Readiness (15% - max 15 points)
  // Life, Income, and Critical Illness Insurance (max 5 points each)
  const protectionScores = {
    'full': 5,
    'partial': 3,
    'none': 0
  };

  const lifeScore = protectionScores[life] || 0;
  const incomeScore = protectionScores[income] || 0;
  const criticalScore = protectionScores[critical] || 0;
  const protectionTotal = lifeScore + incomeScore + criticalScore;

  rawScore += protectionTotal;
  pillarScores.protectionReadiness += protectionTotal;

  if (protectionTotal >= 10) {
    strengths.push('Good protection');
  } else {
    improvements.push('Income protection');
  }

  // Scale raw score to final score (0-100) using dynamic max
  const finalScore = Math.min(Math.round((rawScore / maxPossibleScore) * 100), 100);

  // Determine score interpretation
  let interpretation = '';
  let category = '';
  if (finalScore >= 80) {
    interpretation = 'You appear to be in a strong position for a mortgage application.';
    category = 'Mortgage-Ready & Financially Resilient';
  } else if (finalScore >= 65) {
    interpretation = "You're broadly on track, with a few areas to focus on.";
    category = 'On Track with Minor Improvements';
  } else if (finalScore >= 50) {
    interpretation = 'A mortgage may be achievable with some planning and improvements.';
    category = 'Mortgage Possible with Planning';
  } else {
    interpretation = 'Some focused steps could significantly improve your position.';
    category = 'Preparation Recommended';
  }

  // Calculate pillar percentages (for visualization)
  // Pillar 1 max is dynamic: 17 (employment + credit) + 10 (LTI if available) + 8 (DTI if available)
  const pillar1Max = 17 + (ltiResult.score !== null ? 10 : 0) + (dtiResult.score !== null ? 8 : 0);
  const pillarPercentages = {
    mortgageEligibility: Math.round((pillarScores.mortgageEligibility / pillar1Max) * 100),
    affordabilityBudget: Math.round((pillarScores.affordabilityBudget / 30) * 100),
    financialResilience: Math.round((pillarScores.financialResilience / 10) * 100),
    protectionReadiness: Math.round((pillarScores.protectionReadiness / 15) * 100)
  };

  // ========== ENHANCED CALCULATIONS ==========

  // 1. Financial Runway (Deadline to Breadline)
  // Already calculated earlier for use in resilience scoring

  // 2. Perception Gap
  const perceptionGap = calculatePerceptionGap(perceptionMonths || 3, runway.days);

  // 3. Income Waterfall (6-month projection)
  const hasEmployerSickPayBenefit = employerSickPay === 'yes';
  const sickPayMonths = parseInt(sickPayDuration) || 0;
  const stateBenefit = getStateBenefit(employment);
  const waterfall = generateIncomeWaterfall(
    monthlyIncome,
    sickPayMonths,
    hasEmployerSickPayBenefit,
    ipMonthlyBenefit,
    ipDeferredPeriod,
    income,              // 'full', 'partial', or 'none'
    employment,          // employment type for correct state benefit
    monthlyEssentials    // for cumulative shortfall calculation
  );

  // 4. Risk Probabilities
  const isSmoker = smoker === 'yes';
  const ageVal = parseInt(age) || 35; // Default to 35 if not provided
  const riskAssessment = riskData.getCompleteRiskAssessment(ageVal, isSmoker);

  // 5. Combined household income
  const totalHouseholdIncome = (parseFloat(monthlyIncome) || 0) + (parseFloat(partnerIncome) || 0);

  // 6. Employer benefits summary
  const employerBenefits = {
    sickPay: {
      exists: hasEmployerSickPayBenefit,
      duration: sickPayMonths,
      description: hasEmployerSickPayBenefit
        ? `Full pay for ${sickPayMonths} month${sickPayMonths !== 1 ? 's' : ''}`
        : `${stateBenefit.type} only`
    },
    deathInService: {
      exists: employerDeathInService === 'yes',
      description: employerDeathInService === 'yes' ? 'Available' : 'Not available'
    }
  };

  return {
    score: finalScore,
    rawScore: rawScore,
    category: category,
    interpretation: interpretation,
    pillarScores: pillarScores,
    pillarPercentages: pillarPercentages,
    breakdown: {
      employment: {
        value: employment,
        score: employmentScore,
        maxScore: 10
      },
      credit: {
        value: credit,
        score: creditScore,
        maxScore: 7
      },
      lti: ltiResult,
      dti: dtiResult,
      deposit: {
        value: depositVal,
        propertyValue: propertyVal,
        ltv: ltv,
        score: depositScore,
        maxScore: 10
      },
      surplus: {
        value: surplus,
        score: surplusScore,
        maxScore: 20
      },
      emergency: {
        value: emergency,
        score: emergencyScore,
        maxScore: 10
      },
      protection: {
        life: { value: life, score: lifeScore },
        income: { value: income, score: incomeScore },
        critical: { value: critical, score: criticalScore },
        totalScore: protectionTotal,
        maxScore: 15
      }
    },
    strengths: strengths.slice(0, 4),
    improvements: improvements.slice(0, 4),

    // ========== ENHANCED METRICS ==========

    // Financial runway
    runway: runway,

    // Perception gap analysis
    perceptionGap: perceptionGap,

    // Income waterfall (6-month projection)
    waterfall: waterfall,

    // Risk probabilities
    riskAssessment: riskAssessment,

    // Household financials
    household: {
      monthlyIncome: totalHouseholdIncome,
      monthlyEssentials: parseFloat(monthlyEssentials) || 0,
      accessibleSavings: parseFloat(accessibleSavings) || 0,
      monthlySurplus: totalHouseholdIncome - (parseFloat(monthlyEssentials) || 0)
    },

    // Employer benefits
    employerBenefits: employerBenefits,

    // State benefit details (SSP for employed, ESA for self-employed)
    stateBenefit: stateBenefit,

    // UK benchmarks for comparison
    benchmarks: UK_BENCHMARKS,

    // Mortgage eligibility metrics (DTI, LTI, LTV dashboard)
    mortgageMetrics: {
      lti: ltiResult,
      dti: dtiResult,
      ltv: {
        ratio: ltv,
        formatted: ltv.toFixed(1) + '%',
        tier: ltv <= 75 ? 'excellent' : ltv <= 85 ? 'good' : ltv <= 90 ? 'acceptable' : 'stretched'
      },
      grossIncome: {
        total: totalGrossAnnual,
        applicant1: incomeResolution,
        applicant2: partnerGrossResolution,
        isEstimated: incomeResolution.isEstimated || (partnerGrossResolution && partnerGrossResolution.isEstimated)
      },
      loanAmount: loanAmount,
      maxPossibleScore: maxPossibleScore
    }
  };
}

/**
 * UK Average Benchmarks for comparison
 *
 * MAINTENANCE: Review and update these values every 6 months
 * Last updated: February 2026
 *
 * Data sources:
 * - L&G Deadline to Breadline: https://www.legalandgeneral.com/adviser/protection/knowledge-hub/research-insights/deadline-to-breadline/
 * - SSP rates: https://www.gov.uk/statutory-sick-pay
 * - UC rates: https://www.gov.uk/universal-credit/what-youll-get
 * - Savings/debt: Money & Pensions Service, ONS Wealth surveys
 */
const UK_BENCHMARKS = {
  averageDeadlineDays: 19,        // L&G Deadline to Breadline 2022
  averageSavings: 2431,           // Money & Pensions Service 2023
  averageDebt: 610,               // Excluding mortgages
  targetDeadlineDays: 90,         // 3 months (recommended minimum)
  // Statutory Sick Pay (April 2026) - PAYE employees only
  sspWeekly: 123.25,              // £123.25/week or 80% of AWE, whichever lower
  sspMonthly: 535,                // SSP monthly equivalent (123.25 * 52 / 12)
  sspMaxWeeks: 28,                // Maximum 28 weeks
  // New Style ESA (April 2025/26) - Both employed and self-employed (if NIC paid)
  esaWeeklyAssessment: 92.05,     // Assessment phase (first 13 weeks), age 25+
  esaMonthlyAssessment: 399,      // Monthly equivalent (92.05 * 52 / 12)
  esaWeeklySupportGroup: 140.55,  // Support group (basic + component)
  esaMonthlySupportGroup: 609,    // Monthly equivalent
  esaAssessmentWeeks: 13,         // Assessment phase duration
  // Universal Credit (April 2025/26) - Means-tested, both employed and self-employed
  ucSingle: 400,                  // Single 25+ standard allowance monthly
  ucCouple: 628,                  // Joint claimants (one 25+) monthly
  ucLCWRA: 423                    // Limited capability for work-related activity element
};

/**
 * Determine which state benefit applies based on employment type
 * - PAYE employees: SSP (£535/month for up to 28 weeks)
 * - Self-employed: No SSP. New Style ESA if NIC contributions paid (£399/month assessment phase)
 * - Contractors: Depends on engagement - assume PAYE-like
 * - Irregular: Conservative assumption - ESA rate
 * @param {string} employment - Employment type code
 * @returns {Object} State benefit details
 */
function getStateBenefit(employment) {
  const isEmployee = ['paye-12', 'paye-under', 'contractor'].includes(employment);
  const isSelfEmployed = ['self-2', 'self-under'].includes(employment);

  if (isEmployee) {
    return {
      type: 'SSP',
      monthlyAmount: UK_BENCHMARKS.sspMonthly,
      label: 'Statutory Sick Pay (SSP)',
      maxWeeks: UK_BENCHMARKS.sspMaxWeeks,
      description: `£${UK_BENCHMARKS.sspWeekly}/week (£${UK_BENCHMARKS.sspMonthly}/month) for up to ${UK_BENCHMARKS.sspMaxWeeks} weeks`,
      eligible: true
    };
  } else if (isSelfEmployed) {
    return {
      type: 'ESA',
      monthlyAmount: UK_BENCHMARKS.esaMonthlyAssessment,
      label: 'New Style ESA (estimated)',
      maxWeeks: null, // Can continue beyond 365 days if in support group
      description: `£${UK_BENCHMARKS.esaWeeklyAssessment}/week (£${UK_BENCHMARKS.esaMonthlyAssessment}/month) during assessment phase, subject to NI contributions`,
      eligible: true,
      note: 'Self-employed are not eligible for SSP. New Style ESA is available if Class 2 NI contributions have been paid.'
    };
  } else {
    // Irregular/unknown - use ESA as conservative estimate
    return {
      type: 'ESA',
      monthlyAmount: UK_BENCHMARKS.esaMonthlyAssessment,
      label: 'New Style ESA (estimated)',
      maxWeeks: null,
      description: `£${UK_BENCHMARKS.esaWeeklyAssessment}/week (£${UK_BENCHMARKS.esaMonthlyAssessment}/month) subject to NI contributions`,
      eligible: true,
      note: 'Eligibility depends on your National Insurance contribution record.'
    };
  }
}

/**
 * Calculate financial runway (deadline to breadline)
 * Accounts for state benefits (SSP or ESA depending on employment type) and Income Protection
 * @param {number} savings - Accessible savings amount
 * @param {number} monthlyEssentials - Monthly essential outgoings
 * @param {number} ipMonthlyBenefit - Income protection monthly benefit
 * @param {number} ipDeferredPeriod - Months before IP starts
 * @param {string} hasIncomeProtection - 'full', 'partial', or 'none'
 * @param {string} employment - Employment type code
 * @returns {Object} Runway calculation result
 */
function calculateRunway(savings, monthlyEssentials, ipMonthlyBenefit = 0, ipDeferredPeriod = 0, hasIncomeProtection = 'none', employment = 'paye-12') {
  const savingsVal = parseFloat(savings) || 0;
  const essentialsVal = parseFloat(monthlyEssentials) || 0;

  if (savingsVal <= 0 || essentialsVal <= 0) {
    return {
      days: 0,
      months: 0,
      message: 'Insufficient data to calculate runway'
    };
  }

  const stateBenefit = getStateBenefit(employment);
  const benefitMonthly = stateBenefit.monthlyAmount;
  const ipBenefit = parseFloat(ipMonthlyBenefit) || 0;
  const ipDeferred = parseInt(ipDeferredPeriod) || 0;
  const hasIP = (hasIncomeProtection === 'full' || hasIncomeProtection === 'partial') && ipBenefit > 0;

  let remainingSavings = savingsVal;
  let monthsPassed = 0;

  // Calculate runway month by month
  while (remainingSavings > 0 && monthsPassed < 120) { // Cap at 10 years
    let monthlyIncome = benefitMonthly; // State benefit (SSP for employed, ESA for self-employed)

    // Add IP after deferred period
    if (hasIP && monthsPassed >= ipDeferred) {
      monthlyIncome += ipBenefit;
    }

    // Calculate monthly shortfall (or surplus)
    const monthlyShortfall = essentialsVal - monthlyIncome;

    if (monthlyShortfall <= 0) {
      // Income covers essentials - no savings burn, infinite runway
      return {
        days: 999, // Effectively infinite
        months: 99.9,
        status: 'strong',
        color: '#22C55E',
        vsUKAverage: 999 - UK_BENCHMARKS.averageDeadlineDays,
        vsTarget: 999 - UK_BENCHMARKS.targetDeadlineDays,
        message: 'Income covers essentials - savings not depleted'
      };
    }

    // Burn savings
    remainingSavings -= monthlyShortfall;
    monthsPassed++;
  }

  const days = Math.round(monthsPassed * 30.44);
  const months = Math.round(monthsPassed * 10) / 10;

  // Determine status
  let status = 'critical';
  let color = '#EF4444';
  if (days >= 90) {
    status = 'strong';
    color = '#22C55E';
  } else if (days >= 60) {
    status = 'good';
    color = '#84CC16';
  } else if (days >= 30) {
    status = 'moderate';
    color = '#EAB308';
  }

  return {
    days,
    months,
    status,
    color,
    vsUKAverage: days - UK_BENCHMARKS.averageDeadlineDays,
    vsTarget: days - UK_BENCHMARKS.targetDeadlineDays
  };
}

/**
 * Calculate perception gap
 * @param {number} estimatedMonths - User's estimate in months
 * @param {number} actualDays - Calculated actual days
 * @returns {Object} Perception gap analysis
 */
function calculatePerceptionGap(estimatedMonths, actualDays) {
  const estimatedDays = estimatedMonths * 30.44;
  const gap = actualDays - estimatedDays;
  const ratio = estimatedDays > 0 ? actualDays / estimatedDays : 0;

  let message = '';
  if (gap > 30) {
    message = `You're actually in a better position than you thought — ${Math.round(Math.abs(gap))} days more runway than estimated.`;
  } else if (gap < -30) {
    message = `Your savings would cover less time than you estimated — ${Math.round(Math.abs(gap))} days less than you thought.`;
  } else {
    message = 'Your estimate was quite close to reality.';
  }

  return {
    estimatedDays,
    actualDays,
    gap,
    ratio,
    underestimated: gap > 0,
    message
  };
}

/**
 * Generate 6-month income waterfall
 * Shows income progression based on employment type:
 * - PAYE: Employer sick pay → SSP + Income Protection
 * - Self-employed: No SSP. ESA (if NIC paid) + Income Protection
 * @param {number} monthlyIncome - Monthly take-home income
 * @param {number} employerSickPayMonths - Months of full employer sick pay (0-6)
 * @param {boolean} hasEmployerSickPay - Whether employer pays above statutory
 * @param {number} ipMonthlyBenefit - Income protection monthly benefit (£)
 * @param {number} ipDeferredPeriod - Months before IP starts paying
 * @param {string} hasIncomeProtection - 'full', 'partial', or 'none'
 * @param {string} employment - Employment type code
 * @param {number} monthlyEssentials - Monthly essential outgoings for shortfall calc
 * @returns {Array} 6-month waterfall data with cumulative shortfall
 */
function generateIncomeWaterfall(monthlyIncome, employerSickPayMonths, hasEmployerSickPay, ipMonthlyBenefit, ipDeferredPeriod, hasIncomeProtection, employment, monthlyEssentials) {
  const incomeVal = parseFloat(monthlyIncome) || 0;
  const essentials = parseFloat(monthlyEssentials) || 0;
  const waterfall = [];
  const stateBenefit = getStateBenefit(employment);

  // Default to 0 if no employer sick pay or "not sure"
  const sickPayMonths = hasEmployerSickPay ? (employerSickPayMonths || 0) : 0;

  // Income protection details
  const ipBenefit = parseFloat(ipMonthlyBenefit) || 0;
  const ipDeferred = parseInt(ipDeferredPeriod) || 0;
  const hasIP = (hasIncomeProtection === 'full' || hasIncomeProtection === 'partial') && ipBenefit > 0;

  let cumulativeShortfall = 0;

  for (let month = 1; month <= 6; month++) {
    let income = 0;
    let sources = [];

    if (month <= sickPayMonths) {
      // Period 1: Full employer sick pay
      income = incomeVal;
      sources.push('Employer sick pay');
    } else {
      // Period 2: After employer scheme ends - state benefit kicks in
      income = stateBenefit.monthlyAmount;
      sources.push(stateBenefit.type); // 'SSP' or 'ESA'

      // Add income protection if deferred period has passed
      if (hasIP && month > ipDeferred) {
        income += ipBenefit;
        sources.push('Income Protection');
      }
    }

    const monthlyIncome = Math.round(income);
    const shortfall = Math.max(0, essentials - monthlyIncome);
    cumulativeShortfall += shortfall;

    waterfall.push({
      month,
      income: monthlyIncome,
      source: sources.join(' + '),
      shortfall: Math.round(shortfall),
      cumulativeShortfall: Math.round(cumulativeShortfall)
    });
  }

  return waterfall;
}

/**
 * Validate input data before scoring
 * @param {Object} data - User input data to validate
 * @returns {Object} Validation result with isValid flag and errors array
 */
function validate(data) {
  const errors = [];

  // Required fields (original form fields)
  if (!data.employment) errors.push('Employment status is required');
  if (!data.credit) errors.push('Credit history is required');
  if (!data.surplus) errors.push('Monthly surplus information is required');
  if (!data.life) errors.push('Life insurance information is required');
  if (!data.income) errors.push('Income protection information is required');
  if (!data.critical) errors.push('Critical illness cover information is required');

  // Note: emergency field is no longer required - we now use accessibleSavings + monthlyEssentials
  // for more accurate runway calculation instead of the old emergency fund dropdown

  // Numeric validations
  if (data.propertyValue !== undefined) {
    const propertyVal = parseFloat(data.propertyValue);
    if (isNaN(propertyVal) || propertyVal < 0) {
      errors.push('Property value must be a valid positive number');
    }
  }

  if (data.deposit !== undefined) {
    const depositVal = parseFloat(data.deposit);
    if (isNaN(depositVal) || depositVal < 0) {
      errors.push('Deposit must be a valid positive number');
    }
  }

  // Deposit should not exceed property value
  if (data.propertyValue && data.deposit) {
    const propertyVal = parseFloat(data.propertyValue);
    const depositVal = parseFloat(data.deposit);
    if (depositVal > propertyVal) {
      errors.push('Deposit cannot exceed property value');
    }
  }

  return {
    isValid: errors.length === 0,
    errors: errors
  };
}

module.exports = {
  calculate,
  validate
};
