/**
 * PDF Report Template — Premium Editorial Design
 *
 * Pure JS template literals (no Handlebars — Workers block `new Function()`).
 * Uses SVG chart generators from report-charts.js for gauge, radar, runway,
 * waterfall, and mini-bar visuals.
 *
 * Typography: Playfair Display (headings) + Inter (body/data)
 * Layout: 4-page A4 with generous white space, subtle shadows, B watermark
 */

var charts = require('./report-charts');

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(num) {
  var val = parseFloat(num) || 0;
  return val.toLocaleString('en-GB', { maximumFractionDigits: 0 });
}

function fmtDec(num, d) {
  return (parseFloat(num) || 0).toFixed(typeof d === 'number' ? d : 1);
}

function pct(score, max) {
  var s = parseFloat(score) || 0;
  var m = parseFloat(max) || 1;
  return Math.round((s / m) * 100);
}

function escHtml(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Template Renderer ────────────────────────────────────────────────────────

module.exports = function renderHTML(data) {
  var lastWF = (data.waterfall && data.waterfall.length > 0)
    ? data.waterfall[data.waterfall.length - 1]
    : null;

  var pp = data.pillarPercentages || {};

  // Pre-build score breakdown rows
  var breakdownRows = [
    { label: 'Employment Status', score: data.breakdown.employment.score, max: data.breakdown.employment.maxScore },
    { label: 'Credit History', score: data.breakdown.credit.score, max: data.breakdown.credit.maxScore },
    { label: 'Deposit / LTV', score: data.breakdown.deposit.score, max: data.breakdown.deposit.maxScore },
    { label: 'Monthly Surplus', score: data.breakdown.surplus.score, max: data.breakdown.surplus.maxScore },
    { label: 'Emergency Savings', score: data.breakdown.emergency.score, max: data.breakdown.emergency.maxScore },
    { label: 'Protection Cover', score: data.breakdown.protection.totalScore, max: data.breakdown.protection.maxScore }
  ];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Financial Wellness Report — B Mortgage Services</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    /* ═══════ RESET & BASE ═══════ */
    @page { size: A4; margin: 0; }
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

    :root {
      --orange: #F05B28;
      --charcoal: #2D2D2D;
      --slate: #64748B;
      --light: #F3F4F6;
      --border: #E5E7EB;
      --white: #FFFFFF;
      --off-white: #FAFAFA;
      --green: #22C55E;
      --red: #EF4444;
      --serif: 'Playfair Display', Georgia, 'Times New Roman', serif;
      --sans: 'Inter', system-ui, -apple-system, sans-serif;
    }

    body {
      font-family: var(--sans);
      font-size: 10px;
      line-height: 1.55;
      color: var(--charcoal);
      background: var(--white);
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* ═══════ PAGE SHELL ═══════ */
    .page {
      width: 210mm;
      min-height: 297mm;
      padding: 28mm 24mm 20mm;
      position: relative;
      page-break-after: always;
      overflow: hidden;
    }
    .page:last-child { page-break-after: avoid; }
    .page--alt { background: var(--off-white); }

    /* ═══════ HEADER BAR ═══════ */
    .hdr {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      padding-bottom: 12px;
      border-bottom: 2px solid var(--orange);
    }
    .hdr__brand {
      font-family: var(--serif);
      font-size: 14px;
      font-weight: 700;
      color: var(--orange);
      letter-spacing: 0.01em;
    }
    .hdr__meta {
      font-size: 8.5px;
      color: var(--slate);
      text-align: right;
      line-height: 1.4;
    }

    /* ═══════ FOOTER ═══════ */
    .ftr {
      position: absolute;
      bottom: 12mm;
      left: 24mm;
      right: 24mm;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 7.5px;
      color: var(--slate);
      border-top: 1px solid var(--border);
      padding-top: 8px;
    }

    /* ═══════ TYPOGRAPHY ═══════ */
    .t-serif { font-family: var(--serif); }
    .t-sans  { font-family: var(--sans); }

    h1 {
      font-family: var(--serif);
      font-size: 26px;
      font-weight: 700;
      color: var(--charcoal);
      letter-spacing: -0.02em;
      line-height: 1.15;
      margin-bottom: 6px;
    }

    h2 {
      font-family: var(--serif);
      font-size: 17px;
      font-weight: 700;
      color: var(--charcoal);
      letter-spacing: -0.01em;
      margin-bottom: 14px;
    }
    h2 .accent { color: var(--orange); }

    h3 {
      font-family: var(--sans);
      font-size: 11px;
      font-weight: 700;
      color: var(--charcoal);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-bottom: 10px;
    }

    .subtitle {
      font-size: 11px;
      color: var(--slate);
      margin-bottom: 22px;
      line-height: 1.5;
    }

    /* ═══════ SCORE HERO ═══════ */
    .score-hero {
      display: flex;
      align-items: center;
      gap: 28px;
      margin-bottom: 28px;
    }
    .score-hero__gauge {
      flex-shrink: 0;
      width: 180px;
    }
    .score-hero__text {
      flex: 1;
    }
    .score-hero__category {
      font-family: var(--serif);
      font-size: 22px;
      font-weight: 700;
      color: var(--charcoal);
      margin-bottom: 4px;
    }
    .score-hero__interp {
      font-size: 10.5px;
      color: var(--slate);
      line-height: 1.55;
    }

    /* ═══════ PILLAR SECTION ═══════ */
    .pillars {
      display: flex;
      gap: 24px;
      align-items: flex-start;
      margin-bottom: 24px;
    }
    .pillars__chart {
      flex-shrink: 0;
      width: 240px;
    }
    .pillars__cards {
      flex: 1;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .p-card {
      background: var(--white);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 12px 14px;
      position: relative;
      overflow: hidden;
    }
    .p-card::before {
      content: '';
      position: absolute;
      top: 0; left: 0; bottom: 0;
      width: 3px;
    }
    .p-card--elig::before  { background: var(--green); }
    .p-card--aff::before   { background: #3B82F6; }
    .p-card--res::before   { background: #EAB308; }
    .p-card--prot::before  { background: #A855F7; }

    .p-card__label {
      font-size: 8px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--slate);
      margin-bottom: 2px;
    }
    .p-card__pct {
      font-size: 22px;
      font-weight: 700;
      color: var(--charcoal);
      line-height: 1.1;
    }

    /* ═══════ STRENGTHS / IMPROVEMENTS ═══════ */
    .two-col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      margin-bottom: 20px;
    }
    .si-card {
      border-radius: 8px;
      padding: 14px 16px;
    }
    .si-card--green {
      background: #F0FDF4;
      border: 1px solid #BBF7D0;
    }
    .si-card--orange {
      background: #FFF7ED;
      border: 1px solid #FED7AA;
    }
    .si-card__title {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 8px;
    }
    .si-card--green .si-card__title { color: var(--green); }
    .si-card--orange .si-card__title { color: var(--orange); }
    .si-card__list {
      list-style: none;
      padding: 0;
    }
    .si-card__list li {
      padding: 2px 0;
      font-size: 9.5px;
      line-height: 1.45;
    }
    .si-card--green .si-card__list li::before { content: "\\2713\\0020"; color: var(--green); font-weight: 700; }
    .si-card--orange .si-card__list li::before { content: "\\2192\\0020"; color: var(--orange); font-weight: 700; }

    /* ═══════ STAT GRID ═══════ */
    .stat-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 22px;
    }
    .stat-box {
      text-align: center;
      padding: 14px 8px 12px;
      background: var(--white);
      border: 1px solid var(--border);
      border-radius: 8px;
    }
    .stat-box__val {
      font-size: 20px;
      font-weight: 700;
      color: var(--charcoal);
      line-height: 1.1;
    }
    .stat-box__label {
      font-size: 7.5px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--slate);
      margin-top: 4px;
    }

    /* ═══════ BREAKDOWN TABLE ═══════ */
    .bd-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      margin-bottom: 22px;
    }
    .bd-table th {
      font-size: 8px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--slate);
      text-align: left;
      padding: 8px 10px;
      border-bottom: 2px solid var(--charcoal);
    }
    .bd-table th:last-child { text-align: right; }
    .bd-table td {
      padding: 9px 10px;
      font-size: 10px;
      border-bottom: 1px solid var(--border);
      vertical-align: middle;
    }
    .bd-table td:first-child { font-weight: 600; }
    .bd-table td:last-child { text-align: right; font-weight: 700; }
    .bd-table .bar-cell { width: 130px; }

    /* ═══════ RUNWAY SECTION ═══════ */
    .runway-hero {
      display: flex;
      align-items: center;
      gap: 22px;
      background: var(--white);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 18px 22px;
      margin-bottom: 16px;
    }
    .runway-hero__big {
      font-size: 48px;
      font-weight: 700;
      color: var(--orange);
      line-height: 1;
    }
    .runway-hero__unit {
      font-size: 13px;
      font-weight: 600;
      color: var(--slate);
    }
    .runway-hero__body { flex: 1; }
    .runway-hero__body p {
      font-size: 10px;
      color: var(--slate);
      line-height: 1.5;
    }

    /* ═══════ WATERFALL SECTION ═══════ */
    .wf-chart {
      margin-bottom: 14px;
    }

    .shortfall-callout {
      background: #FEF2F2;
      border: 1px solid #FECACA;
      border-radius: 8px;
      padding: 14px 18px;
      text-align: center;
      margin-bottom: 18px;
    }
    .shortfall-callout__val {
      font-size: 28px;
      font-weight: 700;
      color: #991B1B;
      line-height: 1.1;
    }
    .shortfall-callout__label {
      font-size: 9px;
      color: #7F1D1D;
      margin-top: 4px;
    }

    /* ═══════ RISK CARDS ═══════ */
    .risk-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 18px;
    }
    .risk-card {
      text-align: center;
      padding: 16px 10px 14px;
      background: var(--white);
      border: 1px solid var(--border);
      border-radius: 8px;
      position: relative;
    }
    .risk-card::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 3px;
      border-radius: 8px 8px 0 0;
    }
    .risk-card--death::before   { background: var(--red); }
    .risk-card--ci::before      { background: #EAB308; }
    .risk-card--absence::before { background: #3B82F6; }

    .risk-card__icon {
      font-size: 22px;
      margin-bottom: 6px;
    }
    .risk-card__val {
      font-size: 26px;
      font-weight: 700;
      color: var(--charcoal);
      line-height: 1;
    }
    .risk-card__label {
      font-size: 8px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--slate);
      margin-top: 4px;
    }
    .risk-card__ctx {
      font-size: 8px;
      color: var(--slate);
      margin-top: 6px;
      line-height: 1.35;
    }

    /* ═══════ RECOMMENDATION CARDS ═══════ */
    .rec-card {
      display: flex;
      gap: 14px;
      align-items: flex-start;
      background: var(--white);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px 18px;
      margin-bottom: 10px;
    }
    .rec-card__num {
      flex-shrink: 0;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: var(--orange);
      color: var(--white);
      font-size: 13px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
    }
    .rec-card__body { flex: 1; }
    .rec-card__title {
      font-size: 11px;
      font-weight: 700;
      color: var(--charcoal);
      margin-bottom: 3px;
    }
    .rec-card__text {
      font-size: 9.5px;
      color: var(--slate);
      line-height: 1.5;
    }

    /* ═══════ CTA BOX ═══════ */
    .cta {
      background: var(--charcoal);
      border-radius: 10px;
      padding: 26px 28px;
      text-align: center;
      margin-top: 18px;
    }
    .cta h3 {
      font-family: var(--serif);
      font-size: 17px;
      font-weight: 700;
      color: var(--white);
      text-transform: none;
      letter-spacing: -0.01em;
      margin-bottom: 6px;
    }
    .cta p {
      font-size: 10px;
      color: rgba(255,255,255,0.75);
      margin-bottom: 10px;
      line-height: 1.55;
    }
    .cta__contact {
      font-size: 12px;
      font-weight: 600;
      color: var(--orange);
    }

    /* ═══════ DISCLAIMER ═══════ */
    .disc {
      font-size: 7.5px;
      color: var(--slate);
      line-height: 1.4;
      margin-top: 14px;
      padding-top: 10px;
      border-top: 1px solid var(--border);
    }

    /* ═══════ WATERMARK ═══════ */
    .wm-wrap {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      pointer-events: none;
      z-index: 0;
    }

    /* ═══════ INFO BOXES ═══════ */
    .info-box {
      border-left: 3px solid;
      border-radius: 0 6px 6px 0;
      padding: 10px 14px;
      margin-bottom: 10px;
      font-size: 9px;
      line-height: 1.5;
    }
    .info-box--blue {
      background: #F0F4FF;
      border-left-color: #3B82F6;
    }
    .info-box--amber {
      background: #FFF7ED;
      border-left-color: #F59E0B;
    }
    .info-box__title {
      font-size: 9.5px;
      font-weight: 700;
      margin-bottom: 4px;
    }
    .info-box--blue .info-box__title { color: #1E3A5F; }
    .info-box--amber .info-box__title { color: #92400E; }
    .info-box p {
      color: #374151;
      font-size: 8.5px;
      margin-bottom: 4px;
    }
    .info-box p:last-child { margin-bottom: 0; }

    /* ═══════ UTILITY ═══════ */
    .mb-0 { margin-bottom: 0 !important; }
    .mb-sm { margin-bottom: 8px; }
    .mb-md { margin-bottom: 16px; }
    .text-sm { font-size: 8.5px; }
    .text-slate { color: var(--slate); }
    .text-center { text-align: center; }
    .text-italic { font-style: italic; }
  </style>
</head>
<body>

  <!-- ═══════════════════════════════════════════════════════════════════════
       PAGE 1 — EXECUTIVE SUMMARY
       ═══════════════════════════════════════════════════════════════════════ -->
  <div class="page">
    <div class="wm-wrap">${charts.watermark()}</div>

    <div class="hdr">
      <div class="hdr__brand">B Mortgage Services</div>
      <div class="hdr__meta">Financial Wellness Report<br>${data.generatedDate}</div>
    </div>

    <h1>Your Financial <span style="color:var(--orange);">Wellness</span> Report</h1>
    <p class="subtitle">A personalised snapshot of your mortgage readiness, financial resilience, and protection cover.</p>

    <!-- Score Hero: Gauge + Category -->
    <div class="score-hero">
      <div class="score-hero__gauge">
        ${charts.gaugeChart(data.score, 100, charts.ORANGE)}
      </div>
      <div class="score-hero__text">
        <div class="score-hero__category">${escHtml(data.category)}</div>
        <p class="score-hero__interp">${escHtml(data.interpretation)}</p>
      </div>
    </div>

    <!-- Four Pillars: Radar + Cards -->
    <h2>The Four <span class="accent">Pillars</span></h2>
    <div class="pillars">
      <div class="pillars__chart">
        ${charts.radarChart(pp)}
      </div>
      <div class="pillars__cards">
        <div class="p-card p-card--elig">
          <div class="p-card__label">Mortgage Eligibility</div>
          <div class="p-card__pct">${pp.mortgageEligibility || 0}%</div>
        </div>
        <div class="p-card p-card--aff">
          <div class="p-card__label">Affordability &amp; Budget</div>
          <div class="p-card__pct">${pp.affordabilityBudget || 0}%</div>
        </div>
        <div class="p-card p-card--res">
          <div class="p-card__label">Financial Resilience</div>
          <div class="p-card__pct">${pp.financialResilience || 0}%</div>
        </div>
        <div class="p-card p-card--prot">
          <div class="p-card__label">Protection Readiness</div>
          <div class="p-card__pct">${pp.protectionReadiness || 0}%</div>
        </div>
      </div>
    </div>

    <!-- Strengths & Improvements -->
    <div class="two-col">
      <div class="si-card si-card--green">
        <div class="si-card__title">Your Strengths</div>
        <ul class="si-card__list">
          ${(data.strengths || []).map(function (s) { return '<li>' + escHtml(s) + '</li>'; }).join('\n          ')}
        </ul>
      </div>
      <div class="si-card si-card--orange">
        <div class="si-card__title">Areas to Improve</div>
        <ul class="si-card__list">
          ${(data.improvements || []).map(function (s) { return '<li>' + escHtml(s) + '</li>'; }).join('\n          ')}
        </ul>
      </div>
    </div>

    <div class="ftr">
      <span>B Mortgage Services &middot; bmortgageservices.co.uk</span>
      <span>Page 1 of 4 &middot; ${data.reportId}</span>
    </div>
  </div>

  <!-- ═══════════════════════════════════════════════════════════════════════
       PAGE 2 — FINANCIAL HEALTH
       ═══════════════════════════════════════════════════════════════════════ -->
  <div class="page page--alt">
    <div class="wm-wrap">${charts.watermark()}</div>

    <div class="hdr">
      <div class="hdr__brand">B Mortgage Services</div>
      <div class="hdr__meta">Financial Wellness Report<br>${data.generatedDate}</div>
    </div>

    <h2>Your Financial <span class="accent">Health</span></h2>

    <!-- Household Dashboard -->
    <h3>Household Dashboard</h3>
    <div class="stat-grid">
      <div class="stat-box">
        <div class="stat-box__val">&pound;${fmt(data.household.monthlyIncome)}</div>
        <div class="stat-box__label">Monthly Income</div>
      </div>
      <div class="stat-box">
        <div class="stat-box__val">&pound;${fmt(data.household.monthlyEssentials)}</div>
        <div class="stat-box__label">Monthly Essentials</div>
      </div>
      <div class="stat-box">
        <div class="stat-box__val">&pound;${fmt(data.household.accessibleSavings)}</div>
        <div class="stat-box__label">Accessible Savings</div>
      </div>
      <div class="stat-box">
        <div class="stat-box__val">&pound;${fmt(data.household.monthlySurplus)}</div>
        <div class="stat-box__label">Monthly Surplus</div>
      </div>
    </div>

    <!-- Score Breakdown -->
    <h3>Score Breakdown</h3>
    <table class="bd-table">
      <thead>
        <tr>
          <th>Component</th>
          <th style="width:130px;">Progress</th>
          <th>Score</th>
        </tr>
      </thead>
      <tbody>
        ${breakdownRows.map(function (row) {
          var rowPct = pct(row.score, row.max);
          var rowColor = charts.pillarColor(rowPct);
          return '<tr>' +
            '<td>' + escHtml(row.label) + '</td>' +
            '<td class="bar-cell">' + charts.miniBar(rowPct, rowColor) + '</td>' +
            '<td>' + row.score + ' / ' + row.max + '</td>' +
            '</tr>';
        }).join('\n        ')}
      </tbody>
    </table>

    ${data.breakdown.deposit.propertyValue ? `
    <!-- Property & Mortgage -->
    <h3>Property &amp; Mortgage</h3>
    <div class="stat-grid">
      <div class="stat-box">
        <div class="stat-box__val">&pound;${fmt(data.breakdown.deposit.propertyValue)}</div>
        <div class="stat-box__label">Property Value</div>
      </div>
      <div class="stat-box">
        <div class="stat-box__val">&pound;${fmt(data.breakdown.deposit.value)}</div>
        <div class="stat-box__label">Deposit</div>
      </div>
      <div class="stat-box">
        <div class="stat-box__val">${fmtDec(data.breakdown.deposit.ltv, 1)}%</div>
        <div class="stat-box__label">Loan to Value</div>
      </div>
      <div class="stat-box">
        <div class="stat-box__val">&pound;${fmt((parseFloat(data.breakdown.deposit.propertyValue) || 0) - (parseFloat(data.breakdown.deposit.value) || 0))}</div>
        <div class="stat-box__label">Mortgage Amount</div>
      </div>
    </div>` : ''}

    <!-- Financial Runway -->
    <h3>Financial Runway</h3>
    <div class="runway-hero">
      <div>
        <div class="runway-hero__big">${data.runway.days}</div>
        <div class="runway-hero__unit">days</div>
      </div>
      <div class="runway-hero__body">
        <p>If your income stopped today, your accessible savings would cover essential outgoings for approximately <strong>${data.runway.days} days (${data.runway.months} months)</strong>.</p>
      </div>
    </div>
    ${charts.runwayBars(data.runway.days, data.benchmarks.averageDeadlineDays, data.benchmarks.targetDeadlineDays)}

    <div class="ftr">
      <span>B Mortgage Services &middot; bmortgageservices.co.uk</span>
      <span>Page 2 of 4 &middot; ${data.reportId}</span>
    </div>
  </div>

  <!-- ═══════════════════════════════════════════════════════════════════════
       PAGE 3 — THE REALITY CHECK
       ═══════════════════════════════════════════════════════════════════════ -->
  <div class="page">
    <div class="wm-wrap">${charts.watermark()}</div>

    <div class="hdr">
      <div class="hdr__brand">B Mortgage Services</div>
      <div class="hdr__meta">Financial Wellness Report<br>${data.generatedDate}</div>
    </div>

    <h2>The Reality <span class="accent">Check</span></h2>
    <p class="subtitle mb-md">What happens to your household finances if you can't work for an extended period?</p>

    <!-- Income Waterfall Chart -->
    <div class="wf-chart">
      ${charts.waterfallChart(data.waterfall, data.household.monthlyEssentials)}
    </div>

    ${(lastWF && lastWF.cumulativeShortfall) ? `
    <div class="shortfall-callout">
      <div class="shortfall-callout__val">&pound;${fmt(lastWF.cumulativeShortfall)}</div>
      <div class="shortfall-callout__label">Total 6-month shortfall — the amount you'd need from savings or other sources to cover essential outgoings.</div>
    </div>` : ''}

    <!-- Risk Statistics -->
    <h3>The Statistics Over a 25-Year Mortgage</h3>
    <div class="risk-grid">
      <div class="risk-card risk-card--death">
        <div class="risk-card__icon">&#9760;</div>
        <div class="risk-card__val">${data.riskAssessment.formatted.death}</div>
        <div class="risk-card__label">Chance of Death</div>
        <div class="risk-card__ctx">During a 25-year mortgage term</div>
      </div>
      <div class="risk-card risk-card--ci">
        <div class="risk-card__icon">&#9829;</div>
        <div class="risk-card__val">${data.riskAssessment.formatted.criticalIllness}</div>
        <div class="risk-card__label">Critical Illness</div>
        <div class="risk-card__ctx">Probability of diagnosis</div>
      </div>
      <div class="risk-card risk-card--absence">
        <div class="risk-card__icon">&#9201;</div>
        <div class="risk-card__val">${data.riskAssessment.formatted.longTermAbsence}</div>
        <div class="risk-card__label">2+ Month Absence</div>
        <div class="risk-card__ctx">From work during term</div>
      </div>
    </div>

    <p class="text-sm text-slate text-italic mb-md">
      Statistics based on age bracket (${escHtml(data.riskAssessment.probabilities.ageBracket)}) and smoking status (${escHtml(data.riskAssessment.probabilities.smokingStatus)}). Individual risk varies — discuss with a qualified adviser.
    </p>

    <!-- State Benefit Info -->
    <div class="info-box info-box--blue">
      <div class="info-box__title">Understanding Your State Benefit Entitlement</div>
      ${data.stateBenefit.type === 'SSP'
        ? `<p>As a PAYE employee, you are entitled to <strong>Statutory Sick Pay (SSP)</strong> of &pound;${data.benchmarks.sspWeekly}/week (&pound;${data.benchmarks.sspMonthly}/month) for up to ${data.benchmarks.sspMaxWeeks} weeks. SSP is payable from day 1 of sickness (from April 2026).</p>
           <p>After SSP ends, you may be eligible for <strong>New Style ESA</strong> at &pound;${data.benchmarks.esaWeeklyAssessment}/week and <strong>Universal Credit</strong> (&pound;${data.benchmarks.ucSingle}/month plus up to &pound;${data.benchmarks.ucLCWRA}/month LCWRA element).</p>`
        : `<p>As self-employed, you are <strong>not eligible for SSP</strong>. You may claim <strong>New Style ESA</strong> at &pound;${data.benchmarks.esaWeeklyAssessment}/week (&pound;${data.benchmarks.esaMonthlyAssessment}/month) during the 13-week assessment phase, rising to &pound;${data.benchmarks.esaWeeklySupportGroup}/week in the Support Group.</p>
           <p>You may also qualify for <strong>Universal Credit</strong> (&pound;${data.benchmarks.ucSingle}/month plus up to &pound;${data.benchmarks.ucLCWRA}/month LCWRA element).</p>`}
    </div>

    <div class="info-box info-box--amber">
      <div class="info-box__title">&#9888; State Benefits Are Not Guaranteed</div>
      <p>To receive ESA or Universal Credit health element, you must pass the <strong>Work Capability Assessment</strong> — approximately <strong>1 in 5 claimants are found fit for work</strong> at initial assessment. The process takes around 4 months from claim to decision.</p>
    </div>

    <div class="ftr">
      <span>B Mortgage Services &middot; bmortgageservices.co.uk</span>
      <span>Page 3 of 4 &middot; ${data.reportId}</span>
    </div>
  </div>

  <!-- ═══════════════════════════════════════════════════════════════════════
       PAGE 4 — NEXT STEPS
       ═══════════════════════════════════════════════════════════════════════ -->
  <div class="page page--alt">
    <div class="wm-wrap">${charts.watermark()}</div>

    <div class="hdr">
      <div class="hdr__brand">B Mortgage Services</div>
      <div class="hdr__meta">Financial Wellness Report<br>${data.generatedDate}</div>
    </div>

    <h2>Your Next <span class="accent">Steps</span></h2>
    <p class="subtitle">Based on your results, here are the most impactful actions you can take right now.</p>

    ${(data.recommendations || []).map(function (rec, idx) {
      return '<div class="rec-card">' +
        '<div class="rec-card__num">' + (idx + 1) + '</div>' +
        '<div class="rec-card__body">' +
          '<div class="rec-card__title">' + escHtml(rec.title) + '</div>' +
          '<div class="rec-card__text">' + escHtml(rec.text) + '</div>' +
        '</div>' +
        '</div>';
    }).join('\n    ')}

    <!-- Employer Benefits Summary -->
    <h3 style="margin-top:18px;">Your Employer Safety Net</h3>
    <div class="stat-grid" style="grid-template-columns: 1fr 1fr; margin-bottom: 20px;">
      <div class="stat-box" style="text-align:left; padding: 12px 16px;">
        <div style="font-size:9px; font-weight:600; color:var(--charcoal); margin-bottom:2px;">Employer Sick Pay</div>
        <div style="font-size:9px; color:var(--slate);">${escHtml(data.employerBenefits.sickPay.description)}</div>
      </div>
      <div class="stat-box" style="text-align:left; padding: 12px 16px;">
        <div style="font-size:9px; font-weight:600; color:var(--charcoal); margin-bottom:2px;">Death in Service</div>
        <div style="font-size:9px; color:var(--slate);">${escHtml(data.employerBenefits.deathInService.description)}</div>
      </div>
    </div>

    <!-- CTA -->
    <div class="cta">
      <h3>Ready to Take the Next Step?</h3>
      <p>Book a free, no-obligation consultation. We'll review your report, discuss your goals, and create a personalised action plan.</p>
      <div class="cta__contact">bmortgageservices.co.uk &middot; info@bmortgagesolutions.co.uk</div>
    </div>

    <div class="disc">
      This report is for informational purposes only and does not constitute financial advice. B Mortgage Services is authorised and regulated by the Financial Conduct Authority. Your home may be repossessed if you do not keep up repayments on your mortgage. Report generated ${data.generatedDate}. Risk probabilities from CMI mortality tables and ONS data. State benefit rates for 2025/26. UK average financial runway: ${data.benchmarks.averageDeadlineDays} days (L&amp;G 2022). Your data is held securely and processed in accordance with our privacy policy.
    </div>

    <div class="ftr">
      <span>B Mortgage Services &middot; bmortgageservices.co.uk</span>
      <span>Page 4 of 4 &middot; ${data.reportId}</span>
    </div>
  </div>

</body>
</html>`;
};
