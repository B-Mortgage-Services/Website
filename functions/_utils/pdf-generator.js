/**
 * PDF Generator for Financial Wellness Report (Cloudflare Browser Rendering)
 *
 * Uses @cloudflare/puppeteer + Handlebars to generate a branded 4-page PDF.
 * The browser instance is provided via the BROWSER binding in wrangler.toml.
 */

const puppeteer = require('@cloudflare/puppeteer');
const handlebars = require('handlebars');
const templateSource = require('./pdf-template');

// Register Handlebars helpers
handlebars.registerHelper('formatNumber', function (num) {
  var val = parseFloat(num) || 0;
  return val.toLocaleString('en-GB', { maximumFractionDigits: 0 });
});

handlebars.registerHelper('formatDecimal', function (num, decimals) {
  var val = parseFloat(num) || 0;
  return val.toFixed(typeof decimals === 'number' ? decimals : 1);
});

handlebars.registerHelper('round', function (num) {
  return Math.round(parseFloat(num) || 0);
});

handlebars.registerHelper('scorePercent', function (score, maxScore) {
  var s = parseFloat(score) || 0;
  var m = parseFloat(maxScore) || 1;
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

// Compile template once at module level
var template = handlebars.compile(templateSource);

/**
 * Generate personalised recommendations based on scoring result
 * @param {Object} data - Full scoring result data
 * @returns {Array} Array of recommendation objects
 */
function generateRecommendations(data) {
  var recommendations = [];

  if (data.runway && data.runway.days < 90) {
    recommendations.push({
      title: 'Build Your Emergency Fund',
      text: 'Your financial runway of ' + data.runway.days + ' days is below the recommended 3-month target. Aim to build accessible savings to cover at least 90 days of essential outgoings (\u00a3' + Math.round(data.household.monthlyEssentials * 3).toLocaleString('en-GB') + ').'
    });
  }

  if (data.breakdown.protection.totalScore < 10) {
    recommendations.push({
      title: 'Review Your Protection Cover',
      text: 'Your protection cover has room for improvement. Income protection, life insurance, and critical illness cover can safeguard your mortgage payments if the unexpected happens. A protection review could identify gaps in your cover.'
    });
  }

  if (data.breakdown.deposit.ltv > 90) {
    recommendations.push({
      title: 'Boost Your Deposit',
      text: 'Your current LTV is ' + Math.round(data.breakdown.deposit.ltv) + '%. Increasing your deposit to reach 90% LTV or below could unlock better mortgage rates and reduce monthly payments. Consider ISAs or Lifetime ISAs for tax-efficient saving.'
    });
  }

  if (data.breakdown.credit.score < 7) {
    recommendations.push({
      title: 'Strengthen Your Credit Profile',
      text: 'Improving your credit history could significantly boost your mortgage options. Consider registering on the electoral roll, ensuring all bills are paid on time, and checking your credit report for errors.'
    });
  }

  if (data.breakdown.surplus.score < 12) {
    recommendations.push({
      title: 'Improve Your Monthly Budget',
      text: 'Lenders look for a comfortable surplus after mortgage payments. Review your monthly outgoings for potential savings and aim to demonstrate consistent saving habits over 3-6 months before applying.'
    });
  }

  if (recommendations.length < 2) {
    recommendations.push({
      title: 'Book a Mortgage Review',
      text: 'You\'re in a strong position. A professional mortgage review can help you find the best rates and products for your situation, potentially saving thousands over your mortgage term.'
    });
  }

  return recommendations.slice(0, 4);
}

/**
 * Generate PDF from report data using Cloudflare Browser Rendering
 * @param {Object} browserBinding - The BROWSER binding from env
 * @param {Object} reportData - Full scoring result data from database
 * @param {string} reportId - Unique report identifier
 * @returns {Promise<ArrayBuffer>} PDF file as ArrayBuffer
 */
async function generatePDF(browserBinding, reportData, reportId) {
  var recommendations = generateRecommendations(reportData);

  var templateData = Object.assign({}, reportData, {
    reportId: reportId,
    generatedDate: new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }),
    recommendations: recommendations
  });

  var html = template(templateData);

  var browser = await puppeteer.launch(browserBinding);
  try {
    var page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });

    var pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
      preferCSSPageSize: true
    });

    return pdfBuffer;
  } finally {
    await browser.close();
  }
}

module.exports = {
  generatePDF: generatePDF,
  generateRecommendations: generateRecommendations
};
