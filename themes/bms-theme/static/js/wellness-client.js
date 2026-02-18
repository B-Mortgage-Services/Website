/**
 * Wellness Check Client-Side API Handler
 *
 * Handles communication between the wellness form and the backend API,
 * including visualization rendering and report sharing.
 */

// Global state
let currentReportId = null;
let currentReportData = null;
let currentChartInstances = {};

/**
 * Submit wellness check data to backend API
 * @param {Object} formData - Form data to submit
 * @returns {Promise<Object>} API response
 */
async function submitWellnessCheck(formData) {
  try {
    // Show loading state
    showLoadingState();

    // Submit to API
    const response = await fetch('/.netlify/functions/wellness-calculate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formData)
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Unknown error occurred');
    }

    // Store report data
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

/**
 * Display wellness check results
 * @param {Object} data - API response data
 */
function displayResults(data) {
  // Hide all steps
  document.querySelectorAll('.wellness-step').forEach(step => {
    step.style.display = 'none';
  });

  // Show results section
  const resultsSection = document.getElementById('results');
  if (resultsSection) {
    resultsSection.style.display = 'block';
  }

  // Animate score
  animateScore(data.score);

  // Update category label
  updateCategoryLabel(data.score, data.category, data.interpretation);

  // Update strengths and improvements
  updateStrengthsAndImprovements(data.strengths, data.improvements);

  // Render charts if Chart.js is available
  if (typeof Chart !== 'undefined') {
    renderCharts(data.chartData, data.pillarPercentages);
  }

  // Display enhanced metrics (Week 2 additions)
  if (data.runway) {
    displayRunway(data.runway);
  }

  if (data.perceptionGap) {
    displayPerceptionGap(data.perceptionGap);
  }

  if (data.waterfall && data.household && typeof Chart !== 'undefined') {
    renderWaterfallChart(data.waterfall, data.household.monthlyEssentials);
  }

  if (data.stateBenefit && data.benchmarks) {
    renderBenefitExplanation(data.stateBenefit, data.benchmarks, data.waterfall);
  }

  if (data.riskAssessment) {
    displayRiskProbabilities(data.riskAssessment);
  }

  // Update share/download buttons
  updateActionButtons(data.reportId, data.reportUrl);
}

/**
 * Animate the score gauge
 * @param {number} finalScore - Target score to animate to
 */
function animateScore(finalScore) {
  const scoreEl = document.getElementById('score-value');
  const arcEl = document.getElementById('score-arc');

  if (!scoreEl || !arcEl) return;

  let current = 0;
  const duration = 2000; // 2 seconds
  const increment = finalScore / (duration / 20);

  const interval = setInterval(() => {
    current += increment;
    if (current >= finalScore) {
      current = finalScore;
      clearInterval(interval);
    }

    scoreEl.textContent = Math.round(current);

    // Update arc (251 is the total arc length)
    const offset = 251 - (251 * current / 100);
    arcEl.style.strokeDashoffset = offset;
  }, 20);
}

/**
 * Update category label and interpretation
 */
function updateCategoryLabel(score, category, interpretation) {
  const labelEl = document.getElementById('score-label');
  if (!labelEl) return;

  let color;
  if (score >= 80) color = '#22C55E';
  else if (score >= 65) color = '#84CC16';
  else if (score >= 50) color = '#EAB308';
  else color = '#F97316';

  labelEl.innerHTML = `
    <h3 style="color: ${color};">${category}</h3>
    <p>${interpretation}</p>
  `;
}

/**
 * Update strengths and improvements lists
 */
function updateStrengthsAndImprovements(strengths, improvements) {
  const strengthsList = document.getElementById('strengths-list');
  const improvementsList = document.getElementById('improve-list');

  if (strengthsList) {
    strengthsList.innerHTML = strengths
      .slice(0, 4)
      .map(s => `<li>• ${s}</li>`)
      .join('');
  }

  if (improvementsList) {
    improvementsList.innerHTML = improvements
      .slice(0, 4)
      .map(i => `<li>• ${i}</li>`)
      .join('');
  }
}

/**
 * Display financial runway callout
 * @param {Object} runway - Runway data from API
 */
function displayRunway(runway) {
  if (!runway) return;

  const daysEl = document.getElementById('runway-days');
  const messageEl = document.getElementById('runway-message');
  const calloutEl = document.getElementById('runway-callout');

  if (daysEl) {
    // Animate the days count
    let current = 0;
    const target = runway.days;
    const duration = 1500;
    const increment = target / (duration / 20);

    const interval = setInterval(() => {
      current += increment;
      if (current >= target) {
        current = target;
        clearInterval(interval);
      }
      daysEl.textContent = Math.round(current);
    }, 20);
  }

  if (messageEl) {
    const months = Math.round(runway.days / 30.44 * 10) / 10;
    messageEl.textContent = `If your income stopped tomorrow, your savings would cover essential expenses for approximately ${runway.days} days (${months} month${months !== 1 ? 's' : ''}).`;
  }

  // Update background color based on status
  if (calloutEl) {
    let gradient = 'linear-gradient(135deg, var(--brand-orange) 0%, #D94A1F 100%)';
    if (runway.status === 'strong') {
      gradient = 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)';
    } else if (runway.status === 'good') {
      gradient = 'linear-gradient(135deg, #84CC16 0%, #65A30D 100%)';
    } else if (runway.status === 'moderate') {
      gradient = 'linear-gradient(135deg, #EAB308 0%, #CA8A04 100%)';
    } else if (runway.status === 'critical') {
      gradient = 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)';
    }
    calloutEl.style.background = gradient;
  }
}

/**
 * Display perception gap analysis
 * @param {Object} perceptionGap - Perception gap data from API
 */
function displayPerceptionGap(perceptionGap) {
  if (!perceptionGap) return;

  const estimatedEl = document.getElementById('perception-estimated');
  const actualEl = document.getElementById('perception-actual');
  const messageEl = document.getElementById('perception-message');

  if (estimatedEl) {
    estimatedEl.textContent = Math.round(perceptionGap.estimatedDays);
  }

  if (actualEl) {
    actualEl.textContent = Math.round(perceptionGap.actualDays);
  }

  if (messageEl) {
    messageEl.textContent = perceptionGap.message;
  }
}

/**
 * Render waterfall chart showing income over 6 months
 * @param {Array} waterfall - Waterfall data from API
 * @param {number} monthlyEssentials - Monthly essential outgoings
 */
function renderWaterfallChart(waterfall, monthlyEssentials) {
  if (!waterfall || waterfall.length === 0) return;

  const canvas = document.getElementById('waterfall-chart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');

  // Destroy existing chart if any
  if (window.waterfallChartInstance) {
    window.waterfallChartInstance.destroy();
  }

  window.waterfallChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: waterfall.map(m => `Month ${m.month}`),
      datasets: [
        {
          label: 'Your Income',
          data: waterfall.map(m => m.income),
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
          title: {
            display: true,
            text: '£ per month'
          },
          ticks: {
            callback: function(value) {
              return '£' + value.toLocaleString();
            }
          }
        }
      },
      plugins: {
        legend: {
          position: 'bottom'
        },
        tooltip: {
          callbacks: {
            title: function(context) {
              return waterfall[context[0].dataIndex].source;
            },
            label: function(context) {
              return context.dataset.label + ': £' + context.parsed.y.toLocaleString();
            }
          }
        }
      }
    }
  });
}

/**
 * Render state benefit explanation, WCA warning, and cumulative shortfall below waterfall chart
 * @param {Object} stateBenefit - State benefit details from API
 * @param {Object} benchmarks - UK benchmark rates
 * @param {Array} waterfall - Waterfall data with cumulative shortfall
 */
function renderBenefitExplanation(stateBenefit, benchmarks, waterfall) {
  const el = document.getElementById('benefit-explanation');
  if (!el) return;

  let html = '';

  // Cumulative shortfall total
  var totalShortfall = waterfall && waterfall.length > 0 ? waterfall[waterfall.length - 1].cumulativeShortfall : 0;
  if (totalShortfall > 0) {
    html += '<div style="background: #FEF2F2; border: 1px solid #FECACA; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; text-align: center;">'
      + '<p style="font-size: 1.1rem; font-weight: 700; color: #991B1B; margin: 0;">'
      + 'Total 6-month shortfall: &pound;' + totalShortfall.toLocaleString() + '</p>'
      + '<p style="font-size: 0.8rem; color: #7F1D1D; margin: 0.25rem 0 0 0;">'
      + 'This is the amount you would need to find from savings or other sources to cover your essential outgoings over 6 months without adequate income protection.</p></div>';
  }

  // State benefit explanation
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

  // Disclaimer
  html += '<p style="font-size: 0.75rem; color: #6B7280; margin: 0.5rem 0 0 0; font-style: italic;">'
    + 'Rates shown are for 2025/26. Actual entitlement depends on individual circumstances, '
    + 'NI record, and household income. UC is means-tested. This is for illustration only and does not constitute benefits advice.</p>';

  el.innerHTML = html;
  el.style.display = 'block';
}

/**
 * Display risk probability cards
 * @param {Object} riskAssessment - Risk assessment data from API
 */
function displayRiskProbabilities(riskAssessment) {
  if (!riskAssessment || !riskAssessment.formatted) return;

  const deathEl = document.querySelector('#risk-death p:first-child');
  const ciEl = document.querySelector('#risk-ci p:first-child');
  const absenceEl = document.querySelector('#risk-absence p:first-child');

  if (deathEl) {
    deathEl.textContent = riskAssessment.formatted.death;
  }

  if (ciEl) {
    ciEl.textContent = riskAssessment.formatted.criticalIllness;
  }

  if (absenceEl) {
    absenceEl.textContent = riskAssessment.formatted.longTermAbsence;
  }
}

/**
 * Render Chart.js visualizations
 * @param {Object} chartData - Chart configuration data from API
 * @param {Object} pillarPercentages - Pillar score percentages
 */
function renderCharts(chartData, pillarPercentages) {
  // Destroy existing charts if any
  Object.values(currentChartInstances).forEach(chart => chart.destroy());
  currentChartInstances = {};

  // Render radar chart
  const radarCanvas = document.getElementById('radar-chart');
  if (radarCanvas && chartData.radar) {
    const ctx = radarCanvas.getContext('2d');
    currentChartInstances.radar = new Chart(ctx, {
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
        scales: {
          r: {
            beginAtZero: true,
            max: 100,
            ticks: {
              stepSize: 20
            }
          }
        },
        plugins: {
          legend: {
            position: 'bottom'
          }
        }
      }
    });
  }

  // Render bar chart
  const barCanvas = document.getElementById('bar-chart');
  if (barCanvas && chartData.bars) {
    const ctx = barCanvas.getContext('2d');
    currentChartInstances.bar = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: chartData.bars.map(b => b.label),
        datasets: [{
          label: 'Your Score',
          data: chartData.bars.map(b => b.score),
          backgroundColor: chartData.bars.map(b => b.color),
          borderColor: chartData.bars.map(b => b.color),
          borderWidth: 1
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: true,
        scales: {
          x: {
            beginAtZero: true,
            max: 100
          }
        },
        plugins: {
          legend: {
            display: false
          }
        }
      }
    });
  }
}

/**
 * Update action buttons (share, download)
 */
function updateActionButtons(reportId, reportUrl) {
  // Update share button
  const shareBtn = document.getElementById('share-report-btn');
  if (shareBtn) {
    shareBtn.style.display = 'inline-block';
    shareBtn.onclick = () => shareReport(reportUrl);
  }

  // Update download PDF button (will be implemented in Phase 3)
  const downloadBtn = document.getElementById('download-pdf-btn');
  if (downloadBtn) {
    downloadBtn.style.display = 'inline-block';
    downloadBtn.onclick = () => downloadPDF(reportId);
  }
}

/**
 * Share report - copy link to clipboard
 */
function shareReport(reportUrl) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(reportUrl)
      .then(() => {
        alert('Report link copied to clipboard!');
      })
      .catch(err => {
        console.error('Failed to copy link:', err);
        prompt('Copy this link to share your report:', reportUrl);
      });
  } else {
    // Fallback for older browsers
    prompt('Copy this link to share your report:', reportUrl);
  }
}

/**
 * Download PDF report
 * @param {string} reportId - Report ID to generate PDF for
 */
function downloadPDF(reportId) {
  const downloadBtn = document.getElementById('download-pdf-btn');
  const originalText = downloadBtn ? downloadBtn.textContent : '';

  // Show loading state
  if (downloadBtn) {
    downloadBtn.disabled = true;
    downloadBtn.textContent = 'Generating PDF...';
  }

  // Open PDF in new tab (triggers download via Content-Disposition header)
  const pdfUrl = `/.netlify/functions/wellness-pdf?reportId=${reportId}`;

  fetch(pdfUrl)
    .then(response => {
      if (!response.ok) {
        return response.json().then(err => { throw new Error(err.message || 'PDF generation failed'); });
      }
      return response.json();
    })
    .then(data => {
      if (data.pdfUrl) {
        window.open(data.pdfUrl, '_blank');
      }
    })
    .catch(err => {
      console.error('PDF download failed:', err);
      alert('PDF generation is currently unavailable. Please try again later.');
    })
    .finally(() => {
      // Restore button
      if (downloadBtn) {
        downloadBtn.disabled = false;
        downloadBtn.textContent = originalText;
      }
    });
}

/**
 * Show loading state
 */
function showLoadingState() {
  const loader = document.getElementById('loading-indicator');
  if (loader) {
    loader.style.display = 'block';
  }

  // Disable submit button
  const submitBtn = document.querySelector('button[onclick*="calculateScore"]');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Processing...';
  }
}

/**
 * Hide loading state
 */
function hideLoadingState() {
  const loader = document.getElementById('loading-indicator');
  if (loader) {
    loader.style.display = 'none';
  }

  // Re-enable submit button
  const submitBtn = document.querySelector('button[onclick*="calculateScore"]');
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Get My Score ✓';
  }
}

/**
 * Show error state
 */
function showErrorState(message) {
  alert(`Error: ${message}\n\nPlease try again or contact support if the problem persists.`);
}

/**
 * Get form data from wellness check form
 * @returns {Object} Form data
 */
function getFormData() {
  // Get smoker status from radio buttons
  const smokerYes = document.getElementById('smoker-yes');
  const smokerStatus = smokerYes?.checked ? 'yes' : 'no';

  // Get partner income if applicable
  const partnerYes = document.getElementById('partner-yes');
  const hasPartner = partnerYes?.checked;
  const partnerIncome = hasPartner
    ? (parseFloat(document.getElementById('partner-income')?.value) || 0)
    : 0;

  return {
    // Original fields
    employment: document.getElementById('employment-status')?.value,
    credit: document.getElementById('credit-history')?.value,
    propertyValue: parseFloat(document.getElementById('property-value')?.value) || 0,
    deposit: parseFloat(document.getElementById('deposit-amount')?.value) || 0,
    surplus: document.getElementById('monthly-surplus')?.value,
    emergency: document.getElementById('emergency-fund')?.value,
    life: document.getElementById('life-insurance')?.value,
    income: document.getElementById('income-protection')?.value,
    critical: document.getElementById('critical-illness')?.value,
    email: document.getElementById('user-email')?.value || null,

    // New enhanced fields
    age: parseInt(document.getElementById('user-age')?.value) || 35,
    smoker: smokerStatus,
    monthlyIncome: parseFloat(document.getElementById('monthly-income')?.value) || 0,
    partnerIncome: partnerIncome,
    accessibleSavings: parseFloat(document.getElementById('accessible-savings')?.value) || 0,
    monthlyEssentials: parseFloat(document.getElementById('monthly-essentials')?.value) || 0,
    perceptionMonths: parseInt(document.getElementById('perception-months')?.value) || 3,
    employerSickPay: document.getElementById('employer-sick-pay')?.value,
    sickPayDuration: document.getElementById('sick-pay-duration')?.value,
    employerDeathInService: document.getElementById('employer-death-in-service')?.value,

    // Income protection details (conditional)
    ipMonthlyBenefit: parseFloat(document.getElementById('ip-monthly-benefit')?.value) || 0,
    ipDeferredPeriod: parseInt(document.getElementById('ip-deferred-period')?.value) || 0,
    ipBenefitPeriod: document.getElementById('ip-benefit-period')?.value
  };
}

/**
 * Main function to calculate score - called from form button
 */
async function calculateScore() {
  try {
    // Get form data
    const formData = getFormData();

    // Basic validation
    if (!formData.employment || !formData.credit) {
      alert('Please complete all required fields');
      return;
    }

    // Submit to API
    const result = await submitWellnessCheck(formData);

    // Display results
    displayResults(result);

  } catch (error) {
    console.error('Error in calculateScore:', error);
    // Error is already handled in submitWellnessCheck
  }
}

// Navigation function (keep existing implementation)
function nextStep(step) {
  document.querySelectorAll('.wellness-step').forEach(s => s.style.display = 'none');
  document.getElementById('step-' + step).style.display = 'block';
  document.querySelectorAll('.step-dot').forEach((dot, i) => {
    dot.classList.toggle('step-dot--active', i < step);
  });
}

// Conditional logic functions for new questions

/**
 * Toggle partner income field visibility
 */
function togglePartnerIncome() {
  const partnerYes = document.getElementById('partner-yes');
  const partnerIncomeGroup = document.getElementById('partner-income-group');

  if (partnerYes && partnerYes.checked) {
    partnerIncomeGroup.style.display = 'block';
  } else {
    partnerIncomeGroup.style.display = 'none';
  }
}

/**
 * Toggle sick pay duration field visibility
 */
function toggleSickPayDuration() {
  const sickPaySelect = document.getElementById('employer-sick-pay');
  const durationGroup = document.getElementById('sick-pay-duration-group');

  if (sickPaySelect && sickPaySelect.value === 'yes') {
    durationGroup.style.display = 'block';
  } else {
    durationGroup.style.display = 'none';
  }
}

/**
 * Toggle death in service multiple field visibility
 */
function toggleDeathInServiceMultiple() {
  const deathInServiceSelect = document.getElementById('employer-death-in-service');
  const multipleGroup = document.getElementById('death-in-service-multiple-group');

  if (deathInServiceSelect && deathInServiceSelect.value === 'yes') {
    multipleGroup.style.display = 'block';
  } else {
    multipleGroup.style.display = 'none';
  }
}

/**
 * Toggle income protection details
 */
function toggleIPDetails() {
  const ipSelect = document.getElementById('income-protection');
  const ipDetailsGroup = document.getElementById('ip-details-group');

  if (ipSelect && (ipSelect.value === 'full' || ipSelect.value === 'partial')) {
    ipDetailsGroup.style.display = 'block';
  } else {
    ipDetailsGroup.style.display = 'none';
  }
}

/**
 * Update perception check slider display value
 */
function updatePerceptionValue(value) {
  const displayEl = document.getElementById('perception-value');
  if (displayEl) {
    displayEl.textContent = value + ' month' + (value != 1 ? 's' : '');
  }
}
