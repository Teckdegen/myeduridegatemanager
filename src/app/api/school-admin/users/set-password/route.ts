import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSessionFromRequest } from '@/lib/session';

export async function POST(request: NextRequest) {
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
    const body = await request.json();
    const userId = (body.user_id || '').trim();
    const password = (body.password || '').trim();

    if (!userId || !password) {
      return NextResponse.json({ error: 'user_id and password are required' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const supabase = getAdminClient();

    const { data: targetRoles, error: targetRolesErr } = await supabase
      .from('user_school_roles')
      .select('school_id, role')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (targetRolesErr) {
      return NextResponse.json({ error: targetRolesErr.message }, { status: 500 });
    }

    const belongsToAdminSchool = (targetRoles || []).some((r) => schoolIds.includes(r.school_id));
    if (!belongsToAdminSchool) {
      return NextResponse.json({ error: 'You can only manage users in your school' }, { status: 403 });
    }

    const includesSuperAdmin = (targetRoles || []).some((r) => r.role === 'super_admin');
    if (includesSuperAdmin) {
      return NextResponse.json({ error: 'Super admin passwords can only be managed by super admin' }, { status: 403 });
    }

    const { data: userData, error: getErr } = await supabase.auth.admin.getUserById(userId);
    if (getErr || !userData.user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const currentMeta = userData.user.user_metadata || {};
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      password,
      user_metadata: {
        ...currentMeta,
        login_password: password,
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await supabase
      .from('user_profiles')
      .update({
        last_password_change_at: new Date().toISOString(),
        auth_preference: 'password',
      })
      .eq('id', userId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Could not update password' }, { status: 500 });
  }
}
