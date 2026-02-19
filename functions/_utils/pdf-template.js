/**
 * PDF Report Handlebars Template (inlined for Cloudflare Workers)
 *
 * Cloudflare Workers cannot use fs.readFileSync, so the template
 * is exported as a string from this module.
 */
module.exports = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Financial Wellness Report - B Mortgage Services</title>
  <style>
    /* ========== PDF BASE STYLES ========== */
    @page {
      size: A4;
      margin: 15mm 20mm;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 11px;
      line-height: 1.5;
      color: #2D2D2D;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* Page break control */
    .page {
      page-break-after: always;
      position: relative;
      min-height: 250mm;
    }

    .page:last-child {
      page-break-after: avoid;
    }

    /* ========== BRAND COLORS ========== */
    :root {
      --brand-orange: #F05B28;
      --brand-charcoal: #2D2D2D;
      --brand-cream: #FFF8F5;
      --text-secondary: #6B7280;
      --green: #22C55E;
      --yellow: #EAB308;
      --red: #EF4444;
      --blue: #3B82F6;
      --purple: #A855F7;
      --light-grey: #F3F4F6;
    }

    /* ========== HEADER / FOOTER ========== */
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 10px;
      border-bottom: 2px solid var(--brand-orange);
      margin-bottom: 20px;
    }

    .page-header__logo {
      font-size: 14px;
      font-weight: 700;
      color: var(--brand-orange);
    }

    .page-header__date {
      font-size: 9px;
      color: var(--text-secondary);
    }

    .page-footer {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      text-align: center;
      font-size: 8px;
      color: var(--text-secondary);
      padding-top: 10px;
      border-top: 1px solid #E5E7EB;
    }

    /* ========== TYPOGRAPHY ========== */
    h1 {
      font-size: 22px;
      color: var(--brand-charcoal);
      margin-bottom: 6px;
    }

    h2 {
      font-size: 16px;
      color: var(--brand-orange);
      margin-bottom: 12px;
      padding-bottom: 6px;
      border-bottom: 1px solid #E5E7EB;
    }

    h3 {
      font-size: 13px;
      color: var(--brand-charcoal);
      margin-bottom: 8px;
    }

    p {
      margin-bottom: 6px;
    }

    /* ========== COMPONENTS ========== */
    .score-hero {
      text-align: center;
      background: linear-gradient(135deg, var(--brand-orange) 0%, #D94A1F 100%);
      color: white;
      padding: 25px;
      border-radius: 12px;
      margin-bottom: 20px;
    }

    .score-hero__number {
      font-size: 64px;
      font-weight: 700;
      line-height: 1;
    }

    .score-hero__max {
      font-size: 24px;
      opacity: 0.8;
    }

    .score-hero__category {
      font-size: 16px;
      margin-top: 6px;
      opacity: 0.95;
    }

    .score-hero__interpretation {
      font-size: 11px;
      margin-top: 4px;
      opacity: 0.85;
    }

    /* Runway Hero */
    .runway-hero {
      display: flex;
      align-items: center;
      gap: 20px;
      background: var(--brand-cream);
      padding: 16px 20px;
      border-radius: 10px;
      margin-bottom: 20px;
      border-left: 4px solid var(--brand-orange);
    }

    .runway-hero__days {
      font-size: 42px;
      font-weight: 700;
      color: var(--brand-orange);
      line-height: 1;
    }

    .runway-hero__label {
      font-size: 14px;
      color: var(--text-secondary);
    }

    .runway-hero__detail {
      flex: 1;
    }

    .runway-hero__detail p {
      font-size: 11px;
      color: var(--text-secondary);
    }

    /* Pillar Grid */
    .pillar-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 20px;
    }

    .pillar-card {
      background: var(--light-grey);
      padding: 14px;
      border-radius: 8px;
      border-left: 4px solid;
    }

    .pillar-card--eligibility { border-left-color: var(--green); }
    .pillar-card--affordability { border-left-color: var(--blue); }
    .pillar-card--resilience { border-left-color: var(--yellow); }
    .pillar-card--protection { border-left-color: var(--purple); }

    .pillar-card__title {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-secondary);
      margin-bottom: 4px;
    }

    .pillar-card__score {
      font-size: 24px;
      font-weight: 700;
      color: var(--brand-charcoal);
    }

    .pillar-card__bar {
      height: 6px;
      background: #E5E7EB;
      border-radius: 3px;
      margin-top: 6px;
      overflow: hidden;
    }

    .pillar-card__fill {
      height: 100%;
      border-radius: 3px;
      transition: width 0.3s ease;
    }

    /* Strengths & Improvements */
    .two-column {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 20px;
    }

    .column-card {
      padding: 14px;
      border-radius: 8px;
    }

    .column-card--green {
      background: #F0FDF4;
      border: 1px solid #BBF7D0;
    }

    .column-card--orange {
      background: #FFF7ED;
      border: 1px solid #FED7AA;
    }

    .column-card__title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      margin-bottom: 8px;
    }

    .column-card--green .column-card__title { color: var(--green); }
    .column-card--orange .column-card__title { color: var(--brand-orange); }

    .column-card__list {
      list-style: none;
      padding: 0;
    }

    .column-card__list li {
      padding: 3px 0;
      font-size: 10px;
    }

    .column-card__list li::before {
      content: "\u2713 ";
      font-weight: 700;
    }

    .column-card--green .column-card__list li::before { color: var(--green); }
    .column-card--orange .column-card__list li::before { content: "\u2192 "; color: var(--brand-orange); }

    /* Chart placeholder */
    .chart-container {
      background: var(--light-grey);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 20px;
      text-align: center;
    }

    .chart-container img {
      max-width: 100%;
      height: auto;
    }

    /* Perception Gap */
    .perception-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 16px;
    }

    .perception-box {
      text-align: center;
      padding: 14px;
      border-radius: 8px;
      background: white;
      border: 1px solid #E5E7EB;
    }

    .perception-box--actual {
      border-color: var(--brand-orange);
      border-width: 2px;
    }

    .perception-box__value {
      font-size: 32px;
      font-weight: 700;
      color: var(--brand-charcoal);
    }

    .perception-box--actual .perception-box__value {
      color: var(--brand-orange);
    }

    .perception-box__label {
      font-size: 9px;
      color: var(--text-secondary);
      text-transform: uppercase;
    }

    .perception-box__unit {
      font-size: 10px;
      color: var(--text-secondary);
    }

    /* Waterfall Table */
    .waterfall-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
      font-size: 10px;
    }

    .waterfall-table th {
      background: var(--brand-charcoal);
      color: white;
      padding: 8px 10px;
      text-align: left;
      font-size: 9px;
      text-transform: uppercase;
    }

    .waterfall-table td {
      padding: 8px 10px;
      border-bottom: 1px solid #E5E7EB;
    }

    .waterfall-table tr:nth-child(even) td {
      background: #F9FAFB;
    }

    .waterfall-bar {
      height: 14px;
      border-radius: 3px;
      display: inline-block;
      vertical-align: middle;
    }

    .waterfall-bar--income { background: var(--blue); }
    .waterfall-bar--shortfall { background: var(--red); opacity: 0.3; }

    /* Risk Cards */
    .risk-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 12px;
      margin-bottom: 20px;
    }

    .risk-card {
      text-align: center;
      padding: 16px 12px;
      border-radius: 8px;
      background: var(--light-grey);
      border-top: 3px solid;
    }

    .risk-card--death { border-top-color: var(--red); }
    .risk-card--ci { border-top-color: var(--yellow); }
    .risk-card--absence { border-top-color: var(--blue); }

    .risk-card__value {
      font-size: 28px;
      font-weight: 700;
      color: var(--brand-charcoal);
    }

    .risk-card__label {
      font-size: 9px;
      color: var(--text-secondary);
      text-transform: uppercase;
      margin-top: 4px;
    }

    .risk-card__context {
      font-size: 9px;
      color: var(--text-secondary);
      margin-top: 6px;
    }

    /* Employer Benefits */
    .benefits-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 20px;
    }

    .benefit-card {
      padding: 12px;
      border-radius: 8px;
      background: var(--light-grey);
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .benefit-card__icon {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      flex-shrink: 0;
    }

    .benefit-card__icon--yes { background: #DCFCE7; }
    .benefit-card__icon--no { background: #FEE2E2; }

    .benefit-card__text {
      font-size: 10px;
    }

    .benefit-card__label {
      font-weight: 600;
      color: var(--brand-charcoal);
    }

    .benefit-card__value {
      color: var(--text-secondary);
    }

    /* Recommendations */
    .recommendation {
      padding: 14px;
      border-radius: 8px;
      margin-bottom: 10px;
      border-left: 4px solid var(--brand-orange);
      background: var(--brand-cream);
    }

    .recommendation__title {
      font-size: 12px;
      font-weight: 700;
      color: var(--brand-charcoal);
      margin-bottom: 4px;
    }

    .recommendation__text {
      font-size: 10px;
      color: var(--text-secondary);
    }

    /* CTA Box */
    .cta-box {
      text-align: center;
      background: var(--brand-charcoal);
      color: white;
      padding: 24px;
      border-radius: 12px;
      margin-top: 20px;
    }

    .cta-box h3 {
      color: white;
      font-size: 16px;
      margin-bottom: 8px;
    }

    .cta-box p {
      opacity: 0.8;
      font-size: 11px;
    }

    .cta-box__contact {
      margin-top: 12px;
      font-size: 13px;
      color: var(--brand-orange);
      font-weight: 600;
    }

    /* Household Summary */
    .household-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr 1fr;
      gap: 10px;
      margin-bottom: 20px;
    }

    .household-stat {
      text-align: center;
      padding: 12px 8px;
      background: var(--light-grey);
      border-radius: 8px;
    }

    .household-stat__value {
      font-size: 18px;
      font-weight: 700;
      color: var(--brand-charcoal);
    }

    .household-stat__label {
      font-size: 8px;
      text-transform: uppercase;
      color: var(--text-secondary);
      margin-top: 2px;
    }

    /* Disclaimer */
    .disclaimer {
      font-size: 8px;
      color: var(--text-secondary);
      line-height: 1.4;
      margin-top: 16px;
      padding-top: 10px;
      border-top: 1px solid #E5E7EB;
    }
  </style>
</head>
<body>

  <!-- ========== PAGE 1: EXECUTIVE SUMMARY ========== -->
  <div class="page">
    <div class="page-header">
      <div class="page-header__logo">B Mortgage Services</div>
      <div class="page-header__date">Financial Wellness Report &middot; {{generatedDate}}</div>
    </div>

    <h1>Your Financial Wellness Report</h1>
    <p style="color: var(--text-secondary); margin-bottom: 20px;">A personalised snapshot of your mortgage readiness and financial resilience.</p>

    <!-- Score Hero -->
    <div class="score-hero">
      <div>
        <span class="score-hero__number">{{score}}</span><span class="score-hero__max">/100</span>
      </div>
      <div class="score-hero__category">{{category}}</div>
      <div class="score-hero__interpretation">{{interpretation}}</div>
    </div>

    <!-- Runway Hero -->
    <div class="runway-hero">
      <div>
        <div class="runway-hero__days">{{runway.days}}</div>
        <div class="runway-hero__label">days</div>
      </div>
      <div class="runway-hero__detail">
        <h3>Your Financial Runway</h3>
        <p>If your income stopped, your savings would cover essential outgoings for approximately <strong>{{runway.days}} days ({{runway.months}} months)</strong>.</p>
        <p>UK average: {{benchmarks.averageDeadlineDays}} days &middot; Target: {{benchmarks.targetDeadlineDays}}+ days</p>
      </div>
    </div>

    <!-- Four Pillar Cards -->
    <h2>Four Pillar Breakdown</h2>
    <div class="pillar-grid">
      <div class="pillar-card pillar-card--eligibility">
        <div class="pillar-card__title">Mortgage Eligibility</div>
        <div class="pillar-card__score">{{pillarPercentages.mortgageEligibility}}%</div>
        <div class="pillar-card__bar">
          <div class="pillar-card__fill" style="width: {{pillarPercentages.mortgageEligibility}}%; background: var(--green);"></div>
        </div>
      </div>
      <div class="pillar-card pillar-card--affordability">
        <div class="pillar-card__title">Affordability & Budget</div>
        <div class="pillar-card__score">{{pillarPercentages.affordabilityBudget}}%</div>
        <div class="pillar-card__bar">
          <div class="pillar-card__fill" style="width: {{pillarPercentages.affordabilityBudget}}%; background: var(--blue);"></div>
        </div>
      </div>
      <div class="pillar-card pillar-card--resilience">
        <div class="pillar-card__title">Financial Resilience</div>
        <div class="pillar-card__score">{{pillarPercentages.financialResilience}}%</div>
        <div class="pillar-card__bar">
          <div class="pillar-card__fill" style="width: {{pillarPercentages.financialResilience}}%; background: var(--yellow);"></div>
        </div>
      </div>
      <div class="pillar-card pillar-card--protection">
        <div class="pillar-card__title">Protection Readiness</div>
        <div class="pillar-card__score">{{pillarPercentages.protectionReadiness}}%</div>
        <div class="pillar-card__bar">
          <div class="pillar-card__fill" style="width: {{pillarPercentages.protectionReadiness}}%; background: var(--purple);"></div>
        </div>
      </div>
    </div>

    <!-- Strengths & Improvements -->
    <div class="two-column">
      <div class="column-card column-card--green">
        <div class="column-card__title">Your Strengths</div>
        <ul class="column-card__list">
          {{#each strengths}}
          <li>{{this}}</li>
          {{/each}}
        </ul>
      </div>
      <div class="column-card column-card--orange">
        <div class="column-card__title">Areas to Improve</div>
        <ul class="column-card__list">
          {{#each improvements}}
          <li>{{this}}</li>
          {{/each}}
        </ul>
      </div>
    </div>

    <div class="page-footer">
      B Mortgage Services &middot; bmortgageservices.co.uk &middot; Page 1 of 4 &middot; Report ID: {{reportId}}
    </div>
  </div>

  <!-- ========== PAGE 2: DETAILED ANALYSIS ========== -->
  <div class="page">
    <div class="page-header">
      <div class="page-header__logo">B Mortgage Services</div>
      <div class="page-header__date">Financial Wellness Report &middot; {{generatedDate}}</div>
    </div>

    <h2>Detailed Score Analysis</h2>

    <!-- Household Summary -->
    <h3>Your Household Finances</h3>
    <div class="household-grid">
      <div class="household-stat">
        <div class="household-stat__value">&pound;{{formatNumber household.monthlyIncome}}</div>
        <div class="household-stat__label">Monthly Income</div>
      </div>
      <div class="household-stat">
        <div class="household-stat__value">&pound;{{formatNumber household.monthlyEssentials}}</div>
        <div class="household-stat__label">Monthly Essentials</div>
      </div>
      <div class="household-stat">
        <div class="household-stat__value">&pound;{{formatNumber household.accessibleSavings}}</div>
        <div class="household-stat__label">Accessible Savings</div>
      </div>
      <div class="household-stat">
        <div class="household-stat__value">&pound;{{formatNumber household.monthlySurplus}}</div>
        <div class="household-stat__label">Monthly Surplus</div>
      </div>
    </div>

    <!-- Score Breakdown Table -->
    <h3>Score Breakdown</h3>
    <table class="waterfall-table" style="margin-bottom: 20px;">
      <thead>
        <tr>
          <th>Category</th>
          <th>Your Score</th>
          <th>Max Score</th>
          <th>Percentage</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Employment Status</strong></td>
          <td>{{breakdown.employment.score}}</td>
          <td>{{breakdown.employment.maxScore}}</td>
          <td>{{scorePercent breakdown.employment.score breakdown.employment.maxScore}}%</td>
        </tr>
        <tr>
          <td><strong>Credit History</strong></td>
          <td>{{breakdown.credit.score}}</td>
          <td>{{breakdown.credit.maxScore}}</td>
          <td>{{scorePercent breakdown.credit.score breakdown.credit.maxScore}}%</td>
        </tr>
        <tr>
          <td><strong>Deposit / LTV</strong></td>
          <td>{{breakdown.deposit.score}}</td>
          <td>{{breakdown.deposit.maxScore}}</td>
          <td>{{scorePercent breakdown.deposit.score breakdown.deposit.maxScore}}%</td>
        </tr>
        <tr>
          <td><strong>Monthly Surplus</strong></td>
          <td>{{breakdown.surplus.score}}</td>
          <td>{{breakdown.surplus.maxScore}}</td>
          <td>{{scorePercent breakdown.surplus.score breakdown.surplus.maxScore}}%</td>
        </tr>
        <tr>
          <td><strong>Emergency Savings</strong></td>
          <td>{{breakdown.emergency.score}}</td>
          <td>{{breakdown.emergency.maxScore}}</td>
          <td>{{scorePercent breakdown.emergency.score breakdown.emergency.maxScore}}%</td>
        </tr>
        <tr>
          <td><strong>Protection Cover</strong></td>
          <td>{{breakdown.protection.totalScore}}</td>
          <td>{{breakdown.protection.maxScore}}</td>
          <td>{{scorePercent breakdown.protection.totalScore breakdown.protection.maxScore}}%</td>
        </tr>
      </tbody>
    </table>

    {{#if breakdown.deposit.propertyValue}}
    <h3>Property & Deposit</h3>
    <div class="benefits-grid">
      <div class="benefit-card">
        <div class="benefit-card__text">
          <div class="benefit-card__label">Property Value</div>
          <div class="benefit-card__value">&pound;{{formatNumber breakdown.deposit.propertyValue}}</div>
        </div>
      </div>
      <div class="benefit-card">
        <div class="benefit-card__text">
          <div class="benefit-card__label">Deposit</div>
          <div class="benefit-card__value">&pound;{{formatNumber breakdown.deposit.value}}</div>
        </div>
      </div>
      <div class="benefit-card">
        <div class="benefit-card__text">
          <div class="benefit-card__label">Loan to Value</div>
          <div class="benefit-card__value">{{formatDecimal breakdown.deposit.ltv 1}}%</div>
        </div>
      </div>
      <div class="benefit-card">
        <div class="benefit-card__text">
          <div class="benefit-card__label">Mortgage Amount</div>
          <div class="benefit-card__value">&pound;{{formatNumber (subtract breakdown.deposit.propertyValue breakdown.deposit.value)}}</div>
        </div>
      </div>
    </div>
    {{/if}}

    <div class="disclaimer">
      Scores are calculated based on the information you provided. Actual mortgage eligibility depends on lender criteria, credit checks, and professional assessment.
    </div>

    <div class="page-footer">
      B Mortgage Services &middot; bmortgageservices.co.uk &middot; Page 2 of 4 &middot; Report ID: {{reportId}}
    </div>
  </div>

  <!-- ========== PAGE 3: FINANCIAL RESILIENCE ========== -->
  <div class="page">
    <div class="page-header">
      <div class="page-header__logo">B Mortgage Services</div>
      <div class="page-header__date">Financial Wellness Report &middot; {{generatedDate}}</div>
    </div>

    <h2>Financial Resilience</h2>

    <!-- Perception Gap -->
    <h3>Reality Check</h3>
    <div class="perception-grid">
      <div class="perception-box">
        <div class="perception-box__label">You Estimated</div>
        <div class="perception-box__value">{{round perceptionGap.estimatedDays}}</div>
        <div class="perception-box__unit">days</div>
      </div>
      <div class="perception-box perception-box--actual">
        <div class="perception-box__label">The Reality</div>
        <div class="perception-box__value">{{runway.days}}</div>
        <div class="perception-box__unit">days</div>
      </div>
    </div>
    <p style="text-align: center; font-size: 10px; color: var(--text-secondary); margin-bottom: 20px;">{{perceptionGap.message}}</p>

    <!-- Income Waterfall -->
    <h3>What If You Couldn't Work?</h3>
    <p style="font-size: 10px; color: var(--text-secondary); margin-bottom: 10px;">
      This shows what would happen to your income over 6 months if you were unable to work due to illness or injury.
    </p>
    <table class="waterfall-table">
      <thead>
        <tr>
          <th>Month</th>
          <th>Income Source</th>
          <th>Monthly Income</th>
          <th>vs. Essentials</th>
          <th>Cumulative Shortfall</th>
        </tr>
      </thead>
      <tbody>
        {{#each waterfall}}
        <tr>
          <td>Month {{this.month}}</td>
          <td>{{this.source}}</td>
          <td>&pound;{{formatNumber this.income}}</td>
          <td>
            {{#if (isShortfall this.income ../household.monthlyEssentials)}}
            <span style="color: var(--red); font-weight: 600;">-&pound;{{formatNumber (shortfallAmount this.income ../household.monthlyEssentials)}}</span>
            {{else}}
            <span style="color: var(--green); font-weight: 600;">+&pound;{{formatNumber (surplusAmount this.income ../household.monthlyEssentials)}}</span>
            {{/if}}
          </td>
          <td>
            {{#if this.cumulativeShortfall}}
            <span style="color: var(--red); font-weight: 600;">-&pound;{{formatNumber this.cumulativeShortfall}}</span>
            {{else}}
            <span style="color: var(--green);">&pound;0</span>
            {{/if}}
          </td>
        </tr>
        {{/each}}
      </tbody>
    </table>

    {{#with (lastItem waterfall)}}
    {{#if this.cumulativeShortfall}}
    <div style="background: #FEF2F2; border: 1px solid #FECACA; border-radius: 6px; padding: 10px 14px; margin-bottom: 12px; text-align: center;">
      <p style="font-size: 11px; font-weight: 700; color: #991B1B; margin: 0;">
        Total 6-month shortfall: &pound;{{formatNumber this.cumulativeShortfall}}
      </p>
      <p style="font-size: 9px; color: #7F1D1D; margin: 4px 0 0 0;">
        This is the amount you would need to find from savings or other sources to cover your essential outgoings over 6 months without adequate income protection.
      </p>
    </div>
    {{/if}}
    {{/with}}

    <!-- State Benefit Explanation -->
    <div style="background: #F0F4FF; border-left: 3px solid #3B82F6; padding: 10px 14px; margin-bottom: 10px; border-radius: 0 4px 4px 0;">
      <p style="font-size: 10px; font-weight: 600; color: #1E3A5F; margin: 0 0 6px 0;">Understanding Your State Benefit Entitlement</p>
      {{#ifEquals stateBenefit.type "SSP"}}
      <p style="font-size: 9px; color: #374151; margin: 0 0 4px 0;">
        As a PAYE employee, you are entitled to <strong>Statutory Sick Pay (SSP)</strong> of &pound;{{benchmarks.sspWeekly}}/week (&pound;{{benchmarks.sspMonthly}}/month) for up to {{benchmarks.sspMaxWeeks}} weeks. SSP is payable from day 1 of sickness (from April 2026). Your employer may also offer enhanced sick pay above this level.
      </p>
      <p style="font-size: 9px; color: #374151; margin: 0 0 4px 0;">
        After SSP ends, you may be eligible for <strong>New Style ESA</strong> at &pound;{{benchmarks.esaWeeklyAssessment}}/week, subject to your NI contribution record, and <strong>Universal Credit</strong> (&pound;{{benchmarks.ucSingle}}/month plus up to &pound;{{benchmarks.ucLCWRA}}/month LCWRA element).
      </p>
      {{else}}
      <p style="font-size: 9px; color: #374151; margin: 0 0 4px 0;">
        As a self-employed individual, you are <strong>not eligible for SSP</strong>. You may claim <strong>New Style ESA</strong> at &pound;{{benchmarks.esaWeeklyAssessment}}/week (&pound;{{benchmarks.esaMonthlyAssessment}}/month) during the 13-week assessment phase, rising to &pound;{{benchmarks.esaWeeklySupportGroup}}/week in the Support Group. Eligibility depends on Class 2 NI contributions.
      </p>
      <p style="font-size: 9px; color: #374151; margin: 0 0 4px 0;">
        You may also qualify for <strong>Universal Credit</strong> (&pound;{{benchmarks.ucSingle}}/month plus up to &pound;{{benchmarks.ucLCWRA}}/month LCWRA element). The Minimum Income Floor does not apply if you have limited capability for work.
      </p>
      {{/ifEquals}}
    </div>

    <!-- WCA Warning -->
    <div style="background: #FFF7ED; border-left: 3px solid #F59E0B; padding: 10px 14px; margin-bottom: 10px; border-radius: 0 4px 4px 0;">
      <p style="font-size: 10px; font-weight: 600; color: #92400E; margin: 0 0 6px 0;">&#9888; Important: State Benefits Are Not Guaranteed</p>
      <p style="font-size: 9px; color: #374151; margin: 0 0 4px 0;">
        To receive ESA or the health-related element of Universal Credit, you must pass the <strong>Work Capability Assessment (WCA)</strong> &mdash; a strict, points-based functional test. Approximately <strong>1 in 5 claimants are found fit for work</strong> at initial assessment and receive no health-related benefit. The WCA assesses what you can functionally do, not your diagnosis &mdash; having a medical condition alone is not sufficient.
      </p>
      <p style="font-size: 9px; color: #374151; margin: 0 0 4px 0;">
        The assessment process typically takes <strong>around 4 months</strong> from claim to decision. During this period you would receive only the basic UC rate with no health element. If you need to challenge a decision, it can take 6&ndash;9 months or more.
      </p>
      <p style="font-size: 8px; color: #6B7280; margin: 4px 0 0 0; font-style: italic;">
        Rates shown are for 2025/26. Actual entitlement depends on individual circumstances, NI record, and household income. UC is means-tested. This is for illustration only and does not constitute benefits advice.
      </p>
    </div>

    <!-- Employer Benefits -->
    <h3>Your Employer Safety Net</h3>
    <div class="benefits-grid">
      <div class="benefit-card">
        <div class="benefit-card__icon {{#if employerBenefits.sickPay.exists}}benefit-card__icon--yes{{else}}benefit-card__icon--no{{/if}}">
          {{#if employerBenefits.sickPay.exists}}&#10003;{{else}}&#10007;{{/if}}
        </div>
        <div class="benefit-card__text">
          <div class="benefit-card__label">Employer Sick Pay</div>
          <div class="benefit-card__value">{{employerBenefits.sickPay.description}}</div>
        </div>
      </div>
      <div class="benefit-card">
        <div class="benefit-card__icon {{#if employerBenefits.deathInService.exists}}benefit-card__icon--yes{{else}}benefit-card__icon--no{{/if}}">
          {{#if employerBenefits.deathInService.exists}}&#10003;{{else}}&#10007;{{/if}}
        </div>
        <div class="benefit-card__text">
          <div class="benefit-card__label">Death in Service</div>
          <div class="benefit-card__value">{{employerBenefits.deathInService.description}}</div>
        </div>
      </div>
    </div>

    <div class="disclaimer">
      Financial runway calculation accounts for {{stateBenefit.label}} (&pound;{{stateBenefit.monthlyAmount}}/month) and any personal income protection cover declared. Actual benefit entitlement depends on individual circumstances and may vary.
    </div>

    <div class="page-footer">
      B Mortgage Services &middot; bmortgageservices.co.uk &middot; Page 3 of 4 &middot; Report ID: {{reportId}}
    </div>
  </div>

  <!-- ========== PAGE 4: RISK & RECOMMENDATIONS ========== -->
  <div class="page">
    <div class="page-header">
      <div class="page-header__logo">B Mortgage Services</div>
      <div class="page-header__date">Financial Wellness Report &middot; {{generatedDate}}</div>
    </div>

    <h2>Mortgage Term Risk Statistics</h2>
    <p style="font-size: 10px; color: var(--text-secondary); margin-bottom: 14px;">
      {{riskAssessment.summary}}
    </p>

    <div class="risk-grid">
      <div class="risk-card risk-card--death">
        <div class="risk-card__value">{{riskAssessment.formatted.death}}</div>
        <div class="risk-card__label">Chance of Death</div>
        <div class="risk-card__context">During 25-year mortgage</div>
      </div>
      <div class="risk-card risk-card--ci">
        <div class="risk-card__value">{{riskAssessment.formatted.criticalIllness}}</div>
        <div class="risk-card__label">Critical Illness</div>
        <div class="risk-card__context">Diagnosis probability</div>
      </div>
      <div class="risk-card risk-card--absence">
        <div class="risk-card__value">{{riskAssessment.formatted.longTermAbsence}}</div>
        <div class="risk-card__label">2+ Month Absence</div>
        <div class="risk-card__context">From work during term</div>
      </div>
    </div>

    <p style="font-size: 9px; color: var(--text-secondary); font-style: italic; margin-bottom: 20px;">
      These are statistical averages based on age ({{riskAssessment.probabilities.ageBracket}}) and smoking status ({{riskAssessment.probabilities.smokingStatus}}). Individual risk varies. Discuss with a qualified adviser.
    </p>

    <!-- Recommendations -->
    <h2>Your Next Steps</h2>

    {{#each recommendations}}
    <div class="recommendation">
      <div class="recommendation__title">{{this.title}}</div>
      <div class="recommendation__text">{{this.text}}</div>
    </div>
    {{/each}}

    <!-- CTA -->
    <div class="cta-box">
      <h3>Ready to Take the Next Step?</h3>
      <p>Book a free, no-obligation consultation with one of our mortgage advisers. We'll review your report and create a personalised action plan.</p>
      <div class="cta-box__contact">
        bmortgageservices.co.uk &middot; info@bmortgagesolutions.co.uk
      </div>
    </div>

    <div class="disclaimer">
      This report is for informational purposes only and does not constitute financial advice. B Mortgage Services is authorised and regulated by the Financial Conduct Authority. Your home may be repossessed if you do not keep up repayments on your mortgage. Report generated {{generatedDate}}. Data based on {{benchmarks.averageDeadlineDays}}-day UK average deadline (L&amp;G 2022), SSP rates from April 2026, and risk probabilities from CMI mortality tables.
    </div>

    <div class="page-footer">
      B Mortgage Services &middot; bmortgageservices.co.uk &middot; Page 4 of 4 &middot; Report ID: {{reportId}}
    </div>
  </div>

</body>
</html>`;
