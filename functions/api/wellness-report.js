/**
 * Wellness Report Data — Cloudflare Pages Function
 *
 * GET /api/wellness-report?reportId={id}
 *
 * Returns the full scoring result JSON for a given report ID.
 * Used by the web report page as a fallback when sessionStorage
 * doesn't have the data (e.g. shared links, returning visitors).
 */

const supabaseClient = require('../_utils/supabase-client');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS'
};

/**
 * Handle CORS preflight
 */
export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

/**
 * Handle GET — return report JSON
 */
export async function onRequestGet(context) {
  const { env } = context;
  const headers = { ...corsHeaders, 'Content-Type': 'application/json' };

  try {
    const url = new URL(context.request.url);
    const reportId = url.searchParams.get('reportId');

    if (!reportId) {
      return new Response(JSON.stringify({
        error: 'reportId query parameter is required'
      }), { status: 400, headers });
    }

    var report = await supabaseClient.getReport(env, reportId);

    if (!report) {
      return new Response(JSON.stringify({
        error: 'Report not found or expired'
      }), { status: 404, headers });
    }

    return new Response(JSON.stringify({
      reportId: report.report_id,
      data: report.data,
      createdAt: report.created_at
    }), { status: 200, headers });

  } catch (error) {
    console.error('Error fetching report:', error);

    return new Response(JSON.stringify({
      error: 'Failed to fetch report',
      message: 'An error occurred while retrieving the report.'
    }), { status: 500, headers });
  }
}
