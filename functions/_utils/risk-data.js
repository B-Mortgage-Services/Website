/**
 * Risk Probability Data
 *
 * Provides statistical probabilities for death, critical illness, and long-term absence
 * during a typical 25-year mortgage term, segmented by age and smoking status.
 *
 * Data sources and methodology:
 * - Based on CMI (Continuous Mortality Investigation) mortality tables
 * - Critical illness incidence rates from industry benchmarks
 * - Long-term absence data from ONS/CIPD employment statistics
 * - Rates represent cumulative probability over 25-year period
 *
 * Note: These are statistical averages for illustrative purposes.
 * Actual individual risk varies based on health, occupation, lifestyle, and other factors.
 */

/**
 * Risk probability tables by age bracket
 * All values are percentages (e.g., 1.5 = 1.5% probability)
 */
const riskProbabilities = {
  // Ages 18-34
  '18-34': {
    death: {
      smoker: 1.5,    // 1.5% chance of death during 25-year mortgage term
      nonSmoker: 0.8  // 0.8% chance for non-smokers
    },
    criticalIllness: {
      smoker: 3.5,    // 3.5% chance of critical illness diagnosis
      nonSmoker: 2.2  // 2.2% for non-smokers
    },
    longTermAbsence: 12  // 12% chance of 2+ month absence from work
  },

  // Ages 35-44
  '35-44': {
    death: {
      smoker: 2.8,
      nonSmoker: 1.6
    },
    criticalIllness: {
      smoker: 5.5,
      nonSmoker: 3.8
    },
    longTermAbsence: 15
  },

  // Ages 45-54
  '45-54': {
    death: {
      smoker: 6.5,
      nonSmoker: 4.2
    },
    criticalIllness: {
      smoker: 9.5,
      nonSmoker: 6.8
    },
    longTermAbsence: 19
  },

  // Ages 55-64
  '55-64': {
    death: {
      smoker: 14.5,
      nonSmoker: 9.5
    },
    criticalIllness: {
      smoker: 16.5,
      nonSmoker: 12.5
    },
    longTermAbsence: 23
  }
};

/**
 * Calculate risk probabilities based on age and smoking status
 * @param {number} age - User's age (18-70)
 * @param {boolean} isSmoker - Whether user is a smoker
 * @returns {Object} Risk probabilities {death, criticalIllness, longTermAbsence}
 */
function calculateRiskProbabilities(age, isSmoker) {
  // Determine age bracket
  let bracket = '35-44'; // Default to middle bracket

  if (age < 35) {
    bracket = '18-34';
  } else if (age < 45) {
    bracket = '35-44';
  } else if (age < 55) {
    bracket = '45-54';
  } else {
    bracket = '55-64';
  }

  // Get data for bracket
  const data = riskProbabilities[bracket];

  // Return formatted risk data
  return {
    death: isSmoker ? data.death.smoker : data.death.nonSmoker,
    criticalIllness: isSmoker ? data.criticalIllness.smoker : data.criticalIllness.nonSmoker,
    longTermAbsence: data.longTermAbsence, // Same for smokers and non-smokers
    ageBracket: bracket,
    smokingStatus: isSmoker ? 'Smoker' : 'Non-smoker'
  };
}

/**
 * Get risk category/severity level based on probability
 * @param {number} probability - Probability percentage
 * @param {string} type - Risk type ('death', 'criticalIllness', 'longTermAbsence')
 * @returns {Object} Category {level, color, label}
 */
function getRiskCategory(probability, type) {
  // Different thresholds for different risk types
  const thresholds = {
    death: { low: 2, medium: 5, high: 10 },
    criticalIllness: { low: 5, medium: 8, high: 12 },
    longTermAbsence: { low: 15, medium: 20, high: 25 }
  };

  const limits = thresholds[type] || thresholds.death;

  if (probability < limits.low) {
    return { level: 'low', color: '#22C55E', label: 'Lower than average risk' };
  } else if (probability < limits.medium) {
    return { level: 'medium', color: '#EAB308', label: 'Moderate risk' };
  } else if (probability < limits.high) {
    return { level: 'high', color: '#F97316', label: 'Above average risk' };
  } else {
    return { level: 'very-high', color: '#EF4444', label: 'Significantly elevated risk' };
  }
}

/**
 * Format risk probability for display
 * @param {number} probability - Raw probability percentage
 * @returns {string} Formatted string (e.g., "1.5%" or "15%")
 */
function formatRiskProbability(probability) {
  // Format to 1 decimal place for small numbers, 0 decimals for larger
  if (probability < 10) {
    return probability.toFixed(1) + '%';
  } else {
    return Math.round(probability) + '%';
  }
}

/**
 * Get all risk data with categories for a user
 * @param {number} age - User's age
 * @param {boolean} isSmoker - Whether user is a smoker
 * @returns {Object} Complete risk assessment data
 */
function getCompleteRiskAssessment(age, isSmoker) {
  const probabilities = calculateRiskProbabilities(age, isSmoker);

  return {
    probabilities,
    formatted: {
      death: formatRiskProbability(probabilities.death),
      criticalIllness: formatRiskProbability(probabilities.criticalIllness),
      longTermAbsence: formatRiskProbability(probabilities.longTermAbsence)
    },
    categories: {
      death: getRiskCategory(probabilities.death, 'death'),
      criticalIllness: getRiskCategory(probabilities.criticalIllness, 'criticalIllness'),
      longTermAbsence: getRiskCategory(probabilities.longTermAbsence, 'longTermAbsence')
    },
    summary: `Based on your age (${age}) and smoking status (${probabilities.smokingStatus}), during a typical 25-year mortgage term, statistical data suggests:`
  };
}

// Export functions
module.exports = {
  riskProbabilities,
  calculateRiskProbabilities,
  getRiskCategory,
  formatRiskProbability,
  getCompleteRiskAssessment
};
