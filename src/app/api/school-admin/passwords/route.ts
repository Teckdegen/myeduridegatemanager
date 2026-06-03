import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSessionFromRequest } from '@/lib/session';
import {
  chunkArray,
  fetchAllActiveSchoolRoles,
  fetchAllTeacherProfiles,
  fetchProfilesByIds,
  loadAuthPasswordsForUsers,
} from '@/lib/db/fetch-all';

export const dynamic = 'force-dynamic';

const STAFF_ROLES = new Set(['school_admin', 'teacher', 'gate_officer', 'staff']);

type CredentialUser = {
  id: string;
  username: string;
  full_name: string;
  roles: string[];
  password: string;
  staff_id_number?: string | null;
};

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

type SchoolCredentials = {
  id: string;
  name: string;
  address: string | null;
  staff: CredentialUser[];
  parents: CredentialUser[];
  students: StudentParentCredential[];
  other: CredentialUser[];
  users: CredentialUser[];
  total_users: number;
};

function toUserRow(
  profile: { id: string; username: string | null; full_name: string | null },
  roles: string[],
  password: string,
  staffIdNumber?: string | null
): CredentialUser {
  return {
    id: profile.id,
    username: profile.username || '',
    full_name: profile.full_name || '',
    roles: [...roles].sort(),
    password,
    staff_id_number: staffIdNumber ?? null,
  };
}

async function fetchStudentParentCredentials(
  supabase: ReturnType<typeof getAdminClient>,
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
    const primary =
      links.find((l) => l.is_primary) || links[0] || null;

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

export async function GET(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session?.user_id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const schoolIds = Array.from(
    new Set(
      (session.roles || [])
        .filter((r) => r.role === 'school_admin')
        .map((r) => r.school_id)
        .filter(Boolean)
    )
  );

  if (schoolIds.length === 0) {
    return NextResponse.json({ error: 'School admin access required' }, { status: 403 });
  }

  try {
    const supabase = getAdminClient();

    const { data: schools, error: schoolsErr } = await supabase
      .from('schools')
      .select('id, name, address')
      .in('id', schoolIds)
      .order('name');

    if (schoolsErr) {
      return NextResponse.json({ error: schoolsErr.message }, { status: 500 });
    }

    const roleRows = await fetchAllActiveSchoolRoles(supabase, schoolIds);
    const userIds = [...new Set(roleRows.map((r) => r.user_id).filter(Boolean))];
    const [profileById, authById, staffProfiles] = await Promise.all([
      fetchProfilesByIds(supabase, userIds),
      loadAuthPasswordsForUsers(supabase, userIds),
      fetchAllTeacherProfiles(supabase, schoolIds),
    ]);

    const staffIdByUserSchool = new Map<string, string | null>();
    for (const sp of staffProfiles) {
      staffIdByUserSchool.set(`${sp.user_id}:${sp.school_id}`, sp.staff_id_number);
    }

    const rolesBySchoolUser = new Map<string, Map<string, string[]>>();
    for (const row of roleRows) {
      if (!row.school_id || !row.user_id) continue;
      if (row.role === 'super_admin') continue;

      if (!rolesBySchoolUser.has(row.school_id)) {
        rolesBySchoolUser.set(row.school_id, new Map());
      }
      const userMap = rolesBySchoolUser.get(row.school_id)!;
      if (!userMap.has(row.user_id)) userMap.set(row.user_id, []);
      userMap.get(row.user_id)!.push(row.role);
    }

    const sortUsers = (a: CredentialUser, b: CredentialUser) =>
      (a.full_name || a.username).localeCompare(b.full_name || b.username);

    const schoolCredentials: SchoolCredentials[] = [];

    for (const school of schools || []) {
      const userMap = rolesBySchoolUser.get(school.id);
      const staff: CredentialUser[] = [];
      const parents: CredentialUser[] = [];
      const other: CredentialUser[] = [];
      const studentParentIds = new Set<string>();

      const students = await fetchStudentParentCredentials(
        supabase,
        school.id,
        profileById,
        authById
      );
      for (const s of students) {
        if (s.parent_user_id) studentParentIds.add(s.parent_user_id);
      }

      if (userMap) {
        for (const [userId, roles] of userMap.entries()) {
          const profile = profileById.get(userId);
          if (!profile) continue;

          const password = authById.get(userId) || '';
          const staffId = staffIdByUserSchool.get(`${userId}:${school.id}`) ?? null;
          const row = toUserRow(profile, roles, password, staffId);

          const isParentOnly = roles.every((r) => r === 'parent');
          const isStaff = roles.some((r) => STAFF_ROLES.has(r));

          if (isStaff) staff.push(row);
          else if (isParentOnly) {
            if (!studentParentIds.has(userId)) parents.push(row);
          } else other.push(row);
        }
      }

      staff.sort(sortUsers);
      parents.sort(sortUsers);
      other.sort(sortUsers);
      const users = [...staff, ...parents, ...other];

      schoolCredentials.push({
        id: school.id,
        name: school.name,
        address: school.address,
        staff,
        parents,
        students,
        other,
        users,
        total_users: users.length + students.filter((s) => s.parent_user_id).length,
      });
    }

    const totalUsers = schoolCredentials.reduce((n, s) => n + s.total_users, 0);
    const totalStudents = schoolCredentials.reduce((n, s) => n + s.students.length, 0);

    return NextResponse.json({
      schools: schoolCredentials,
      total_users: totalUsers,
      total_students: totalStudents,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load credentials';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
