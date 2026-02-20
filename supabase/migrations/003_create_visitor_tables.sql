-- Visitor Activity Table
-- Stores page views, tool interactions, and CTA clicks
-- Browser writes via Supabase anon key with RLS (INSERT only for anon)

CREATE TABLE IF NOT EXISTS visitor_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  page_url TEXT,
  page_title TEXT,
  referrer TEXT,
  tool_type TEXT,
  cta_name TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_va_visitor_id ON visitor_activity(visitor_id);
CREATE INDEX idx_va_session_id ON visitor_activity(session_id);
CREATE INDEX idx_va_event_type ON visitor_activity(event_type);
CREATE INDEX idx_va_created_at ON visitor_activity(created_at DESC);
CREATE INDEX idx_va_utm_campaign ON visitor_activity(utm_campaign) WHERE utm_campaign IS NOT NULL;

ALTER TABLE visitor_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public insert on visitor_activity"
  ON visitor_activity
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow service role select on visitor_activity"
  ON visitor_activity
  FOR SELECT
  USING (true);


-- Visitor Tool Results Table
-- Stores full tool output data linked to visitor IDs

CREATE TABLE IF NOT EXISTS visitor_tool_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  tool_type TEXT NOT NULL,
  result_data JSONB NOT NULL,
  result_summary TEXT,
  completed BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vtr_visitor_id ON visitor_tool_results(visitor_id);
CREATE INDEX idx_vtr_tool_type ON visitor_tool_results(tool_type);
CREATE INDEX idx_vtr_created_at ON visitor_tool_results(created_at DESC);

ALTER TABLE visitor_tool_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public insert on visitor_tool_results"
  ON visitor_tool_results
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow service role select on visitor_tool_results"
  ON visitor_tool_results
  FOR SELECT
  USING (true);


-- Contact Enquiries Table
-- Contains PII (name, email, phone) — separate from anonymous activity data

CREATE TABLE IF NOT EXISTS contact_enquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  enquiry_type TEXT,
  message TEXT,
  visitor_id TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ce_created_at ON contact_enquiries(created_at DESC);
CREATE INDEX idx_ce_visitor_id ON contact_enquiries(visitor_id) WHERE visitor_id IS NOT NULL;

ALTER TABLE contact_enquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public insert on contact_enquiries"
  ON contact_enquiries
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow service role select on contact_enquiries"
  ON contact_enquiries
  FOR SELECT
  USING (true);


-- Cleanup function for old tracking data (12-month retention)
CREATE OR REPLACE FUNCTION delete_old_visitor_activity()
RETURNS void AS $$
BEGIN
  DELETE FROM visitor_activity WHERE created_at < NOW() - INTERVAL '12 months';
  DELETE FROM visitor_tool_results WHERE created_at < NOW() - INTERVAL '12 months';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: To enable automatic cleanup, set up a cron job in Supabase Dashboard:
-- 1. Go to Database > Cron Jobs
-- 2. Create new job with schedule: 0 2 * * * (daily at 2am)
-- 3. SQL: SELECT delete_old_visitor_activity();

COMMENT ON TABLE visitor_activity IS 'Visitor page views, tool interactions, and CTA clicks (12-month retention)';
COMMENT ON TABLE visitor_tool_results IS 'Full tool output data linked to visitor IDs';
COMMENT ON TABLE contact_enquiries IS 'Contact form submissions with optional visitor tracking linkage';
COMMENT ON FUNCTION delete_old_visitor_activity() IS 'Deletes visitor activity older than 12 months (run via cron)';
