-- Ensure gate + attendance tables exist (safe to re-run)

CREATE TABLE IF NOT EXISTS gate_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  gate_officer_user_id UUID NOT NULL REFERENCES user_profiles(id),
  mode TEXT NOT NULL CHECK (mode IN ('arrival', 'dismissal')),
  status TEXT NOT NULL CHECK (status IN ('active', 'closed')) DEFAULT 'active',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS attendance_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  gate_session_id UUID REFERENCES gate_sessions(id),
  type TEXT NOT NULL CHECK (type IN ('arrival', 'departure')),
  verification_method TEXT NOT NULL CHECK (verification_method IN ('face_recognition', 'id_card_scan', 'manual', 'teacher_manual')),
  verified_by_user_id UUID REFERENCES user_profiles(id),
  status TEXT CHECK (status IN ('on_time', 'late', 'absent')) DEFAULT 'on_time',
  source TEXT NOT NULL DEFAULT 'gate' CHECK (source IN ('gate', 'teacher')),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS staff_attendance (
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

CREATE INDEX IF NOT EXISTS idx_attendance_school_date ON attendance_records(school_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance_records(student_id);
