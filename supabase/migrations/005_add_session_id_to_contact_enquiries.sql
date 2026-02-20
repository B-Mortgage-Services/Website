-- Add session_id column to contact_enquiries table
-- Links contact form submissions to session-scoped visitor tracking
-- so CRM can look up all visitor_activity rows for the same session,
-- even when the visitor declined cookies (no persistent bms_vid).

ALTER TABLE contact_enquiries ADD COLUMN IF NOT EXISTS session_id TEXT;

CREATE INDEX IF NOT EXISTS idx_ce_session_id ON contact_enquiries(session_id) WHERE session_id IS NOT NULL;

COMMENT ON COLUMN contact_enquiries.session_id IS 'Session ID from sessionStorage (bms_sid) — always available, links to visitor_activity.session_id';
