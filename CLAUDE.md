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

- [ ] **Apply migration `049` to production.** The file exists in the CRM repo
      but **has not been run** — it is DDL, so it cannot go through the REST
      API. Paste into the Supabase SQL Editor:
      `DROP POLICY IF EXISTS "visitor_tool_results_update_anon" ON public.visitor_tool_results;`
      Until this runs, any holder of the public anon key can update any row in
      `visitor_tool_results`. Verify with the `pg_policies` query in the
      migration file.
- [ ] **Add Cloudflare Turnstile to the contact form.** A honeypot, a minimum
      submit time and per-IP rate limiting are now in place (done below), which
      handles the commodity spam seen so far. Turnstile needs a site key and a
      secret key created in the Cloudflare dashboard, so it could not be done
      from the repo alone. Add the secret as a Pages environment variable.
- [ ] **Populate `ip_country`.** Still always NULL. It cannot be set from the
      browser — it needs the tracker to POST to a Pages Function that reads
      `request.cf.country` and the `User-Agent` header server-side. That change
      would also stop shipping the Supabase anon key in the page bundle and
      allow rate limiting of tracking writes. Worth doing; not done.
- [ ] **Re-clear the analytics tables after the stale cache expires
      (~13 Oct).** They were emptied on 2026-10-06, but the seven stale cached
      pages still serve the *old* build, which still loads the tracker and is
      still writing rows (37 arrived in the few hours after deploy, 24 of them
      from `/employers/`). Those rows are identifiable by `user_agent IS NULL`,
      since the current build always sends one.
- [ ] **Confirm the apex cache purge works** before launch — see the known issue
      below. You do not want to discover an unresponsive purge on launch day.
- [ ] **Canonicalise `www`.** Both `www` and the apex now serve identical
      content. Hugo's `baseURL` is the apex, so add a Cloudflare Redirect Rule
      `www.bmortgageservices.co.uk/*` → `https://bmortgageservices.co.uk/$1`
      (301). Harmless on a one-page holding site, duplicate content once the
      full site is live.
- [ ] **Give `develop` its own `404.html`.** `main` has
      `themes/bms-theme/layouts/404.html` worded for the pre-launch state
      ("our new website isn't live yet"). The restore in Step 2 takes
      `develop`'s tree wholesale, so that file disappears unless `develop`
      has its own version with launch-appropriate wording. Without a
      `404.html` in the build, Cloudflare Pages falls back to serving
      `index.html` with HTTP **200** for every unmatched path (see gotcha
      below).

### Done on 2026-10-06

**Tracker data quality.** Every one of the 121 stored tool results was all-zero
and they arrived in pairs sharing a timestamp. Cause: the calculators called
`trackToolComplete` at the end of *every* run of `calculateAffordability()` /
`calculateMovingCosts()`, and those run on `DOMContentLoaded` (list.html:1248)
and on each keystroke. So every bot that loaded the page filed a completed
result, and the two calculators firing together produced the pairs. Both
functions now take a `track` argument, passed only from the Calculate buttons,
and additionally require real input (`totalIncome > 0` / `housePrice > 0`).

If you add another caller, do **not** pass `track` unless it is a deliberate
user action — and never wire these functions straight to an event listener,
because the Event object would arrive as `track` and read as truthy.

Also fixed: `user_agent` is now sent (it was always NULL, which is why bot and
human traffic were indistinguishable), and `setConsent()` no longer re-sends a
page view, which had been double-counting everyone who accepted cookies.

**Contact form hardening** (`functions/api/contact.js`): honeypot field, a
2.5-second minimum submit time, per-IP rate limiting (3/hour via the existing
`check_rate_limit` RPC), and CORS narrowed from `*` to the live domains. The
honeypot and timing checks deliberately return `{success: true}` so bots get no
signal to adapt. Rate limiting fails open — a database problem must not block a
genuine enquiry.

Correction to an earlier note in this file: `/api/contact` never had rate
limiting. The 5/hour limit is on the CRM's separate `/api/enquiry` route, which
this form does not call — the website form posts straight to the Pages Function,
which inserted into Supabase with no checks at all. That is how all five spam
enquiries got in.

**Data cleanup.** Deleted 5 spam enquiries (all B2B cold outreach; zero genuine
enquiries had ever been received) and emptied `visitor_activity` (3,468 rows)
and `visitor_tool_results` (121 rows). Employer and client records were
untouched — verified Nottingham Trent University and Giacom survived, since two
spam enquiries had been mis-attributed to them. Deleting the enquiry rows
removed those links, so no separate detach was needed.

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

## DNS and hostnames (resolved 2026-10-06)

Cloudflare is authoritative. The domain is *registered* at IONOS, but the
nameservers delegate to Cloudflare (`lila.ns.cloudflare.com`,
`benedict.ns.cloudflare.com`), so **the IONOS DNS panel is dormant** — records
edited there have no effect on live traffic. Only change DNS in Cloudflare.

| Record | Value | |
|---|---|---|
| `bmortgageservices.co.uk` CNAME | `bms-website-gjc.pages.dev` (proxied) | correct |
| `www` | Pages custom domain (proxied) | fixed 2026-10-06 |
| `MX` | `...mail.protection.outlook.com` | do not touch |
| `TXT` | SPF (`_spf-eu.ionos.com`, `spf.protection.outlook.com`) | do not touch |
| `autodiscover` CNAME | `autodiscover.outlook.com` | do not touch |

If you ever attach a new hostname to the Pages project, delete any conflicting
`A`/`AAAA` record **first**, then add it under Workers & Pages → `bms-website` →
Custom domains. Pages routes by `Host` header, so a bare CNAME to
`bms-website-gjc.pages.dev` without registering the custom domain will not serve
this project.

### Resolved: `www` was serving a forgotten IONOS WordPress site

Until 2026-10-06 the `www` A/AAAA records pointed at `217.160.0.37`, an IONOS
WordPress box, while the apex pointed at Pages. Two different public websites
were live on the brand domain, and the WordPress one had `/wp-json/` exposed and
sat entirely outside this deployment pipeline. `www` is now a Pages custom domain
and the IONOS WordPress package has been cancelled.

The lesson worth keeping: the apex and `www` were configured independently, so
**check both hostnames after any deployment change**. Verifying only the apex
would have missed this completely.

## Known issue: cache purge does not work on the apex

As of 2026-10-06, seven apex URLs still serve the *previous* Hugo deployment and
cannot be cleared:

```
/contact/  /individuals/  /individuals/protection/  /employers/
/wellness/  /affordability-calculator/  /cookie-policy/
```

Treat this as a **pre-launch blocker**. It is harmless now (those responses carry
`x-robots-tag: noindex`, and `/api/*` is gone so no form can submit), but at
launch you will need a bad page gone in minutes, and right now that is not
possible.

What was ruled out, so nobody repeats it:

- Origin is correct — every URL variant returns the right 404
- Always Online: off. Cache Reserve: off. No Cache Rules, no Page Rules
- DNS is correct (apex CNAME → Pages, proxied)
- **Purge Everything, single-URL Custom Purge, and Development Mode all had zero
  effect** — the `age` header kept climbing in step with real time through all of
  them, when a successful purge resets it to 0

### The diagnostic that actually isolates the problem

Append a unique query string. Cache keys include the full URL, so this forces a
miss and reaches the origin:

```bash
curl -s -o /dev/null -w "%{http_code}\n" "https://bmortgageservices.co.uk/contact/?nonce=$RANDOM"   # 404 — origin is fine
curl -s -o /dev/null -w "%{http_code}\n" "https://bmortgageservices.co.uk/contact/"                 # 200 — stale cached copy
```

If those two disagree, the origin is healthy and the problem is purely an edge
cache entry. `/contact` (no slash), `/contact//` and `/Contact/` all correctly
404 too — only the exact cached key is affected.

Corroborating evidence: `www`, added fresh with no cache history, returns 404 for
all seven paths while the apex does not. Same deployment, same origin — so this
is per-hostname cached objects, not a build or routing fault.

Escalate to Cloudflare support with the above if it recurs. Removing and
re-adding the apex custom domain in the Pages project may reset the edge state,
at the cost of brief downtime. Objects carry `s-maxage=604800`, so untouched they
expire within 7 days.

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

### Gotcha: no `404.html` means every unknown URL returns HTTP 200

Cloudflare Pages has single-page-app fallback behaviour: if the build output
contains no `404.html`, it serves `index.html` with status **200** for any path
that doesn't match a file. Removing a page therefore does *not* make its URL
return 404 — it silently becomes a soft 404.

That matters because search engines will not deindex a URL that returns 200.
After the content pages were deleted, `/contact/`, `/individuals/` and even
`/zzz-does-not-exist/` all returned 200 serving the holding page, so the old
URLs would have stayed in Google's index indefinitely. `layouts/404.html` exists
on `main` to force real 404s. Keep a `404.html` in the build on every branch.

Verify with a path that never existed:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://bmortgageservices.co.uk/zzz-test/   # want 404
```

### Gotcha: "Purge Everything" does not always clear non-homepage HTML

Pages other than the homepage are served with `cache-control: public,
s-maxage=604800` (7 days), while the homepage sends `max-age=0,
must-revalidate`. The result is that a deploy updates the homepage immediately
while old inner pages keep being served from the edge for up to a week.

Check the `age` response header to tell whether a purge actually landed — it
resets to near 0 on a successful purge and keeps climbing if the object was
missed. Confirm the purge was run on the **`bmortgageservices.co.uk` zone**
(Caching → Configuration → Purge Everything), not inside the Pages project,
which has no purge control of its own.

```bash
curl -sI https://bmortgageservices.co.uk/contact/ | grep -i age
```

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

- `SUPABASE_URL` — Supabase project URL. **No trailing slash.**
- `SUPABASE_ANON_KEY` — Public anon key (RLS enforced). Not the service_role key.
- `SUPABASE_SERVICE_ROLE_KEY` — Optional. Without it `getAdminClient()` silently
  falls back to the anon client, so storage and PDF writes fail on RLS rather
  than erroring clearly.
- `SENDGRID_API_KEY` — Email delivery (documented, not yet read by any function)
- `REPORT_BASE_URL` — `http://localhost:8788/wellness/report/` locally,
  the deployment's own origin otherwise

### Cloudflare keeps Preview and Production variables separate

This is the single most likely cause of a 500 from `/api/*`, and it has bitten
this project once already. Setting variables on Production does **not** set them
on Preview, so a preview deployment gets `undefined`, `createClient()` throws,
and `functions/api/wellness-calculate.js` converts it into a generic
`{"error":"Internal server error"}` that says nothing about the real cause.

Set both sets under **Workers & Pages → bms-website → Settings → Environment
variables**, then **redeploy** — Cloudflare only picks up variable changes on a
fresh build.

### Local development

`npm run dev` is `wrangler pages dev public`, which reads **`.dev.vars`** — it
does *not* read `.env`. The repo has a `.env` that wrangler ignores entirely;
`.dev.vars` is the file that matters. Both are gitignored.

Run `npm run build` first, or there is no `public/` for wrangler to serve.

**Known limitation:** `wrangler pages dev` refuses to start while `wrangler.toml`
declares the `[browser]` binding — "Browser Rendering is not supported locally".
That binding is only used by the PDF generator. To run the rest of the functions
locally you need `wrangler pages dev --remote`, or to temporarily comment the
binding out.

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
