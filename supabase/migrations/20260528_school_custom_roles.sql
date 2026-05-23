-- Custom job titles per school (Accountant, Cleaner, Class Teacher, etc.)
-- App role "staff" = sign-in + own attendance only; class link only when can_assign_class = true.

CREATE TABLE IF NOT EXISTS school_custom_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  can_assign_class BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(school_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_school_custom_roles_school ON school_custom_roles(school_id, is_active);

ALTER TABLE teacher_profiles ADD COLUMN IF NOT EXISTS custom_role_id UUID REFERENCES school_custom_roles(id) ON DELETE SET NULL;

ALTER TABLE user_school_roles DROP CONSTRAINT IF EXISTS user_school_roles_role_check;
ALTER TABLE user_school_roles ADD CONSTRAINT user_school_roles_role_check
  CHECK (role IN ('super_admin', 'school_admin', 'teacher', 'gate_officer', 'parent', 'staff'));

ALTER TABLE school_custom_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "School staff see custom roles" ON school_custom_roles;
CREATE POLICY "School staff see custom roles" ON school_custom_roles
  FOR SELECT USING (
    school_id IN (SELECT school_id FROM user_school_roles WHERE user_id = auth.uid() AND is_active = true)
  );

DROP POLICY IF EXISTS "Admins manage custom roles" ON school_custom_roles;
CREATE POLICY "Admins manage custom roles" ON school_custom_roles
  FOR ALL USING (
    school_id IN (
      SELECT school_id FROM user_school_roles
      WHERE user_id = auth.uid() AND role IN ('school_admin', 'super_admin') AND is_active = true
    )
  );

COMMENT ON TABLE school_custom_roles IS 'Display job titles for staff role users; can_assign_class allows homeroom class link';
