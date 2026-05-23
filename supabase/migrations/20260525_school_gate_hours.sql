-- Ensure school gate-hour columns exist (settings page persistence)
ALTER TABLE schools ADD COLUMN IF NOT EXISTS gate_open_time TIME DEFAULT '06:30';
ALTER TABLE schools ADD COLUMN IF NOT EXISTS school_start_time TIME DEFAULT '08:00';
ALTER TABLE schools ADD COLUMN IF NOT EXISTS late_threshold TIME DEFAULT '08:15';
ALTER TABLE schools ADD COLUMN IF NOT EXISTS gate_close_time TIME DEFAULT '09:00';
ALTER TABLE schools ADD COLUMN IF NOT EXISTS dismissal_start_time TIME DEFAULT '14:00';
ALTER TABLE schools ADD COLUMN IF NOT EXISTS dismissal_end_time TIME DEFAULT '16:00';
ALTER TABLE schools ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Africa/Lagos';

SELECT 'Migration 20260525_school_gate_hours applied.' AS status;
