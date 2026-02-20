/**
 * Supabase Client Wrapper (Cloudflare Pages Functions)
 *
 * Provides helper functions for interacting with Supabase database and storage
 * for wellness check reports and PDFs.
 *
 * Uses lazy initialisation — env vars are passed from the request context
 * since Cloudflare Workers don't expose process.env at module scope.
 */

const { createClient } = require('@supabase/supabase-js');

let _client = null;
let _adminClient = null;

/**
 * Get or create the Supabase client (anon key, RLS enforced)
 * @param {Object} env - Cloudflare env bindings
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
function getClient(env) {
  if (!_client) {
    _client = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
  }
  return _client;
}

/**
 * Get or create the admin client (service_role, bypasses RLS)
 * Falls back to anon client if service role key not set.
 * @param {Object} env - Cloudflare env bindings
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
function getAdminClient(env) {
  if (!_adminClient) {
    _adminClient = env.SUPABASE_SERVICE_ROLE_KEY
      ? createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
      : getClient(env);
  }
  return _adminClient;
}

/**
 * Generate a unique, URL-safe report ID
 * @returns {string} 8-character unique identifier
 */
function generateReportId() {
  var bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, function(b) { return b.toString(16).padStart(2, '0'); }).join('');
}

/**
 * Save wellness report to Supabase database
 * @param {Object} env - Cloudflare env bindings
 * @param {Object} reportData - The scoring result and user data
 * @param {string|null} email - Optional user email
 * @param {string|null} visitorId - Optional visitor tracking ID
 * @returns {Promise<string>} The generated report ID
 */
async function saveReport(env, reportData, email = null, visitorId = null) {
  const supabase = getClient(env);
  const reportId = generateReportId();

  const row = {
    report_id: reportId,
    data: reportData,
    email: email
  };
  if (visitorId) row.visitor_id = visitorId;

  const { data, error } = await supabase
    .from('wellness_reports')
    .insert(row)
    .select()
    .single();

  if (error) {
    console.error('Error saving report to Supabase:', error);
    throw new Error(`Failed to save report: ${error.message}`);
  }

  console.log(`Report saved successfully with ID: ${reportId}`);
  return reportId;
}

/**
 * Retrieve wellness report by ID
 * @param {Object} env - Cloudflare env bindings
 * @param {string} reportId - The report ID to fetch
 * @returns {Promise<Object|null>} The report data or null if not found/expired
 */
async function getReport(env, reportId) {
  const supabase = getClient(env);

  const { data, error } = await supabase
    .from('wellness_reports')
    .select('*')
    .eq('report_id', reportId)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      console.log(`Report ${reportId} not found or expired`);
      return null;
    }
    console.error('Error fetching report:', error);
    throw new Error(`Failed to fetch report: ${error.message}`);
  }

  return data;
}

/**
 * Upload PDF to Supabase Storage
 * @param {Object} env - Cloudflare env bindings
 * @param {string} reportId - The report ID
 * @param {Buffer} pdfBuffer - The PDF file buffer
 * @returns {Promise<string>} The public URL of the uploaded PDF
 */
async function uploadPDF(env, reportId, pdfBuffer) {
  const admin = getAdminClient(env);
  const fileName = `${reportId}.pdf`;

  const { data, error } = await admin.storage
    .from('wellness-pdfs')
    .upload(fileName, pdfBuffer, {
      contentType: 'application/pdf',
      cacheControl: '3600',
      upsert: true
    });

  if (error) {
    console.error('Error uploading PDF to Supabase Storage:', error);
    throw new Error(`Failed to upload PDF: ${error.message}`);
  }

  const { data: urlData } = admin.storage
    .from('wellness-pdfs')
    .getPublicUrl(fileName);

  console.log(`PDF uploaded successfully: ${urlData.publicUrl}`);
  return urlData.publicUrl;
}

/**
 * Check if PDF exists in Supabase Storage
 * @param {Object} env - Cloudflare env bindings
 * @param {string} reportId - The report ID
 * @returns {Promise<boolean>} True if PDF exists
 */
async function pdfExists(env, reportId) {
  const admin = getAdminClient(env);
  const fileName = `${reportId}.pdf`;

  const { data, error } = await admin.storage
    .from('wellness-pdfs')
    .list('', { search: fileName });

  if (error) {
    console.error('Error checking PDF existence:', error);
    return false;
  }

  return data && data.length > 0;
}

/**
 * Get PDF public URL from Supabase Storage
 * @param {Object} env - Cloudflare env bindings
 * @param {string} reportId - The report ID
 * @returns {string} The public URL of the PDF
 */
function getPDFUrl(env, reportId) {
  const admin = getAdminClient(env);
  const fileName = `${reportId}.pdf`;

  const { data } = admin.storage
    .from('wellness-pdfs')
    .getPublicUrl(fileName);

  return data.publicUrl;
}

/**
 * Get signed URL for PDF (valid for 1 hour)
 * @param {Object} env - Cloudflare env bindings
 * @param {string} reportId - The report ID
 * @returns {Promise<string>} The signed URL
 */
async function getSignedPDFUrl(env, reportId) {
  const admin = getAdminClient(env);
  const fileName = `${reportId}.pdf`;

  const { data, error } = await admin.storage
    .from('wellness-pdfs')
    .createSignedUrl(fileName, 3600);

  if (error) {
    console.error('Error creating signed URL:', error);
    throw new Error(`Failed to create signed URL: ${error.message}`);
  }

  return data.signedUrl;
}

/**
 * Log analytics data (anonymized)
 * @param {Object} env - Cloudflare env bindings
 * @param {Object} analyticsData - Analytics data to log
 * @returns {Promise<void>}
 */
async function logAnalytics(env, analyticsData) {
  const supabase = getClient(env);

  const { error } = await supabase
    .from('wellness_analytics')
    .insert({
      ...analyticsData,
      created_at: new Date().toISOString()
    });

  if (error) {
    console.error('Error logging analytics:', error);
    // Don't throw - analytics failure shouldn't break the main flow
  }
}

/**
 * Delete expired reports (for manual cleanup if needed)
 * @param {Object} env - Cloudflare env bindings
 * @returns {Promise<number>} Number of reports deleted
 */
async function deleteExpiredReports(env) {
  const supabase = getClient(env);

  const { data, error } = await supabase
    .from('wellness_reports')
    .delete()
    .lt('expires_at', new Date().toISOString())
    .select();

  if (error) {
    console.error('Error deleting expired reports:', error);
    throw new Error(`Failed to delete expired reports: ${error.message}`);
  }

  const count = data ? data.length : 0;
  console.log(`Deleted ${count} expired reports`);
  return count;
}

module.exports = {
  getClient,
  getAdminClient,
  generateReportId,
  saveReport,
  getReport,
  uploadPDF,
  pdfExists,
  getPDFUrl,
  getSignedPDFUrl,
  logAnalytics,
  deleteExpiredReports
};
