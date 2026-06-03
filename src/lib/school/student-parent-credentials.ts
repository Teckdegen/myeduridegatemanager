import type { SupabaseClient } from '@supabase/supabase-js';
import {
  chunkArray,
  fetchProfilesByIds,
  loadAuthPasswordsForUsers,
} from '@/lib/db/fetch-all';

export type StudentParentCredential = {
  student_id: string;
  student_name: string;
  student_id_number: string;
  class_name: string | null;
  parent_user_id: string | null;
  parent_name: string;
  parent_username: string;
  password: string;
};

export async function fetchStudentParentCredentials(
  supabase: SupabaseClient,
  schoolId: string,
  profileById: Map<string, { id: string; username: string | null; full_name: string | null }>,
  authById: Map<string, string>
): Promise<StudentParentCredential[]> {
  const { data: students, error: studErr } = await supabase
    .from('students')
    .select('id, first_name, last_name, student_id_number, class:school_classes(name)')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .order('last_name');

  if (studErr || !students?.length) return [];

  const studentIds = students.map((s) => s.id);
  const parentLinks: Array<{
    student_id: string;
    parent_user_id: string;
    is_primary: boolean;
  }> = [];

  for (const batch of chunkArray(studentIds)) {
    const { data: links } = await supabase
      .from('student_parents')
      .select('student_id, parent_user_id, is_primary')
      .in('student_id', batch);
    if (links?.length) parentLinks.push(...links);
  }

  const parentIdsToLoad = [
    ...new Set(parentLinks.map((l) => l.parent_user_id).filter(Boolean)),
  ].filter((id) => !profileById.has(id));

  if (parentIdsToLoad.length) {
    const extraProfiles = await fetchProfilesByIds(supabase, parentIdsToLoad);
    for (const [id, p] of extraProfiles) profileById.set(id, p);

    const extraPasswords = await loadAuthPasswordsForUsers(supabase, parentIdsToLoad);
    for (const [id, pw] of extraPasswords) authById.set(id, pw);
  }

  const linksByStudent = new Map<string, typeof parentLinks>();
  for (const link of parentLinks) {
    if (!linksByStudent.has(link.student_id)) linksByStudent.set(link.student_id, []);
    linksByStudent.get(link.student_id)!.push(link);
  }

  const rows: StudentParentCredential[] = [];

  for (const student of students) {
    const cls = student.class as { name?: string } | { name?: string }[] | null;
    const className = Array.isArray(cls) ? cls[0]?.name : cls?.name;
    const links = linksByStudent.get(student.id) || [];
    const primary = links.find((l) => l.is_primary) || links[0] || null;

    let parentUserId: string | null = null;
    let parentName = '';
    let parentUsername = '';
    let password = '';

    if (primary?.parent_user_id) {
      parentUserId = primary.parent_user_id;
      const profile = profileById.get(parentUserId);
      parentName = profile?.full_name || '';
      parentUsername = profile?.username || '';
      password = authById.get(parentUserId) || '';
    }

    rows.push({
      student_id: student.id,
      student_name: `${student.first_name} ${student.last_name}`.trim(),
      student_id_number: student.student_id_number || '',
      class_name: className || null,
      parent_user_id: parentUserId,
      parent_name: parentName,
      parent_username: parentUsername,
      password,
    });
  }

  return rows;
}
