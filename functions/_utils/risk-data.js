/**
 * Risk Probability Data
 *
 * Provides statistical probabilities for death, critical illness, and long-term absence
 * during a typical 25-year mortgage term, segmented by age and smoking status.
 *
 * All probability data and category thresholds are loaded from data/risk_tables.json.
 * See MAINTENANCE.md for sources and update schedule.
 */

const riskConfig = require('../../data/risk_tables.json');

// Build lookup table by bracket name (once at module load)
const riskProbabilities = {};
riskConfig.ageBrackets.forEach(function(bracket) {
  riskProbabilities[bracket.bracket] = {
    death: bracket.death,
    criticalIllness: bracket.criticalIllness,
    longTermAbsence: bracket.longTermAbsence
  };
});

/**
 * Calculate risk probabilities based on age and smoking status
 * @param {number} age - User's age (18-70)
 * @param {boolean} isSmoker - Whether user is a smoker
 * @returns {Object} Risk probabilities {death, criticalIllness, longTermAbsence}
 */
function calculateRiskProbabilities(age, isSmoker) {
  // Determine age bracket from config
  var bracket = riskConfig.defaultAgeBracket;

  for (var i = 0; i < riskConfig.ageBrackets.length; i++) {
    var b = riskConfig.ageBrackets[i];
    if (age >= b.minAge && age <= b.maxAge) {
      bracket = b.bracket;
      break;
    }
  }

  var data = riskProbabilities[bracket];

  return {
    death: isSmoker ? data.death.smoker : data.death.nonSmoker,
    criticalIllness: isSmoker ? data.criticalIllness.smoker : data.criticalIllness.nonSmoker,
    longTermAbsence: data.longTermAbsence,
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
  var thresholds = riskConfig.riskCategoryThresholds[type] || riskConfig.riskCategoryThresholds.death;

  if (probability < thresholds.low.below) {
    return { level: 'low', color: thresholds.low.colour, label: thresholds.low.label };
  } else if (probability < thresholds.medium.below) {
    return { level: 'medium', color: thresholds.medium.colour, label: thresholds.medium.label };
  } else if (probability < thresholds.high.below) {
    return { level: 'high', color: thresholds.high.colour, label: thresholds.high.label };
  } else {
    return { level: 'very-high', color: thresholds.veryHigh.colour, label: thresholds.veryHigh.label };
  }
}

/**
 * Format risk probability for display
 * @param {number} probability - Raw probability percentage
 * @returns {string} Formatted string (e.g., "1.5%" or "15%")
 */
function formatRiskProbability(probability) {
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
  var probabilities = calculateRiskProbabilities(age, isSmoker);

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
    summary: `Based on your age (${age}) and smoking status (${probabilities.smokingStatus}), during a typical ${riskConfig.mortgageTermYears}-year mortgage term, statistical data suggests:`
  };
}

module.exports = {
  riskProbabilities,
  calculateRiskProbabilities,
  getRiskCategory,
  formatRiskProbability,
  getCompleteRiskAssessment
};
