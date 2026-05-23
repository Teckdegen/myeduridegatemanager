import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSessionFromRequest, sessionHasRole } from '@/lib/session';
import { lagosDayBoundsFromDateStr } from '@/lib/attendance/lagos-dates';
import { nowUtcIso } from '@/lib/timezone';

export const dynamic = 'force-dynamic';

/**
 * POST /api/staff/attendance
 * School admin marks official staff attendance (record_source = admin).
 */
export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { school_id, user_id, calendar_date, present } = await request.json();

    if (!school_id || !user_id || !calendar_date) {
      return NextResponse.json(
        { error: 'school_id, user_id, and calendar_date required' },
        { status: 400 }
      );
    }

    const isAdmin = session.roles.some(
      (r) => r.school_id === school_id && ['school_admin', 'super_admin'].includes(r.role)
    );
    if (!isAdmin && !sessionHasRole(session, 'super_admin')) {
      return NextResponse.json({ error: 'School admin only' }, { status: 403 });
    }

    const supabase = getAdminClient();
    const { startIso, endIso } = lagosDayBoundsFromDateStr(calendar_date);

    if (!present) {
      await supabase
        .from('staff_attendance')
        .delete()
        .eq('school_id', school_id)
        .eq('user_id', user_id)
        .eq('record_source', 'admin')
        .eq('type', 'clock_in')
        .gte('timestamp', startIso)
        .lte('timestamp', endIso);

      return NextResponse.json({ success: true, present: false });
    }

    const { data: existing } = await supabase
      .from('staff_attendance')
      .select('id')
      .eq('school_id', school_id)
      .eq('user_id', user_id)
      .eq('record_source', 'admin')
      .eq('type', 'clock_in')
      .gte('timestamp', startIso)
      .lte('timestamp', endIso)
      .maybeSingle();

    if (existing?.id) {
      return NextResponse.json({ success: true, present: true, record_id: existing.id });
    }

    const midDayIso = startIso;
    const { data, error } = await supabase
      .from('staff_attendance')
      .insert({
        user_id,
        school_id,
        type: 'clock_in',
        record_source: 'admin',
        verification_method: 'admin_manual',
        verified_by_user_id: session.user_id,
        timestamp: midDayIso,
      })
      .select()
      .single();

    if (error && /record_source/i.test(error.message)) {
      const legacy = await supabase
        .from('staff_attendance')
        .insert({
          user_id,
          school_id,
          type: 'clock_in',
          verification_method: 'admin_manual',
          verified_by_user_id: session.user_id,
          timestamp: nowUtcIso(),
        })
        .select()
        .single();
      if (legacy.error) {
        return NextResponse.json({ error: legacy.error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, present: true, record: legacy.data });
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, present: true, record: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
