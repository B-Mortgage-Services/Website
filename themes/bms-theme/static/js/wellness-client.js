/**
 * Wellness Check Client-Side API Handler
 *
 * Handles the wellness assessment modal, form submission, API communication,
 * visualization rendering, sessionStorage pre-fill, and report sharing.
 */

// Global state
let currentReportId = null;
let currentReportData = null;
let currentChartInstances = {};
let chartJsLoaded = false;
let chartJsLoadPromise = null;

const WELLNESS_SESSION_KEY = 'bms_affordability_data';
const WELLNESS_TOTAL_STEPS = 4;

// ========================================
// MODAL LIFECYCLE
// ========================================

/**
 * Open the wellness modal
 * @param {Object} options - Optional config (source tracking)
 */
function openWellnessModal(options) {
  options = options || {};
  var modal = document.getElementById('wellnessModal');
  if (!modal) return;

  // Close any other modals that might be open
  var quoteModal = document.querySelector('.quote-modal--open');
  if (quoteModal) {
    quoteModal.classList.remove('quote-modal--open');
  }

  resetWellnessForm();
  modal.classList.add('wellness-modal--open');
  document.body.style.overflow = 'hidden';

  // Check for pre-fill data from affordability calculator
  applySessionData();

  // Track source for analytics
  if (options.source) {
    modal.dataset.source = options.source;
  }
}

/**
 * Close the wellness modal with optional unsaved-progress warning
 */
function closeWellnessModal() {
  var modal = document.getElementById('wellnessModal');
  if (!modal) return;

  // Check if user is mid-form (not on step 1 and not on results)
  var resultsVisible = document.getElementById('wellness-results');
  var onStep1 = document.getElementById('step-1');
  var isOnResults = resultsVisible && resultsVisible.style.display === 'block';
  var isOnStep1 = onStep1 && onStep1.style.display !== 'none';

  if (!isOnResults && !isOnStep1) {
    if (!confirm('You have an assessment in progress. Are you sure you want to close?')) {
      return;
    }
  }

  modal.classList.remove('wellness-modal--open');
  document.body.style.overflow = '';
}

/**
 * Reset the wellness form to initial state
 */
function resetWellnessForm() {
  // Reset all steps to hidden except step 1
  var steps = document.querySelectorAll('.wellness-step');
  for (var i = 0; i < steps.length; i++) {
    steps[i].style.display = 'none';
  }
  var step1 = document.getElementById('step-1');
  if (step1) step1.style.display = 'block';

  // Reset progress dots
  var dots = document.querySelectorAll('.step-dot');
  for (var j = 0; j < dots.length; j++) {
    dots[j].classList.toggle('step-dot--active', j === 0);
  }

  // Clear form fields
  var inputs = document.querySelectorAll('#wellnessModal input[type="number"], #wellnessModal input[type="email"]');
  for (var k = 0; k < inputs.length; k++) {
    inputs[k].value = '';
    inputs[k].classList.remove('wellness-field--prefilled');
  }
  var selects = document.querySelectorAll('#wellnessModal select');
  for (var l = 0; l < selects.length; l++) {
    selects[l].selectedIndex = 0;
    selects[l].classList.remove('wellness-field--prefilled');
  }

  // Reset radio buttons to defaults
  var smokerNo = document.getElementById('smoker-no');
  if (smokerNo) smokerNo.checked = true;
  var partnerNo = document.getElementById('partner-no');
  if (partnerNo) partnerNo.checked = true;

  // Reset conditional fields
  var partnerGroup = document.getElementById('partner-income-group');
  if (partnerGroup) partnerGroup.style.display = 'none';
  var partnerGrossGroup = document.getElementById('partner-gross-income-group');
  if (partnerGrossGroup) partnerGrossGroup.style.display = 'none';
  var sickPayGroup = document.getElementById('sick-pay-duration-group');
  if (sickPayGroup) sickPayGroup.style.display = 'none';
  var disGroup = document.getElementById('death-in-service-multiple-group');
  if (disGroup) disGroup.style.display = 'none';
  var ipGroup = document.getElementById('ip-details-group');
  if (ipGroup) ipGroup.style.display = 'none';

  // Reset perception slider
  var slider = document.getElementById('perception-months');
  if (slider) slider.value = 3;
  var sliderDisplay = document.getElementById('perception-value');
  if (sliderDisplay) sliderDisplay.textContent = '3 months';

  // Hide pre-fill notice
  var notice = document.getElementById('prefillNotice');
  if (notice) notice.style.display = 'none';

  // Remove prefill badges
  var badges = document.querySelectorAll('.prefill-badge');
  for (var m = 0; m < badges.length; m++) {
    badges[m].remove();
  }
  var prefilledGroups = document.querySelectorAll('.form-group--prefilled');
  for (var n = 0; n < prefilledGroups.length; n++) {
    prefilledGroups[n].classList.remove('form-group--prefilled');
  }

  // Reset mortgage metrics dashboard
  var metricsEl = document.getElementById('mortgage-metrics-dashboard');
  if (metricsEl) { metricsEl.innerHTML = ''; metricsEl.style.display = 'none'; }

  // Reset chart instances
  Object.values(currentChartInstances).forEach(function(chart) { chart.destroy(); });
  currentChartInstances = {};
  if (window.waterfallChartInstance) {
    window.waterfallChartInstance.destroy();
    window.waterfallChartInstance = null;
  }
}

// ========================================
// SESSION DATA PRE-FILL
// ========================================

/**
 * Check sessionStorage for affordability calculator data and pre-fill form fields
 */
function applySessionData() {
  var raw = sessionStorage.getItem(WELLNESS_SESSION_KEY);
  if (!raw) return;

  var data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    return;
  }

  // Validate data freshness (expire after 30 minutes)
  if (data.timestamp && (Date.now() - data.timestamp > 30 * 60 * 1000)) {
    sessionStorage.removeItem(WELLNESS_SESSION_KEY);
    return;
  }

  var prefilledCount = 0;

  // Income: affordability calc provides net monthly
  if (data.applicant1NetMonthly) {
    setFieldValue('monthly-income', Math.round(data.applicant1NetMonthly));
    prefilledCount++;
  }

  // Gross annual income
  if (data.applicant1Gross) {
    setFieldValue('gross-annual-income', data.applicant1Gross);
    prefilledCount++;
  }

  // Joint application detection
  if (data.applicationType === 'joint') {
    var partnerYes = document.getElementById('partner-yes');
    var partnerNo = document.getElementById('partner-no');
    if (partnerYes) partnerYes.checked = true;
    if (partnerNo) partnerNo.checked = false;
    togglePartnerIncome();
    if (data.applicant2NetMonthly) {
      setFieldValue('partner-income', Math.round(data.applicant2NetMonthly));
      prefilledCount++;
    }
    if (data.applicant2Gross) {
      setFieldValue('partner-gross-income', data.applicant2Gross);
      prefilledCount++;
    }
  }

  // Property & deposit
  if (data.propertyValue) {
    setFieldValue('property-value', data.propertyValue);
    prefilledCount++;
  }
  if (data.deposit) {
    setFieldValue('deposit-amount', data.deposit);
    prefilledCount++;
  }

  // Monthly commitments as a starting point for essentials
  if (data.totalMonthlyCommitments) {
    setFieldValue('monthly-essentials', Math.round(data.totalMonthlyCommitments));
    prefilledCount++;
  }

  // Show pre-fill notice if any fields were populated
  if (prefilledCount > 0) {
    var notice = document.getElementById('prefillNotice');
    if (notice) notice.style.display = 'flex';
    highlightPrefilledFields();
  }
}

/**
 * Set a field value and mark it as pre-filled
 */
function setFieldValue(fieldId, value) {
  var field = document.getElementById(fieldId);
  if (!field) return;
  field.value = value;
  field.classList.add('wellness-field--prefilled');
  var group = field.closest('.form-group');
  if (group) group.classList.add('form-group--prefilled');
}

/**
 * Add visual indicators to pre-filled fields
 */
function highlightPrefilledFields() {
  var fields = document.querySelectorAll('.wellness-field--prefilled');
  for (var i = 0; i < fields.length; i++) {
    var parent = fields[i].parentElement;
    if (parent && !parent.querySelector('.prefill-badge')) {
      var badge = document.createElement('span');
      badge.className = 'prefill-badge';
      badge.textContent = 'Auto-filled';
      parent.appendChild(badge);
    }
  }
}

// ========================================
// CHART.JS LAZY LOADING
// ========================================

/**
 * Ensure Chart.js is loaded before rendering charts
 */
function ensureChartJs() {
  if (chartJsLoaded || typeof Chart !== 'undefined') {
    chartJsLoaded = true;
    return Promise.resolve();
  }
  if (chartJsLoadPromise) return chartJsLoadPromise;

  chartJsLoadPromise = new Promise(function(resolve, reject) {
    var script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.7';
    script.onload = function() { chartJsLoaded = true; resolve(); };
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return chartJsLoadPromise;
}

// ========================================
// API COMMUNICATION
// ========================================

/**
 * Submit wellness check data to backend API
 * @param {Object} formData - Form data to submit
 * @returns {Promise<Object>} API response
 */
async function submitWellnessCheck(formData) {
  try {
    showLoadingState();

    var response = await fetch('/.netlify/functions/wellness-calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });

    if (!response.ok) {
      throw new Error('API request failed: ' + response.status);
    }

    var data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Unknown error occurred');
    }

    currentReportId = data.reportId;
    currentReportData = data;

    // Save to localStorage for "view again" feature
    localStorage.setItem('lastWellnessReport', JSON.stringify({
      reportId: data.reportId,
      timestamp: new Date().toISOString(),
      score: data.score
    }));

    return data;

  } catch (error) {
    console.error('Error submitting wellness check:', error);
    showErrorState(error.message);
    throw error;
  } finally {
    hideLoadingState();
  }
}

// ========================================
// RESULTS DISPLAY
// ========================================

/**
 * Display wellness check results with deferred chart rendering
 * @param {Object} data - API response data
 */
function displayResults(data) {
  // Hide all steps
  var steps = document.querySelectorAll('.wellness-step');
  for (var i = 0; i < steps.length; i++) {
    steps[i].style.display = 'none';
  }

  // Show results section
  var resultsSection = document.getElementById('wellness-results');
  if (resultsSection) {
    resultsSection.style.display = 'block';
  }

  // Scroll modal container to top
  var container = document.querySelector('.wellness-modal__container');
  if (container) container.scrollTo(0, 0);

  // Update progress dots to show all complete
  var dots = document.querySelectorAll('.step-dot');
  for (var j = 0; j < dots.length; j++) {
    dots[j].classList.add('step-dot--active');
  }

  // Animate score
  animateScore(data.score);
  updateCategoryLabel(data.score, data.category, data.interpretation);
  updateStrengthsAndImprovements(data.strengths, data.improvements);

  // Display non-chart metrics immediately
  if (data.runway) displayRunway(data.runway);
  if (data.mortgageMetrics) displayMortgageMetrics(data.mortgageMetrics);
  if (data.perceptionGap) displayPerceptionGap(data.perceptionGap);
  if (data.riskAssessment) displayRiskProbabilities(data.riskAssessment);
  if (data.stateBenefit && data.benchmarks) {
    renderBenefitExplanation(data.stateBenefit, data.benchmarks, data.waterfall);
  }

  // Defer chart rendering for next paint cycle (modal canvas sizing)
  requestAnimationFrame(function() {
    setTimeout(function() {
      if (typeof Chart !== 'undefined') {
        renderCharts(data.chartData, data.pillarPercentages);
        if (data.waterfall && data.household) {
          renderWaterfallChart(data.waterfall, data.household.monthlyEssentials);
        }
      }
    }, 150);
  });

  // Update share/download buttons
  updateActionButtons(data.reportId, data.reportUrl);
}

/**
 * Animate the score gauge
 */
function animateScore(finalScore) {
  var scoreEl = document.getElementById('score-value');
  var arcEl = document.getElementById('score-arc');
  if (!scoreEl || !arcEl) return;

  var current = 0;
  var duration = 2000;
  var increment = finalScore / (duration / 20);

  var interval = setInterval(function() {
    current += increment;
    if (current >= finalScore) {
      current = finalScore;
      clearInterval(interval);
    }
    scoreEl.textContent = Math.round(current);
    var offset = 251 - (251 * current / 100);
    arcEl.style.strokeDashoffset = offset;
  }, 20);
}

/**
 * Update category label and interpretation
 */
function updateCategoryLabel(score, category, interpretation) {
  var labelEl = document.getElementById('score-label');
  if (!labelEl) return;

  var color;
  if (score >= 80) color = '#22C55E';
  else if (score >= 65) color = '#84CC16';
  else if (score >= 50) color = '#EAB308';
  else color = '#F97316';

  labelEl.innerHTML = '<h3 style="color: ' + color + ';">' + category + '</h3><p>' + interpretation + '</p>';
}

/**
 * Update strengths and improvements lists
 */
function updateStrengthsAndImprovements(strengths, improvements) {
  var strengthsList = document.getElementById('strengths-list');
  var improvementsList = document.getElementById('improve-list');

  if (strengthsList) {
    strengthsList.innerHTML = strengths.slice(0, 4).map(function(s) { return '<li>&bull; ' + s + '</li>'; }).join('');
  }
  if (improvementsList) {
    improvementsList.innerHTML = improvements.slice(0, 4).map(function(i) { return '<li>&bull; ' + i + '</li>'; }).join('');
  }
}

/**
 * Display financial runway callout
 */
function displayRunway(runway) {
  if (!runway) return;

  var daysEl = document.getElementById('runway-days');
  var messageEl = document.getElementById('runway-message');
  var calloutEl = document.getElementById('runway-callout');

  if (daysEl) {
    var current = 0;
    var target = runway.days;
    var increment = target / (1500 / 20);

    var interval = setInterval(function() {
      current += increment;
      if (current >= target) {
        current = target;
        clearInterval(interval);
      }
      daysEl.textContent = Math.round(current);
    }, 20);
  }

  if (messageEl) {
    var months = Math.round(runway.days / 30.44 * 10) / 10;
    messageEl.textContent = 'If your income stopped tomorrow, your savings would cover essential expenses for approximately ' + runway.days + ' days (' + months + ' month' + (months !== 1 ? 's' : '') + ').';
  }

  if (calloutEl) {
    var gradient = 'linear-gradient(135deg, var(--brand-orange) 0%, #D94A1F 100%)';
    if (runway.status === 'strong') gradient = 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)';
    else if (runway.status === 'good') gradient = 'linear-gradient(135deg, #84CC16 0%, #65A30D 100%)';
    else if (runway.status === 'moderate') gradient = 'linear-gradient(135deg, #EAB308 0%, #CA8A04 100%)';
    else if (runway.status === 'critical') gradient = 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)';
    calloutEl.style.background = gradient;
  }
}

/**
 * Display perception gap analysis
 */
function displayPerceptionGap(perceptionGap) {
  if (!perceptionGap) return;

  var estimatedEl = document.getElementById('perception-estimated');
  var actualEl = document.getElementById('perception-actual');
  var messageEl = document.getElementById('perception-message');

  if (estimatedEl) estimatedEl.textContent = Math.round(perceptionGap.estimatedDays);
  if (actualEl) actualEl.textContent = Math.round(perceptionGap.actualDays);
  if (messageEl) messageEl.textContent = perceptionGap.message;
}

/**
 * Render waterfall chart showing income over 6 months
 */
function renderWaterfallChart(waterfall, monthlyEssentials) {
  if (!waterfall || waterfall.length === 0) return;

  var canvas = document.getElementById('waterfall-chart');
  if (!canvas) return;

  var ctx = canvas.getContext('2d');

  if (window.waterfallChartInstance) {
    window.waterfallChartInstance.destroy();
  }

  window.waterfallChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: waterfall.map(function(m) { return 'Month ' + m.month; }),
      datasets: [
        {
          label: 'Your Income',
          data: waterfall.map(function(m) { return m.income; }),
          backgroundColor: '#3B82F6',
          borderColor: '#2563EB',
          borderWidth: 1
        },
        {
          label: 'Essential Outgoings',
          data: Array(waterfall.length).fill(monthlyEssentials),
          type: 'line',
          borderColor: '#EF4444',
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: '\u00A3 per month' },
          ticks: {
            callback: function(value) { return '\u00A3' + value.toLocaleString(); }
          }
        }
      },
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            title: function(context) { return waterfall[context[0].dataIndex].source; },
            label: function(context) { return context.dataset.label + ': \u00A3' + context.parsed.y.toLocaleString(); }
          }
        }
      }
    }
  });
}

/**
 * Render state benefit explanation, WCA warning, and cumulative shortfall
 */
function renderBenefitExplanation(stateBenefit, benchmarks, waterfall) {
  var el = document.getElementById('benefit-explanation');
  if (!el) return;

  var html = '';

  // Cumulative shortfall total
  var totalShortfall = waterfall && waterfall.length > 0 ? waterfall[waterfall.length - 1].cumulativeShortfall : 0;
  if (totalShortfall > 0) {
    html += '<div style="background: #FEF2F2; border: 1px solid #FECACA; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; text-align: center;">'
      + '<p style="font-size: 1.1rem; font-weight: 700; color: #991B1B; margin: 0;">'
      + 'Total 6-month shortfall: &pound;' + totalShortfall.toLocaleString() + '</p>'
      + '<p style="font-size: 0.8rem; color: #7F1D1D; margin: 0.25rem 0 0 0;">'
      + 'This is the amount you would need to find from savings or other sources to cover your essential outgoings over 6 months without adequate income protection.</p></div>';
  }

  html += '<p style="font-weight: 600; color: #1E3A5F; margin: 0 0 0.5rem 0; font-size: 0.9rem;">Understanding Your State Benefit Entitlement</p>';

  if (stateBenefit.type === 'SSP') {
    html += '<p style="font-size: 0.85rem; color: #374151; margin: 0 0 0.4rem 0;">'
      + 'As a PAYE employee, you are entitled to <strong>Statutory Sick Pay (SSP)</strong> of '
      + '&pound;' + benchmarks.sspWeekly + '/week (&pound;' + benchmarks.sspMonthly + '/month) for up to ' + benchmarks.sspMaxWeeks + ' weeks. '
      + 'SSP is payable from day 1 of sickness (from April 2026). Your employer may also offer enhanced sick pay above this level.</p>';
    html += '<p style="font-size: 0.85rem; color: #374151; margin: 0 0 0.4rem 0;">'
      + 'After SSP ends, you may be eligible for <strong>New Style ESA</strong> at '
      + '&pound;' + benchmarks.esaWeeklyAssessment + '/week, subject to your NI contribution record, and '
      + '<strong>Universal Credit</strong> (&pound;' + benchmarks.ucSingle + '/month plus up to &pound;' + benchmarks.ucLCWRA + '/month LCWRA element).</p>';
  } else {
    html += '<p style="font-size: 0.85rem; color: #374151; margin: 0 0 0.4rem 0;">'
      + 'As a self-employed individual, you are <strong>not eligible for Statutory Sick Pay (SSP)</strong>. '
      + 'You may claim <strong>New Style ESA</strong> at '
      + '&pound;' + benchmarks.esaWeeklyAssessment + '/week (&pound;' + benchmarks.esaMonthlyAssessment + '/month) during the 13-week assessment phase, '
      + 'rising to &pound;' + benchmarks.esaWeeklySupportGroup + '/week in the Support Group. '
      + 'Eligibility depends on Class 2 NI contributions.</p>';
    html += '<p style="font-size: 0.85rem; color: #374151; margin: 0 0 0.4rem 0;">'
      + 'You may also qualify for <strong>Universal Credit</strong> (&pound;' + benchmarks.ucSingle + '/month plus up to &pound;' + benchmarks.ucLCWRA + '/month LCWRA element). '
      + 'The Minimum Income Floor does not apply if you have limited capability for work.</p>';
  }

  // WCA Warning
  html += '<div style="background: #FFF7ED; border-left: 3px solid #F59E0B; padding: 0.75rem 1rem; margin: 0.75rem 0; border-radius: 0 6px 6px 0;">'
    + '<p style="font-weight: 600; color: #92400E; margin: 0 0 0.4rem 0; font-size: 0.85rem;">&#9888; Important: State Benefits Are Not Guaranteed</p>'
    + '<p style="font-size: 0.8rem; color: #374151; margin: 0 0 0.3rem 0;">'
    + 'To receive ESA or the health element of Universal Credit, you must pass the <strong>Work Capability Assessment (WCA)</strong> &mdash; '
    + 'a strict, points-based functional test. Approximately <strong>1 in 5 claimants are found fit for work</strong> at initial assessment '
    + 'and receive no health-related benefit. The WCA assesses what you can functionally do, not your diagnosis.</p>'
    + '<p style="font-size: 0.8rem; color: #374151; margin: 0;">'
    + 'The assessment process typically takes <strong>around 4 months</strong> from claim to decision. '
    + 'During this period you would receive only the basic UC rate with no health element. '
    + 'If you need to challenge a decision, it can take 6&ndash;9 months or more.</p></div>';

  html += '<p style="font-size: 0.75rem; color: #6B7280; margin: 0.5rem 0 0 0; font-style: italic;">'
    + 'Rates shown are for 2025/26. Actual entitlement depends on individual circumstances, '
    + 'NI record, and household income. UC is means-tested. This is for illustration only and does not constitute benefits advice.</p>';

  el.innerHTML = html;
  el.style.display = 'block';
}

/**
 * Display risk probability cards
 */
function displayRiskProbabilities(riskAssessment) {
  if (!riskAssessment || !riskAssessment.formatted) return;

  var deathEl = document.querySelector('#risk-death p:first-child');
  var ciEl = document.querySelector('#risk-ci p:first-child');
  var absenceEl = document.querySelector('#risk-absence p:first-child');

  if (deathEl) deathEl.textContent = riskAssessment.formatted.death;
  if (ciEl) ciEl.textContent = riskAssessment.formatted.criticalIllness;
  if (absenceEl) absenceEl.textContent = riskAssessment.formatted.longTermAbsence;
}

// ========================================
// MORTGAGE ELIGIBILITY DASHBOARD
// ========================================

/**
 * Display the Mortgage Eligibility Dashboard with LTI, DTI, and LTV gauges
 * @param {Object} metrics - mortgageMetrics from API response
 */
function displayMortgageMetrics(metrics) {
  var container = document.getElementById('mortgage-metrics-dashboard');
  if (!container) return;

  var hasLTI = metrics.lti && metrics.lti.ratio !== null;
  var hasDTI = metrics.dti && metrics.dti.ratio !== null;
  var hasLTV = metrics.ltv && metrics.ltv.ratio < 100 && metrics.loanAmount > 0;

  // Don't show dashboard if no metrics available
  if (!hasLTI && !hasDTI && !hasLTV) return;

  var html = '';

  // Estimation notice
  if (metrics.grossIncome && metrics.grossIncome.isEstimated) {
    html += '<div class="metrics-notice">'
      + '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;">'
      + '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
      + '<span>Gross income estimated from your take-home pay. For more accurate results, enter your gross annual salary.</span>'
      + '</div>';
  }

  // Gauge cards
  html += '<div class="metrics-gauges">';

  if (hasLTI) {
    html += buildGaugeCard(
      'Loan-to-Income',
      metrics.lti.ratioFormatted,
      metrics.lti.tier,
      metrics.lti.description,
      getLTIGaugePercent(metrics.lti.ratio),
      getGaugeColor(metrics.lti.tier),
      'FCA cap: 4.5x',
      [
        { label: '< 3.5x', color: '#22C55E' },
        { label: '3.5\u20134.5x', color: '#EAB308' },
        { label: '> 4.5x', color: '#EF4444' }
      ]
    );
  }

  if (hasDTI) {
    var dtiFootnote = 'Based on ' + metrics.dti.rateUsed + '% interest rate';
    if (metrics.dti.stressTestedRatio !== null) {
      dtiFootnote += '. Lenders stress test at ' + metrics.dti.stressRate
        + '% \u2014 your DTI at that rate would be ' + metrics.dti.stressTestedFormatted;
    }
    html += buildGaugeCard(
      'Debt-to-Income',
      metrics.dti.ratioFormatted,
      metrics.dti.tier,
      metrics.dti.description,
      getDTIGaugePercent(metrics.dti.ratio),
      getGaugeColor(metrics.dti.tier),
      dtiFootnote,
      [
        { label: '< 25%', color: '#22C55E' },
        { label: '25\u201335%', color: '#84CC16' },
        { label: '35\u201345%', color: '#EAB308' },
        { label: '> 45%', color: '#EF4444' }
      ]
    );
  }

  if (hasLTV) {
    html += buildGaugeCard(
      'Loan-to-Value',
      metrics.ltv.formatted,
      metrics.ltv.tier,
      getLTVDescription(metrics.ltv.ratio),
      getLTVGaugePercent(metrics.ltv.ratio),
      getGaugeColor(metrics.ltv.tier),
      'Lower LTV = better rates',
      [
        { label: '< 75%', color: '#22C55E' },
        { label: '75\u201385%', color: '#84CC16' },
        { label: '85\u201390%', color: '#EAB308' },
        { label: '> 90%', color: '#EF4444' }
      ]
    );
  }

  html += '</div>';

  // Monthly affordability breakdown table
  if (hasDTI && metrics.dti.estimatedMortgagePayment > 0) {
    html += '<div class="metrics-breakdown">';
    html += '<h4>Monthly Affordability Breakdown</h4>';
    html += '<div class="breakdown-row"><span>Estimated mortgage payment (at ' + metrics.dti.rateUsed + '%)</span><strong>&pound;' + metrics.dti.estimatedMortgagePayment.toLocaleString() + '</strong></div>';
    if (metrics.dti.monthlyCommitments > 0) {
      html += '<div class="breakdown-row"><span>Other monthly commitments</span><strong>&pound;' + metrics.dti.monthlyCommitments.toLocaleString() + '</strong></div>';
    }
    html += '<div class="breakdown-row breakdown-row--total"><span>Total monthly debt</span><strong>&pound;' + metrics.dti.totalMonthlyDebt.toLocaleString() + '</strong></div>';
    html += '<div class="breakdown-row"><span>Gross monthly income</span><strong>&pound;' + Math.round(metrics.grossIncome.total / 12).toLocaleString() + '</strong></div>';
    if (metrics.dti.stressTestedPayment > 0) {
      html += '<div class="breakdown-row" style="color: var(--text-secondary); font-style: italic;"><span>Mortgage payment at stress test (' + metrics.dti.stressRate + '%)</span><strong>&pound;' + metrics.dti.stressTestedPayment.toLocaleString() + '</strong></div>';
    }
    html += '</div>';
  }

  container.innerHTML = '<div class="results-section">'
    + '<h3 class="results-section__heading">Mortgage Eligibility Dashboard</h3>'
    + '<p class="results-section__intro">These are the key ratios lenders use to assess your borrowing. Green means you\'re well within typical limits; amber or red may require a specialist lender or a larger deposit.</p>'
    + html
    + '</div>';
  container.style.display = 'block';
}

/**
 * Build a single gauge card HTML string
 */
function buildGaugeCard(title, value, tier, description, percent, color, footnote, legend) {
  var tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);
  var html = '<div class="metric-gauge-card">';
  html += '<h4 class="metric-gauge__title">' + title + '</h4>';
  html += '<div class="metric-gauge__value" style="color: ' + color + ';">' + value + '</div>';
  html += '<div class="metric-gauge__bar"><div class="metric-gauge__fill" style="width: ' + percent + '%; background: ' + color + ';"></div></div>';
  html += '<div class="metric-gauge__tier" style="color: ' + color + ';">' + tierLabel + '</div>';
  html += '<p class="metric-gauge__desc">' + description + '</p>';
  html += '<div class="metric-gauge__legend">';
  for (var i = 0; i < legend.length; i++) {
    html += '<span><span class="legend-dot" style="background: ' + legend[i].color + ';"></span>' + legend[i].label + '</span>';
  }
  html += '</div>';
  if (footnote) {
    html += '<p class="metric-gauge__footnote">' + footnote + '</p>';
  }
  html += '</div>';
  return html;
}

function getLTIGaugePercent(ratio) { return Math.min(100, Math.max(0, (ratio / 6) * 100)); }
function getDTIGaugePercent(ratio) { return Math.min(100, Math.max(0, (ratio / 60) * 100)); }
function getLTVGaugePercent(ratio) { return Math.min(100, Math.max(0, ratio)); }

function getGaugeColor(tier) {
  var colors = {
    'excellent': '#22C55E',
    'good': '#84CC16',
    'acceptable': '#EAB308',
    'stretched': '#F97316',
    'difficult': '#EF4444',
    'high': '#EF4444'
  };
  return colors[tier] || '#6B7280';
}

function getLTVDescription(ltv) {
  if (ltv <= 75) return 'Access to the best rates from most lenders';
  if (ltv <= 85) return 'Good range of competitive products available';
  if (ltv <= 90) return 'Standard lending \u2014 some rate premiums may apply';
  return 'Limited lender options \u2014 higher rates likely';
}

/**
 * Render Chart.js visualizations
 */
function renderCharts(chartData, pillarPercentages) {
  Object.values(currentChartInstances).forEach(function(chart) { chart.destroy(); });
  currentChartInstances = {};

  var radarCanvas = document.getElementById('radar-chart');
  if (radarCanvas && chartData.radar) {
    var rCtx = radarCanvas.getContext('2d');
    currentChartInstances.radar = new Chart(rCtx, {
      type: 'radar',
      data: {
        labels: chartData.radar.labels,
        datasets: [
          {
            label: 'Your Score',
            data: chartData.radar.userScores,
            backgroundColor: 'rgba(240, 91, 40, 0.2)',
            borderColor: '#F05B28',
            pointBackgroundColor: '#F05B28',
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: '#F05B28'
          },
          {
            label: 'Ideal Score',
            data: chartData.radar.idealScores,
            backgroundColor: 'rgba(45, 45, 45, 0.1)',
            borderColor: '#2D2D2D',
            pointBackgroundColor: '#2D2D2D',
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: '#2D2D2D',
            borderDash: [5, 5]
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        scales: { r: { beginAtZero: true, max: 100, ticks: { stepSize: 20 } } },
        plugins: { legend: { position: 'bottom' } }
      }
    });
  }

  var barCanvas = document.getElementById('bar-chart');
  if (barCanvas && chartData.bars) {
    var bCtx = barCanvas.getContext('2d');
    currentChartInstances.bar = new Chart(bCtx, {
      type: 'bar',
      data: {
        labels: chartData.bars.map(function(b) { return b.label; }),
        datasets: [{
          label: 'Your Score',
          data: chartData.bars.map(function(b) { return b.score; }),
          backgroundColor: chartData.bars.map(function(b) { return b.color; }),
          borderColor: chartData.bars.map(function(b) { return b.color; }),
          borderWidth: 1
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: true,
        scales: { x: { beginAtZero: true, max: 100 } },
        plugins: { legend: { display: false } }
      }
    });
  }
}

/**
 * Update action buttons (share, download)
 */
function updateActionButtons(reportId, reportUrl) {
  var shareBtn = document.getElementById('share-report-btn');
  if (shareBtn) {
    shareBtn.style.display = 'inline-block';
    shareBtn.onclick = function() { shareReport(reportUrl); };
  }

  var downloadBtn = document.getElementById('download-pdf-btn');
  if (downloadBtn) {
    downloadBtn.style.display = 'inline-block';
    downloadBtn.onclick = function() { downloadPDF(reportId); };
  }
}

/**
 * Share report - copy link to clipboard
 */
function shareReport(reportUrl) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(reportUrl)
      .then(function() { alert('Report link copied to clipboard!'); })
      .catch(function() { prompt('Copy this link to share your report:', reportUrl); });
  } else {
    prompt('Copy this link to share your report:', reportUrl);
  }
}

/**
 * Download PDF report
 */
function downloadPDF(reportId) {
  var downloadBtn = document.getElementById('download-pdf-btn');
  var originalText = downloadBtn ? downloadBtn.textContent : '';

  if (downloadBtn) {
    downloadBtn.disabled = true;
    downloadBtn.textContent = 'Generating PDF...';
  }

  var pdfUrl = '/.netlify/functions/wellness-pdf?reportId=' + reportId;

  fetch(pdfUrl)
    .then(function(response) {
      if (!response.ok) {
        return response.json().then(function(err) { throw new Error(err.message || 'PDF generation failed'); });
      }
      return response.json();
    })
    .then(function(data) {
      if (data.pdfUrl) window.open(data.pdfUrl, '_blank');
    })
    .catch(function(err) {
      console.error('PDF download failed:', err);
      alert('PDF generation is currently unavailable. Please try again later.');
    })
    .finally(function() {
      if (downloadBtn) {
        downloadBtn.disabled = false;
        downloadBtn.textContent = originalText;
      }
    });
}

// ========================================
// LOADING & ERROR STATES
// ========================================

function showLoadingState() {
  var loader = document.getElementById('loading-indicator');
  if (loader) loader.style.display = 'block';

  var submitBtn = document.querySelector('button[onclick*="calculateScore"]');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Processing...';
  }
}

function hideLoadingState() {
  var loader = document.getElementById('loading-indicator');
  if (loader) loader.style.display = 'none';

  var submitBtn = document.querySelector('button[onclick*="calculateScore"]');
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Get My Score';
  }
}

function showErrorState(message) {
  alert('Error: ' + message + '\n\nPlease try again or contact support if the problem persists.');
}

// ========================================
// FORM DATA & SUBMISSION
// ========================================

/**
 * Get form data from wellness check form
 */
function getFormData() {
  var smokerYes = document.getElementById('smoker-yes');
  var smokerStatus = smokerYes && smokerYes.checked ? 'yes' : 'no';

  var partnerYes = document.getElementById('partner-yes');
  var hasPartner = partnerYes && partnerYes.checked;
  var partnerIncome = hasPartner
    ? (parseFloat(document.getElementById('partner-income').value) || 0)
    : 0;

  // Read sessionStorage for supplementary data (mortgage term, rate, commitments)
  var sessionData = {};
  try {
    var raw = sessionStorage.getItem(WELLNESS_SESSION_KEY);
    if (raw) sessionData = JSON.parse(raw);
  } catch(e) {}

  var propertyValue = parseFloat(document.getElementById('property-value').value) || 0;
  var depositAmount = parseFloat(document.getElementById('deposit-amount').value) || 0;

  return {
    employment: document.getElementById('employment-status').value,
    credit: document.getElementById('credit-history').value,
    propertyValue: propertyValue,
    deposit: depositAmount,
    surplus: document.getElementById('monthly-surplus').value,
    life: document.getElementById('life-insurance').value,
    income: document.getElementById('income-protection').value,
    critical: document.getElementById('critical-illness').value,
    email: document.getElementById('user-email').value || null,
    age: parseInt(document.getElementById('user-age').value) || 35,
    smoker: smokerStatus,
    monthlyIncome: parseFloat(document.getElementById('monthly-income').value) || 0,
    partnerIncome: partnerIncome,
    accessibleSavings: parseFloat(document.getElementById('accessible-savings').value) || 0,
    monthlyEssentials: parseFloat(document.getElementById('monthly-essentials').value) || 0,
    perceptionMonths: parseInt(document.getElementById('perception-months').value) || 3,
    employerSickPay: document.getElementById('employer-sick-pay').value,
    sickPayDuration: document.getElementById('sick-pay-duration').value,
    employerDeathInService: document.getElementById('employer-death-in-service').value,
    ipMonthlyBenefit: parseFloat(document.getElementById('ip-monthly-benefit').value) || 0,
    ipDeferredPeriod: parseInt(document.getElementById('ip-deferred-period').value) || 0,
    ipBenefitPeriod: document.getElementById('ip-benefit-period').value,
    // Mortgage eligibility metrics (DTI/LTI)
    grossAnnualIncome: parseFloat(document.getElementById('gross-annual-income').value) || sessionData.applicant1Gross || 0,
    partnerGrossAnnualIncome: hasPartner
      ? (parseFloat(document.getElementById('partner-gross-income').value) || sessionData.applicant2Gross || 0)
      : 0,
    totalMonthlyCommitments: sessionData.totalMonthlyCommitments || 0,
    mortgageTerm: sessionData.mortgageTerm || 25,
    interestRate: sessionData.interestRate || 0,
    mortgageAmount: sessionData.mortgageAmount || Math.max(0, propertyValue - depositAmount)
  };
}

/**
 * Main function to calculate score - called from form button
 */
async function calculateScore() {
  try {
    var formData = getFormData();

    if (!formData.employment || !formData.credit) {
      alert('Please complete all required fields');
      return;
    }

    // Ensure Chart.js is loaded before submitting
    await ensureChartJs();

    var result = await submitWellnessCheck(formData);
    displayResults(result);

  } catch (error) {
    console.error('Error in calculateScore:', error);
  }
}

// ========================================
// NAVIGATION (4-step flow)
// ========================================

/**
 * Navigate between wizard steps
 */
function nextStep(step) {
  var steps = document.querySelectorAll('.wellness-step');
  for (var i = 0; i < steps.length; i++) {
    steps[i].style.display = 'none';
  }
  var target = document.getElementById('step-' + step);
  if (target) target.style.display = 'block';

  // Update progress dots
  var dots = document.querySelectorAll('.step-dot');
  for (var j = 0; j < dots.length; j++) {
    dots[j].classList.toggle('step-dot--active', j < step);
  }

  // Scroll modal container to top
  var container = document.querySelector('.wellness-modal__container');
  if (container) container.scrollTo(0, 0);
}

// ========================================
// CONDITIONAL FIELD TOGGLES
// ========================================

function togglePartnerIncome() {
  var partnerYes = document.getElementById('partner-yes');
  var show = partnerYes && partnerYes.checked;
  var group = document.getElementById('partner-income-group');
  var grossGroup = document.getElementById('partner-gross-income-group');
  if (group) group.style.display = show ? 'block' : 'none';
  if (grossGroup) grossGroup.style.display = show ? 'block' : 'none';
}

function toggleSickPayDuration() {
  var select = document.getElementById('employer-sick-pay');
  var group = document.getElementById('sick-pay-duration-group');
  if (group) group.style.display = (select && select.value === 'yes') ? 'block' : 'none';
}

function toggleDeathInServiceMultiple() {
  var select = document.getElementById('employer-death-in-service');
  var group = document.getElementById('death-in-service-multiple-group');
  if (group) group.style.display = (select && select.value === 'yes') ? 'block' : 'none';
}

function toggleIPDetails() {
  var select = document.getElementById('income-protection');
  var group = document.getElementById('ip-details-group');
  if (group) group.style.display = (select && (select.value === 'full' || select.value === 'partial')) ? 'block' : 'none';
}

function updatePerceptionValue(value) {
  var displayEl = document.getElementById('perception-value');
  if (displayEl) displayEl.textContent = value + ' month' + (value != 1 ? 's' : '');
}

// ========================================
// AUTO-OPEN ON HASH
// ========================================

document.addEventListener('DOMContentLoaded', function() {
  if (window.location.hash === '#start-assessment') {
    openWellnessModal({ source: 'direct-link' });
  }
});
