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

// ── Gauge Chart (Speedometer) ────────────────────────────────────────────────

/**
 * Generate a speedometer-style gauge with coloured segments and needle.
 * Matches the wellness-dial.png visual: 180-degree arc with 5 colour bands
 * (red → orange → yellow/olive → green → dark green) and a triangular needle.
 *
 * @param {number} score - Current score (0-100)
 * @param {number} max - Maximum score (default 100)
 * @returns {string} SVG markup
 */
function gaugeChart(score, max, theme) {
  var s = Math.max(0, Math.min(score || 0, max || 100));
  var m = max || 100;
  var pct = s / m;
  var isDark = theme === 'dark';
  var textColor = isDark ? '#FFFFFF' : CHARCOAL;
  var subTextColor = isDark ? 'rgba(255,255,255,0.6)' : SLATE;
  var needleColor = isDark ? '#FFFFFF' : CHARCOAL;
  var hubColor = isDark ? '#FFFFFF' : CHARCOAL;
  var trackColor = isDark ? 'rgba(255,255,255,0.15)' : LIGHT_GREY;

  var cx = 150;
  var cy = 140;
  var outerR = 110;
  var innerR = 72;
  var midR = (outerR + innerR) / 2;
  var bandW = outerR - innerR;

  // 5 colour segments spanning 180 degrees (left to right)
  var segments = [
    { color: '#E85D3A', start: 180, sweep: 36 },   // red-orange
    { color: '#F0983E', start: 216, sweep: 36 },   // orange
    { color: '#C5B944', start: 252, sweep: 36 },   // yellow-olive
    { color: '#7BAA45', start: 288, sweep: 36 },   // green
    { color: '#4A6B5A', start: 324, sweep: 36 }    // dark green/teal
  ];

  function arcPath(cxp, cyp, r, startDeg, sweepDeg) {
    var s1 = (startDeg - 0.5) * Math.PI / 180;
    var s2 = (startDeg + sweepDeg + 0.5) * Math.PI / 180;
    var x1 = cxp + r * Math.cos(s1);
    var y1 = cyp + r * Math.sin(s1);
    var x2 = cxp + r * Math.cos(s2);
    var y2 = cyp + r * Math.sin(s2);
    var large = sweepDeg > 180 ? 1 : 0;
    return 'M ' + x1 + ' ' + y1 + ' A ' + r + ' ' + r + ' 0 ' + large + ' 1 ' + x2 + ' ' + y2;
  }

  function segmentPath(cxp, cyp, outer, inner, startDeg, sweepDeg) {
    var a1 = (startDeg - 0.3) * Math.PI / 180;
    var a2 = (startDeg + sweepDeg + 0.3) * Math.PI / 180;
    var ox1 = cxp + outer * Math.cos(a1), oy1 = cyp + outer * Math.sin(a1);
    var ox2 = cxp + outer * Math.cos(a2), oy2 = cyp + outer * Math.sin(a2);
    var ix1 = cxp + inner * Math.cos(a1), iy1 = cyp + inner * Math.sin(a1);
    var ix2 = cxp + inner * Math.cos(a2), iy2 = cyp + inner * Math.sin(a2);
    var large = sweepDeg > 180 ? 1 : 0;
    return 'M ' + ox1 + ' ' + oy1 +
      ' A ' + outer + ' ' + outer + ' 0 ' + large + ' 1 ' + ox2 + ' ' + oy2 +
      ' L ' + ix2 + ' ' + iy2 +
      ' A ' + inner + ' ' + inner + ' 0 ' + large + ' 0 ' + ix1 + ' ' + iy1 +
      ' Z';
  }

  // Build segments
  var segPaths = '';
  for (var i = 0; i < segments.length; i++) {
    var seg = segments[i];
    segPaths += '<path d="' + segmentPath(cx, cy, outerR, innerR, seg.start, seg.sweep) + '" fill="' + seg.color + '" />';
  }

  // Thin inner track (subtle background ring)
  var trackPath = arcPath(cx, cy, innerR - 4, 180, 180);
  var track = '<path d="' + trackPath + '" fill="none" stroke="' + trackColor + '" stroke-width="2" opacity="0.4" />';

  // Needle: rotates from 180deg (0%) to 360deg (100%)
  var needleAngle = 180 + (pct * 180);
  var needleLen = outerR - 8;
  var needleRad = needleAngle * Math.PI / 180;
  var nx = cx + needleLen * Math.cos(needleRad);
  var ny = cy + needleLen * Math.sin(needleRad);
  // Needle base (perpendicular to needle direction, width 6px)
  var perpRad = needleRad + Math.PI / 2;
  var bw = 4;
  var bx1 = cx + bw * Math.cos(perpRad);
  var by1 = cy + bw * Math.sin(perpRad);
  var bx2 = cx - bw * Math.cos(perpRad);
  var by2 = cy - bw * Math.sin(perpRad);
  var needle = '<polygon points="' + nx + ',' + ny + ' ' + bx1 + ',' + by1 + ' ' + bx2 + ',' + by2 + '" fill="' + needleColor + '" />';
  var hub = '<circle cx="' + cx + '" cy="' + cy + '" r="8" fill="' + hubColor + '" />' +
    '<circle cx="' + cx + '" cy="' + cy + '" r="4" fill="' + ORANGE + '" />';

  // Score text (centred below needle hub)
  var scoreText = '<text x="' + cx + '" y="' + (cy + 36) + '" text-anchor="middle" ' +
    'font-family="Playfair Display,Georgia,serif" font-size="36" font-weight="700" fill="' + textColor + '">' +
    Math.round(s) + '</text>' +
    '<text x="' + cx + '" y="' + (cy + 52) + '" text-anchor="middle" ' +
    'font-family="Inter,system-ui,sans-serif" font-size="12" fill="' + subTextColor + '">out of ' + m + '</text>';

  // Scale labels at 0, 25, 50, 75, 100 positions
  var scaleLbls = '';
  var scaleVals = [0, 25, 50, 75, 100];
  for (var si = 0; si < scaleVals.length; si++) {
    var sAngle = (180 + scaleVals[si] / 100 * 180) * Math.PI / 180;
    var sx = cx + (outerR + 14) * Math.cos(sAngle);
    var sy = cy + (outerR + 14) * Math.sin(sAngle);
    scaleLbls += '<text x="' + sx + '" y="' + (sy + 3) + '" text-anchor="middle" ' +
      'font-family="Inter,system-ui,sans-serif" font-size="9" fill="' + subTextColor + '">' + scaleVals[si] + '</text>';
  }

  return '<svg viewBox="0 0 300 200" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:300px;">' +
    segPaths + track + needle + hub + scoreText + scaleLbls +
    '</svg>';
}

// ── Radar Chart (4-Pillar Spider) ───────────────────────────────────────────

/**
 * Generate a 4-axis radar/spider chart
 * @param {Object} pillars - { mortgageEligibility, affordabilityBudget, financialResilience, protectionReadiness } as 0-100 percentages
 * @returns {string} SVG markup
 */
function radarChart(pillars, theme) {
  var p = pillars || {};
  var isDark = theme === 'dark';
  var labelColor = isDark ? 'rgba(255,255,255,0.75)' : SLATE;
  var gridColor = isDark ? 'rgba(255,255,255,0.15)' : LIGHT_GREY;
  var axisColor = isDark ? 'rgba(255,255,255,0.2)' : LIGHT_GREY;
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
    gridLines += '<polygon points="' + pts.join(' ') + '" fill="none" stroke="' + gridColor + '" stroke-width="1" />';
  }

  // Axis lines
  var axisLines = '';
  for (var i = 0; i < angles.length; i++) {
    var ep = pointAt(angles[i], 1);
    axisLines += '<line x1="' + cx + '" y1="' + cy + '" x2="' + ep.x + '" y2="' + ep.y + '" stroke="' + axisColor + '" stroke-width="1" />';
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
      'font-family="Inter,system-ui,sans-serif" font-size="10" fill="' + labelColor + '">';
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
  var maxVal = Math.max(user, target) * 1.2; // padding for day labels

  var w = 360;
  var barH = 22;
  var gap = 12;
  var labelW = 80;
  var chartW = w - labelW - 60; // reserve 60px right for day labels

  function bLen(val) {
    return Math.max(4, Math.round((val / maxVal) * chartW));
  }

  var userLen = bLen(user);
  var avgLen = bLen(avg);
  var targetLen = bLen(target);
  var totalH = barH * 3 + gap * 4;

  var userColor = user >= target ? GREEN : (user >= 60 ? ORANGE : RED);

  function row(y, label, len, fill, stroke, dayLabel, labelFill, dayFill, bold) {
    var barFill = stroke ? 'fill="none" stroke="' + stroke + '" stroke-width="1.5" stroke-dasharray="6 3"' : 'fill="' + fill + '"';
    var fontW = bold ? ' font-weight="700"' : '';
    return '<text x="0" y="' + (y + barH / 2 + 4) + '" font-family="Inter,system-ui,sans-serif" font-size="10"' + (bold ? ' font-weight="600"' : '') + ' fill="' + labelFill + '">' + label + '</text>' +
      '<rect x="' + labelW + '" y="' + y + '" width="' + len + '" height="' + barH + '" rx="4" ' + barFill + ' />' +
      '<text x="' + (labelW + len + 6) + '" y="' + (y + barH / 2 + 4) + '" font-family="Inter,system-ui,sans-serif" font-size="10"' + fontW + ' fill="' + dayFill + '">' + dayLabel + '</text>';
  }

  return '<svg viewBox="0 0 ' + w + ' ' + totalH + '" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:420px;">' +
    row(gap,             'Your Runway', userLen,   userColor, null,  user + ' days',    CHARCOAL, CHARCOAL, true) +
    row(gap * 2 + barH,  'UK Average',  avgLen,    LIGHT_GREY, null, avg + ' days',     SLATE,    SLATE,    false) +
    row(gap * 3 + barH * 2, 'Target',   targetLen, null,   SLATE, target + '+ days',    SLATE,    SLATE,    false) +
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
