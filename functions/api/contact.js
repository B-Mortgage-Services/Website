/**
 * Contact Form — Cloudflare Pages Function
 *
 * POST /api/contact
 *
 * Stores contact enquiry in Supabase (contact_enquiries table).
 * Optionally forwards to external CRM if CRM_API_URL env var is set.
 */

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
 * Handle POST — submit contact enquiry
 */
export async function onRequestPost(context) {
  const { env } = context;
  const headers = { ...corsHeaders, 'Content-Type': 'application/json' };

  try {
    const data = await context.request.json();

    // Validate required fields
    if (!data.name || !data.name.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: 'Name is required' }),
        { status: 400, headers }
      );
    }
    if (!data.email || !data.email.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: 'Email is required' }),
        { status: 400, headers }
      );
    }

    // Basic email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid email address' }),
        { status: 400, headers }
      );
    }

    // Save to Supabase
    const supabase = supabaseClient.getClient(env);
    const { error: insertError } = await supabase
      .from('contact_enquiries')
      .insert({
        name: data.name.trim(),
        email: data.email.trim(),
        phone: data.phone ? data.phone.trim() : null,
        enquiry_type: data.enquiry_type || null,
        message: data.message ? data.message.trim() : null,
        visitor_id: data.visitor_id || null,
        session_id: data.session_id || null,
        utm_source: data.utm_source || null,
        utm_medium: data.utm_medium || null,
        utm_campaign: data.utm_campaign || null
      });

    if (insertError) {
      console.error('Error saving contact enquiry:', insertError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to save enquiry' }),
        { status: 500, headers }
      );
    }

    // Forward to CRM if configured (fire-and-forget)
    if (env.CRM_API_URL) {
      try {
        await fetch(env.CRM_API_URL + '/api/enquiry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
      } catch (e) {
        console.log('CRM forwarding failed (expected if CRM not deployed):', e.message);
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers }
    );

  } catch (error) {
    console.error('Contact form error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers }
    );
  }
}
