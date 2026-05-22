import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSessionFromRequest } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * GET /api/parent/attendance-history
 * Query params:
 *   student_id — required
 *   type       — 'daily' | 'weekly' | 'monthly' | 'yearly'
 *   date       — YYYY-MM-DD anchor (defaults to today)
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
    const dateParam = sp.get('date') || new Date().toISOString().split('T')[0];
    const yearParam = sp.get('year');
    const termParam = sp.get('term');

    if (!studentId) return NextResponse.json({ error: 'student_id required' }, { status: 400 });

    const supabase = getAdminClient();

    // Verify parent is linked to student
    const { data: link } = await supabase
      .from('student_parents')
      .select('student_id')
      .eq('student_id', studentId)
      .eq('parent_user_id', session.user_id)
      .maybeSingle();

    if (!link) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    const anchor = new Date(`${dateParam}T12:00:00`);
    let rangeStart: Date;
    let rangeEnd: Date;

    if (type === 'daily') {
      rangeStart = new Date(anchor);
      rangeStart.setHours(0, 0, 0, 0);
      rangeEnd = new Date(anchor);
      rangeEnd.setHours(23, 59, 59, 999);
    } else if (type === 'weekly') {
      const day = anchor.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      rangeStart = new Date(anchor);
      rangeStart.setDate(anchor.getDate() + diff);
      rangeStart.setHours(0, 0, 0, 0);
      rangeEnd = new Date(rangeStart);
      rangeEnd.setDate(rangeStart.getDate() + 6);
      rangeEnd.setHours(23, 59, 59, 999);
    } else if (type === 'monthly') {
      rangeStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1, 0, 0, 0, 0);
      rangeEnd = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0, 23, 59, 59, 999);
    } else {
      // yearly / term
      const year = yearParam ? parseInt(yearParam) : anchor.getFullYear();
      if (termParam) {
        const term = parseInt(termParam);
        // Nigerian school terms (approximate)
        const termRanges: Record<number, [number, number, number, number]> = {
          1: [8, 1, 11, 30],   // Sep–Nov (month 0-indexed: 8=Sep, 11=Dec)
          2: [0, 1, 3, 30],    // Jan–Apr
          3: [4, 1, 7, 31],    // May–Aug
        };
        const [sm, sd, em, ed] = termRanges[term] || [0, 1, 11, 31];
        const termYear = term === 1 ? year : year + 1;
        rangeStart = new Date(term === 1 ? year : termYear, sm, sd, 0, 0, 0, 0);
        rangeEnd = new Date(termYear, em, ed, 23, 59, 59, 999);
      } else {
        rangeStart = new Date(year, 0, 1, 0, 0, 0, 0);
        rangeEnd = new Date(year, 11, 31, 23, 59, 59, 999);
      }
    }

    // Fetch arrivals
    const { data: arrivals, error: arrErr } = await supabase
      .from('attendance_records')
      .select('student_id, type, status, timestamp, minutes_late')
      .eq('student_id', studentId)
      .eq('type', 'arrival')
      .gte('timestamp', rangeStart.toISOString())
      .lte('timestamp', rangeEnd.toISOString())
      .order('timestamp', { ascending: true });

    if (arrErr) return NextResponse.json({ error: arrErr.message }, { status: 500 });

    // Fetch departures
    const { data: departures } = await supabase
      .from('attendance_records')
      .select('student_id, timestamp')
      .eq('student_id', studentId)
      .eq('type', 'departure')
      .gte('timestamp', rangeStart.toISOString())
      .lte('timestamp', rangeEnd.toISOString())
      .order('timestamp', { ascending: false });

    // Build day maps
    const arrivalByDay: Record<string, any> = {};
    for (const a of arrivals || []) {
      const d = a.timestamp.split('T')[0];
      if (!arrivalByDay[d]) arrivalByDay[d] = a;
    }

    const departureByDay: Record<string, string> = {};
    for (const d of departures || []) {
      const day = d.timestamp.split('T')[0];
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
        minutes_late: arrival?.minutes_late || null,
      });
    }

    // Build calendar days
    const days = getDaysInRange(rangeStart, rangeEnd);
    const calendar = days.map((day) => {
      const dayKey = day.toISOString().split('T')[0];
      const arrival = arrivalByDay[dayKey];
      const departure = departureByDay[dayKey];
      const isWeekend = day.getDay() === 0 || day.getDay() === 6;
      return {
        date: dayKey,
        is_weekend: isWeekend,
        status: isWeekend ? 'weekend' : arrival ? arrival.status : 'absent',
        check_in_time: arrival?.timestamp || null,
        check_out_time: departure || null,
        minutes_late: arrival?.minutes_late || null,
        // colour coding for calendar
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
      range: { start: rangeStart.toISOString(), end: rangeEnd.toISOString() },
      summary: {
        total_school_days: total,
        present,
        late,
        absent,
        attendance_pct: total > 0 ? Math.round(((present + late) / total) * 100) : 0,
      },
      calendar,
    });
  } catch (err: any) {
    console.error('[parent/attendance-history]', err);
    return NextResponse.json({ error: err.message || 'Failed' }, { status: 500 });
  }
}

function getDaysInRange(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}
