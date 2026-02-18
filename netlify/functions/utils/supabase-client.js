/**
 * Supabase Client Wrapper
 *
 * Provides helper functions for interacting with Supabase database and storage
 * for wellness check reports and PDFs.
 */

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// Initialize Supabase client (anon key for database reads/writes with RLS)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Admin client for storage operations (service_role bypasses RLS)
// Safe: only used server-side in Netlify Functions, never exposed to browser
const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : supabase;

/**
 * Generate a unique, URL-safe report ID
 * @returns {string} 8-character unique identifier
 */
function generateReportId() {
  return crypto.randomBytes(4).toString('hex');
}

/**
 * Save wellness report to Supabase database
 * @param {Object} reportData - The scoring result and user data
 * @param {string|null} email - Optional user email
 * @returns {Promise<string>} The generated report ID
 */
async function saveReport(reportData, email = null) {
  const reportId = generateReportId();

  const { data, error } = await supabase
    .from('wellness_reports')
    .insert({
      report_id: reportId,
      data: reportData,
      email: email
    })
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
 * @param {string} reportId - The report ID to fetch
 * @returns {Promise<Object|null>} The report data or null if not found/expired
 */
async function getReport(reportId) {
  const { data, error } = await supabase
    .from('wellness_reports')
    .select('*')
    .eq('report_id', reportId)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned (not found or expired)
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
 * @param {string} reportId - The report ID
 * @param {Buffer} pdfBuffer - The PDF file buffer
 * @returns {Promise<string>} The public URL of the uploaded PDF
 */
async function uploadPDF(reportId, pdfBuffer) {
  const fileName = `${reportId}.pdf`;

  const { data, error } = await supabaseAdmin.storage
    .from('wellness-pdfs')
    .upload(fileName, pdfBuffer, {
      contentType: 'application/pdf',
      cacheControl: '3600',
      upsert: true // Overwrite if exists
    });

  if (error) {
    console.error('Error uploading PDF to Supabase Storage:', error);
    throw new Error(`Failed to upload PDF: ${error.message}`);
  }

  // Get public URL
  const { data: urlData } = supabaseAdmin.storage
    .from('wellness-pdfs')
    .getPublicUrl(fileName);

  console.log(`PDF uploaded successfully: ${urlData.publicUrl}`);
  return urlData.publicUrl;
}

/**
 * Check if PDF exists in Supabase Storage
 * @param {string} reportId - The report ID
 * @returns {Promise<boolean>} True if PDF exists, false otherwise
 */
async function pdfExists(reportId) {
  const fileName = `${reportId}.pdf`;

  const { data, error } = await supabaseAdmin.storage
    .from('wellness-pdfs')
    .list('', {
      search: fileName
    });

  if (error) {
    console.error('Error checking PDF existence:', error);
    return false;
  }

  return data && data.length > 0;
}

/**
 * Get PDF public URL from Supabase Storage
 * @param {string} reportId - The report ID
 * @returns {string} The public URL of the PDF
 */
function getPDFUrl(reportId) {
  const fileName = `${reportId}.pdf`;

  const { data } = supabaseAdmin.storage
    .from('wellness-pdfs')
    .getPublicUrl(fileName);

  return data.publicUrl;
}

/**
 * Get signed URL for PDF (valid for 1 hour)
 * @param {string} reportId - The report ID
 * @returns {Promise<string>} The signed URL
 */
async function getSignedPDFUrl(reportId) {
  const fileName = `${reportId}.pdf`;

  const { data, error } = await supabaseAdmin.storage
    .from('wellness-pdfs')
    .createSignedUrl(fileName, 3600); // 1 hour expiry

  if (error) {
    console.error('Error creating signed URL:', error);
    throw new Error(`Failed to create signed URL: ${error.message}`);
  }

  return data.signedUrl;
}

/**
 * Log analytics data (anonymized)
 * @param {Object} analyticsData - Analytics data to log
 * @returns {Promise<void>}
 */
async function logAnalytics(analyticsData) {
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
 * Note: This is normally handled by PostgreSQL cron job
 * @returns {Promise<number>} Number of reports deleted
 */
async function deleteExpiredReports() {
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
  supabase,
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
