-- ============================================
-- MyEduRide — Incremental migration (pilot features)
-- Run once in Supabase SQL Editor on an EXISTING database.
-- Safe to re-run: uses IF NOT EXISTS / DROP IF EXISTS where possible.
-- Date: 2026-05-22
-- ============================================

-- ---------- attendance_records: teacher scan + late minutes ----------
ALTER TABLE attendance_records
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'gate';

ALTER TABLE attendance_records
  ADD COLUMN IF NOT EXISTS minutes_late INT;

-- Default source for existing rows
UPDATE attendance_records SET source = 'gate' WHERE source IS NULL;

-- Allow teacher_manual verification + gate/teacher source
ALTER TABLE attendance_records DROP CONSTRAINT IF EXISTS attendance_records_verification_method_check;
ALTER TABLE attendance_records ADD CONSTRAINT attendance_records_verification_method_check
  CHECK (verification_method IN ('face_recognition', 'id_card_scan', 'manual', 'teacher_manual'));

ALTER TABLE attendance_records DROP CONSTRAINT IF EXISTS attendance_records_source_check;
ALTER TABLE attendance_records ADD CONSTRAINT attendance_records_source_check
  CHECK (source IN ('gate', 'teacher'));

-- Teachers may insert classroom attendance (if policy missing on older DBs)
DROP POLICY IF EXISTS "Teachers create attendance" ON attendance_records;
CREATE POLICY "Teachers create attendance" ON attendance_records
  FOR INSERT WITH CHECK (
    school_id IN (
      SELECT school_id FROM user_school_roles
      WHERE user_id = auth.uid() AND role IN ('gate_officer', 'school_admin', 'teacher')
    )
  );

-- ---------- dismissal_requests: one per student per day ----------
ALTER TABLE dismissal_requests
  ADD COLUMN IF NOT EXISTS dismissal_date DATE;

ALTER TABLE dismissal_requests
  ADD COLUMN IF NOT EXISTS extra_lesson_until TIME;

ALTER TABLE dismissal_requests
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

ALTER TABLE dismissal_requests
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Backfill dismissal_date from created_at for existing rows
UPDATE dismissal_requests
SET dismissal_date = (created_at AT TIME ZONE 'Africa/Lagos')::date
WHERE dismissal_date IS NULL;

ALTER TABLE dismissal_requests
  ALTER COLUMN dismissal_date SET DEFAULT CURRENT_DATE;

ALTER TABLE dismissal_requests
  ALTER COLUMN dismissal_date SET NOT NULL;

-- Remove duplicate (student, day) rows before unique index (keeps newest)
DELETE FROM dismissal_requests a
USING dismissal_requests b
WHERE a.student_id = b.student_id
  AND a.dismissal_date = b.dismissal_date
  AND a.created_at < b.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS idx_dismissal_student_date_unique
  ON dismissal_requests (student_id, dismissal_date);

-- ---------- extra_lessons ----------
CREATE TABLE IF NOT EXISTS extra_lessons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  teacher_user_id UUID NOT NULL REFERENCES user_profiles(id),
  lesson_end_time TIME,
  date DATE DEFAULT CURRENT_DATE,
  is_released BOOLEAN DEFAULT FALSE,
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, date)
);

-- ---------- pickup_persons ----------
CREATE TABLE IF NOT EXISTS pickup_persons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  relationship TEXT NOT NULL,
  phone TEXT,
  photo_url TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pickup_person_students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pickup_person_id UUID NOT NULL REFERENCES pickup_persons(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(pickup_person_id, student_id)
);

-- ---------- pickup_requests (parent Notify School) ----------
CREATE TABLE IF NOT EXISTS pickup_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  parent_user_id UUID NOT NULL REFERENCES user_profiles(id),
  pickup_person_name TEXT NOT NULL,
  pickup_person_phone TEXT,
  message TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'acknowledged', 'completed')),
  acknowledged_by UUID REFERENCES user_profiles(id),
  acknowledged_at TIMESTAMPTZ,
  request_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------- notifications: pickup_request type ----------
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('arrival', 'departure', 'late', 'dismissal', 'system', 'pickup_request'));

-- ---------- indexes ----------
CREATE INDEX IF NOT EXISTS idx_dismissal_school_status
  ON dismissal_requests(school_id, status, dismissal_date);

CREATE INDEX IF NOT EXISTS idx_extra_lessons_student_date
  ON extra_lessons(student_id, date);

CREATE INDEX IF NOT EXISTS idx_extra_lessons_school
  ON extra_lessons(school_id, date);

CREATE INDEX IF NOT EXISTS idx_pickup_persons_school
  ON pickup_persons(school_id);

CREATE INDEX IF NOT EXISTS idx_pickup_person_students_student
  ON pickup_person_students(student_id);

CREATE INDEX IF NOT EXISTS idx_pickup_person_students_person
  ON pickup_person_students(pickup_person_id);

CREATE INDEX IF NOT EXISTS idx_pickup_requests_school_date
  ON pickup_requests(school_id, request_date);

CREATE INDEX IF NOT EXISTS idx_pickup_requests_student
  ON pickup_requests(student_id);

-- ---------- RLS ----------
ALTER TABLE extra_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE pickup_persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE pickup_person_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE pickup_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff see extra lessons" ON extra_lessons;
CREATE POLICY "Staff see extra lessons" ON extra_lessons
  FOR ALL USING (
    school_id IN (SELECT school_id FROM user_school_roles WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Staff see pickup persons" ON pickup_persons;
CREATE POLICY "Staff see pickup persons" ON pickup_persons
  FOR SELECT USING (
    school_id IN (SELECT school_id FROM user_school_roles WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins and parents manage pickup persons" ON pickup_persons;
CREATE POLICY "Admins and parents manage pickup persons" ON pickup_persons
  FOR ALL USING (
    school_id IN (
      SELECT school_id FROM user_school_roles
      WHERE user_id = auth.uid() AND role IN ('school_admin', 'super_admin', 'parent')
    )
  );

DROP POLICY IF EXISTS "Staff see pickup person links" ON pickup_person_students;
CREATE POLICY "Staff see pickup person links" ON pickup_person_students
  FOR SELECT USING (
    school_id IN (SELECT school_id FROM user_school_roles WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins manage pickup person links" ON pickup_person_students;
CREATE POLICY "Admins manage pickup person links" ON pickup_person_students
  FOR ALL USING (
    school_id IN (
      SELECT school_id FROM user_school_roles
      WHERE user_id = auth.uid() AND role IN ('school_admin', 'super_admin', 'parent')
    )
  );

DROP POLICY IF EXISTS "Staff see pickup requests" ON pickup_requests;
CREATE POLICY "Staff see pickup requests" ON pickup_requests
  FOR SELECT USING (
    school_id IN (SELECT school_id FROM user_school_roles WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Parents create pickup requests" ON pickup_requests;
CREATE POLICY "Parents create pickup requests" ON pickup_requests
  FOR INSERT WITH CHECK (parent_user_id = auth.uid());

DROP POLICY IF EXISTS "Staff update pickup requests" ON pickup_requests;
CREATE POLICY "Staff update pickup requests" ON pickup_requests
  FOR UPDATE USING (
    school_id IN (
      SELECT school_id FROM user_school_roles
      WHERE user_id = auth.uid() AND role IN ('school_admin', 'super_admin', 'gate_officer')
    )
  );

-- ---------- realtime (skip if already subscribed) ----------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'extra_lessons'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE extra_lessons;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'pickup_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE pickup_requests;
  END IF;
END $$;

-- ---------- platform school (super_admin roles — not a real school) ----------
INSERT INTO schools (id, name, setup_completed, setup_step)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'MyEduRide Platform',
  TRUE,
  'complete'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  setup_completed = TRUE,
  setup_step = 'complete';

-- ---------- comments ----------
COMMENT ON COLUMN attendance_records.minutes_late IS 'Minutes late for late arrivals (NULL if on_time or absent)';
COMMENT ON COLUMN dismissal_requests.dismissal_date IS 'Calendar date of dismissal — prevents double-tap per student per day';
COMMENT ON TABLE extra_lessons IS 'Students staying for extra lesson — not ready for pickup until teacher releases them';
COMMENT ON TABLE pickup_persons IS 'Authorised persons who can collect a student — with photo for gate verification';
COMMENT ON TABLE pickup_requests IS 'Parent message: who will pick up their child today';

-- Backfill dismissal_date for rows created today (UTC/Lagos mismatch fix)
UPDATE dismissal_requests
SET dismissal_date = (created_at AT TIME ZONE 'Africa/Lagos')::date
WHERE dismissal_date IS NULL OR dismissal_date <> (created_at AT TIME ZONE 'Africa/Lagos')::date;

-- Done
SELECT 'Migration 20260522_pilot_features applied successfully.' AS status;
