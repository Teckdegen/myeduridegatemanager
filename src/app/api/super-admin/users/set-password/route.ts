import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSessionFromRequest, sessionHasRole } from '@/lib/session';

export async function POST(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session || !sessionHasRole(session, 'super_admin')) {
    return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });
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
