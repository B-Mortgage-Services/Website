# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

# ⚠️ CURRENT STATE: THE SITE IS NOT LAUNCHED

`main` publishes **one page only** — the Coming Soon holding page. Most of what the
rest of this document describes (the wellness tool, the `/api/*` functions, the
calculators) exists on `develop`, **not** on `main`.

## Branches

| Branch | Contents | Published? |
|---|---|---|
| `main` | Coming Soon holding page, nothing else | **Yes — this is the live public site** |
| `develop` | The complete site. Do all work here. | No |
| `holding-page` | Snapshot of the holding-page reduction | No |
| `full-site` | Legacy, same commit as `develop` started from. Safe to delete. | No |

## Why the site was reduced

The earlier "Coming Soon" commit only replaced the homepage *layout*. Every other
page stayed published, the nav and footer links to them were merely CSS-hidden
(`display: none`) — which crawlers still follow — and the `/api/*` functions stayed
live regardless of which pages existed. Google and Bing indexed the unlaunched
site, and the open `/api/contact` endpoint collected spam enquiries.

Commit `6775163` on `main` fixed that by:

- Deleting every `content/` page except `content/_index.md`
- Deleting `functions/` and `netlify/` (this is what closed `/api/contact`)
- Adding `holdingPage = true` under `[params]` in `hugo.toml`, which gates the
  header, footer, wellness modal and visitor tracking out of
  `themes/bms-theme/layouts/_default/baseof.html`
- Adding `disableKinds = ['taxonomy', 'term', 'rss']` to `hugo.toml`
- Restricting `static/robots.txt` to the homepage only
- Stripping the page list out of `static/llms.txt`
- Emptying `static/_redirects` and removing the function config from `netlify.toml`

A correct holding-page build produces **exactly one HTML file** with **zero
internal links**. Verify before any deploy of `main`:

```bash
hugo --gc --minify
find public -name "*.html"                               # must be only public/index.html
grep -oE 'href="[^"]*"' public/index.html | grep -v fonts.googleapis   # must be empty
```

---

# HOW TO PUT THE FULL SITE BACK

Do the pre-launch checklist first — several items are not cosmetic.

## Step 1 — Pre-launch checklist

- [ ] **Fix the `visitor_tool_results` UPDATE policy.** Migration
      `006_visitor_tracking.sql` in the CRM repo has
      `FOR UPDATE USING (true)`, letting any anonymous user modify *any* saved
      result. Scope it to the row's own `visitor_id`.
- [ ] **Add bot protection to the contact form.** All five enquiries received
      while unlaunched were spam. `/api/contact` has IP rate limiting (5/hr) but
      no CAPTCHA or honeypot. Add Cloudflare Turnstile plus a honeypot field.
- [ ] **Fix the tracker** (`themes/bms-theme/static/js/bms-tracker.js`):
      `sendEvent()` never populates `user_agent` or `ip_country`, so bot traffic
      is indistinguishable from real visitors; `tool_complete` fires on page load
      against empty form state (every stored result is all-zeros); and
      `setConsent()` calls `trackPageView()` a second time, double-counting.
- [ ] **Restrict CORS** in the API handlers from `*` to `bmortgageservices.co.uk`.
- [ ] **Clear the junk analytics.** `visitor_activity` holds ~3,400 rows of
      almost entirely crawler traffic. Truncate it and `visitor_tool_results`
      so launch metrics start clean.
- [ ] **Remove the spam enquiries** and detach them from the real employer
      records they were wrongly attributed to (Nottingham Trent University,
      Giacom).

## Step 2 — Restore the full site onto `main`

This makes `main`'s tree exactly match `develop`, re-adding the deleted pages and
reverting `hugo.toml`, `robots.txt`, `llms.txt` and `baseof.html` in one step. It
is an ordinary commit — **no force push**.

```bash
git checkout develop && git pull
git checkout main && git pull
git read-tree -m -u develop          # main's tree becomes develop's, exactly
git commit -m "Restore full site for launch"
```

Verify before pushing — `holdingPage` must be gone and the pages must be back:

```bash
grep holdingPage hugo.toml           # must return nothing
hugo --gc --minify
find public -name "*.html" | wc -l   # expect ~13, not 1
grep -c bms-tracker public/index.html   # expect 1
head -3 static/robots.txt            # must be "Allow: /", not "Disallow: /"
```

Then `git push origin main`.

Do **not** use `git merge develop` for this. `main` deleted those content files,
`develop` never touched them, so git keeps the deletions and the pages stay gone.

## Step 3 — Purge the Cloudflare cache

**This step is mandatory and easy to miss.** The live domain is served by
**Cloudflare Pages**, not GitHub Pages. Non-homepage HTML is sent with
`cache-control: public, s-maxage=604800` (7 days), so old pages keep being served
from the edge long after a deploy — a cache purge is the only thing that clears
them. Purge Everything in the Cloudflare dashboard (Caching → Configuration),
then confirm:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://bmortgageservices.co.uk/contact/
```

## Step 4 — Re-open indexing

Once live, ask Google Search Console and Bing Webmaster Tools to recrawl, and
resubmit `sitemap.xml`. If the holding page was indexed, request removal of any
stale URLs.

---

## Deployment topology (easy to get wrong)

Three targets are configured, and **the live domain is not GitHub Pages**:

| Target | Config | Serves |
|---|---|---|
| **Cloudflare Pages** | `wrangler.toml` (project `bms-website`) | **`bmortgageservices.co.uk` — the live site**, plus `bms-website-gjc.pages.dev` |
| GitHub Pages | `.github/workflows/jekyll-gh-pages.yml`, builds on push to `main` | `b-mortgage-services.github.io/Website/` only |
| Netlify | `netlify.toml` | Legacy, functions removed |

Because the custom domain is Cloudflare's, a GitHub Pages deploy alone does not
change the live site. Note also that Cloudflare Pages creates a public preview
deployment for **every** pushed branch by default — keep previews disabled or
behind Cloudflare Access so `develop` does not become publicly reachable.

---

## Build & Development Commands

```bash
npm run dev          # Start local dev server (Hugo + Cloudflare Pages Functions on localhost:8788)
npm run build        # Production build (hugo --gc --minify)
hugo                 # Quick build (no minification, useful for verifying changes)
```

No automated test suite exists. Test serverless functions manually:
```bash
curl -X POST http://localhost:8788/api/wellness-calculate \
  -H "Content-Type: application/json" \
  -d '{"employment":"paye-12","credit":"clean","propertyValue":250000,"deposit":50000,"surplus":"surplus","emergency":"6plus","life":"full","income":"full","critical":"full"}'
```

## Architecture

**Hugo static site** + **Cloudflare Pages Functions** + **Supabase** (PostgreSQL + Storage) + **Cloudflare Browser Rendering** (PDF generation).

The site is a UK mortgage broker website with an interactive Financial Wellness Assessment tool. Users fill a 4-step modal form, which POSTs to a Cloudflare Pages Function that scores their mortgage readiness across 4 pillars, stores the report in Supabase, and returns results rendered client-side with Chart.js.

### Request flow
```
Browser (wellness-client.js)
  → POST /api/wellness-calculate
    → functions/api/wellness-calculate.js
      → scoring-engine.js (calculate + validate)
      → supabase-client.js (save report + log analytics)
    ← JSON response (score, charts, metrics, runway, risk data)
  → displayResults() renders everything in the modal

  → GET /api/wellness-pdf?reportId={id}
    → functions/api/wellness-pdf.js
      → pdf-generator.js (Cloudflare Browser Rendering + @cloudflare/puppeteer)
      → supabase-client.js (upload PDF to Supabase Storage)
    ← JSON { pdfUrl }
```

### Key directories
- `themes/bms-theme/layouts/` — Hugo templates (Go templating). Page-specific layouts in subfolders (`individuals/`, `employers/`, `wellness/`, etc.), reusable parts in `partials/`.
- `themes/bms-theme/static/css/main.css` — Single stylesheet, ~5500 lines. BEM naming (`.block__element--modifier`), CSS custom properties for brand colours and spacing.
- `themes/bms-theme/static/js/` — Vanilla JS, no frameworks. `main.js` (site-wide), `wellness-client.js` (modal/form/results ~900 lines).
- `functions/api/` — Cloudflare Pages Function endpoints. `wellness-calculate.js` (POST handler), `wellness-pdf.js` (GET handler for PDF generation).
- `functions/_utils/` — Shared modules (prefixed `_` so Cloudflare doesn't expose as routes). `scoring-engine.js` (~1000 lines, core algorithm), `supabase-client.js`, `risk-data.js`, `pdf-generator.js`, `pdf-template.js`.
- `content/` — Hugo markdown content pages.
- `static/images/` — Images, partner logos, and PDF downloads (privacy-policy.pdf, financial-wellness-brochure.pdf).
- `supabase/migrations/` — SQL schema for `wellness_reports` and `wellness_analytics` tables.
- `netlify/` — Legacy Netlify Functions (kept for reference, no longer active).

### Site structure & navigation

The Hugo menu (`hugo.toml`) supports nested dropdowns. The header partial (`partials/header.html`) renders children via `{{ if .HasChildren }}`.

```
Home
Individuals (identifier: "individuals")
  └─ Protection (/individuals/protection/)
Employers
Tools
  ├─ Affordability Calculator
  ├─ Budget Planner
  └─ Financial Wellness
Contact
```

To add a new child page: add a `[[menu.main]]` entry with `parent = "<identifier>"`, create `content/<section>/<page>/_index.md`, and add a layout at `themes/bms-theme/layouts/<section>/<page>/list.html`.

### Cloudflare Pages Functions

Functions use **file-based routing** — `functions/api/wellness-calculate.js` automatically handles `/api/wellness-calculate`. Files/folders prefixed with `_` are helper modules (not routes).

**Handler pattern** (ESM exports, Web API Request/Response):
```javascript
export async function onRequestPost(context) {
  const data = await context.request.json();
  const { env } = context;  // env vars via context, NOT process.env
  return new Response(JSON.stringify({...}), { status: 200, headers: {...} });
}
export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
```

**Runtime restrictions** (Cloudflare Workers):
- No `process.env` at module scope — env vars only available in request context via `context.env`
- No `new Function()` or `eval()` — Handlebars/lodash templates won't work; use template literals
- No Node.js built-ins (`fs`, `child_process`, `path`) unless `nodejs_compat` flag is set in `wrangler.toml`
- Use Web Crypto API (`crypto.getRandomValues()`) instead of `require('crypto')`

### Cloudflare Configuration

`wrangler.toml` must include `pages_build_output_dir` or Cloudflare ignores the entire file. Current config:
```toml
name = "bms-website"
pages_build_output_dir = "public"
compatibility_date = "2024-12-01"
compatibility_flags = ["nodejs_compat"]

[browser]
binding = "BROWSER"
```

## Scoring Engine

The scoring engine (`functions/_utils/scoring-engine.js`) calculates a 0-100 score using dynamic max scoring across 4 pillars:

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
- **JS**: Vanilla JS with `var` declarations (ES5 compat in client code). Cloudflare functions use CommonJS (`require`/`module.exports`) with ESM exports for handler functions.
- **Results page sections**: Use `.results-section` wrapper with `.results-section__heading` and `.results-section__intro` for consistent visual hierarchy.
- **Hugo templates**: Go template syntax. Partials in `themes/bms-theme/layouts/partials/`. The wellness modal (`wellness-modal.html`) is included site-wide via `baseof.html`.
- **PDF templates**: Pure JS template literals in `functions/_utils/pdf-template.js` — no Handlebars (blocked by Workers CSP).

## Environment Variables

Set in **Cloudflare Pages dashboard** (Settings > Environment variables) for production. For local dev, create a `.dev.vars` file (Cloudflare's equivalent of `.env`):
- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_ANON_KEY` — Public anon key (RLS enforced)
- `SENDGRID_API_KEY` — Email delivery
- `REPORT_BASE_URL` — `http://localhost:8788/wellness/report/` locally, `https://bmortgageservices.co.uk/wellness/report/` in production

## Development Phases

- **Phase 1** (complete): Backend infrastructure, scoring engine, Supabase setup
- **Phase 2** (complete): Frontend modal, form wizard, results visualisation, session data sharing, mortgage eligibility metrics (LTI/DTI/LTV)
- **Phase 3** (in progress): PDF report generation via Cloudflare Browser Rendering, email delivery via SendGrid

## Development Log

Track what has been built, key decisions, and gotchas so future sessions can pick up without re-discovery.

### Completed Work

**Cloudflare Pages Migration**
- Migrated from Netlify to Cloudflare Pages (functions, env var handling, config)
- Converted Netlify Functions (`exports.handler`) to Cloudflare Pages Functions (`onRequestPost`/`onRequestGet`)
- Replaced `process.env` with `context.env` injection pattern in supabase-client.js
- Replaced `require('crypto')` with Web Crypto API (`crypto.getRandomValues()`)
- Replaced Handlebars PDF template with pure JS template literals (Workers block `new Function()`)
- PDF generation uses Cloudflare Browser Rendering (`@cloudflare/puppeteer` + BROWSER binding, requires Workers Paid plan)
- API endpoints: `/api/wellness-calculate` (POST), `/api/wellness-pdf` (GET)

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

**Protection Page (`/individuals/protection/`)**
- Full page with 7 sections: Hero, Why Protection is Non-Negotiable (19-day stat), Three Pillars (Life/Critical Illness/Income Protection), Safety Net Graphic (dark section), Shortfall Calculator, Complex Lives Callout, Final CTA
- Interactive shortfall calculator with editable text input (monthly outgoings, default £2,500) + range slider (time off work, 1–24 months, default 6)
- Calculator updates dynamically: monthly void, SSP percentage bar, and N-month total risk
- Added to nav menu as dropdown child under Individuals (`identifier` + `parent` pattern in `hugo.toml`)
- Layout: `themes/bms-theme/layouts/individuals/protection/list.html`
- Content: `content/individuals/protection/_index.md`

**Employer Page Enhancements**
- Company Insights Banner: dark gradient section targeting HR managers about anonymised employee data insights (3 feature cards)
- Trust Bar: partner logos with welcoming message for employer audience
- Orange CTA Banner: "Ready to Get Started?" with condensed 3-step process
- Merged 4 compliance cards (Independent, Regulated & Confidential) into "How This Benefits Your Organisation" section (now 8 cards)
- Commented out redundant sections: "Support Across Every Stage", "Easy for Employers", "Independent, Regulated & Confidential"
- All "Request Employer Information Pack" buttons changed to "Download Info Pack" pointing to `/images/financial-wellness-brochure.pdf`

**Broken Link Audit & Fixes (Feb 2026)**
- `/employers/brochure/` → direct PDF download (`/images/financial-wellness-brochure.pdf`)
- `/refer/` → `/contact/` (no referral page exists yet)
- `/privacy/` and `/privacy-policy/` → `/images/privacy-policy.pdf` (placeholder PDF)
- Contact page email typo fixed: `bmortgagesolutions` → `bmortgageservices`
- Contact page employer brochure: removed `/static/` prefix from path
- Calendly URL typo: `enquity` → `enquiry` (employers page, 2 instances)
- Removed `/terms/` and `/complaints/` from footer (no content yet)

### Known Gotchas

- **Variable ordering in scoring-engine.js**: `propertyVal`, `depositVal`, `ltv` must be parsed before Pillar 1 (they were originally in Pillar 2). If you add new metrics that reference these, they're available early in `calculate()`.
- **Runway callout text colour**: The `#runway-callout` CSS sets `color: var(--white)` but the background changes via JS. Explicit white colour rules exist for `p`, `span`, `div` children to prevent inheritance issues on lighter gradient backgrounds (green/lime).
- **DTI edge case**: A DTI of 0% would score 8 points (excellent) even with no data. Guard clause returns null score when both `mortgageAmount <= 0` and `monthlyCommitments <= 0`.
- **CORS**: Currently set to `*` in both API handlers — needs restricting to `bmortgageservices.co.uk` before production.
- **Client JS uses `var`**: The wellness-client.js uses ES5-style `var` declarations throughout for broad browser compatibility. Keep this pattern when adding new client-side code.
- **wrangler.toml validity**: Must include `pages_build_output_dir` or Cloudflare silently ignores the entire file (no error, just no bindings/flags applied).
- **No `new Function()` in Workers**: Handlebars, lodash templates, and similar libraries that compile strings to functions will throw `EvalError`. Use template literals instead.
- **Cloudflare env vars**: Only available inside request handlers via `context.env`, not at module scope. Supabase client uses lazy initialization pattern.

### Pending / TODO

- SendGrid email delivery of PDF reports
- Restrict CORS origin for production
- Custom domain setup (currently on `*.pages.dev`)
- No automated tests — scoring engine would benefit from unit tests
- Terms of Service and Complaints pages (removed from footer, need content/PDFs)
- Referral page (`/refer/`) — currently redirects to `/contact/`
- Privacy policy PDF is a placeholder — replace with final version
- Calendly URL `workplace-advice-enquiry` — verify this is the correct Calendly event slug
