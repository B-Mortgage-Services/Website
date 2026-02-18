/**
 * Wellness PDF — Cloudflare Pages Function (stub)
 *
 * GET /api/wellness-pdf?reportId={id}
 *
 * PDF generation is not yet available on Cloudflare Workers.
 * This stub returns a clear message; Phase 3 will implement
 * PDF generation via an external service or Cloudflare-compatible approach.
 */

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
 * Handle GET — PDF generation placeholder
 */
export async function onRequestGet() {
  const headers = { ...corsHeaders, 'Content-Type': 'application/json' };

  return new Response(JSON.stringify({
    error: 'PDF generation is not yet available',
    message: 'This feature is coming soon in Phase 3.'
  }), { status: 501, headers });
}
