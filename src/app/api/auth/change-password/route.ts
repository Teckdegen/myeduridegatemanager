import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSessionFromRequest } from '@/lib/session';
import { authEmailFromUsername } from '@/lib/auth/username';

function getPublicSupabaseClient() {
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  url = url.replace(/\/rest\/v1\/?.*$/, '').replace(/\/$/, '');
  return createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '', {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session?.user_id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getAdminClient();
    let username = session.username;
    if (!username) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('username')
        .eq('id', session.user_id)
        .maybeSingle();
      username = profile?.username || '';
    }
    if (!username) {
      return NextResponse.json({ error: 'Username not found on account' }, { status: 400 });
    }
    const body = await request.json();
    const currentPassword = (body.current_password || '').trim();
    const newPassword = (body.new_password || '').trim();

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Current password and new password are required' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'New password must be at least 6 characters' },
        { status: 400 }
      );
    }

    if (currentPassword === newPassword) {
      return NextResponse.json(
        { error: 'New password must be different from current password' },
        { status: 400 }
      );
    }

    const authEmail = authEmailFromUsername(username);
    const authClient = getPublicSupabaseClient();
    const { error: signInError } = await authClient.auth.signInWithPassword({
      email: authEmail,
      password: currentPassword,
    });

    if (signInError) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
    }

    await authClient.auth.signOut();

    const { data: userData } = await supabase.auth.admin.getUserById(session.user_id);
    const currentMeta = userData.user?.user_metadata || {};

    const { error: updateErr } = await supabase.auth.admin.updateUserById(session.user_id, {
      password: newPassword,
      user_metadata: {
        ...currentMeta,
        login_password: newPassword,
      },
    });

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    await supabase
      .from('user_profiles')
      .update({
        last_password_change_at: new Date().toISOString(),
        auth_preference: 'password',
      })
      .eq('id', session.user_id);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Could not change password' }, { status: 500 });
  }
}
