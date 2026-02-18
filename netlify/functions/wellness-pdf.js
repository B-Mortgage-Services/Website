/**
 * Wellness PDF Function
 *
 * GET /api/wellness-pdf?reportId={id}
 *
 * Generates a branded PDF report, uploads to Supabase Storage,
 * and returns the public download URL.
 */

const supabaseClient = require('./utils/supabase-client');
const pdfGenerator = require('./utils/pdf-generator');

exports.handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Only accept GET
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed. Use GET.' })
    };
  }

  try {
    // Get report ID from query params
    const reportId = event.queryStringParameters?.reportId;

    if (!reportId) {
      return {
        statusCode: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'reportId query parameter is required' })
      };
    }

    console.log(`PDF requested for report: ${reportId}`);

    // Check if PDF already exists in Supabase Storage (cached)
    const exists = await supabaseClient.pdfExists(reportId);
    if (exists) {
      console.log(`Returning cached PDF for report: ${reportId}`);
      const pdfUrl = supabaseClient.getPDFUrl(reportId);
      return {
        statusCode: 200,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfUrl })
      };
    }

    // Fetch report from Supabase
    const report = await supabaseClient.getReport(reportId);

    if (!report) {
      return {
        statusCode: 404,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Report not found or expired' })
      };
    }

    // Generate PDF
    const pdfBuffer = await pdfGenerator.generatePDF(report.data, reportId);
    console.log(`PDF generated for report: ${reportId} (${pdfBuffer.length} bytes)`);

    // Upload to Supabase Storage
    const pdfUrl = await supabaseClient.uploadPDF(reportId, pdfBuffer);
    console.log(`PDF uploaded: ${pdfUrl}`);

    return {
      statusCode: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ pdfUrl })
    };

  } catch (error) {
    console.error('Error generating PDF:', error);

    return {
      statusCode: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Failed to generate PDF',
        message: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred'
      })
    };
  }
};
