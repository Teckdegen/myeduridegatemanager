import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { lookupUserByUsername } from '@/lib/auth/lookup-user-by-username';
import { getSessionFromRequest } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session?.user_id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const canLookup = (session.roles || []).some((r) =>
    ['super_admin', 'school_admin', 'teacher', 'gate_officer', 'staff'].includes(r.role)
  );
  if (!canLookup) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const username = request.nextUrl.searchParams.get('username')?.trim();
  if (!username) {
    return NextResponse.json({ error: 'username required' }, { status: 400 });
  }

  try {
    const supabase = getAdminClient();
    const user = await lookupUserByUsername(supabase, username);
    if (!user) {
      return NextResponse.json({ found: false, user: null });
    }
    return NextResponse.json({ found: true, user });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Lookup failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
