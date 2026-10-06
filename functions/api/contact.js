/**
 * Contact Form — Cloudflare Pages Function
 *
 * POST /api/contact
 *
 * Stores contact enquiry in Supabase (contact_enquiries table).
 * Optionally forwards to external CRM if CRM_API_URL env var is set.
 */

const supabaseClient = require('../_utils/supabase-client');

const ALLOWED_ORIGINS = [
  'https://bmortgageservices.co.uk',
  'https://www.bmortgageservices.co.uk',
  'http://localhost:8788'
];

// A human cannot read the page and complete the form faster than this.
const MIN_SUBMIT_MS = 2500;

const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_SECONDS = 3600;

function buildCorsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.indexOf(origin) !== -1 ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin'
  };
}

/**
 * Handle CORS preflight
 */
export async function onRequestOptions(context) {
  return new Response(null, { status: 204, headers: buildCorsHeaders(context.request) });
}

/**
 * Handle POST — submit contact enquiry
 */
export async function onRequestPost(context) {
  const { env } = context;
  const headers = { ...buildCorsHeaders(context.request), 'Content-Type': 'application/json' };

  // Spam rejections return success so bots see no signal to retry or adapt.
  const silentOk = () => new Response(JSON.stringify({ success: true }), { status: 200, headers });

  try {
    const data = await context.request.json();

    // Honeypot: hidden field, invisible to real users.
    if (data.website && String(data.website).trim() !== '') {
      return silentOk();
    }

    // Instant submissions are automated.
    if (typeof data.elapsed_ms === 'number' && data.elapsed_ms < MIN_SUBMIT_MS) {
      return silentOk();
    }

    // Rate limit per IP. Fails open so a database problem cannot block
    // genuine enquiries.
    const ip = context.request.headers.get('CF-Connecting-IP');
    if (ip) {
      try {
        const db = supabaseClient.getClient(env);
        const { data: limited } = await db.rpc('check_rate_limit', {
          p_key: 'contact:' + ip,
          p_max_attempts: RATE_LIMIT_MAX,
          p_window_seconds: RATE_LIMIT_WINDOW_SECONDS
        });
        if (limited === true) {
          return new Response(
            JSON.stringify({ success: false, error: 'Too many enquiries. Please try again later or call 01452 925209.' }),
            { status: 429, headers }
          );
        }
      } catch (e) {
        console.error('Rate limit check failed, allowing request:', e.message);
      }
    }

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

    // Journey context from the mortgage pages (?topic= / ?deal_end=). There are
    // no columns for these, so append them to the message — the adviser needs
    // to know which journey the enquiry came from and when the deal ends.
    const DEAL_END_LABELS = {
      '0-3m': 'within 3 months',
      '3-6m': '3-6 months',
      '6-12m': '6-12 months',
      '12m+': 'more than 12 months',
      'unknown': 'already ended or unknown'
    };
    let message = data.message ? data.message.trim() : '';
    const context = [];
    if (data.topic) context.push(`Enquiry topic: ${String(data.topic).slice(0, 40)}`);
    if (data.deal_end) {
      const label = DEAL_END_LABELS[data.deal_end] || String(data.deal_end).slice(0, 40);
      context.push(`Current deal ends: ${label}`);
    }
    if (context.length) {
      message = message ? `${message}\n\n---\n${context.join('\n')}` : context.join('\n');
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
        employer_id: data.employer_id || null,
        message: message || null,
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
