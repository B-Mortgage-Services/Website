# Wellness Check Backend Setup Guide

This guide walks you through setting up the serverless backend for the B Mortgage Services wellness check.

## Prerequisites

- Node.js 24.x or later
- npm or yarn
- A Supabase account (free tier)
- A SendGrid account (free tier)
- A Netlify account (free tier)

## Phase 1: Local Development Setup

### Step 1: Install Dependencies

```bash
npm install
```

This will install all required packages including:
- @netlify/functions - Netlify Functions runtime
- @supabase/supabase-js - Supabase client
- @sendgrid/mail - SendGrid email client
- puppeteer-core, @sparticuz/chromium - PDF generation (Phase 3)
- chart.js, canvas, handlebars - Visualization and templating (Phase 3)

### Step 2: Set Up Supabase

1. **Create a Supabase Project:**
   - Go to https://supabase.com
   - Click "New Project"
   - Choose organization and enter project details
   - Wait for project to be provisioned (~2 minutes)

2. **Get Your Supabase Credentials:**
   - In your project dashboard, go to Settings > API
   - Copy your `Project URL` (looks like https://xxxxx.supabase.co)
   - Copy your `anon/public` key (starts with `eyJ...`)
   - **DO NOT** use the `service_role` key (it bypasses RLS security)

3. **Run Database Migrations:**
   - In Supabase dashboard, go to SQL Editor
   - Click "New Query"
   - Copy the contents of `supabase/migrations/001_create_wellness_tables.sql`
   - Paste and click "Run"
   - Verify tables created: Database > Tables should show `wellness_reports` and `wellness_analytics`

4. **Create Storage Bucket for PDFs:**
   - Go to Storage in Supabase dashboard
   - Click "Create new bucket"
   - Name: `wellness-pdfs`
   - Public bucket: ✅ **YES** (PDFs need to be downloadable)
   - File size limit: 2048 KB (2MB)
   - Allowed MIME types: `application/pdf`
   - Click "Create bucket"

5. **Add Storage Bucket RLS Policies:**
   - Go to SQL Editor in Supabase dashboard
   - Click "New Query"
   - Copy the contents of `supabase/migrations/002_create_storage_policies.sql`
   - Paste and click "Run"
   - This allows the serverless functions to upload and read PDFs from the bucket

6. **Set Up Cron Job for Automatic Cleanup (Optional):**
   - Go to Database > Cron Jobs (requires pg_cron extension)
   - Click "Create cron job"
   - Schedule: `0 0 * * *` (daily at midnight UTC)
   - SQL: `SELECT delete_expired_wellness_reports();`
   - Click "Create"

### Step 3: Set Up SendGrid

1. **Create SendGrid Account:**
   - Go to https://sendgrid.com
   - Sign up for free tier (100 emails/day)
   - Verify your account via email

2. **Create API Key:**
   - Go to Settings > API Keys
   - Click "Create API Key"
   - Name: "B Mortgage Services - Wellness Check"
   - Permissions: "Full Access" (or "Mail Send" only)
   - Click "Create & View"
   - **COPY THE KEY IMMEDIATELY** (you won't see it again)

3. **Verify Sender Identity:**
   - Go to Settings > Sender Authentication
   - Click "Verify a Single Sender"
   - Enter: info@bmortgagesolutions.co.uk
   - Fill in contact details
   - Click "Create"
   - Check inbox for verification email

4. **Domain Authentication (Recommended):**
   - Go to Settings > Sender Authentication > Authenticate Your Domain
   - Enter: bmortgageservices.co.uk
   - Add DNS records provided by SendGrid to your domain registrar
   - Wait for verification (can take up to 48 hours)

### Step 4: Configure Environment Variables

1. **Create `.env` file:**
   ```bash
   cp .env.example .env
   ```

2. **Edit `.env` with your credentials:**
   ```env
   SUPABASE_URL=https://xxxxx.supabase.co
   SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   SENDGRID_API_KEY=SG.xxxxx...
   REPORT_BASE_URL=http://localhost:8888/wellness/report/
   ```

   **Important:**
   - Never commit `.env` to git (already in .gitignore)
   - Use the `anon` key, not the `service_role` key
   - For local development, use `localhost` URL

### Step 5: Test Locally with Netlify Dev

1. **Install Netlify CLI globally:**
   ```bash
   npm install -g netlify-cli
   ```

2. **Start local development server:**
   ```bash
   netlify dev
   ```

   This will:
   - Start Hugo on port 1313
   - Start Netlify Functions on port 8888
   - Proxy everything through localhost:8888

3. **Verify the site loads:**
   - Open http://localhost:8888
   - Navigate to /wellness/
   - The current form should display

4. **Test the API endpoint:**
   ```bash
   curl -X POST http://localhost:8888/.netlify/functions/wellness-calculate \
     -H "Content-Type: application/json" \
     -d '{
       "employment": "paye-12",
       "credit": "clean",
       "propertyValue": 250000,
       "deposit": 50000,
       "surplus": "surplus",
       "emergency": "6plus",
       "life": "full",
       "income": "full",
       "critical": "full"
     }'
   ```

   Expected response:
   ```json
   {
     "success": true,
     "reportId": "a1b2c3d4",
     "score": 100,
     "category": "Mortgage-Ready & Financially Resilient",
     ...
   }
   ```

5. **Verify database insertion:**
   - Go to Supabase dashboard > Table Editor
   - Open `wellness_reports` table
   - You should see your test report
   - Check `expires_at` is 30 days in the future

## Phase 2: Netlify Deployment

### Step 1: Connect GitHub Repository to Netlify

1. **Log in to Netlify:**
   - Go to https://netlify.com
   - Sign up or log in with GitHub

2. **Create New Site:**
   - Click "Add new site" > "Import an existing project"
   - Choose "GitHub"
   - Authorize Netlify to access your repos
   - Select `B-Mortgage-Services/Website` repository

3. **Configure Build Settings:**
   - **Base directory:** (leave empty)
   - **Build command:** `hugo --gc --minify`
   - **Publish directory:** `public`
   - **Functions directory:** `netlify/functions`
   - Click "Show advanced" > "Add environment variables"

4. **Add Environment Variables:**
   Add each of these in Netlify:
   - `SUPABASE_URL` → (your Supabase project URL)
   - `SUPABASE_ANON_KEY` → (your Supabase anon key)
   - `SENDGRID_API_KEY` → (your SendGrid API key)
   - `REPORT_BASE_URL` → `https://bmortgageservices.co.uk/wellness/report/`
   - `HUGO_VERSION` → `0.154.4`
   - `NODE_VERSION` → `24.12.0`

5. **Deploy:**
   - Click "Deploy site"
   - Wait for build to complete (~2-3 minutes)
   - Note your temporary URL (e.g., `https://random-name-12345.netlify.app`)

### Step 2: Test on Netlify Preview

1. **Visit your temporary URL:**
   - Navigate to `/wellness/`
   - Form should display correctly

2. **Test the wellness calculation:**
   - Fill out the 4-step form with test data
   - Click "Get My Score"
   - **Expected:** "Internal Server Error" or similar (we haven't updated frontend yet)

3. **Check Function Logs:**
   - In Netlify dashboard: Functions > wellness-calculate
   - Click on recent invocation
   - Check logs for errors

4. **Verify Database:**
   - Go to Supabase > Table Editor > wellness_reports
   - Should see test submission (if function ran successfully)

### Step 3: Update DNS (When Ready for Production)

1. **In Netlify:**
   - Go to Site settings > Domain management
   - Click "Add custom domain"
   - Enter: `bmortgageservices.co.uk`
   - Netlify will provide DNS instructions

2. **Update DNS Records:**
   - Go to your domain registrar (where bmortgageservices.co.uk is registered)
   - Update CNAME record:
     - Name: `@` or `bmortgageservices.co.uk`
     - Value: `random-name-12345.netlify.app`
   - TTL: 3600 or Auto
   - Save and wait for propagation (5-60 minutes)

3. **Enable HTTPS:**
   - Netlify automatically provisions SSL certificate
   - Wait for "Certificate active" status
   - Test: https://bmortgageservices.co.uk

## Troubleshooting

### Function Returns 500 Error

**Check:**
- Are environment variables set correctly in Netlify?
- Is Supabase project active (not paused)?
- Check function logs in Netlify dashboard

**Common fixes:**
- Verify `SUPABASE_URL` doesn't have trailing slash
- Verify `SUPABASE_ANON_KEY` is the anon key, not service_role
- Check Supabase project is not paused (free tier auto-pauses after inactivity)

### Database Insert Fails

**Check:**
- Are RLS policies correctly applied?
- Is the anon key being used (not service_role)?

**Fix:**
- Re-run `001_create_wellness_tables.sql` migration
- Verify policies in Supabase > Authentication > Policies

### CORS Errors

**Check:**
- Is `Access-Control-Allow-Origin` set correctly in function?
- Are you making cross-origin requests?

**Fix:**
- Update `wellness-calculate.js` line 18 to restrict origin:
  ```javascript
  'Access-Control-Allow-Origin': 'https://bmortgageservices.co.uk'
  ```

### Netlify Build Fails

**Check:**
- Is `HUGO_VERSION` set to `0.154.4`?
- Is `NODE_VERSION` set to `24.12.0`?
- Are there any syntax errors in functions?

**Fix:**
- Check build logs in Netlify dashboard
- Verify `netlify.toml` configuration
- Test locally with `netlify build`

## Next Steps

Once Phase 1 is working:

- **Phase 2:** Update frontend to call the new API
  - Modify `themes/bms-theme/layouts/wellness/list.html`
  - Create `themes/bms-theme/static/js/wellness-client.js`
  - Add Chart.js visualizations
  - Implement shareable report links

- **Phase 3:** Implement PDF generation
  - Create `templates/pdf/wellness-report.hbs`
  - Implement `netlify/functions/wellness-pdf.js`
  - Upload PDFs to Supabase Storage
  - Add email delivery

## Security Checklist

Before going to production:

- [ ] Update CORS origin to specific domain (not `*`)
- [ ] Verify RLS policies are enabled on all tables
- [ ] Use `anon` key, never `service_role` key in client code
- [ ] Enable Netlify's built-in rate limiting
- [ ] Set up Supabase cron job for auto-deletion
- [ ] Configure SendGrid domain authentication
- [ ] Test with invalid/malicious input data
- [ ] Verify HTTPS is enforced
- [ ] Review Supabase Storage bucket permissions

## Support

For issues or questions:
- Check Netlify function logs
- Check Supabase logs (Logs > Dashboard)
- Review this documentation
- Consult the plan at `C:\Users\phouse\.claude\plans\lovely-napping-bachman.md`
