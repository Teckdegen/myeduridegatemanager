import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSessionFromRequest, sessionHasRole } from '@/lib/session';

export const dynamic = 'force-dynamic';

function canManage(session: ReturnType<typeof getSessionFromRequest>, schoolId: string) {
  if (!session) return false;
  if (sessionHasRole(session, 'super_admin')) return true;
  return session.roles.some(
    (r) => r.school_id === schoolId && r.role === 'school_admin'
  );
}

function canView(session: ReturnType<typeof getSessionFromRequest>, schoolId: string) {
  if (!session) return false;
  if (sessionHasRole(session, 'super_admin')) return true;
  return session.roles.some((r) => r.school_id === schoolId);
}

/** GET — list non-school days (optional year/month filter) */
export async function GET(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const schoolId = request.nextUrl.searchParams.get('school_id');
  if (!schoolId) return NextResponse.json({ error: 'school_id required' }, { status: 400 });
  if (!canView(session, schoolId)) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const year = request.nextUrl.searchParams.get('year');
  const month = request.nextUrl.searchParams.get('month');

  const supabase = getAdminClient();
  let q = supabase
    .from('school_non_school_days')
    .select('*')
    .eq('school_id', schoolId)
    .order('calendar_date', { ascending: true });

  if (year && month) {
    const start = `${year}-${month.padStart(2, '0')}-01`;
    const endDay = new Date(Number(year), Number(month), 0).getDate();
    const end = `${year}-${month.padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
    q = q.gte('calendar_date', start).lte('calendar_date', end);
  }

  const { data, error } = await q;
  if (error) {
    if (/school_non_school_days/i.test(error.message)) {
      return NextResponse.json({ days: [], migration_required: true });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ days: data || [] });
}

/** POST — add holiday / event / closure */
export async function POST(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await request.json();
  const { school_id, calendar_date, day_type, title, description, notify_parents } = body;

  if (!school_id || !calendar_date || !day_type || !title) {
    return NextResponse.json(
      { error: 'school_id, calendar_date, day_type, and title are required' },
      { status: 400 }
    );
  }

  if (!canManage(session, school_id)) {
    return NextResponse.json({ error: 'School admin access required' }, { status: 403 });
  }

  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('school_non_school_days')
    .upsert(
      {
        school_id,
        calendar_date,
        day_type,
        title,
        description: description || null,
        notify_parents: !!notify_parents,
      },
      { onConflict: 'school_id,calendar_date' }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, day: data });
}

/** DELETE — remove by id */
export async function DELETE(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const id = request.nextUrl.searchParams.get('id');
  const schoolId = request.nextUrl.searchParams.get('school_id');
  if (!id || !schoolId) {
    return NextResponse.json({ error: 'id and school_id required' }, { status: 400 });
  }

  if (!canManage(session, schoolId)) {
    return NextResponse.json({ error: 'School admin access required' }, { status: 403 });
  }

  const supabase = getAdminClient();
  const { error } = await supabase
    .from('school_non_school_days')
    .delete()
    .eq('id', id)
    .eq('school_id', schoolId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
