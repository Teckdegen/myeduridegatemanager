import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSessionFromRequest } from '@/lib/session';

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

type SchoolCredentials = {
  id: string;
  name: string;
  address: string | null;
  staff: CredentialUser[];
  parents: CredentialUser[];
  other: CredentialUser[];
  users: CredentialUser[];
  total_users: number;
};

async function loadAuthPasswords(supabase: ReturnType<typeof getAdminClient>, userIds: string[]) {
  const authById = new Map<string, string>();
  if (userIds.length === 0) return authById;

  const idSet = new Set(userIds);
  let page = 1;
  const perPage = 1000;
  while (page <= 20) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    for (const user of data.users) {
      if (!idSet.has(user.id)) continue;
      authById.set(user.id, (user.user_metadata?.login_password as string) || '');
    }
    if (data.users.length < perPage) break;
    page += 1;
  }
  return authById;
}

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

    const { data: roleRows, error: rolesErr } = await supabase
      .from('user_school_roles')
      .select('user_id, school_id, role')
      .in('school_id', schoolIds)
      .eq('is_active', true);

    if (rolesErr) {
      return NextResponse.json({ error: rolesErr.message }, { status: 500 });
    }

    const userIds = [...new Set((roleRows || []).map((r) => r.user_id).filter(Boolean))];
    const profileById = new Map<
      string,
      { id: string; username: string | null; full_name: string | null }
    >();

    if (userIds.length > 0) {
      const { data: profiles, error: profilesErr } = await supabase
        .from('user_profiles')
        .select('id, username, full_name')
        .in('id', userIds);

      if (profilesErr) {
        return NextResponse.json({ error: profilesErr.message }, { status: 500 });
      }
      for (const p of profiles || []) {
        profileById.set(p.id, p);
      }
    }

    const authById = await loadAuthPasswords(supabase, userIds);

    const { data: staffProfiles } = await supabase
      .from('teacher_profiles')
      .select('user_id, school_id, staff_id_number')
      .in('school_id', schoolIds);

    const staffIdByUserSchool = new Map<string, string | null>();
    for (const sp of staffProfiles || []) {
      staffIdByUserSchool.set(`${sp.user_id}:${sp.school_id}`, sp.staff_id_number);
    }

    const rolesBySchoolUser = new Map<string, Map<string, string[]>>();
    for (const row of roleRows || []) {
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
          else if (isParentOnly) parents.push(row);
          else other.push(row);
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
        other,
        users,
        total_users: users.length,
      });
    }

    const totalUsers = schoolCredentials.reduce((n, s) => n + s.total_users, 0);

    return NextResponse.json({
      schools: schoolCredentials,
      total_users: totalUsers,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load credentials';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
