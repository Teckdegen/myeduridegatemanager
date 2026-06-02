import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { findProfileByUsername } from '@/lib/auth/ensure-user';
import { isValidUsername, normalizeUsername } from '@/lib/auth/username';

export const dynamic = 'force-dynamic';

/**
 * GET /api/public/login-branding?username=
 * Returns school logo/name for login screen (no auth). Uses user's primary school role.
 */
export async function GET(request: NextRequest) {
  try {
    const username = normalizeUsername(request.nextUrl.searchParams.get('username') || '');
    if (!username || !isValidUsername(username)) {
      return NextResponse.json({ school: null });
    }

    const supabase = getAdminClient();
    const { data: profile } = await findProfileByUsername(supabase, username);
    if (!profile) {
      return NextResponse.json({ school: null });
    }

    const { data: roles } = await supabase
      .from('user_school_roles')
      .select('role, school_id')
      .eq('user_id', profile.id)
      .eq('is_active', true);

    const schoolRole =
      (roles || []).find((r) => r.role === 'school_admin') ||
      (roles || []).find((r) => r.role === 'parent') ||
      (roles || []).find((r) => r.role === 'gate_officer') ||
      (roles || []).find((r) => r.role === 'teacher') ||
      (roles || [])[0];

    if (!schoolRole?.school_id) {
      return NextResponse.json({ school: null });
    }

    const { data: school } = await supabase
      .from('schools')
      .select('id, name, logo_url, welcome_message')
      .eq('id', schoolRole.school_id)
      .maybeSingle();

    if (!school) {
      return NextResponse.json({ school: null });
    }

    return NextResponse.json({
      school: {
        id: school.id,
        name: school.name,
        logo_url: school.logo_url,
        welcome_message: school.welcome_message,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
