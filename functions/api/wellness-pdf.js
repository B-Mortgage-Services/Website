/**
 * Wellness PDF — Cloudflare Pages Function
 *
 * GET /api/wellness-pdf?reportId={id}
 *
 * Generates a branded PDF report using Cloudflare Browser Rendering,
 * uploads to Supabase Storage, and returns the public download URL.
 */

const supabaseClient = require('../_utils/supabase-client');
const pdfGenerator = require('../_utils/pdf-generator');

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
 * Handle GET — generate or return cached PDF
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

    console.log('PDF requested for report: ' + reportId);

    // Check if PDF already exists in Supabase Storage (cached)
    const exists = await supabaseClient.pdfExists(env, reportId);
    if (exists) {
      console.log('Returning cached PDF for report: ' + reportId);
      const pdfUrl = supabaseClient.getPDFUrl(env, reportId);
      return new Response(JSON.stringify({ pdfUrl: pdfUrl }), { status: 200, headers });
    }

    // Fetch report from Supabase
    const report = await supabaseClient.getReport(env, reportId);

    if (!report) {
      return new Response(JSON.stringify({
        error: 'Report not found or expired'
      }), { status: 404, headers });
    }

    // Generate PDF using Cloudflare Browser Rendering
    const pdfBuffer = await pdfGenerator.generatePDF(env.BROWSER, report.data, reportId);
    console.log('PDF generated for report: ' + reportId + ' (' + pdfBuffer.byteLength + ' bytes)');

    // Upload to Supabase Storage
    const pdfUrl = await supabaseClient.uploadPDF(env, reportId, pdfBuffer);
    console.log('PDF uploaded: ' + pdfUrl);

    return new Response(JSON.stringify({ pdfUrl: pdfUrl }), { status: 200, headers });

  } catch (error) {
    console.error('Error generating PDF:', error);

    return new Response(JSON.stringify({
      error: 'Failed to generate PDF',
      message: 'An error occurred during PDF generation.'
    }), { status: 500, headers });
  }
}
