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
 * All scoring weights, thresholds, and benefit rates are loaded from JSON config
 * files in data/ — see MAINTENANCE.md for the full variable reference.
 *
 * Enhanced features:
 * - Financial runway calculation (deadline to breadline)
 * - Perception gap analysis
 * - Income waterfall projection
 * - Risk probability assessment
 */

const riskData = require('./risk-data');

// ========== CONFIGURATION FROM JSON ==========
const scoringConfig = require('../../data/scoring.json');
const annualRates = require('../../data/annual_rates.json');
const benchmarksConfig = require('../../data/benchmarks.json');

// Build lookup maps from config (once at module load)
const employmentScoreMap = Object.fromEntries(
  Object.entries(scoringConfig.employmentScoring.tiers).map(function(entry) { return [entry[0], entry[1].points]; })
);
const creditScoreMap = Object.fromEntries(
  Object.entries(scoringConfig.creditScoring.tiers).map(function(entry) { return [entry[0], entry[1].points]; })
);
const surplusScoreMap = Object.fromEntries(
  Object.entries(scoringConfig.surplusScoring.tiers).map(function(entry) { return [entry[0], entry[1].points]; })
);
const emergencyDropdownMap = Object.fromEntries(
  Object.entries(scoringConfig.emergencyFundScoring.tiersByDropdown).map(function(entry) { return [entry[0], entry[1].points]; })
);
const protectionScoreMap = Object.fromEntries(
  Object.entries(scoringConfig.protectionScoring.tiers).map(function(entry) { return [entry[0], entry[1].points]; })
);

// Build UK_BENCHMARKS from annual_rates.json + benchmarks.json (same key names as before)
const UK_BENCHMARKS = {
  averageDeadlineDays: benchmarksConfig.ukAverages.deadlineToBreadlineDays,
  averageSavings: benchmarksConfig.ukAverages.averageSavings,
  averageDebt: benchmarksConfig.ukAverages.averageDebt,
  targetDeadlineDays: benchmarksConfig.runwayTargets.targetDays,
  sspWeekly: annualRates.statutorySickPay.weeklyRate,
  sspMonthly: annualRates.statutorySickPay.monthlyEquivalent,
  sspMaxWeeks: annualRates.statutorySickPay.maxWeeks,
  esaWeeklyAssessment: annualRates.employmentSupportAllowance.assessmentPhase.weeklyRate,
  esaMonthlyAssessment: annualRates.employmentSupportAllowance.assessmentPhase.monthlyEquivalent,
  esaWeeklySupportGroup: annualRates.employmentSupportAllowance.supportGroup.weeklyRate,
  esaMonthlySupportGroup: annualRates.employmentSupportAllowance.supportGroup.monthlyEquivalent,
  esaAssessmentWeeks: annualRates.employmentSupportAllowance.assessmentPhase.durationWeeks,
  ucSingle: annualRates.universalCredit.singleOver25,
  ucCouple: annualRates.universalCredit.coupleOneOver25,
  ucLCWRA: annualRates.universalCredit.lcwraElement
};

// ========== HELPER: DATA-DRIVEN TIER LOOKUP ==========

/**
 * Find the matching tier from an ordered array of tier objects.
 * Tiers must be ordered from best to worst, with a `maxRatio`/`maxLtv` key.
 * The last tier should have null as the max value (catch-all).
 */
function findTier(tiers, value, maxKey) {
  for (var i = 0; i < tiers.length; i++) {
    if (tiers[i][maxKey] === null || value < tiers[i][maxKey]) {
      return tiers[i];
    }
  }
  return tiers[tiers.length - 1];
}

/**
 * Find deposit/LTV tier (uses <= comparison since LTV thresholds are inclusive)
 */
function findLtvTier(tiers, ltv) {
  for (var i = 0; i < tiers.length; i++) {
    if (tiers[i].maxLtv === null || ltv <= tiers[i].maxLtv) {
      return tiers[i];
    }
  }
  return tiers[tiers.length - 1];
}

// ========== MORTGAGE ELIGIBILITY METRICS ==========

/**
 * Resolve gross annual income from available data sources
 * Priority: 1) Explicit gross annual, 2) Estimate from net monthly
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
    const multiplier = scoringConfig.grossIncomeEstimation.multiplier;
    const estimatedGross = Math.round(monthlyNet * 12 * multiplier);
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
 * @param {number} mortgageAmount - Loan amount (propertyValue - deposit)
 * @param {number} grossAnnualIncome - Total household gross annual income
 * @returns {Object} { ratio, score, tier, description, maxScore, ratioFormatted, fcaCap }
 */
function calculateLTI(mortgageAmount, grossAnnualIncome) {
  const ltiConfig = scoringConfig.ltiScoring;

  if (!grossAnnualIncome || grossAnnualIncome <= 0 || !mortgageAmount || mortgageAmount <= 0) {
    return {
      ratio: null,
      score: null,
      tier: 'unavailable',
      description: 'Insufficient data to calculate LTI',
      maxScore: ltiConfig.maxPoints,
      ratioFormatted: null,
      fcaCap: ltiConfig.fcaCap
    };
  }

  const ratio = mortgageAmount / grossAnnualIncome;
  const matched = findTier(ltiConfig.tiers, ratio, 'maxRatio');

  return {
    ratio: Math.round(ratio * 100) / 100,
    score: matched.points,
    tier: matched.tier,
    description: matched.description,
    maxScore: ltiConfig.maxPoints,
    ratioFormatted: ratio.toFixed(1) + 'x',
    fcaCap: ltiConfig.fcaCap
  };
}

/**
 * Calculate Debt-to-Income ratio and score
 * Uses user's rate for primary DTI, and stress test rate for comparison
 * @param {number} mortgageAmount - Loan amount
 * @param {number} grossMonthlyIncome - Household gross monthly income
 * @param {number} monthlyCommitments - Other monthly debt commitments
 * @param {number} mortgageTerm - Mortgage term in years
 * @param {number} userRate - User's interest rate from calculator
 * @returns {Object} DTI result with ratio, stress-tested ratio, score, and breakdown
 */
function calculateDTI(mortgageAmount, grossMonthlyIncome, monthlyCommitments, mortgageTerm, userRate) {
  const dtiConfig = scoringConfig.dtiScoring;
  const STRESS_RATE = dtiConfig.stressTestRate;
  const DEFAULT_RATE = dtiConfig.defaultRate;
  const DEFAULT_TERM = dtiConfig.defaultTerm;

  // Skip if no income OR no debt data to assess
  if (!grossMonthlyIncome || grossMonthlyIncome <= 0 ||
      ((!mortgageAmount || mortgageAmount <= 0) && (!monthlyCommitments || monthlyCommitments <= 0))) {
    return {
      ratio: null,
      score: null,
      tier: 'unavailable',
      description: 'Insufficient data to calculate DTI',
      maxScore: dtiConfig.maxPoints,
      ratioFormatted: null,
      stressTestedRatio: null,
      stressTestedFormatted: null,
      estimatedMortgagePayment: 0,
      stressTestedPayment: 0,
      monthlyCommitments: 0,
      totalMonthlyDebt: 0,
      rateUsed: 0,
      stressRate: STRESS_RATE,
      termUsed: DEFAULT_TERM
    };
  }

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

  const matched = findTier(dtiConfig.tiers, ratio, 'maxRatio');

  return {
    ratio: Math.round(ratio * 10) / 10,
    score: matched.points,
    tier: matched.tier,
    description: matched.description,
    maxScore: dtiConfig.maxPoints,
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
  const runway = calculateRunway(
    accessibleSavings,
    monthlyEssentials,
    ipMonthlyBenefit,
    ipDeferredPeriod,
    income,     // 'full', 'partial', or 'none'
    employment  // employment type for correct state benefit
  );

  // PILLAR 1: Mortgage Eligibility
  // Employment Status
  const employmentScore = employmentScoreMap[employment] || 0;
  rawScore += employmentScore;
  pillarScores.mortgageEligibility += employmentScore;

  if (employmentScore >= scoringConfig.employmentScoring.strengthThreshold) {
    strengths.push(scoringConfig.employmentScoring.strengthMessage);
  } else {
    improvements.push(scoringConfig.employmentScoring.improvementMessage);
  }

  // Credit History
  const creditScore = creditScoreMap[credit] || 0;
  rawScore += creditScore;
  pillarScores.mortgageEligibility += creditScore;

  if (creditScore >= scoringConfig.creditScoring.strengthThreshold) {
    strengths.push(scoringConfig.creditScoring.strengthMessage);
  } else {
    improvements.push(scoringConfig.creditScoring.improvementMessage);
  }

  // --- LTI & DTI Scoring ---

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
  let maxPossibleScore = scoringConfig.totalMaxScore;

  // LTI Scoring
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
    maxPossibleScore -= scoringConfig.dynamicMaxRules.deductIfNoLTI;
  }

  // DTI Scoring
  const dtiResult = calculateDTI(
    loanAmount,
    totalGrossAnnual / 12,
    parseFloat(totalMonthlyCommitments) || 0,
    parseInt(mortgageTerm) || scoringConfig.dtiScoring.defaultTerm,
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
    maxPossibleScore -= scoringConfig.dynamicMaxRules.deductIfNoDTI;
  }

  // PILLAR 2: Affordability & Budget
  // Deposit/LTV
  const ltvTier = findLtvTier(scoringConfig.depositLtvScoring.tiers, ltv);
  const depositScore = ltvTier.points;
  if (ltvTier.label) {
    if (depositScore >= 8) {
      strengths.push(ltvTier.label);
    } else {
      improvements.push('Deposit size');
    }
  }
  rawScore += depositScore;
  pillarScores.affordabilityBudget += depositScore;

  // Monthly Surplus
  const surplusScore = surplusScoreMap[surplus] || 0;
  rawScore += surplusScore;
  pillarScores.affordabilityBudget += surplusScore;

  if (surplusScore >= scoringConfig.surplusScoring.strengthThreshold) {
    strengths.push(scoringConfig.surplusScoring.strengthMessage);
  } else {
    improvements.push(scoringConfig.surplusScoring.improvementMessage);
  }

  // PILLAR 3: Financial Resilience
  // Emergency Fund Coverage
  let emergencyScore = 0;

  if (emergency) {
    // Use old dropdown value if provided (backward compatibility)
    emergencyScore = emergencyDropdownMap[emergency] || 0;
  } else if (accessibleSavings && monthlyEssentials) {
    // Calculate from runway (enhanced approach)
    const runwayMonths = runway.months;
    const runwayTiers = scoringConfig.emergencyFundScoring.tiersByRunway;
    for (var i = 0; i < runwayTiers.length; i++) {
      if (runwayMonths >= runwayTiers[i].minMonths) {
        emergencyScore = runwayTiers[i].points;
        break;
      }
    }
  }

  rawScore += emergencyScore;
  pillarScores.financialResilience += emergencyScore;

  if (emergencyScore >= scoringConfig.emergencyFundScoring.strengthThreshold) {
    strengths.push(scoringConfig.emergencyFundScoring.strengthMessage);
  } else {
    improvements.push(scoringConfig.emergencyFundScoring.improvementMessage);
  }

  // PILLAR 4: Protection Readiness
  const lifeScore = protectionScoreMap[life] || 0;
  const incomeScore = protectionScoreMap[income] || 0;
  const criticalScore = protectionScoreMap[critical] || 0;
  const protectionTotal = lifeScore + incomeScore + criticalScore;

  rawScore += protectionTotal;
  pillarScores.protectionReadiness += protectionTotal;

  if (protectionTotal >= scoringConfig.protectionScoring.strengthThreshold) {
    strengths.push(scoringConfig.protectionScoring.strengthMessage);
  } else {
    improvements.push(scoringConfig.protectionScoring.improvementMessage);
  }

  // Scale raw score to final score (0-100) using dynamic max
  const finalScore = Math.min(Math.round((rawScore / maxPossibleScore) * 100), 100);

  // Determine score interpretation from config
  let interpretation = '';
  let category = '';
  const scoreCategories = scoringConfig.scoreCategories.tiers;
  for (var j = 0; j < scoreCategories.length; j++) {
    if (finalScore >= scoreCategories[j].minScore) {
      interpretation = scoreCategories[j].interpretation;
      category = scoreCategories[j].category;
      break;
    }
  }

  // Calculate pillar percentages (for visualization)
  const pillar1Max = scoringConfig.pillars.mortgageEligibility.maxPointsWithoutBoth
    + (ltiResult.score !== null ? scoringConfig.ltiScoring.maxPoints : 0)
    + (dtiResult.score !== null ? scoringConfig.dtiScoring.maxPoints : 0);
  const pillarPercentages = {
    mortgageEligibility: Math.round((pillarScores.mortgageEligibility / pillar1Max) * 100),
    affordabilityBudget: Math.round((pillarScores.affordabilityBudget / scoringConfig.pillars.affordabilityBudget.maxPoints) * 100),
    financialResilience: Math.round((pillarScores.financialResilience / scoringConfig.pillars.financialResilience.maxPoints) * 100),
    protectionReadiness: Math.round((pillarScores.protectionReadiness / scoringConfig.pillars.protectionReadiness.maxPoints) * 100)
  };

  // ========== ENHANCED CALCULATIONS ==========

  // Perception Gap
  const perceptionGap = calculatePerceptionGap(perceptionMonths || scoringConfig.perceptionGap.defaultEstimateMonths, runway.days);

  // Income Waterfall
  const hasEmployerSickPayBenefit = employerSickPay === 'yes';
  const sickPayMonths = parseInt(sickPayDuration) || 0;
  const stateBenefit = getStateBenefit(employment);
  const waterfall = generateIncomeWaterfall(
    monthlyIncome,
    sickPayMonths,
    hasEmployerSickPayBenefit,
    ipMonthlyBenefit,
    ipDeferredPeriod,
    income,
    employment,
    monthlyEssentials
  );

  // Risk Probabilities
  const isSmoker = smoker === 'yes';
  const ageVal = parseInt(age) || scoringConfig.defaultAge;
  const riskAssessment = riskData.getCompleteRiskAssessment(ageVal, isSmoker);

  // Combined household income
  const totalHouseholdIncome = (parseFloat(monthlyIncome) || 0) + (parseFloat(partnerIncome) || 0);

  // Employer benefits summary
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
        maxScore: scoringConfig.pillars.mortgageEligibility.components.employment.maxPoints
      },
      credit: {
        value: credit,
        score: creditScore,
        maxScore: scoringConfig.pillars.mortgageEligibility.components.credit.maxPoints
      },
      lti: ltiResult,
      dti: dtiResult,
      deposit: {
        value: depositVal,
        propertyValue: propertyVal,
        ltv: ltv,
        score: depositScore,
        maxScore: scoringConfig.pillars.affordabilityBudget.components.deposit.maxPoints
      },
      surplus: {
        value: surplus,
        score: surplusScore,
        maxScore: scoringConfig.pillars.affordabilityBudget.components.surplus.maxPoints
      },
      emergency: {
        value: emergency,
        score: emergencyScore,
        maxScore: scoringConfig.pillars.financialResilience.components.emergencyFund.maxPoints
      },
      protection: {
        life: { value: life, score: lifeScore },
        income: { value: income, score: incomeScore },
        critical: { value: critical, score: criticalScore },
        totalScore: protectionTotal,
        maxScore: scoringConfig.pillars.protectionReadiness.maxPoints
      }
    },
    strengths: strengths.slice(0, scoringConfig.maxStrengths),
    improvements: improvements.slice(0, scoringConfig.maxImprovements),

    // ========== ENHANCED METRICS ==========
    runway: runway,
    perceptionGap: perceptionGap,
    waterfall: waterfall,
    riskAssessment: riskAssessment,
    household: {
      monthlyIncome: totalHouseholdIncome,
      monthlyEssentials: parseFloat(monthlyEssentials) || 0,
      accessibleSavings: parseFloat(accessibleSavings) || 0,
      monthlySurplus: totalHouseholdIncome - (parseFloat(monthlyEssentials) || 0)
    },
    employerBenefits: employerBenefits,
    stateBenefit: stateBenefit,
    benchmarks: UK_BENCHMARKS,
    mortgageMetrics: {
      lti: ltiResult,
      dti: dtiResult,
      ltv: {
        ratio: ltv,
        formatted: ltv.toFixed(1) + '%',
        tier: findLtvTier(scoringConfig.depositLtvScoring.tiers, ltv).tier
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
 * Determine which state benefit applies based on employment type
 * @param {string} employment - Employment type code
 * @returns {Object} State benefit details
 */
function getStateBenefit(employment) {
  const mapping = benchmarksConfig.stateEmploymentBenefitMapping;
  const isEmployee = mapping.sspEligible.includes(employment);
  const isSelfEmployed = mapping.esaEligible.includes(employment);

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
      maxWeeks: null,
      description: `£${UK_BENCHMARKS.esaWeeklyAssessment}/week (£${UK_BENCHMARKS.esaMonthlyAssessment}/month) during assessment phase, subject to NI contributions`,
      eligible: true,
      note: 'Self-employed are not eligible for SSP. New Style ESA is available if Class 2 NI contributions have been paid.'
    };
  } else {
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
  const runwayTargets = benchmarksConfig.runwayTargets;
  const DAYS_PER_MONTH = runwayTargets.daysPerMonth;

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
  while (remainingSavings > 0 && monthsPassed < runwayTargets.calculationCapMonths) {
    let monthlyIncome = benefitMonthly;

    // Add IP after deferred period
    if (hasIP && monthsPassed >= ipDeferred) {
      monthlyIncome += ipBenefit;
    }

    const monthlyShortfall = essentialsVal - monthlyIncome;

    if (monthlyShortfall <= 0) {
      // Income covers essentials - effectively infinite runway
      return {
        days: runwayTargets.infiniteRunwayDays,
        months: runwayTargets.infiniteRunwayMonths,
        status: 'strong',
        color: benchmarksConfig.runwayStatus.tiers[0].colour,
        vsUKAverage: runwayTargets.infiniteRunwayDays - UK_BENCHMARKS.averageDeadlineDays,
        vsTarget: runwayTargets.infiniteRunwayDays - UK_BENCHMARKS.targetDeadlineDays,
        message: runwayTargets.infiniteRunwayMessage
      };
    }

    remainingSavings -= monthlyShortfall;
    monthsPassed++;
  }

  const days = Math.round(monthsPassed * DAYS_PER_MONTH);
  const months = Math.round(monthsPassed * 10) / 10;

  // Determine status from config tiers (ordered best to worst)
  let status = 'critical';
  let color = benchmarksConfig.runwayStatus.tiers[benchmarksConfig.runwayStatus.tiers.length - 1].colour;
  const statusTiers = benchmarksConfig.runwayStatus.tiers;
  for (var i = 0; i < statusTiers.length; i++) {
    if (days >= statusTiers[i].minDays) {
      status = statusTiers[i].status;
      color = statusTiers[i].colour;
      break;
    }
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
  const DAYS_PER_MONTH = benchmarksConfig.runwayTargets.daysPerMonth;
  const tolerance = scoringConfig.perceptionGap.toleranceDays;
  const estimatedDays = estimatedMonths * DAYS_PER_MONTH;
  const gap = actualDays - estimatedDays;
  const ratio = estimatedDays > 0 ? actualDays / estimatedDays : 0;

  let message = '';
  if (gap > tolerance) {
    message = `You're actually in a better position than you thought — ${Math.round(Math.abs(gap))} days more runway than estimated.`;
  } else if (gap < -tolerance) {
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
 * Generate income waterfall projection
 * @param {number} monthlyIncome - Monthly take-home income
 * @param {number} employerSickPayMonths - Months of full employer sick pay (0-6)
 * @param {boolean} hasEmployerSickPay - Whether employer pays above statutory
 * @param {number} ipMonthlyBenefit - Income protection monthly benefit
 * @param {number} ipDeferredPeriod - Months before IP starts paying
 * @param {string} hasIncomeProtection - 'full', 'partial', or 'none'
 * @param {string} employment - Employment type code
 * @param {number} monthlyEssentials - Monthly essential outgoings for shortfall calc
 * @returns {Array} Waterfall data with cumulative shortfall
 */
function generateIncomeWaterfall(monthlyIncome, employerSickPayMonths, hasEmployerSickPay, ipMonthlyBenefit, ipDeferredPeriod, hasIncomeProtection, employment, monthlyEssentials) {
  const incomeVal = parseFloat(monthlyIncome) || 0;
  const essentials = parseFloat(monthlyEssentials) || 0;
  const waterfall = [];
  const stateBenefit = getStateBenefit(employment);
  const projectionMonths = scoringConfig.incomeWaterfall.projectionMonths;

  const sickPayMonths = hasEmployerSickPay ? (employerSickPayMonths || 0) : 0;

  const ipBenefit = parseFloat(ipMonthlyBenefit) || 0;
  const ipDeferred = parseInt(ipDeferredPeriod) || 0;
  const hasIP = (hasIncomeProtection === 'full' || hasIncomeProtection === 'partial') && ipBenefit > 0;

  let cumulativeShortfall = 0;

  for (let month = 1; month <= projectionMonths; month++) {
    let income = 0;
    let sources = [];

    if (month <= sickPayMonths) {
      income = incomeVal;
      sources.push('Employer sick pay');
    } else {
      income = stateBenefit.monthlyAmount;
      sources.push(stateBenefit.type);

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

  if (!data.employment) errors.push('Employment status is required');
  if (!data.credit) errors.push('Credit history is required');
  if (!data.surplus) errors.push('Monthly surplus information is required');
  if (!data.life) errors.push('Life insurance information is required');
  if (!data.income) errors.push('Income protection information is required');
  if (!data.critical) errors.push('Critical illness cover information is required');

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
