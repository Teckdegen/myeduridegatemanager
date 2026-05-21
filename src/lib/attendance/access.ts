import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppSession } from '@/lib/session';
import { sessionHasRole } from '@/lib/session';

export type AttendanceAccess = {
  schoolId: string | null;
  studentIds: string[] | null;
  role: 'super_admin' | 'school_admin' | 'teacher';
};

/** Who can export attendance and which students they see. */
export async function resolveAttendanceAccess(
  supabase: SupabaseClient,
  session: AppSession,
  requestedSchoolId?: string | null
): Promise<AttendanceAccess | { error: string }> {
  if (sessionHasRole(session, 'super_admin')) {
    return {
      role: 'super_admin',
      schoolId: requestedSchoolId || null,
      studentIds: null,
    };
  }

  const adminRole = session.roles.find((r) => r.role === 'school_admin');
  if (adminRole) {
    const schoolId = requestedSchoolId || adminRole.school_id;
    if (!schoolId || adminRole.school_id !== schoolId) {
      return { error: 'Access denied for this school' };
    }
    return { role: 'school_admin', schoolId, studentIds: null };
  }

  const teacherRole = session.roles.find((r) => r.role === 'teacher');
  if (!teacherRole?.school_id) {
    return { error: 'Teacher role not found' };
  }

  const schoolId = teacherRole.school_id;
  if (requestedSchoolId && requestedSchoolId !== schoolId) {
    return { error: 'Access denied for this school' };
  }

  const { data: teacherProfile } = await supabase
    .from('teacher_profiles')
    .select('id')
    .eq('user_id', session.user_id)
    .eq('school_id', schoolId)
    .maybeSingle();

  let studentIds: string[] | null = null;
  if (teacherProfile?.id) {
    const { data: assignments } = await supabase
      .from('teacher_class_assignments')
      .select('class_id')
      .eq('teacher_profile_id', teacherProfile.id);

    const classIds = (assignments || []).map((a) => a.class_id);
    if (classIds.length > 0) {
      const { data: students } = await supabase
        .from('students')
        .select('id')
        .eq('school_id', schoolId)
        .in('class_id', classIds)
        .eq('is_active', true);
      studentIds = (students || []).map((s) => s.id);
    }
  }

  return { role: 'teacher', schoolId, studentIds };
}
