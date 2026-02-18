-- Wellness Reports Table
-- Stores wellness check results with 30-day expiration

CREATE TABLE IF NOT EXISTS wellness_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id TEXT UNIQUE NOT NULL,
  data JSONB NOT NULL,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days'
);

-- Create indexes for performance
CREATE INDEX idx_report_id ON wellness_reports(report_id);
CREATE INDEX idx_expires_at ON wellness_reports(expires_at);
CREATE INDEX idx_created_at ON wellness_reports(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE wellness_reports ENABLE ROW LEVEL SECURITY;

-- Create policy to allow public read access to non-expired reports by report_id
CREATE POLICY "Allow public read access to non-expired reports"
  ON wellness_reports
  FOR SELECT
  USING (expires_at > NOW());

-- Create policy to allow insert (for anonymous function calls)
CREATE POLICY "Allow public insert"
  ON wellness_reports
  FOR INSERT
  WITH CHECK (true);

-- Wellness Analytics Table
-- Stores anonymized analytics data

CREATE TABLE IF NOT EXISTS wellness_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  score INTEGER,
  category TEXT,
  has_email BOOLEAN,
  employment_type TEXT,
  ltv_bracket TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on created_at for analytics queries
CREATE INDEX idx_analytics_created_at ON wellness_analytics(created_at DESC);

-- Enable RLS on analytics table
ALTER TABLE wellness_analytics ENABLE ROW LEVEL SECURITY;

-- Create policy to allow insert
CREATE POLICY "Allow public insert on analytics"
  ON wellness_analytics
  FOR INSERT
  WITH CHECK (true);

-- Create policy to allow read (for admin dashboard in future)
CREATE POLICY "Allow read on analytics"
  ON wellness_analytics
  FOR SELECT
  USING (true);

-- Function to automatically delete expired reports (called by cron)
CREATE OR REPLACE FUNCTION delete_expired_wellness_reports()
RETURNS void AS $$
BEGIN
  DELETE FROM wellness_reports WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: To enable automatic deletion, set up a cron job in Supabase Dashboard:
-- 1. Go to Database > Cron Jobs
-- 2. Create new job with schedule: 0 0 * * * (daily at midnight)
-- 3. SQL: SELECT delete_expired_wellness_reports();

COMMENT ON TABLE wellness_reports IS 'Stores wellness check reports with 30-day expiration';
COMMENT ON TABLE wellness_analytics IS 'Stores anonymized analytics data for wellness checks';
COMMENT ON FUNCTION delete_expired_wellness_reports() IS 'Automatically deletes expired wellness reports (run via cron)';
