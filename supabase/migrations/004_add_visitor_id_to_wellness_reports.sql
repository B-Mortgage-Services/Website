-- Add visitor_id column to wellness_reports table
-- Links wellness reports to the anonymous visitor tracking system
-- so that when a visitor submits a contact enquiry, their wellness report
-- can be found directly via visitor_id without needing the bridge table.

ALTER TABLE wellness_reports ADD COLUMN IF NOT EXISTS visitor_id TEXT;

CREATE INDEX IF NOT EXISTS idx_wr_visitor_id ON wellness_reports(visitor_id) WHERE visitor_id IS NOT NULL;

COMMENT ON COLUMN wellness_reports.visitor_id IS 'Anonymous visitor ID from bms_vid cookie — links to visitor_activity and contact_enquiries';
