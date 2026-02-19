/**
 * Wellness Calculate — Cloudflare Pages Function
 *
 * POST /api/wellness-calculate
 *
 * Main API endpoint for wellness check calculation.
 * Accepts form data, runs scoring engine, stores results in Supabase,
 * and returns comprehensive scoring results.
 */

const scoringEngine = require('../_utils/scoring-engine');
const supabaseClient = require('../_utils/supabase-client');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // TODO: Restrict to bmortgageservices.co.uk
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

/**
 * Handle CORS preflight
 */
export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

/**
 * Handle POST — calculate wellness score
 */
export async function onRequestPost(context) {
  const { env } = context;
  const headers = { ...corsHeaders, 'Content-Type': 'application/json' };

  try {
    // Parse request body
    const data = await context.request.json();

    // Validate input data
    const validation = scoringEngine.validate(data);
    if (!validation.isValid) {
      return new Response(JSON.stringify({
        error: 'Validation failed',
        details: validation.errors
      }), { status: 400, headers });
    }

    console.log('Processing wellness check calculation...');

    // Run scoring engine
    const scoringResult = scoringEngine.calculate(data);

    console.log(`Calculated score: ${scoringResult.score}/100`);

    // Save report to Supabase
    const reportId = await supabaseClient.saveReport(env, scoringResult, data.email || null);

    // Build report URL (query-param format matches web report page)
    const baseUrl = env.REPORT_BASE_URL || 'https://bmortgageservices.co.uk/wellness/report/';
    const reportUrl = `${baseUrl}?id=${reportId}`;

    // Log analytics (anonymized)
    await supabaseClient.logAnalytics(env, {
      score: scoringResult.score,
      category: scoringResult.category,
      has_email: !!data.email,
      employment_type: data.employment,
      ltv_bracket: getLTVBracket(scoringResult.breakdown.deposit.ltv),
      lti_ratio: scoringResult.mortgageMetrics?.lti?.ratio || null,
      dti_ratio: scoringResult.mortgageMetrics?.dti?.ratio || null,
      has_gross_income: !!data.grossAnnualIncome,
      income_estimated: scoringResult.mortgageMetrics?.grossIncome?.isEstimated || false
    });

    // Return response
    return new Response(JSON.stringify({
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
      breakdown: scoringResult.breakdown,
      runway: scoringResult.runway,
      perceptionGap: scoringResult.perceptionGap,
      waterfall: scoringResult.waterfall,
      riskAssessment: scoringResult.riskAssessment,
      household: scoringResult.household,
      employerBenefits: scoringResult.employerBenefits,
      benchmarks: scoringResult.benchmarks,
      stateBenefit: scoringResult.stateBenefit,
      mortgageMetrics: scoringResult.mortgageMetrics
    }), { status: 200, headers });

  } catch (error) {
    console.error('Error in wellness-calculate function:', error);

    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: 'An error occurred processing your request'
    }), { status: 500, headers });
  }
}

/**
 * Helper function to categorize LTV for analytics
 */
function getLTVBracket(ltv) {
  if (ltv <= 75) return '<= 75%';
  if (ltv <= 85) return '75-85%';
  if (ltv <= 90) return '85-90%';
  return '> 90%';
}
