/**
 * Wellness Calculate Function
 *
 * POST /api/calculate
 *
 * Main API endpoint for wellness check calculation.
 * Accepts form data, runs scoring engine, stores results in Supabase,
 * and returns comprehensive scoring results.
 */

const scoringEngine = require('./utils/scoring-engine');
const supabaseClient = require('./utils/supabase-client');

exports.handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*', // TODO: Restrict to bmortgageservices.co.uk in production
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Only accept POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed. Use POST.' })
    };
  }

  try {
    // Parse request body
    const data = JSON.parse(event.body);

    // Validate input data
    const validation = scoringEngine.validate(data);
    if (!validation.isValid) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Validation failed',
          details: validation.errors
        })
      };
    }

    console.log('Processing wellness check calculation...');

    // Run scoring engine
    const scoringResult = scoringEngine.calculate(data);

    console.log(`Calculated score: ${scoringResult.score}/100`);

    // Save report to Supabase
    const reportId = await supabaseClient.saveReport(scoringResult, data.email || null);

    // Build report URL
    const reportUrl = `${process.env.REPORT_BASE_URL || 'https://bmortgageservices.co.uk/wellness/report/'}${reportId}`;

    // Log analytics (anonymized)
    await supabaseClient.logAnalytics({
      score: scoringResult.score,
      category: scoringResult.category,
      has_email: !!data.email,
      employment_type: data.employment,
      ltv_bracket: getLTVBracket(scoringResult.breakdown.deposit.ltv)
    });

    // TODO: In Phase 3, generate PDF here and upload to Supabase Storage
    // For now, we'll return success without PDF URL

    // Return response
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        reportId: reportId,
        reportUrl: reportUrl,
        score: scoringResult.score,
        category: scoringResult.category,
        interpretation: scoringResult.interpretation,
        pillarPercentages: scoringResult.pillarPercentages,
        strengths: scoringResult.strengths,
        improvements: scoringResult.improvements,
        chartData: {
          radar: {
            labels: [
              'Mortgage Eligibility',
              ['Affordability', '& Budget'],
              'Financial Resilience',
              ['Protection', 'Readiness']
            ],
            userScores: [
              scoringResult.pillarPercentages.mortgageEligibility,
              scoringResult.pillarPercentages.affordabilityBudget,
              scoringResult.pillarPercentages.financialResilience,
              scoringResult.pillarPercentages.protectionReadiness
            ],
            idealScores: [100, 100, 100, 100]
          },
          bars: [
            {
              label: 'Mortgage Eligibility',
              score: scoringResult.pillarPercentages.mortgageEligibility,
              color: '#22C55E'
            },
            {
              label: 'Affordability & Budget',
              score: scoringResult.pillarPercentages.affordabilityBudget,
              color: '#3B82F6'
            },
            {
              label: 'Financial Resilience',
              score: scoringResult.pillarPercentages.financialResilience,
              color: '#F59E0B'
            },
            {
              label: 'Protection Readiness',
              score: scoringResult.pillarPercentages.protectionReadiness,
              color: '#A855F7'
            }
          ]
        },
        // Full breakdown for potential future use
        breakdown: scoringResult.breakdown,

        // ========== ENHANCED METRICS (Week 2) ==========
        runway: scoringResult.runway,
        perceptionGap: scoringResult.perceptionGap,
        waterfall: scoringResult.waterfall,
        riskAssessment: scoringResult.riskAssessment,
        household: scoringResult.household,
        employerBenefits: scoringResult.employerBenefits,
        benchmarks: scoringResult.benchmarks
      })
    };

  } catch (error) {
    console.error('Error in wellness-calculate function:', error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred processing your request'
      })
    };
  }
};

/**
 * Helper function to categorize LTV for analytics
 * @param {number} ltv - Loan-to-Value percentage
 * @returns {string} LTV bracket category
 */
function getLTVBracket(ltv) {
  if (ltv <= 75) return '<= 75%';
  if (ltv <= 85) return '75-85%';
  if (ltv <= 90) return '85-90%';
  return '> 90%';
}
