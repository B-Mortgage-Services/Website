/**
 * PDF Generator for Financial Wellness Report
 *
 * Uses Puppeteer + Handlebars to generate a branded 4-page PDF report.
 * Designed for serverless execution on Netlify Functions.
 */

const fs = require('fs');
const path = require('path');
const handlebars = require('handlebars');

// Register Handlebars helpers
handlebars.registerHelper('formatNumber', function (num) {
  const val = parseFloat(num) || 0;
  return val.toLocaleString('en-GB', { maximumFractionDigits: 0 });
});

handlebars.registerHelper('formatDecimal', function (num, decimals) {
  const val = parseFloat(num) || 0;
  return val.toFixed(typeof decimals === 'number' ? decimals : 1);
});

handlebars.registerHelper('round', function (num) {
  return Math.round(parseFloat(num) || 0);
});

handlebars.registerHelper('scorePercent', function (score, maxScore) {
  const s = parseFloat(score) || 0;
  const m = parseFloat(maxScore) || 1;
  return Math.round((s / m) * 100);
});

handlebars.registerHelper('subtract', function (a, b) {
  return (parseFloat(a) || 0) - (parseFloat(b) || 0);
});

handlebars.registerHelper('isShortfall', function (income, essentials) {
  return (parseFloat(income) || 0) < (parseFloat(essentials) || 0);
});

handlebars.registerHelper('shortfallAmount', function (income, essentials) {
  return Math.round((parseFloat(essentials) || 0) - (parseFloat(income) || 0));
});

handlebars.registerHelper('surplusAmount', function (income, essentials) {
  return Math.round((parseFloat(income) || 0) - (parseFloat(essentials) || 0));
});

handlebars.registerHelper('ifEquals', function (a, b, options) {
  return a === b ? options.fn(this) : options.inverse(this);
});

handlebars.registerHelper('lastItem', function (arr) {
  return arr && arr.length > 0 ? arr[arr.length - 1] : null;
});

/**
 * Generate personalised recommendations based on scoring result
 * @param {Object} data - Full scoring result data
 * @returns {Array} Array of recommendation objects
 */
function generateRecommendations(data) {
  const recommendations = [];

  // Runway-based recommendations
  if (data.runway && data.runway.days < 90) {
    recommendations.push({
      title: 'Build Your Emergency Fund',
      text: `Your financial runway of ${data.runway.days} days is below the recommended 3-month target. Aim to build accessible savings to cover at least 90 days of essential outgoings (\u00a3${Math.round(data.household.monthlyEssentials * 3).toLocaleString('en-GB')}).`
    });
  }

  // Protection gaps
  if (data.breakdown.protection.totalScore < 10) {
    recommendations.push({
      title: 'Review Your Protection Cover',
      text: 'Your protection cover has room for improvement. Income protection, life insurance, and critical illness cover can safeguard your mortgage payments if the unexpected happens. A protection review could identify gaps in your cover.'
    });
  }

  // Deposit size
  if (data.breakdown.deposit.ltv > 90) {
    recommendations.push({
      title: 'Boost Your Deposit',
      text: `Your current LTV is ${Math.round(data.breakdown.deposit.ltv)}%. Increasing your deposit to reach 90% LTV or below could unlock better mortgage rates and reduce monthly payments. Consider ISAs or Lifetime ISAs for tax-efficient saving.`
    });
  }

  // Credit
  if (data.breakdown.credit.score < 7) {
    recommendations.push({
      title: 'Strengthen Your Credit Profile',
      text: 'Improving your credit history could significantly boost your mortgage options. Consider registering on the electoral roll, ensuring all bills are paid on time, and checking your credit report for errors.'
    });
  }

  // Budget
  if (data.breakdown.surplus.score < 12) {
    recommendations.push({
      title: 'Improve Your Monthly Budget',
      text: 'Lenders look for a comfortable surplus after mortgage payments. Review your monthly outgoings for potential savings and aim to demonstrate consistent saving habits over 3-6 months before applying.'
    });
  }

  // If few improvements needed, add general positive advice
  if (recommendations.length < 2) {
    recommendations.push({
      title: 'Book a Mortgage Review',
      text: 'You\'re in a strong position. A professional mortgage review can help you find the best rates and products for your situation, potentially saving thousands over your mortgage term.'
    });
  }

  return recommendations.slice(0, 4); // Max 4 recommendations
}

/**
 * Generate PDF from report data
 * @param {Object} reportData - Full scoring result data from database
 * @param {string} reportId - Unique report identifier
 * @returns {Buffer} PDF file buffer
 */
async function generatePDF(reportData, reportId) {
  // Load template
  const templatePath = path.join(process.cwd(), 'templates', 'pdf', 'enhanced-ftb-report.hbs');
  const templateSource = fs.readFileSync(templatePath, 'utf8');
  const template = handlebars.compile(templateSource);

  // Generate recommendations
  const recommendations = generateRecommendations(reportData);

  // Prepare template data
  const templateData = {
    ...reportData,
    reportId: reportId,
    generatedDate: new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }),
    recommendations: recommendations
  };

  // Render HTML
  const html = template(templateData);

  // Launch Puppeteer - use @sparticuz/chromium in production, full puppeteer locally
  let browser;
  try {
    const isLocal = process.env.NETLIFY_DEV === 'true' || !process.env.LAMBDA_TASK_ROOT;

    if (isLocal) {
      const puppeteer = require('puppeteer');
      browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    } else {
      const chromium = require('@sparticuz/chromium');
      const puppeteer = require('puppeteer-core');
      browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless
      });
    }

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
      preferCSSPageSize: true
    });

    return pdfBuffer;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = {
  generatePDF,
  generateRecommendations
};
