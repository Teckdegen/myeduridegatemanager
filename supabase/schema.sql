-- ============================================
-- MyEduRide Gate Manager - Complete Database Schema
-- Single file: run entire script in Supabase SQL Editor (fresh project)
-- Last updated: includes all features (ready-for-pickup, extra lessons,
--   pickup persons, pickup requests, attendance reports, parent history,
--   teacher scan, class CRUD, timestamp fixes)
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============ SCHOOLS ============
CREATE TABLE schools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  address TEXT,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#1B4D3E',
  secondary_color TEXT DEFAULT '#D4A017',
  gate_open_time TIME DEFAULT '06:30',
  school_start_time TIME DEFAULT '08:00',
  late_threshold TIME DEFAULT '08:15',
  gate_close_time TIME DEFAULT '09:00',
  dismissal_start_time TIME DEFAULT '14:00',
  dismissal_end_time TIME DEFAULT '16:00',
  timezone TEXT DEFAULT 'Africa/Lagos',
  setup_completed BOOLEAN DEFAULT FALSE,
  setup_step TEXT DEFAULT 'classes' CHECK (setup_step IN ('classes', 'fields', 'teachers', 'students', 'complete')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============ SCHOOL CLASSES ============
CREATE TABLE school_classes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,           -- e.g. "JSS 1A", "Year 3 Blue", "Grade 7"
  grade TEXT NOT NULL,          -- e.g. "Grade 7", "Year 3"
  section TEXT,                 -- e.g. "A", "Blue" (optional)
  assigned_teacher_id UUID,     -- FK to teacher_profiles (set after teachers exist)
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(school_id, name)
);

-- ============ SCHOOL CUSTOM FIELDS ============
CREATE TABLE school_custom_fields (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('student', 'teacher')),
  field_name TEXT NOT NULL,
  field_label TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN ('text', 'number', 'date', 'select', 'email', 'phone', 'textarea')),
  options JSONB,
  is_required BOOLEAN DEFAULT FALSE,
  placeholder TEXT,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(school_id, entity_type, field_name)
);

-- ============ USER PROFILES ============
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============ USER SCHOOL ROLES ============
CREATE TABLE user_school_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'school_admin', 'teacher', 'gate_officer', 'parent')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, school_id, role)
);

-- ============ TEACHER PROFILES ============
CREATE TABLE teacher_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  staff_id_number TEXT UNIQUE,
  qr_code_data TEXT UNIQUE,
  photo_url TEXT,
  face_descriptor JSONB,
  custom_fields JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, school_id)
);

-- ============ TEACHER CLASS ASSIGNMENTS ============
CREATE TABLE teacher_class_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_profile_id UUID NOT NULL REFERENCES teacher_profiles(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES school_classes(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(teacher_profile_id, class_id)
);

-- ============ STUDENTS ============
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES school_classes(id) ON DELETE RESTRICT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  student_id_number TEXT UNIQUE NOT NULL,
  photo_url TEXT,
  face_descriptor JSONB,
  qr_code_data TEXT UNIQUE NOT NULL,
  custom_fields JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============ STUDENT-PARENT LINKS ============
CREATE TABLE student_parents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  parent_user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  relationship TEXT DEFAULT 'parent',
  is_primary BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, parent_user_id)
);

-- ============ GATE SESSIONS ============
CREATE TABLE gate_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  gate_officer_user_id UUID NOT NULL REFERENCES user_profiles(id),
  mode TEXT NOT NULL CHECK (mode IN ('arrival', 'dismissal')),
  status TEXT NOT NULL CHECK (status IN ('active', 'closed')) DEFAULT 'active',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

-- ============ ATTENDANCE RECORDS (Students) ============
CREATE TABLE attendance_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  gate_session_id UUID REFERENCES gate_sessions(id),
  type TEXT NOT NULL CHECK (type IN ('arrival', 'departure')),
  verification_method TEXT NOT NULL CHECK (verification_method IN ('face_recognition', 'id_card_scan', 'manual', 'teacher_manual')),
  verified_by_user_id UUID REFERENCES user_profiles(id),
  status TEXT CHECK (status IN ('on_time', 'late', 'absent')) DEFAULT 'on_time',
  source TEXT NOT NULL DEFAULT 'gate' CHECK (source IN ('gate', 'teacher')),
  -- minutes_late: positive integer when status='late', NULL otherwise
  minutes_late INT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============ STAFF ATTENDANCE ============
CREATE TABLE staff_attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  gate_session_id UUID REFERENCES gate_sessions(id),
  type TEXT NOT NULL CHECK (type IN ('clock_in', 'clock_out')),
  verification_method TEXT NOT NULL CHECK (verification_method IN ('face_recognition', 'id_card_scan', 'manual')),
  verified_by_user_id UUID REFERENCES user_profiles(id),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============ DISMISSAL REQUESTS ============
-- Teacher marks student "Ready for Pickup" → creates a dismissal_request
-- Gate officer confirms release → status = 'completed'
CREATE TABLE dismissal_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  requested_by_user_id UUID NOT NULL REFERENCES user_profiles(id),
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'completed')) DEFAULT 'pending',
  notes TEXT,
  extra_lesson_until TIME,
  approved_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  -- date of the dismissal (for dedup: one per student per day)
  dismissal_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- prevent teacher from double-tapping: one active request per student per day
  UNIQUE(student_id, dismissal_date)
);

-- ============ EXTRA LESSONS ============
-- Teacher marks student as staying for extra lesson (not ready for pickup yet)
CREATE TABLE extra_lessons (
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

-- ============ PARENT PICKUP NOTICES ============
CREATE TABLE pickup_notices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  parent_user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  pickup_person_name TEXT NOT NULL,
  pickup_person_phone TEXT,
  relationship TEXT DEFAULT 'authorized pickup',
  is_self_pickup BOOLEAN DEFAULT FALSE,
  notes TEXT,
  notice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============ PICKUP PERSONS ============
-- Authorised pickup persons registered per student (with photo for gate verification)
CREATE TABLE pickup_persons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  relationship TEXT NOT NULL,  -- father, mother, driver, nanny, etc.
  phone TEXT,
  photo_url TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============ PICKUP PERSON STUDENT LINKS ============
-- One pickup person can be linked to multiple students (e.g. a driver for siblings)
CREATE TABLE pickup_person_students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pickup_person_id UUID NOT NULL REFERENCES pickup_persons(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(pickup_person_id, student_id)
);

-- ============ PICKUP REQUESTS ============
-- Parent sends a message to school: "Today, [Person] will pick up my child"
CREATE TABLE pickup_requests (
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

-- ============ NOTIFICATIONS ============
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('arrival', 'departure', 'late', 'dismissal', 'system', 'pickup_request')),
  is_read BOOLEAN DEFAULT FALSE,
  email_sent BOOLEAN DEFAULT FALSE,
  push_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============ PUSH SUBSCRIPTIONS ============
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  keys_p256dh TEXT NOT NULL,
  keys_auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

-- ============ OTP CODES ============
CREATE TABLE otp_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============ INDEXES ============
CREATE INDEX idx_school_classes_school ON school_classes(school_id);
CREATE INDEX idx_custom_fields_school ON school_custom_fields(school_id, entity_type);
CREATE INDEX idx_students_school ON students(school_id);
CREATE INDEX idx_students_class ON students(class_id);
CREATE INDEX idx_students_qr ON students(qr_code_data);
CREATE INDEX idx_students_id_number ON students(student_id_number);
CREATE INDEX idx_teacher_profiles_school ON teacher_profiles(school_id);
CREATE INDEX idx_teacher_class_assignments ON teacher_class_assignments(class_id);
CREATE INDEX idx_teacher_class_teacher ON teacher_class_assignments(teacher_profile_id);
CREATE INDEX idx_attendance_student ON attendance_records(student_id);
CREATE INDEX idx_attendance_school_date ON attendance_records(school_id, timestamp);
CREATE INDEX idx_attendance_session ON attendance_records(gate_session_id);
CREATE INDEX idx_attendance_school_type_ts ON attendance_records(school_id, type, timestamp);
CREATE INDEX idx_staff_attendance_user ON staff_attendance(user_id, timestamp);
CREATE INDEX idx_staff_attendance_school ON staff_attendance(school_id, timestamp);
CREATE INDEX idx_dismissal_student ON dismissal_requests(student_id);
CREATE INDEX idx_dismissal_school ON dismissal_requests(school_id, created_at);
CREATE INDEX idx_dismissal_school_status ON dismissal_requests(school_id, status, dismissal_date);
CREATE INDEX idx_extra_lessons_student_date ON extra_lessons(student_id, date);
CREATE INDEX idx_extra_lessons_school ON extra_lessons(school_id, date);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX idx_user_roles ON user_school_roles(user_id);
CREATE INDEX idx_user_roles_school ON user_school_roles(school_id, role);
CREATE INDEX idx_student_parents ON student_parents(parent_user_id);
CREATE INDEX idx_pickup_notices_school_date ON pickup_notices(school_id, notice_date);
CREATE INDEX idx_pickup_notices_student ON pickup_notices(student_id);
CREATE INDEX idx_pickup_persons_school ON pickup_persons(school_id);
CREATE INDEX idx_pickup_person_students_student ON pickup_person_students(student_id);
CREATE INDEX idx_pickup_person_students_person ON pickup_person_students(pickup_person_id);
CREATE INDEX idx_pickup_requests_school_date ON pickup_requests(school_id, request_date);
CREATE INDEX idx_pickup_requests_student ON pickup_requests(student_id);
CREATE INDEX idx_otp_email ON otp_codes(email, used, expires_at);

-- ============ ROW LEVEL SECURITY ============
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_school_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_class_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE gate_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE dismissal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE extra_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE pickup_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE pickup_persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE pickup_person_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE pickup_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- ============ RLS POLICIES ============

-- User profiles
CREATE POLICY "Users read own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- Schools
CREATE POLICY "Users see their schools" ON schools
  FOR SELECT USING (
    id IN (SELECT school_id FROM user_school_roles WHERE user_id = auth.uid())
  );
CREATE POLICY "Admins update schools" ON schools
  FOR UPDATE USING (
    id IN (SELECT school_id FROM user_school_roles WHERE user_id = auth.uid() AND role IN ('school_admin', 'super_admin'))
  );

-- School classes
CREATE POLICY "Users see school classes" ON school_classes
  FOR SELECT USING (
    school_id IN (SELECT school_id FROM user_school_roles WHERE user_id = auth.uid())
  );
CREATE POLICY "Admins manage classes" ON school_classes
  FOR ALL USING (
    school_id IN (SELECT school_id FROM user_school_roles WHERE user_id = auth.uid() AND role IN ('school_admin', 'super_admin'))
  );

-- Custom fields
CREATE POLICY "Users see custom fields" ON school_custom_fields
  FOR SELECT USING (
    school_id IN (SELECT school_id FROM user_school_roles WHERE user_id = auth.uid())
  );
CREATE POLICY "Admins manage custom fields" ON school_custom_fields
  FOR ALL USING (
    school_id IN (SELECT school_id FROM user_school_roles WHERE user_id = auth.uid() AND role IN ('school_admin', 'super_admin'))
  );

-- User roles
CREATE POLICY "Users see own roles" ON user_school_roles
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admins manage roles" ON user_school_roles
  FOR ALL USING (
    school_id IN (SELECT school_id FROM user_school_roles WHERE user_id = auth.uid() AND role IN ('school_admin', 'super_admin'))
  );

-- Teacher profiles
CREATE POLICY "Staff see teacher profiles" ON teacher_profiles
  FOR SELECT USING (
    school_id IN (SELECT school_id FROM user_school_roles WHERE user_id = auth.uid())
  );
CREATE POLICY "Admins manage teacher profiles" ON teacher_profiles
  FOR ALL USING (
    school_id IN (SELECT school_id FROM user_school_roles WHERE user_id = auth.uid() AND role IN ('school_admin', 'super_admin'))
  );

-- Teacher class assignments
CREATE POLICY "Staff see teacher assignments" ON teacher_class_assignments
  FOR SELECT USING (
    teacher_profile_id IN (SELECT id FROM teacher_profiles WHERE school_id IN (SELECT school_id FROM user_school_roles WHERE user_id = auth.uid()))
  );
CREATE POLICY "Admins manage teacher assignments" ON teacher_class_assignments
  FOR ALL USING (
    teacher_profile_id IN (SELECT id FROM teacher_profiles WHERE school_id IN (SELECT school_id FROM user_school_roles WHERE user_id = auth.uid() AND role IN ('school_admin', 'super_admin')))
  );

-- Students
CREATE POLICY "Staff see students" ON students
  FOR SELECT USING (
    school_id IN (SELECT school_id FROM user_school_roles WHERE user_id = auth.uid())
  );
CREATE POLICY "Admins manage students" ON students
  FOR ALL USING (
    school_id IN (SELECT school_id FROM user_school_roles WHERE user_id = auth.uid() AND role IN ('school_admin', 'super_admin'))
  );

-- Student parents
CREATE POLICY "Parents see own links" ON student_parents
  FOR SELECT USING (parent_user_id = auth.uid());
CREATE POLICY "Admins manage parent links" ON student_parents
  FOR ALL USING (
    student_id IN (
      SELECT id FROM students WHERE school_id IN (
        SELECT school_id FROM user_school_roles WHERE user_id = auth.uid() AND role IN ('school_admin', 'super_admin')
      )
    )
  );

-- Gate sessions
CREATE POLICY "Gate staff manage sessions" ON gate_sessions
  FOR ALL USING (
    school_id IN (SELECT school_id FROM user_school_roles WHERE user_id = auth.uid() AND role IN ('gate_officer', 'school_admin'))
  );

-- Attendance
CREATE POLICY "Staff see attendance" ON attendance_records
  FOR SELECT USING (
    school_id IN (SELECT school_id FROM user_school_roles WHERE user_id = auth.uid())
  );
CREATE POLICY "Gate officers create attendance" ON attendance_records
  FOR INSERT WITH CHECK (
    school_id IN (SELECT school_id FROM user_school_roles WHERE user_id = auth.uid() AND role IN ('gate_officer', 'school_admin', 'teacher'))
  );

-- Staff attendance
CREATE POLICY "Staff see own attendance" ON staff_attendance
  FOR SELECT USING (
    user_id = auth.uid() OR
    school_id IN (SELECT school_id FROM user_school_roles WHERE user_id = auth.uid() AND role IN ('school_admin', 'super_admin'))
  );
CREATE POLICY "Gate officers log staff attendance" ON staff_attendance
  FOR INSERT WITH CHECK (
    school_id IN (SELECT school_id FROM user_school_roles WHERE user_id = auth.uid() AND role IN ('gate_officer', 'school_admin'))
  );

-- Dismissals
CREATE POLICY "Staff see dismissals" ON dismissal_requests
  FOR SELECT USING (
    school_id IN (SELECT school_id FROM user_school_roles WHERE user_id = auth.uid())
  );
CREATE POLICY "Teachers create dismissals" ON dismissal_requests
  FOR INSERT WITH CHECK (
    school_id IN (SELECT school_id FROM user_school_roles WHERE user_id = auth.uid() AND role IN ('teacher', 'school_admin'))
  );
CREATE POLICY "Gate officers update dismissals" ON dismissal_requests
  FOR UPDATE USING (
    school_id IN (SELECT school_id FROM user_school_roles WHERE user_id = auth.uid() AND role IN ('gate_officer', 'school_admin', 'teacher'))
  );

-- Extra lessons
CREATE POLICY "Staff see extra lessons" ON extra_lessons
  FOR ALL USING (
    school_id IN (SELECT school_id FROM user_school_roles WHERE user_id = auth.uid())
  );

-- Pickup notices
CREATE POLICY "Parents see own pickup notices" ON pickup_notices
  FOR SELECT USING (parent_user_id = auth.uid());
CREATE POLICY "Parents create pickup notices" ON pickup_notices
  FOR INSERT WITH CHECK (parent_user_id = auth.uid());
CREATE POLICY "Staff see school pickup notices" ON pickup_notices
  FOR SELECT USING (
    school_id IN (SELECT school_id FROM user_school_roles WHERE user_id = auth.uid())
  );

-- Pickup persons
CREATE POLICY "Staff see pickup persons" ON pickup_persons
  FOR SELECT USING (
    school_id IN (SELECT school_id FROM user_school_roles WHERE user_id = auth.uid())
  );
CREATE POLICY "Admins and parents manage pickup persons" ON pickup_persons
  FOR ALL USING (
    school_id IN (SELECT school_id FROM user_school_roles WHERE user_id = auth.uid() AND role IN ('school_admin', 'super_admin', 'parent'))
  );

-- Pickup person student links
CREATE POLICY "Staff see pickup person links" ON pickup_person_students
  FOR SELECT USING (
    school_id IN (SELECT school_id FROM user_school_roles WHERE user_id = auth.uid())
  );
CREATE POLICY "Admins manage pickup person links" ON pickup_person_students
  FOR ALL USING (
    school_id IN (SELECT school_id FROM user_school_roles WHERE user_id = auth.uid() AND role IN ('school_admin', 'super_admin', 'parent'))
  );

-- Pickup requests
CREATE POLICY "Staff see pickup requests" ON pickup_requests
  FOR SELECT USING (
    school_id IN (SELECT school_id FROM user_school_roles WHERE user_id = auth.uid())
  );
CREATE POLICY "Parents create pickup requests" ON pickup_requests
  FOR INSERT WITH CHECK (parent_user_id = auth.uid());
CREATE POLICY "Staff update pickup requests" ON pickup_requests
  FOR UPDATE USING (
    school_id IN (SELECT school_id FROM user_school_roles WHERE user_id = auth.uid() AND role IN ('school_admin', 'super_admin', 'gate_officer'))
  );

-- Notifications
CREATE POLICY "Users see own notifications" ON notifications
  FOR SELECT USING (user_id = auth.uid());

-- Push subscriptions
CREATE POLICY "Users manage own subscriptions" ON push_subscriptions
  FOR ALL USING (user_id = auth.uid());

-- ============ REALTIME ============
ALTER PUBLICATION supabase_realtime ADD TABLE attendance_records;
ALTER PUBLICATION supabase_realtime ADD TABLE dismissal_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE extra_lessons;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE pickup_requests;

-- ============ TRIGGERS ============
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_schools_updated_at BEFORE UPDATE ON schools FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON students FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_teacher_profiles_updated_at BEFORE UPDATE ON teacher_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_school_classes_updated_at BEFORE UPDATE ON school_classes FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============ COLUMN DOCUMENTATION ============
COMMENT ON COLUMN students.photo_url IS 'Storage path under photos bucket (e.g. students/{school_id}/{id}.jpg) or legacy public URL';
COMMENT ON COLUMN teacher_profiles.photo_url IS 'Storage path under photos bucket or legacy public URL';
COMMENT ON COLUMN attendance_records.minutes_late IS 'Minutes late for late arrivals (NULL if on_time or absent)';
COMMENT ON COLUMN dismissal_requests.dismissal_date IS 'Calendar date of dismissal — used to prevent double-tap per student per day';
COMMENT ON TABLE extra_lessons IS 'Students staying for extra lesson — not ready for pickup until teacher releases them';
COMMENT ON TABLE pickup_persons IS 'Authorised persons who can collect a student — with photo for gate verification';
COMMENT ON TABLE pickup_requests IS 'Parent sends a message to school about who will pick up their child today';

-- ============ PLATFORM SCHOOL (super_admin roles only) ============
INSERT INTO schools (id, name, setup_completed, setup_step)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'MyEduRide Platform',
  TRUE,
  'complete'
)
ON CONFLICT (id) DO NOTHING;

-- ============ STORAGE: PHOTOS BUCKET ============
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'photos',
  'photos',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']::text[];

DROP POLICY IF EXISTS "Service role photos all" ON storage.objects;
CREATE POLICY "Service role photos all"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'photos')
  WITH CHECK (bucket_id = 'photos');
