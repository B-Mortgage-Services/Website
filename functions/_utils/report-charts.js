/**
 * Report Charts — Pure SVG generators for the Financial Wellness Report
 *
 * All functions return raw SVG markup strings with no DOM dependency.
 * Used by both pdf-template.js (server-side) and wellness-report.js (browser).
 *
 * Brand colours: Orange #F05B28, Charcoal #2D2D2D, Slate #64748B
 */

var ORANGE = '#F05B28';
var CHARCOAL = '#2D2D2D';
var SLATE = '#64748B';
var LIGHT_GREY = '#E5E7EB';
var GREEN = '#22C55E';
var RED = '#EF4444';

// ── B Monogram Watermark ────────────────────────────────────────────────────

function watermark() {
  return '<svg class="watermark" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:200px;height:200px;opacity:0.02;pointer-events:none;z-index:0;">' +
    '<text x="50" y="72" text-anchor="middle" font-family="Playfair Display,Georgia,serif" font-size="80" font-weight="700" fill="' + CHARCOAL + '">B</text>' +
    '</svg>';
}

// ── Gauge Chart (Score Ring) ────────────────────────────────────────────────

/**
 * Generate an arc-style gauge chart
 * @param {number} score - Current score (0-100)
 * @param {number} max - Maximum score (default 100)
 * @param {string} color - Fill color (default brand orange)
 * @returns {string} SVG markup
 */
function gaugeChart(score, max, color) {
  var s = Math.max(0, Math.min(score || 0, max || 100));
  var m = max || 100;
  var c = color || ORANGE;
  var pct = s / m;

  // Arc parameters: 270-degree sweep, starting at 135 degrees
  var radius = 80;
  var cx = 100;
  var cy = 100;
  var strokeWidth = 12;
  var circumference = 2 * Math.PI * radius;
  var arcLength = circumference * 0.75; // 270 degrees
  var filledLength = arcLength * pct;
  var gapLength = circumference - arcLength;

  // Start angle: 135 degrees (bottom-left)
  var startAngle = 135;

  return '<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:280px;">' +
    // Background arc (grey)
    '<circle cx="' + cx + '" cy="' + cy + '" r="' + radius + '" fill="none" ' +
      'stroke="' + LIGHT_GREY + '" stroke-width="' + strokeWidth + '" ' +
      'stroke-dasharray="' + arcLength + ' ' + gapLength + '" ' +
      'stroke-dashoffset="0" ' +
      'stroke-linecap="round" ' +
      'transform="rotate(' + startAngle + ' ' + cx + ' ' + cy + ')" />' +
    // Filled arc (colored)
    '<circle cx="' + cx + '" cy="' + cy + '" r="' + radius + '" fill="none" ' +
      'stroke="' + c + '" stroke-width="' + strokeWidth + '" ' +
      'stroke-dasharray="' + filledLength + ' ' + (circumference - filledLength) + '" ' +
      'stroke-dashoffset="0" ' +
      'stroke-linecap="round" ' +
      'transform="rotate(' + startAngle + ' ' + cx + ' ' + cy + ')" />' +
    // Score text
    '<text x="' + cx + '" y="' + (cy - 8) + '" text-anchor="middle" ' +
      'font-family="Inter,system-ui,sans-serif" font-size="42" font-weight="700" fill="' + CHARCOAL + '">' +
      Math.round(s) + '</text>' +
    '<text x="' + cx + '" y="' + (cy + 14) + '" text-anchor="middle" ' +
      'font-family="Inter,system-ui,sans-serif" font-size="14" fill="' + SLATE + '">/ ' + m + '</text>' +
    '</svg>';
}

// ── Radar Chart (4-Pillar Spider) ───────────────────────────────────────────

/**
 * Generate a 4-axis radar/spider chart
 * @param {Object} pillars - { mortgageEligibility, affordabilityBudget, financialResilience, protectionReadiness } as 0-100 percentages
 * @returns {string} SVG markup
 */
function radarChart(pillars) {
  var p = pillars || {};
  var vals = [
    (p.mortgageEligibility || 0) / 100,
    (p.affordabilityBudget || 0) / 100,
    (p.financialResilience || 0) / 100,
    (p.protectionReadiness || 0) / 100
  ];
  var labels = ['Mortgage\nEligibility', 'Affordability\n& Budget', 'Financial\nResilience', 'Protection\nReadiness'];
  var cx = 150;
  var cy = 150;
  var maxR = 100;

  // Axis angles: top, right, bottom, left (0, 90, 180, 270 degrees)
  var angles = [-90, 0, 90, 180];

  function pointAt(angleDeg, ratio) {
    var rad = angleDeg * Math.PI / 180;
    return {
      x: cx + Math.cos(rad) * maxR * ratio,
      y: cy + Math.sin(rad) * maxR * ratio
    };
  }

  // Grid circles at 25%, 50%, 75%, 100%
  var gridLines = '';
  var gridLevels = [0.25, 0.5, 0.75, 1.0];
  for (var g = 0; g < gridLevels.length; g++) {
    var r = maxR * gridLevels[g];
    var pts = [];
    for (var a = 0; a < angles.length; a++) {
      var gp = pointAt(angles[a], gridLevels[g]);
      pts.push(gp.x + ',' + gp.y);
    }
    gridLines += '<polygon points="' + pts.join(' ') + '" fill="none" stroke="' + LIGHT_GREY + '" stroke-width="1" />';
  }

  // Axis lines
  var axisLines = '';
  for (var i = 0; i < angles.length; i++) {
    var ep = pointAt(angles[i], 1);
    axisLines += '<line x1="' + cx + '" y1="' + cy + '" x2="' + ep.x + '" y2="' + ep.y + '" stroke="' + LIGHT_GREY + '" stroke-width="1" />';
  }

  // Data polygon
  var dataPoints = [];
  for (var d = 0; d < angles.length; d++) {
    var dp = pointAt(angles[d], vals[d]);
    dataPoints.push(dp.x + ',' + dp.y);
  }

  // Labels
  var labelMarkup = '';
  var labelOffsets = [
    { dx: 0, dy: -18, anchor: 'middle' },   // top
    { dx: 18, dy: 4, anchor: 'start' },      // right
    { dx: 0, dy: 22, anchor: 'middle' },     // bottom
    { dx: -18, dy: 4, anchor: 'end' }        // left
  ];

  for (var l = 0; l < angles.length; l++) {
    var lp = pointAt(angles[l], 1);
    var lo = labelOffsets[l];
    var parts = labels[l].split('\n');
    labelMarkup += '<text x="' + (lp.x + lo.dx) + '" y="' + (lp.y + lo.dy) + '" text-anchor="' + lo.anchor + '" ' +
      'font-family="Inter,system-ui,sans-serif" font-size="10" fill="' + SLATE + '">';
    for (var pl = 0; pl < parts.length; pl++) {
      labelMarkup += '<tspan x="' + (lp.x + lo.dx) + '" dy="' + (pl === 0 ? '0' : '12') + '">' + parts[pl] + '</tspan>';
    }
    labelMarkup += '</text>';

    // Percentage label on data point
    var ddp = pointAt(angles[l], vals[l]);
    var pctOffset = vals[l] < 0.3 ? 0 : -2;
    labelMarkup += '<text x="' + ddp.x + '" y="' + (ddp.y + pctOffset) + '" text-anchor="middle" ' +
      'font-family="Inter,system-ui,sans-serif" font-size="11" font-weight="700" fill="' + ORANGE + '">' +
      Math.round(vals[l] * 100) + '%</text>';
  }

  return '<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:320px;">' +
    gridLines +
    axisLines +
    '<polygon points="' + dataPoints.join(' ') + '" fill="rgba(240,91,40,0.15)" stroke="' + ORANGE + '" stroke-width="2" />' +
    labelMarkup +
    '</svg>';
}

// ── Runway Comparison Bars ──────────────────────────────────────────────────

/**
 * Generate horizontal comparison bars for runway
 * @param {number} userDays - User's runway in days
 * @param {number} avgDays - UK average (default 19)
 * @param {number} targetDays - Target days (default 90)
 * @returns {string} SVG markup
 */
function runwayBars(userDays, avgDays, targetDays) {
  var user = Math.max(0, userDays || 0);
  var avg = avgDays || 19;
  var target = targetDays || 90;
  var maxVal = Math.max(user, target) * 1.15; // 15% padding

  var barW = 400;
  var barH = 28;
  var gap = 16;
  var labelW = 100;

  function barLength(val) {
    return Math.round((val / maxVal) * (barW - labelW));
  }

  var userLen = barLength(user);
  var avgLen = barLength(avg);
  var targetLen = barLength(target);

  var userColor = user >= target ? GREEN : (user >= 60 ? ORANGE : RED);

  return '<svg viewBox="0 0 ' + barW + ' ' + (barH * 3 + gap * 4) + '" xmlns="http://www.w3.org/2000/svg" style="width:100%;">' +
    // Your Runway
    '<text x="0" y="' + (gap + barH / 2 + 4) + '" font-family="Inter,system-ui,sans-serif" font-size="11" font-weight="600" fill="' + CHARCOAL + '">Your Runway</text>' +
    '<rect x="' + labelW + '" y="' + gap + '" width="' + userLen + '" height="' + barH + '" rx="4" fill="' + userColor + '" />' +
    '<text x="' + (labelW + userLen + 8) + '" y="' + (gap + barH / 2 + 4) + '" font-family="Inter,system-ui,sans-serif" font-size="12" font-weight="700" fill="' + CHARCOAL + '">' + user + ' days</text>' +
    // UK Average
    '<text x="0" y="' + (gap * 2 + barH * 1.5 + 4) + '" font-family="Inter,system-ui,sans-serif" font-size="11" fill="' + SLATE + '">UK Average</text>' +
    '<rect x="' + labelW + '" y="' + (gap * 2 + barH) + '" width="' + avgLen + '" height="' + barH + '" rx="4" fill="' + LIGHT_GREY + '" />' +
    '<text x="' + (labelW + avgLen + 8) + '" y="' + (gap * 2 + barH * 1.5 + 4) + '" font-family="Inter,system-ui,sans-serif" font-size="12" fill="' + SLATE + '">' + avg + ' days</text>' +
    // Target
    '<text x="0" y="' + (gap * 3 + barH * 2.5 + 4) + '" font-family="Inter,system-ui,sans-serif" font-size="11" fill="' + SLATE + '">Target</text>' +
    '<rect x="' + labelW + '" y="' + (gap * 3 + barH * 2) + '" width="' + targetLen + '" height="' + barH + '" rx="4" fill="none" stroke="' + SLATE + '" stroke-width="1.5" stroke-dasharray="6 3" />' +
    '<text x="' + (labelW + targetLen + 8) + '" y="' + (gap * 3 + barH * 2.5 + 4) + '" font-family="Inter,system-ui,sans-serif" font-size="12" fill="' + SLATE + '">' + target + '+ days</text>' +
    '</svg>';
}

// ── Waterfall Chart (Income vs Essentials) ──────────────────────────────────

/**
 * Generate a waterfall chart showing 6-month income projection vs essentials
 * @param {Array} waterfall - Array of { month, income, source, shortfall, cumulativeShortfall }
 * @param {number} essentials - Monthly essentials amount
 * @returns {string} SVG markup
 */
function waterfallChart(waterfall, essentials) {
  if (!waterfall || waterfall.length === 0) return '';

  var w = 500;
  var h = 280;
  var padLeft = 60;
  var padRight = 20;
  var padTop = 30;
  var padBottom = 50;
  var chartW = w - padLeft - padRight;
  var chartH = h - padTop - padBottom;

  var maxVal = essentials * 1.15;
  var barWidth = Math.floor(chartW / waterfall.length) - 8;

  function yPos(val) {
    return padTop + chartH - (val / maxVal * chartH);
  }

  var essY = yPos(essentials);
  var bars = '';
  var labels = '';

  for (var i = 0; i < waterfall.length; i++) {
    var item = waterfall[i];
    var x = padLeft + i * (barWidth + 8) + 4;
    var incomeH = Math.max(0, item.income / maxVal * chartH);
    var incomeY = padTop + chartH - incomeH;

    // Income bar (orange)
    bars += '<rect x="' + x + '" y="' + incomeY + '" width="' + barWidth + '" height="' + incomeH + '" rx="3" fill="' + ORANGE + '" opacity="0.85" />';

    // Shortfall area (grey, from income top to essentials line)
    if (item.income < essentials) {
      var shortfallH = (essentials - item.income) / maxVal * chartH;
      bars += '<rect x="' + x + '" y="' + essY + '" width="' + barWidth + '" height="' + shortfallH + '" rx="0" fill="' + LIGHT_GREY + '" opacity="0.5" />';
    }

    // Month label
    labels += '<text x="' + (x + barWidth / 2) + '" y="' + (h - padBottom + 16) + '" text-anchor="middle" ' +
      'font-family="Inter,system-ui,sans-serif" font-size="10" fill="' + SLATE + '">Month ' + item.month + '</text>';

    // Income amount on bar
    labels += '<text x="' + (x + barWidth / 2) + '" y="' + (incomeY - 6) + '" text-anchor="middle" ' +
      'font-family="Inter,system-ui,sans-serif" font-size="9" font-weight="600" fill="' + CHARCOAL + '">' +
      '\u00a3' + Math.round(item.income).toLocaleString('en-GB') + '</text>';

    // Source label (small, below income)
    labels += '<text x="' + (x + barWidth / 2) + '" y="' + (h - padBottom + 28) + '" text-anchor="middle" ' +
      'font-family="Inter,system-ui,sans-serif" font-size="7" fill="' + SLATE + '">' +
      (item.source || '').substring(0, 14) + '</text>';
  }

  // Essentials dashed line
  var essLine = '<line x1="' + padLeft + '" y1="' + essY + '" x2="' + (w - padRight) + '" y2="' + essY + '" ' +
    'stroke="' + RED + '" stroke-width="1.5" stroke-dasharray="6 3" />';
  var essLabel = '<text x="' + (w - padRight) + '" y="' + (essY - 6) + '" text-anchor="end" ' +
    'font-family="Inter,system-ui,sans-serif" font-size="9" font-weight="600" fill="' + RED + '">' +
    'Essentials \u00a3' + Math.round(essentials).toLocaleString('en-GB') + '</text>';

  // Y-axis labels
  var yLabels = '';
  var ySteps = [0, 0.25, 0.5, 0.75, 1.0];
  for (var s = 0; s < ySteps.length; s++) {
    var yVal = Math.round(maxVal * ySteps[s]);
    var yy = yPos(yVal);
    yLabels += '<text x="' + (padLeft - 8) + '" y="' + (yy + 3) + '" text-anchor="end" ' +
      'font-family="Inter,system-ui,sans-serif" font-size="9" fill="' + SLATE + '">' +
      '\u00a3' + yVal.toLocaleString('en-GB') + '</text>';
    if (ySteps[s] > 0 && ySteps[s] < 1) {
      yLabels += '<line x1="' + padLeft + '" y1="' + yy + '" x2="' + (w - padRight) + '" y2="' + yy + '" stroke="' + LIGHT_GREY + '" stroke-width="0.5" />';
    }
  }

  return '<svg viewBox="0 0 ' + w + ' ' + h + '" xmlns="http://www.w3.org/2000/svg" style="width:100%;">' +
    yLabels + bars + essLine + essLabel + labels +
    '</svg>';
}

// ── Mini Progress Bar ───────────────────────────────────────────────────────

/**
 * Generate a small inline progress bar
 * @param {number} pct - Percentage (0-100)
 * @param {string} color - Bar color
 * @returns {string} SVG markup
 */
function miniBar(pct, color) {
  var p = Math.max(0, Math.min(pct || 0, 100));
  var c = color || ORANGE;
  return '<svg viewBox="0 0 120 8" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:120px;vertical-align:middle;">' +
    '<rect x="0" y="0" width="120" height="8" rx="4" fill="' + LIGHT_GREY + '" />' +
    '<rect x="0" y="0" width="' + Math.round(p * 1.2) + '" height="8" rx="4" fill="' + c + '" />' +
    '</svg>';
}

// ── Pillar Color ────────────────────────────────────────────────────────────

function pillarColor(pct) {
  if (pct >= 75) return GREEN;
  if (pct >= 50) return ORANGE;
  return RED;
}

// ── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  watermark: watermark,
  gaugeChart: gaugeChart,
  radarChart: radarChart,
  runwayBars: runwayBars,
  waterfallChart: waterfallChart,
  miniBar: miniBar,
  pillarColor: pillarColor,
  ORANGE: ORANGE,
  CHARCOAL: CHARCOAL,
  SLATE: SLATE,
  LIGHT_GREY: LIGHT_GREY,
  GREEN: GREEN,
  RED: RED
};
