/**
 * Wellness Report — Client-side renderer
 *
 * Reads report data from sessionStorage (instant) or falls back to
 * GET /api/wellness-report?reportId={id}. Renders a premium editorial
 * layout with inline SVG charts.
 *
 * Uses ES5 var declarations for broad browser compatibility.
 */

(function () {
  'use strict';

  // ── Brand Constants ──────────────────────────────────────────────────────
  var ORANGE = '#F05B28';
  var CHARCOAL = '#2D2D2D';
  var SLATE = '#64748B';
  var LIGHT_GREY = '#E5E7EB';
  var GREEN = '#22C55E';
  var RED = '#EF4444';

  // ── DOM References ───────────────────────────────────────────────────────
  var loadingEl = document.getElementById('report-loading');
  var errorEl = document.getElementById('report-error');
  var contentEl = document.getElementById('report-content');

  // ── Init ──────────────────────────────────────────────────────────────────
  var params = new URLSearchParams(window.location.search);
  var reportId = params.get('id') || params.get('reportId');

  if (!reportId) {
    showError();
    return;
  }

  // Try sessionStorage first, then API
  var sessionKey = 'bms_report_' + reportId;
  var cached = sessionStorage.getItem(sessionKey);

  if (cached) {
    try {
      var parsed = JSON.parse(cached);
      if (parsed.data && parsed.expiry && parsed.expiry > Date.now()) {
        renderReport(parsed.data, reportId);
        return;
      }
    } catch (e) {
      // Corrupted cache — fall through to API
    }
  }

  // Fallback: fetch from API
  fetchReport(reportId);

  // ── Fetch from API ───────────────────────────────────────────────────────
  function fetchReport(id) {
    fetch('/api/wellness-report?reportId=' + encodeURIComponent(id))
      .then(function (res) {
        if (!res.ok) throw new Error('Report not found');
        return res.json();
      })
      .then(function (json) {
        if (!json.data) throw new Error('Invalid report data');
        renderReport(json.data, id);
      })
      .catch(function () {
        showError();
      });
  }

  // ── State helpers ────────────────────────────────────────────────────────
  function showError() {
    loadingEl.style.display = 'none';
    errorEl.style.display = '';
  }

  // ── Format helpers ───────────────────────────────────────────────────────
  function fmt(num) {
    var val = parseFloat(num) || 0;
    return val.toLocaleString('en-GB', { maximumFractionDigits: 0 });
  }

  function fmtDec(num, d) {
    return (parseFloat(num) || 0).toFixed(typeof d === 'number' ? d : 1);
  }

  function esc(str) {
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function pct(score, max) {
    var s = parseFloat(score) || 0;
    var m = parseFloat(max) || 1;
    return Math.round((s / m) * 100);
  }

  function pillarColor(p) {
    if (p >= 75) return GREEN;
    if (p >= 50) return ORANGE;
    return RED;
  }

  // ── Metric gauge helpers ──────────────────────────────────────────────
  function tierColor(tier) {
    var map = { excellent: '#22C55E', good: '#84CC16', acceptable: '#EAB308', stretched: '#F97316', difficult: '#EF4444', high: '#EF4444' };
    return map[tier] || '#6B7280';
  }
  function ltiGaugePct(r) { return Math.min(100, Math.max(0, (r / 6) * 100)); }
  function dtiGaugePct(r) { return Math.min(100, Math.max(0, (r / 60) * 100)); }
  function ltvGaugePct(r) { return Math.min(100, Math.max(0, r)); }

  function buildMetricCard(title, value, tier, desc, pctVal, color, legend) {
    var tierLbl = tier ? tier.charAt(0).toUpperCase() + tier.slice(1) : '';
    var h = '<div class="report-mcard">';
    h += '<div class="report-mcard__title">' + esc(title) + '</div>';
    h += '<div class="report-mcard__val" style="color:' + color + ';">' + esc(value) + '</div>';
    h += '<div class="report-mcard__bar"><div class="report-mcard__fill" style="width:' + pctVal + '%;background:' + color + ';"></div></div>';
    h += '<div class="report-mcard__tier" style="color:' + color + ';">' + tierLbl + '</div>';
    h += '<p class="report-mcard__desc">' + esc(desc) + '</p>';
    h += '<div class="report-mcard__legend">';
    for (var li = 0; li < legend.length; li++) {
      h += '<span><span class="report-mcard__dot" style="background:' + legend[li].color + ';"></span>' + legend[li].label + '</span>';
    }
    h += '</div></div>';
    return h;
  }

  // ── SVG Chart Generators (client-side mirrors of report-charts.js) ─────

  function gaugeChart(score, max) {
    var s = Math.max(0, Math.min(score || 0, max || 100));
    var m = max || 100;
    var fraction = s / m;
    var cx = 150, cy = 140, outerR = 110, innerR = 72;

    var segments = [
      { color: '#E85D3A', start: 180, sweep: 36 },
      { color: '#F0983E', start: 216, sweep: 36 },
      { color: '#C5B944', start: 252, sweep: 36 },
      { color: '#7BAA45', start: 288, sweep: 36 },
      { color: '#4A6B5A', start: 324, sweep: 36 }
    ];

    function segPath(outer, inner, startDeg, sweepDeg) {
      var a1 = (startDeg - 0.3) * Math.PI / 180;
      var a2 = (startDeg + sweepDeg + 0.3) * Math.PI / 180;
      var ox1 = cx + outer * Math.cos(a1), oy1 = cy + outer * Math.sin(a1);
      var ox2 = cx + outer * Math.cos(a2), oy2 = cy + outer * Math.sin(a2);
      var ix1 = cx + inner * Math.cos(a1), iy1 = cy + inner * Math.sin(a1);
      var ix2 = cx + inner * Math.cos(a2), iy2 = cy + inner * Math.sin(a2);
      var lg = sweepDeg > 180 ? 1 : 0;
      return 'M ' + ox1 + ' ' + oy1 + ' A ' + outer + ' ' + outer + ' 0 ' + lg + ' 1 ' + ox2 + ' ' + oy2 +
        ' L ' + ix2 + ' ' + iy2 + ' A ' + inner + ' ' + inner + ' 0 ' + lg + ' 0 ' + ix1 + ' ' + iy1 + ' Z';
    }

    var segs = '';
    for (var i = 0; i < segments.length; i++) {
      var sg = segments[i];
      segs += '<path d="' + segPath(outerR, innerR, sg.start, sg.sweep) + '" fill="' + sg.color + '" />';
    }

    var needleAngle = 180 + (fraction * 180);
    var needleLen = outerR - 8;
    var nRad = needleAngle * Math.PI / 180;
    var nx = cx + needleLen * Math.cos(nRad), ny = cy + needleLen * Math.sin(nRad);
    var pRad = nRad + Math.PI / 2;
    var bw = 4;
    var bx1 = cx + bw * Math.cos(pRad), by1 = cy + bw * Math.sin(pRad);
    var bx2 = cx - bw * Math.cos(pRad), by2 = cy - bw * Math.sin(pRad);

    var needle = '<polygon points="' + nx + ',' + ny + ' ' + bx1 + ',' + by1 + ' ' + bx2 + ',' + by2 + '" fill="#FFFFFF" />';
    var hub = '<circle cx="' + cx + '" cy="' + cy + '" r="8" fill="#FFFFFF" /><circle cx="' + cx + '" cy="' + cy + '" r="4" fill="' + ORANGE + '" />';

    var txt = '<text x="' + cx + '" y="' + (cy + 36) + '" text-anchor="middle" font-family="Playfair Display,Georgia,serif" font-size="36" font-weight="700" fill="#FFFFFF">' + Math.round(s) + '</text>' +
      '<text x="' + cx + '" y="' + (cy + 52) + '" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-size="12" fill="rgba(255,255,255,0.6)">out of ' + m + '</text>';

    var scaleLbls = '';
    var scaleVals = [0, 25, 50, 75, 100];
    for (var si = 0; si < scaleVals.length; si++) {
      var sA = (180 + scaleVals[si] / 100 * 180) * Math.PI / 180;
      var sx = cx + (outerR + 14) * Math.cos(sA), sy = cy + (outerR + 14) * Math.sin(sA);
      scaleLbls += '<text x="' + sx + '" y="' + (sy + 3) + '" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-size="9" fill="rgba(255,255,255,0.6)">' + scaleVals[si] + '</text>';
    }

    return '<svg viewBox="0 0 300 200" xmlns="http://www.w3.org/2000/svg" class="report-gauge">' +
      segs + needle + hub + txt + scaleLbls + '</svg>';
  }

  function radarChart(pillars) {
    var p = pillars || {};
    var vals = [
      (p.mortgageEligibility || 0) / 100,
      (p.affordabilityBudget || 0) / 100,
      (p.financialResilience || 0) / 100,
      (p.protectionReadiness || 0) / 100
    ];
    var labels = ['Mortgage\nEligibility', 'Affordability\n& Budget', 'Financial\nResilience', 'Protection\nReadiness'];
    var cx = 150, cy = 150, maxR = 100;
    var angles = [-90, 0, 90, 180];

    function ptAt(deg, ratio) {
      var rad = deg * Math.PI / 180;
      return { x: cx + Math.cos(rad) * maxR * ratio, y: cy + Math.sin(rad) * maxR * ratio };
    }

    var gridLines = '';
    var levels = [0.25, 0.5, 0.75, 1.0];
    for (var g = 0; g < levels.length; g++) {
      var pts = [];
      for (var a = 0; a < angles.length; a++) {
        var gp = ptAt(angles[a], levels[g]);
        pts.push(gp.x + ',' + gp.y);
      }
      gridLines += '<polygon points="' + pts.join(' ') + '" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1" />';
    }

    var axisLines = '';
    for (var i = 0; i < angles.length; i++) {
      var ep = ptAt(angles[i], 1);
      axisLines += '<line x1="' + cx + '" y1="' + cy + '" x2="' + ep.x + '" y2="' + ep.y + '" stroke="rgba(255,255,255,0.2)" stroke-width="1" />';
    }

    var dataPoints = [];
    for (var d = 0; d < angles.length; d++) {
      var dp = ptAt(angles[d], vals[d]);
      dataPoints.push(dp.x + ',' + dp.y);
    }

    var labelOffsets = [
      { dx: 0, dy: -18, anchor: 'middle' },
      { dx: 18, dy: 4, anchor: 'start' },
      { dx: 0, dy: 22, anchor: 'middle' },
      { dx: -18, dy: 4, anchor: 'end' }
    ];

    var labelMkp = '';
    for (var l = 0; l < angles.length; l++) {
      var lp = ptAt(angles[l], 1);
      var lo = labelOffsets[l];
      var parts = labels[l].split('\n');
      labelMkp += '<text x="' + (lp.x + lo.dx) + '" y="' + (lp.y + lo.dy) + '" text-anchor="' + lo.anchor + '" font-family="Inter,system-ui,sans-serif" font-size="10" fill="rgba(255,255,255,0.75)">';
      for (var pl = 0; pl < parts.length; pl++) {
        labelMkp += '<tspan x="' + (lp.x + lo.dx) + '" dy="' + (pl === 0 ? '0' : '12') + '">' + parts[pl] + '</tspan>';
      }
      labelMkp += '</text>';

      var ddp = ptAt(angles[l], vals[l]);
      labelMkp += '<text x="' + ddp.x + '" y="' + (ddp.y + (vals[l] < 0.3 ? 0 : -2)) + '" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-size="11" font-weight="700" fill="' + ORANGE + '">' + Math.round(vals[l] * 100) + '%</text>';
    }

    return '<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg" class="report-radar">' +
      gridLines + axisLines +
      '<polygon points="' + dataPoints.join(' ') + '" fill="rgba(240,91,40,0.15)" stroke="' + ORANGE + '" stroke-width="2" />' +
      labelMkp + '</svg>';
  }

  function runwayBars(userDays, avgDays, targetDays) {
    var user = Math.max(0, userDays || 0);
    var avg = avgDays || 19;
    var target = targetDays || 90;
    var maxVal = Math.max(user, target) * 1.2;
    var w = 360, barH = 22, gapV = 12, labelW = 80;
    var chartW = w - labelW - 60;
    var totalH = barH * 3 + gapV * 4;

    function bLen(val) { return Math.max(4, Math.round((val / maxVal) * chartW)); }

    var userLen = bLen(user), avgLen = bLen(avg), targetLen = bLen(target);
    var userCol = user >= target ? GREEN : (user >= 60 ? ORANGE : RED);

    function row(y, label, len, fill, stroke, dayLabel, labelFill, dayFill, bold) {
      var barFill = stroke ? 'fill="none" stroke="' + stroke + '" stroke-width="1.5" stroke-dasharray="6 3"' : 'fill="' + fill + '"';
      var fontW = bold ? ' font-weight="700"' : '';
      return '<text x="0" y="' + (y + barH / 2 + 4) + '" font-family="Inter,system-ui,sans-serif" font-size="10"' + (bold ? ' font-weight="600"' : '') + ' fill="' + labelFill + '">' + label + '</text>' +
        '<rect x="' + labelW + '" y="' + y + '" width="' + len + '" height="' + barH + '" rx="4" ' + barFill + ' />' +
        '<text x="' + (labelW + len + 6) + '" y="' + (y + barH / 2 + 4) + '" font-family="Inter,system-ui,sans-serif" font-size="10"' + fontW + ' fill="' + dayFill + '">' + dayLabel + '</text>';
    }

    return '<svg viewBox="0 0 ' + w + ' ' + totalH + '" xmlns="http://www.w3.org/2000/svg" class="report-runway-bars">' +
      row(gapV,               'Your Runway', userLen,   userCol,    null,  user + ' days',   CHARCOAL, CHARCOAL, true) +
      row(gapV * 2 + barH,    'UK Average',  avgLen,    LIGHT_GREY, null,  avg + ' days',    SLATE,    SLATE,    false) +
      row(gapV * 3 + barH * 2, 'Target',     targetLen, null,       SLATE, target + '+ days', SLATE,    SLATE,    false) +
      '</svg>';
  }

  function waterfallChart(waterfall, essentials) {
    if (!waterfall || waterfall.length === 0) return '';
    var w = 500, h = 280, pL = 60, pR = 20, pT = 30, pB = 50;
    var cW = w - pL - pR, cH = h - pT - pB;
    var maxVal = essentials * 1.15;
    var bW = Math.floor(cW / waterfall.length) - 8;

    function yPos(val) { return pT + cH - (val / maxVal * cH); }

    var essY = yPos(essentials);
    var bars = '', lbls = '';

    for (var i = 0; i < waterfall.length; i++) {
      var item = waterfall[i];
      var x = pL + i * (bW + 8) + 4;
      var iH = Math.max(0, item.income / maxVal * cH);
      var iY = pT + cH - iH;

      bars += '<rect x="' + x + '" y="' + iY + '" width="' + bW + '" height="' + iH + '" rx="3" fill="' + ORANGE + '" opacity="0.85" />';

      if (item.income < essentials) {
        var sH = (essentials - item.income) / maxVal * cH;
        bars += '<rect x="' + x + '" y="' + essY + '" width="' + bW + '" height="' + sH + '" fill="' + LIGHT_GREY + '" opacity="0.5" />';
      }

      lbls += '<text x="' + (x + bW / 2) + '" y="' + (h - pB + 16) + '" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-size="10" fill="' + SLATE + '">Month ' + item.month + '</text>';
      lbls += '<text x="' + (x + bW / 2) + '" y="' + (iY - 6) + '" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-size="9" font-weight="600" fill="' + CHARCOAL + '">\u00a3' + fmt(item.income) + '</text>';
    }

    var essLine = '<line x1="' + pL + '" y1="' + essY + '" x2="' + (w - pR) + '" y2="' + essY + '" stroke="' + RED + '" stroke-width="1.5" stroke-dasharray="6 3" />';
    var essLbl = '<text x="' + (w - pR) + '" y="' + (essY - 6) + '" text-anchor="end" font-family="Inter,system-ui,sans-serif" font-size="9" font-weight="600" fill="' + RED + '">Essentials \u00a3' + fmt(essentials) + '</text>';

    var yLabels = '';
    var steps = [0, 0.25, 0.5, 0.75, 1.0];
    for (var s = 0; s < steps.length; s++) {
      var yVal = Math.round(maxVal * steps[s]);
      var yy = yPos(yVal);
      yLabels += '<text x="' + (pL - 8) + '" y="' + (yy + 3) + '" text-anchor="end" font-family="Inter,system-ui,sans-serif" font-size="9" fill="' + SLATE + '">\u00a3' + fmt(yVal) + '</text>';
      if (steps[s] > 0 && steps[s] < 1) {
        yLabels += '<line x1="' + pL + '" y1="' + yy + '" x2="' + (w - pR) + '" y2="' + yy + '" stroke="' + LIGHT_GREY + '" stroke-width="0.5" />';
      }
    }

    return '<svg viewBox="0 0 ' + w + ' ' + h + '" xmlns="http://www.w3.org/2000/svg" class="report-waterfall">' +
      yLabels + bars + essLine + essLbl + lbls + '</svg>';
  }

  function miniBar(p, color) {
    var val = Math.max(0, Math.min(p || 0, 100));
    return '<svg viewBox="0 0 120 8" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:120px;vertical-align:middle;">' +
      '<rect x="0" y="0" width="120" height="8" rx="4" fill="' + LIGHT_GREY + '" />' +
      '<rect x="0" y="0" width="' + Math.round(val * 1.2) + '" height="8" rx="4" fill="' + (color || ORANGE) + '" />' +
      '</svg>';
  }

  // ── Recommendations (mirrors pdf-generator.js logic) ─────────────────────

  function generateRecommendations(data) {
    var recs = [];

    if (data.runway && data.runway.days < 90) {
      recs.push({
        title: 'Build Your Emergency Fund',
        text: 'Your financial runway of ' + data.runway.days + ' days is below the recommended 3-month target. Aim to build accessible savings to cover at least 90 days of essential outgoings (\u00a3' + fmt(data.household.monthlyEssentials * 3) + ').'
      });
    }

    if (data.breakdown.protection.totalScore < 10) {
      recs.push({
        title: 'Review Your Protection Cover',
        text: 'Your protection cover has room for improvement. Income protection, life insurance, and critical illness cover can safeguard your mortgage payments if the unexpected happens.'
      });
    }

    if (data.breakdown.deposit.ltv > 90) {
      recs.push({
        title: 'Boost Your Deposit',
        text: 'Your current LTV is ' + Math.round(data.breakdown.deposit.ltv) + '%. Increasing your deposit to reach 90% LTV or below could unlock better mortgage rates and reduce monthly payments.'
      });
    }

    if (data.breakdown.credit.score < 7) {
      recs.push({
        title: 'Strengthen Your Credit Profile',
        text: 'Improving your credit history could significantly boost your mortgage options. Register on the electoral roll, ensure all bills are paid on time, and check your credit report for errors.'
      });
    }

    if (data.breakdown.surplus.score < 12) {
      recs.push({
        title: 'Improve Your Monthly Budget',
        text: 'Lenders look for a comfortable surplus after mortgage payments. Review your monthly outgoings for potential savings and aim to demonstrate consistent saving habits over 3-6 months.'
      });
    }

    if (recs.length < 2) {
      recs.push({
        title: 'Book a Mortgage Review',
        text: 'You\u2019re in a strong position. A professional mortgage review can help you find the best rates and products for your situation, potentially saving thousands over your mortgage term.'
      });
    }

    return recs.slice(0, 4);
  }

  // ── Main Render ──────────────────────────────────────────────────────────

  function renderReport(data, id) {
    var pp = data.pillarPercentages || {};
    var lastWF = (data.waterfall && data.waterfall.length > 0)
      ? data.waterfall[data.waterfall.length - 1]
      : null;

    var breakdownRows = [
      { label: 'Employment Status', score: data.breakdown.employment.score, max: data.breakdown.employment.maxScore },
      { label: 'Credit History', score: data.breakdown.credit.score, max: data.breakdown.credit.maxScore },
      { label: 'Deposit / LTV', score: data.breakdown.deposit.score, max: data.breakdown.deposit.maxScore },
      { label: 'Monthly Surplus', score: data.breakdown.surplus.score, max: data.breakdown.surplus.maxScore },
      { label: 'Emergency Savings', score: data.breakdown.emergency.score, max: data.breakdown.emergency.maxScore },
      { label: 'Protection Cover', score: data.breakdown.protection.totalScore, max: data.breakdown.protection.maxScore }
    ];

    // Generate recommendations client-side (not included in API response)
    var recs = data.recommendations || generateRecommendations(data);

    var generatedDate = new Date().toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric'
    });

    var html = '';

    // ── Section 1: Executive Summary ─────────────────────────────────────

    html += '<section class="report-section report-section--hero">';
    html += '<div class="container">';
    html += '<div class="report-header">';
    html += '<img src="/images/BMS_logoWhite.png" alt="B Mortgage Services" class="report-header__logo">';
    html += '<h1 class="report-title">Your Financial <span class="report-title__accent">Wellness</span> Report</h1>';
    html += '<p class="report-subtitle">A personalised snapshot of your mortgage readiness, financial resilience, and protection cover.</p>';
    html += '</div>';

    // Score hero
    html += '<div class="report-score-hero">';
    html += '<div class="report-score-hero__gauge">' + gaugeChart(data.score, 100) + '</div>';
    html += '<div class="report-score-hero__text">';
    html += '<h2 class="report-score-hero__category">' + esc(data.category) + '</h2>';
    html += '<p class="report-score-hero__interp">' + esc(data.interpretation) + '</p>';
    html += '</div>';
    html += '</div>';

    // Four pillars
    html += '<h2 class="report-section__heading">The Four <span class="report-section__heading-accent">Pillars</span></h2>';
    html += '<div class="report-pillars">';
    html += '<div class="report-pillars__chart">' + radarChart(pp) + '</div>';
    html += '<div class="report-pillars__cards">';

    var pillarData = [
      { key: 'mortgageEligibility', label: 'Eligibility', cls: 'elig' },
      { key: 'affordabilityBudget', label: 'Affordability', cls: 'aff' },
      { key: 'financialResilience', label: 'Resilience', cls: 'res' },
      { key: 'protectionReadiness', label: 'Protection', cls: 'prot' }
    ];

    for (var pi = 0; pi < pillarData.length; pi++) {
      var pd = pillarData[pi];
      html += '<div class="report-pcard report-pcard--' + pd.cls + '">';
      html += '<div class="report-pcard__label">' + esc(pd.label) + '</div>';
      html += '<div class="report-pcard__pct">' + (pp[pd.key] || 0) + '%</div>';
      html += '</div>';
    }
    html += '</div>'; // pillars__cards
    html += '</div>'; // report-pillars

    // Strengths & Improvements
    html += '<div class="report-two-col">';
    html += '<div class="report-sicard report-sicard--green">';
    html += '<h3 class="report-sicard__title">Your Strengths</h3>';
    html += '<ul class="report-sicard__list">';
    (data.strengths || []).forEach(function (s) { html += '<li>' + esc(s) + '</li>'; });
    html += '</ul></div>';
    html += '<div class="report-sicard report-sicard--orange">';
    html += '<h3 class="report-sicard__title">Areas to Improve</h3>';
    html += '<ul class="report-sicard__list">';
    (data.improvements || []).forEach(function (s) { html += '<li>' + esc(s) + '</li>'; });
    html += '</ul></div>';
    html += '</div>'; // two-col

    html += '</div></section>'; // section 1

    // ── Section 1b: Mortgage Health (conditional) ──────────────────────
    var mm = data.mortgageMetrics || {};
    var hasLTI = mm.lti && mm.lti.ratio !== null;
    var hasDTI = mm.dti && mm.dti.ratio !== null;
    var hasLTV = mm.ltv && mm.ltv.ratio < 100 && mm.loanAmount > 0;

    if (hasLTI || hasDTI || hasLTV) {
      html += '<section class="report-section report-section--alt">';
      html += '<div class="container">';
      html += '<h2 class="report-section__heading">Your Mortgage <span class="report-section__heading-accent">Health</span></h2>';
      html += '<p class="report-section__intro">Key ratios lenders use to assess your borrowing. Green means you\'re well within typical limits; amber or red may need a specialist lender or larger deposit.</p>';

      if (mm.grossIncome && mm.grossIncome.isEstimated) {
        html += '<p class="report-note">Note: Your gross income has been estimated from your take-home pay. For more accurate results, enter your gross annual salary.</p>';
      }

      // LTI / DTI / LTV cards
      html += '<div class="report-metric-grid">';
      if (hasLTI) {
        html += buildMetricCard('Loan-to-Income', mm.lti.ratioFormatted, mm.lti.tier, mm.lti.description, ltiGaugePct(mm.lti.ratio), tierColor(mm.lti.tier),
          [{ label: '< 3.5x', color: '#22C55E' }, { label: '3.5\u20134.5x', color: '#EAB308' }, { label: '> 4.5x', color: '#EF4444' }]);
      }
      if (hasDTI) {
        html += buildMetricCard('Debt-to-Income', mm.dti.ratioFormatted, mm.dti.tier, mm.dti.description, dtiGaugePct(mm.dti.ratio), tierColor(mm.dti.tier),
          [{ label: '< 25%', color: '#22C55E' }, { label: '25\u201335%', color: '#EAB308' }, { label: '> 45%', color: '#EF4444' }]);
      }
      if (hasLTV) {
        var ltvD = mm.ltv.ratio <= 75 ? 'Best rates available' : mm.ltv.ratio <= 85 ? 'Good range of products' : mm.ltv.ratio <= 90 ? 'Standard lending' : 'Limited options';
        html += buildMetricCard('Loan-to-Value', mm.ltv.formatted, mm.ltv.tier, ltvD, ltvGaugePct(mm.ltv.ratio), tierColor(mm.ltv.tier),
          [{ label: '< 75%', color: '#22C55E' }, { label: '85\u201390%', color: '#EAB308' }, { label: '> 90%', color: '#EF4444' }]);
      }
      html += '</div>';

      // Affordability breakdown
      if (hasDTI && mm.dti.estimatedMortgagePayment > 0) {
        html += '<h3 class="report-label-heading">Monthly Affordability Breakdown</h3>';
        html += '<table class="report-aff-table">';
        html += '<tr><td>Estimated mortgage payment (at ' + mm.dti.rateUsed + '%)</td><td>\u00a3' + fmt(mm.dti.estimatedMortgagePayment) + '</td></tr>';
        if (mm.dti.monthlyCommitments > 0) {
          html += '<tr><td>Other monthly commitments</td><td>\u00a3' + fmt(mm.dti.monthlyCommitments) + '</td></tr>';
        }
        html += '<tr class="report-aff-total"><td>Total monthly debt</td><td>\u00a3' + fmt(mm.dti.totalMonthlyDebt) + '</td></tr>';
        html += '<tr><td>Gross monthly income</td><td>\u00a3' + fmt(Math.round((mm.grossIncome ? mm.grossIncome.total : 0) / 12)) + '</td></tr>';
        if (mm.dti.stressTestedPayment > 0) {
          html += '<tr class="report-aff-stress"><td>Mortgage payment at stress test (' + mm.dti.stressRate + '%)</td><td>\u00a3' + fmt(mm.dti.stressTestedPayment) + '</td></tr>';
        }
        html += '</table>';
      }

      // Property summary
      if (data.breakdown.deposit.propertyValue) {
        html += '<h3 class="report-label-heading">Property &amp; Mortgage Summary</h3>';
        html += '<div class="report-stat-grid">';
        var propStats2 = [
          { val: '\u00a3' + fmt(data.breakdown.deposit.propertyValue), label: 'Property Value' },
          { val: '\u00a3' + fmt(data.breakdown.deposit.value), label: 'Deposit' },
          { val: '\u00a3' + fmt(mm.loanAmount || ((parseFloat(data.breakdown.deposit.propertyValue) || 0) - (parseFloat(data.breakdown.deposit.value) || 0))), label: 'Mortgage Amount' },
          { val: fmtDec(data.breakdown.deposit.ltv, 1) + '%', label: 'Loan to Value' }
        ];
        for (var ps2 = 0; ps2 < propStats2.length; ps2++) {
          html += '<div class="report-stat-box">';
          html += '<div class="report-stat-box__val">' + propStats2[ps2].val + '</div>';
          html += '<div class="report-stat-box__label">' + propStats2[ps2].label + '</div>';
          html += '</div>';
        }
        html += '</div>';
      }

      html += '</div></section>';
    }

    // ── Section 2: Financial Health ──────────────────────────────────────

    html += '<section class="report-section report-section--alt">';
    html += '<div class="container">';
    html += '<h2 class="report-section__heading">Your Financial <span class="report-section__heading-accent">Health</span></h2>';

    // Household dashboard
    html += '<h3 class="report-label-heading">Household Dashboard</h3>';
    html += '<div class="report-stat-grid">';

    var stats = [
      { val: '\u00a3' + fmt(data.household.monthlyIncome), label: 'Monthly Income' },
      { val: '\u00a3' + fmt(data.household.monthlyEssentials), label: 'Monthly Essentials' },
      { val: '\u00a3' + fmt(data.household.accessibleSavings), label: 'Accessible Savings' },
      { val: '\u00a3' + fmt(data.household.monthlySurplus), label: 'Monthly Surplus' }
    ];
    for (var si = 0; si < stats.length; si++) {
      html += '<div class="report-stat-box">';
      html += '<div class="report-stat-box__val">' + stats[si].val + '</div>';
      html += '<div class="report-stat-box__label">' + stats[si].label + '</div>';
      html += '</div>';
    }
    html += '</div>';

    // Score breakdown
    html += '<h3 class="report-label-heading">Score Breakdown</h3>';
    html += '<table class="report-bd-table"><thead><tr>';
    html += '<th>Component</th><th>Progress</th><th>Score</th>';
    html += '</tr></thead><tbody>';
    for (var bi = 0; bi < breakdownRows.length; bi++) {
      var row = breakdownRows[bi];
      var rowPct = pct(row.score, row.max);
      var rowCol = pillarColor(rowPct);
      html += '<tr>';
      html += '<td>' + esc(row.label) + '</td>';
      html += '<td>' + miniBar(rowPct, rowCol) + '</td>';
      html += '<td>' + row.score + ' / ' + row.max + '</td>';
      html += '</tr>';
    }
    html += '</tbody></table>';

    // Financial runway
    html += '<h3 class="report-label-heading">Financial Runway</h3>';
    html += '<div class="report-runway-hero">';
    html += '<div class="report-runway-hero__big">' + data.runway.days + '</div>';
    html += '<div class="report-runway-hero__unit">days</div>';
    html += '<div class="report-runway-hero__body">';
    html += '<p>If your income stopped today, your savings would cover essential outgoings for approximately <strong>' + data.runway.days + ' days (' + data.runway.months + ' months)</strong>.</p>';
    html += '</div></div>';
    html += '<div class="report-runway-chart">' + runwayBars(data.runway.days, data.benchmarks.averageDeadlineDays, data.benchmarks.targetDeadlineDays) + '</div>';

    html += '</div></section>'; // section 2

    // ── Section 3: The Reality Check ─────────────────────────────────────

    html += '<section class="report-section">';
    html += '<div class="container">';
    html += '<h2 class="report-section__heading">The Reality <span class="report-section__heading-accent">Check</span></h2>';
    html += '<p class="report-section__intro">What happens to your household finances if you can\'t work for an extended period?</p>';

    // Waterfall chart
    html += '<div class="report-wf-chart">' + waterfallChart(data.waterfall, data.household.monthlyEssentials) + '</div>';

    // Shortfall callout
    if (lastWF && lastWF.cumulativeShortfall) {
      html += '<div class="report-shortfall-callout">';
      html += '<div class="report-shortfall-callout__val">\u00a3' + fmt(lastWF.cumulativeShortfall) + '</div>';
      html += '<p class="report-shortfall-callout__label">Total 6-month shortfall — the amount you\'d need from savings or other sources to cover essential outgoings.</p>';
      html += '</div>';
    }

    // Risk stats
    html += '<h3 class="report-label-heading">The Statistics Over a 25-Year Mortgage</h3>';
    html += '<div class="report-risk-grid">';

    var risks = [
      { cls: 'death', icon: '\u2620', val: data.riskAssessment.formatted.death, label: 'Chance of Death', ctx: 'During a 25-year mortgage term' },
      { cls: 'ci', icon: '\u2665', val: data.riskAssessment.formatted.criticalIllness, label: 'Critical Illness', ctx: 'Probability of diagnosis' },
      { cls: 'absence', icon: '\u23F1', val: data.riskAssessment.formatted.longTermAbsence, label: '2+ Month Absence', ctx: 'From work during term' }
    ];
    for (var ri = 0; ri < risks.length; ri++) {
      var rk = risks[ri];
      html += '<div class="report-risk-card report-risk-card--' + rk.cls + '">';
      html += '<div class="report-risk-card__icon">' + rk.icon + '</div>';
      html += '<div class="report-risk-card__val">' + rk.val + '</div>';
      html += '<div class="report-risk-card__label">' + rk.label + '</div>';
      html += '<div class="report-risk-card__ctx">' + rk.ctx + '</div>';
      html += '</div>';
    }
    html += '</div>';

    html += '<p class="report-footnote">Statistics based on age bracket (' + esc(data.riskAssessment.probabilities.ageBracket) + ') and smoking status (' + esc(data.riskAssessment.probabilities.smokingStatus) + '). Individual risk varies.</p>';

    html += '</div></section>'; // section 3

    // ── Section 4: Next Steps ────────────────────────────────────────────

    html += '<section class="report-section report-section--alt">';
    html += '<div class="container">';
    html += '<h2 class="report-section__heading">Your Next <span class="report-section__heading-accent">Steps</span></h2>';
    html += '<p class="report-section__intro">Based on your results, here are the most impactful actions you can take right now.</p>';

    // Recommendation cards (recs generated at top of renderReport)
    for (var rci = 0; rci < recs.length; rci++) {
      html += '<div class="report-rec-card">';
      html += '<div class="report-rec-card__num">' + (rci + 1) + '</div>';
      html += '<div class="report-rec-card__body">';
      html += '<h4 class="report-rec-card__title">' + esc(recs[rci].title) + '</h4>';
      html += '<p class="report-rec-card__text">' + esc(recs[rci].text) + '</p>';
      html += '</div></div>';
    }

    // CTA
    html += '<div class="report-cta">';
    html += '<h3 class="report-cta__title">Ready to Take the Next Step?</h3>';
    html += '<p class="report-cta__text">Book a free, no-obligation consultation. We\'ll review your report, discuss your goals, and create a personalised action plan.</p>';
    html += '<a href="https://calendly.com/bmortgageservices" class="btn btn--primary report-cta__btn" target="_blank" rel="noopener">Book a Free Consultation</a>';
    html += '<p class="report-cta__contact">bmortgageservices.co.uk &middot; info@bmortgagesolutions.co.uk</p>';
    html += '</div>';

    // Disclaimer
    html += '<p class="report-disclaimer">This report is for informational purposes only and does not constitute financial advice. B Mortgage Services is authorised and regulated by the Financial Conduct Authority. Your home may be repossessed if you do not keep up repayments on your mortgage. Report generated ' + generatedDate + '. Report ID: ' + esc(id) + '.</p>';

    html += '</div></section>'; // section 4

    // ── Actions bar (download PDF, print) ────────────────────────────────

    html += '<section class="report-section report-actions">';
    html += '<div class="container">';
    html += '<div class="report-actions__inner">';
    html += '<button type="button" class="btn btn--secondary report-actions__print" onclick="window.print()">Print Report</button>';
    html += '<a href="/api/wellness-pdf?reportId=' + encodeURIComponent(id) + '" class="btn btn--primary report-actions__pdf" target="_blank" rel="noopener">Download PDF</a>';
    html += '</div>';
    html += '</div></section>';

    // ── Inject and show ──────────────────────────────────────────────────
    contentEl.innerHTML = html;
    loadingEl.style.display = 'none';
    contentEl.style.display = '';

    // Update page title
    document.title = 'Your Financial Wellness Report | B Mortgage Services';
  }

})();
