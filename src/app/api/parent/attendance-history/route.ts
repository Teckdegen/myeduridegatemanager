import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSessionFromRequest } from '@/lib/session';
import { todayInLagos } from '@/lib/timezone';
import {
  lagosDateStringsInRange,
  lagosWeekend,
  resolveLagosReportRange,
  timestampToLagosDateKey,
} from '@/lib/attendance/lagos-dates';

export const dynamic = 'force-dynamic';

/**
 * GET /api/parent/attendance-history
 * Query params:
 *   student_id — required
 *   type       — 'daily' | 'weekly' | 'monthly' | 'yearly'
 *   date       — YYYY-MM-DD anchor (Lagos calendar; defaults to today in Lagos)
 *   year       — YYYY (for yearly)
 *   term       — 1 | 2 | 3 (for yearly/term view)
 */
export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const sp = request.nextUrl.searchParams;
    const studentId = sp.get('student_id');
    const type = sp.get('type') || 'daily';
    const dateParam = sp.get('date') || todayInLagos();
    const yearParam = sp.get('year');
    const termParam = sp.get('term');

    if (!studentId) return NextResponse.json({ error: 'student_id required' }, { status: 400 });

    const supabase = getAdminClient();

    const { data: link } = await supabase
      .from('student_parents')
      .select('student_id')
      .eq('student_id', studentId)
      .eq('parent_user_id', session.user_id)
      .maybeSingle();

    if (!link) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    const { startDateStr, endDateStr, rangeStartIso, rangeEndIso } = resolveLagosReportRange(
      type,
      dateParam,
      yearParam,
      termParam
    );

    const { data: arrivals, error: arrErr } = await supabase
      .from('attendance_records')
      .select('student_id, type, status, timestamp, minutes_late')
      .eq('student_id', studentId)
      .eq('type', 'arrival')
      .gte('timestamp', rangeStartIso)
      .lte('timestamp', rangeEndIso)
      .order('timestamp', { ascending: true });

    if (arrErr) return NextResponse.json({ error: arrErr.message }, { status: 500 });

    const { data: departures } = await supabase
      .from('attendance_records')
      .select('student_id, timestamp')
      .eq('student_id', studentId)
      .eq('type', 'departure')
      .gte('timestamp', rangeStartIso)
      .lte('timestamp', rangeEndIso)
      .order('timestamp', { ascending: false });

    const arrivalByDay: Record<string, { status: string; timestamp: string; minutes_late: number | null }> = {};
    for (const a of arrivals || []) {
      const d = timestampToLagosDateKey(a.timestamp);
      if (!arrivalByDay[d]) arrivalByDay[d] = a;
    }

    const departureByDay: Record<string, string> = {};
    for (const d of departures || []) {
      const day = timestampToLagosDateKey(d.timestamp);
      if (!departureByDay[day]) departureByDay[day] = d.timestamp;
    }

    if (type === 'daily') {
      const dayKey = dateParam;
      const arrival = arrivalByDay[dayKey];
      const departure = departureByDay[dayKey];
      return NextResponse.json({
        type: 'daily',
        date: dayKey,
        status: arrival ? arrival.status : 'absent',
        check_in_time: arrival?.timestamp || null,
        check_out_time: departure || null,
        minutes_late: arrival?.minutes_late ?? null,
      });
    }

    const dayStrings = lagosDateStringsInRange(startDateStr, endDateStr);
    const calendar = dayStrings.map((dayKey) => {
      const arrival = arrivalByDay[dayKey];
      const departure = departureByDay[dayKey];
      const isWeekend = lagosWeekend(dayKey);
      return {
        date: dayKey,
        is_weekend: isWeekend,
        status: isWeekend ? 'weekend' : arrival ? arrival.status : 'absent',
        check_in_time: arrival?.timestamp || null,
        check_out_time: departure || null,
        minutes_late: arrival?.minutes_late ?? null,
        color: isWeekend
          ? 'gray'
          : !arrival
          ? 'red'
          : arrival.status === 'late'
          ? 'yellow'
          : 'green',
      };
    });

    const schoolDays = calendar.filter((d) => !d.is_weekend);
    const present = schoolDays.filter((d) => d.status === 'on_time').length;
    const late = schoolDays.filter((d) => d.status === 'late').length;
    const absent = schoolDays.filter((d) => d.status === 'absent').length;
    const total = schoolDays.length;

    return NextResponse.json({
      type,
      range: { start: rangeStartIso, end: rangeEndIso },
      summary: {
        total_school_days: total,
        present,
        late,
        absent,
        attendance_pct: total > 0 ? Math.round(((present + late) / total) * 100) : 0,
      },
      calendar,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed';
    console.error('[parent/attendance-history]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
