# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm run dev          # Start local dev server (Hugo + Netlify Functions on localhost:8888)
npm run build        # Production build (hugo --gc --minify)
hugo                 # Quick build (no minification, useful for verifying changes)
netlify dev          # Same as npm run dev — proxies Hugo:1313 + Functions:8888
```

No automated test suite exists. Test serverless functions manually:
```bash
curl -X POST http://localhost:8888/.netlify/functions/wellness-calculate \
  -H "Content-Type: application/json" \
  -d '{"employment":"paye-12","credit":"clean","propertyValue":250000,"deposit":50000,"surplus":"surplus","emergency":"6plus","life":"full","income":"full","critical":"full"}'
```

## Architecture

**Hugo static site** + **Netlify serverless functions** + **Supabase** (PostgreSQL + Storage).

The site is a UK mortgage broker website with an interactive Financial Wellness Assessment tool. Users fill a 4-step modal form, which POSTs to a Netlify Function that scores their mortgage readiness across 4 pillars, stores the report in Supabase, and returns results rendered client-side with Chart.js.

### Request flow
```
Browser (wellness-client.js)
  → POST /api/wellness-calculate (redirected by netlify.toml)
    → /.netlify/functions/wellness-calculate
      → scoring-engine.js (calculate + validate)
      → supabase-client.js (save report + log analytics)
    ← JSON response (score, charts, metrics, runway, risk data)
  → displayResults() renders everything in the modal
```

### Key directories
- `themes/bms-theme/layouts/` — Hugo templates (Go templating). Page-specific layouts in subfolders (`individuals/`, `employers/`, `wellness/`, etc.), reusable parts in `partials/`.
- `themes/bms-theme/static/css/main.css` — Single stylesheet, ~5000 lines. BEM naming (`.block__element--modifier`), CSS custom properties for brand colours and spacing.
- `themes/bms-theme/static/js/` — Vanilla JS, no frameworks. `main.js` (site-wide), `wellness-client.js` (modal/form/results ~900 lines).
- `netlify/functions/` — Serverless endpoints. `wellness-calculate.js` (API handler), `wellness-pdf.js` (Phase 3 PDF generation).
- `netlify/functions/utils/` — `scoring-engine.js` (~1000 lines, core algorithm), `supabase-client.js`, `risk-data.js`, `pdf-generator.js`.
- `content/` — Hugo markdown content pages.
- `supabase/migrations/` — SQL schema for `wellness_reports` and `wellness_analytics` tables.

## Scoring Engine

The scoring engine (`netlify/functions/utils/scoring-engine.js`) calculates a 0-100 score using dynamic max scoring across 4 pillars:

| Pillar | Max Points | Components |
|--------|-----------|------------|
| Mortgage Eligibility | 35 | Employment (10) + Credit (7) + LTI (10) + DTI (8) |
| Affordability & Budget | 30 | Deposit/LTV (20) + Monthly surplus (10) |
| Financial Resilience | 10 | Emergency fund runway |
| Protection Readiness | 15 | Life (5) + Income protection (5) + Critical illness (5) |

When LTI/DTI data is unavailable, `maxPossibleScore` decreases (72-90 range) so users aren't penalised for missing data. Final score = `rawScore / maxPossibleScore * 100`.

## SessionStorage Data Sharing

The affordability calculator on `/individuals/` saves data to sessionStorage (`bms_affordability_data` key, 30-min expiry) which pre-fills the wellness modal form. Fields include income, property value, deposit, gross income, mortgage term, interest rate, and commitments.

## Conventions

- **CSS**: BEM notation, CSS custom properties (e.g. `var(--brand-orange)`, `var(--radius-lg)`). Brand orange: `#F05B28`, brand charcoal: `#2D2D2D`.
- **JS**: Vanilla JS with `var` declarations (ES5 compat in client code). Netlify functions use Node.js CommonJS (`require`/`module.exports`).
- **Results page sections**: Use `.results-section` wrapper with `.results-section__heading` and `.results-section__intro` for consistent visual hierarchy.
- **Hugo templates**: Go template syntax. Partials in `themes/bms-theme/layouts/partials/`. The wellness modal (`wellness-modal.html`) is included site-wide via `baseof.html`.

## Environment Variables

Required in `.env` for local dev (see `.env.example`):
- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_ANON_KEY` — Public anon key (RLS enforced)
- `SENDGRID_API_KEY` — Email delivery
- `REPORT_BASE_URL` — `http://localhost:8888/wellness/report/` locally, `https://bmortgageservices.co.uk/wellness/report/` in production

## Development Phases

- **Phase 1** (complete): Backend infrastructure, scoring engine, Supabase setup
- **Phase 2** (complete): Frontend modal, form wizard, results visualisation, session data sharing, mortgage eligibility metrics (LTI/DTI/LTV)
- **Phase 3** (in progress): PDF report generation with Puppeteer/Chromium, email delivery via SendGrid

## Development Log

Track what has been built, key decisions, and gotchas so future sessions can pick up without re-discovery.

### Completed Work

**Wellness Modal & Form (Phase 2)**
- 4-step wizard: Financial Details → Protection & Benefits → Self-Assessment → Email/Submit
- Employer benefits fields: sick pay duration, death-in-service multiple, income protection details (monthly benefit, deferred period)
- Partner/joint income toggle shows/hides second income + gross income fields
- Gross annual income fields are optional; if omitted, estimated from net × 12 × 1.3

**Scoring Engine Enhancements**
- `resolveGrossIncome(grossAnnual, monthlyNet)` — priority: explicit → estimated from net → unavailable
- `calculateLTI(mortgageAmount, grossAnnualIncome)` — FCA cap 4.5x, tiers: <3.5x excellent → >5.0x difficult
- `calculateDTI(mortgageAmount, grossMonthlyIncome, monthlyCommitments, mortgageTerm, userRate)` — uses user's actual rate for scoring, stress tests at 6.5% BoE rate shown as footnote warning
- DTI guard clause: skips scoring when both mortgage amount and commitments are 0 (prevents false 0% = excellent)
- Property/deposit values parsed early in `calculate()` (before Pillar 1) since LTI/DTI need them
- Dynamic max scoring: full data = 90pts max, no LTI = 80, no DTI = 82, neither = 72

**Results Page Structure**
- Sections wrapped in `.results-section` with `.results-section__heading` and `.results-section__intro`
- Flow: Score + Strengths → Financial Runway → Mortgage Eligibility Dashboard → Score Breakdown (charts) → Reality Check → What If You Couldn't Work (waterfall + risk stats) → Save/CTA
- Runway callout colour changes dynamically by status (strong=green, good=lime, moderate=yellow, critical=red)
- Mortgage metrics dashboard built dynamically in JS (`displayMortgageMetrics()`), only shown when data available
- Income Protection nudge added below Reality Check perception gap comparison
- Risk stat cards grouped under the waterfall chart as "The Statistics Over a 25-Year Mortgage"

**Affordability Calculator**
- Three tiers: Conservative (3.5x), Standard (4.5x), Maximum (6x income)
- `saveAffordabilityToSession()` captures: both incomes, property, deposit, mortgage term, interest rate, mortgage amount
- Print function correctly labels "Maximum (up to 6x)"

### Known Gotchas

- **Variable ordering in scoring-engine.js**: `propertyVal`, `depositVal`, `ltv` must be parsed before Pillar 1 (they were originally in Pillar 2). If you add new metrics that reference these, they're available early in `calculate()`.
- **Runway callout text colour**: The `#runway-callout` CSS sets `color: var(--white)` but the background changes via JS. Explicit white colour rules exist for `p`, `span`, `div` children to prevent inheritance issues on lighter gradient backgrounds (green/lime).
- **DTI edge case**: A DTI of 0% would score 8 points (excellent) even with no data. Guard clause returns null score when both `mortgageAmount <= 0` and `monthlyCommitments <= 0`.
- **CORS**: Currently set to `*` in `wellness-calculate.js` — needs restricting to `bmortgageservices.co.uk` before production.
- **Client JS uses `var`**: The wellness-client.js uses ES5-style `var` declarations throughout for broad browser compatibility. Keep this pattern when adding new client-side code.

### Pending / TODO

- Phase 3 PDF generation (templates in `templates/pdf/`, generator in `netlify/functions/utils/pdf-generator.js`)
- SendGrid email delivery of PDF reports
- Restrict CORS origin for production
- No automated tests — scoring engine would benefit from unit tests
