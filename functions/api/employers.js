/**
 * Employers — Cloudflare Pages Function
 *
 * GET /api/employers
 *
 * Returns active employer partners (id + company_name only).
 */

const supabaseClient = require('../_utils/supabase-client');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // TODO: Restrict to bmortgageservices.co.uk
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
 * Handle GET — list active employer partners
 */
export async function onRequestGet(context) {
  const { env } = context;
  const headers = { ...corsHeaders, 'Content-Type': 'application/json' };

  try {
    const supabase = supabaseClient.getClient(env);
    const { data, error } = await supabase
      .from('employers')
      .select('id, company_name')
      .eq('status', 'active')
      .order('company_name');

    if (error) {
      console.error('Error fetching employers:', error);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch employers' }),
        { status: 500, headers }
      );
    }

    return new Response(
      JSON.stringify({ success: true, employers: data }),
      { status: 200, headers }
    );

  } catch (error) {
    console.error('Employers API error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers }
    );
  }
}
