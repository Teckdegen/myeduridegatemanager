-- Investor pilot: non-school days, official staff attendance source

-- Days excluded from absent counts (holidays, events, closures)
CREATE TABLE IF NOT EXISTS school_non_school_days (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  calendar_date DATE NOT NULL,
  day_type TEXT NOT NULL CHECK (day_type IN ('public_holiday', 'school_event', 'closure')),
  title TEXT NOT NULL,
  description TEXT,
  notify_parents BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(school_id, calendar_date)
);

CREATE INDEX IF NOT EXISTS idx_school_non_school_days_school_date
  ON school_non_school_days(school_id, calendar_date);

ALTER TABLE school_non_school_days ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff see non school days" ON school_non_school_days;
CREATE POLICY "Staff see non school days" ON school_non_school_days
  FOR SELECT USING (
    school_id IN (SELECT school_id FROM user_school_roles WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins manage non school days" ON school_non_school_days;
CREATE POLICY "Admins manage non school days" ON school_non_school_days
  FOR ALL USING (
    school_id IN (
      SELECT school_id FROM user_school_roles
      WHERE user_id = auth.uid() AND role IN ('school_admin', 'super_admin')
    )
  );

-- Staff reports: admin-marked only (gate sign-in/out kept as record_source gate)
ALTER TABLE staff_attendance ADD COLUMN IF NOT EXISTS record_source TEXT DEFAULT 'gate';
ALTER TABLE staff_attendance DROP CONSTRAINT IF EXISTS staff_attendance_record_source_check;
ALTER TABLE staff_attendance ADD CONSTRAINT staff_attendance_record_source_check
  CHECK (record_source IN ('gate', 'admin'));

UPDATE staff_attendance SET record_source = 'gate' WHERE record_source IS NULL;

SELECT 'Migration 20260526_investor_features applied.' AS status;
