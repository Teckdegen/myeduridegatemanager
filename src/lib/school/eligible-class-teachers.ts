import type { SupabaseClient } from '@supabase/supabase-js';

export type EligibleClassTeacher = {
  id: string;
  user_id: string;
  full_name: string;
};

/** Only users with system role `teacher` — not gate officers, staff, or admins. */
export async function fetchEligibleClassTeachers(
  supabase: SupabaseClient,
  schoolId: string
): Promise<EligibleClassTeacher[]> {
  const { data: teacherRoles, error: rolesErr } = await supabase
    .from('user_school_roles')
    .select('user_id')
    .eq('school_id', schoolId)
    .eq('role', 'teacher')
    .eq('is_active', true);

  if (rolesErr) {
    console.error('[eligible-class-teachers]', rolesErr.message);
    return [];
  }

  const userIds = (teacherRoles || []).map((r) => r.user_id).filter(Boolean);
  if (userIds.length === 0) return [];

  const { data: profiles, error: profErr } = await supabase
    .from('teacher_profiles')
    .select('id, user_id, user:user_profiles(full_name)')
    .eq('school_id', schoolId)
    .in('user_id', userIds);

  if (profErr) {
    console.error('[eligible-class-teachers] profiles:', profErr.message);
    return [];
  }

  return (profiles || []).map((p) => {
    const user = Array.isArray(p.user) ? p.user[0] : p.user;
    return {
      id: p.id as string,
      user_id: p.user_id as string,
      full_name: (user as { full_name?: string })?.full_name || 'Teacher',
    };
  });
}

export async function isEligibleClassTeacherProfile(
  supabase: SupabaseClient,
  schoolId: string,
  teacherProfileId: string | null | undefined
): Promise<boolean> {
  if (!teacherProfileId) return true;

  const { data: profile } = await supabase
    .from('teacher_profiles')
    .select('user_id')
    .eq('id', teacherProfileId)
    .eq('school_id', schoolId)
    .maybeSingle();

  if (!profile?.user_id) return false;

  const { data: role } = await supabase
    .from('user_school_roles')
    .select('id')
    .eq('user_id', profile.user_id)
    .eq('school_id', schoolId)
    .eq('role', 'teacher')
    .eq('is_active', true)
    .maybeSingle();

  return !!role;
}
