import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSessionFromRequest } from '@/lib/session';
import { resolveAttendanceAccess } from '@/lib/attendance/access';

export const dynamic = 'force-dynamic';

/**
 * GET /api/attendance/reports
 * Query params:
 *   school_id  — required for admin/teacher
 *   type       — 'daily' | 'weekly' | 'monthly'
 *   date       — YYYY-MM-DD (for daily; week/month anchor)
 *   class_id   — optional filter
 *   format     — 'json' (default) | 'csv'
 */
export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const sp = request.nextUrl.searchParams;
    const schoolId = sp.get('school_id');
    const reportType = sp.get('type') || 'daily';
    const dateParam = sp.get('date') || new Date().toISOString().split('T')[0];
    const classId = sp.get('class_id');
    const format = sp.get('format') || 'json';

    const supabase = getAdminClient();
    const access = await resolveAttendanceAccess(supabase, session, schoolId);
    if ('error' in access) return NextResponse.json({ error: access.error }, { status: 403 });

    const resolvedSchoolId = access.schoolId!;

    // Build date range
    const anchor = new Date(`${dateParam}T12:00:00`);
    let rangeStart: Date;
    let rangeEnd: Date;

    if (reportType === 'daily') {
      rangeStart = new Date(anchor);
      rangeStart.setHours(0, 0, 0, 0);
      rangeEnd = new Date(anchor);
      rangeEnd.setHours(23, 59, 59, 999);
    } else if (reportType === 'weekly') {
      // Monday–Sunday of the week containing dateParam
      const day = anchor.getDay(); // 0=Sun
      const diff = day === 0 ? -6 : 1 - day;
      rangeStart = new Date(anchor);
      rangeStart.setDate(anchor.getDate() + diff);
      rangeStart.setHours(0, 0, 0, 0);
      rangeEnd = new Date(rangeStart);
      rangeEnd.setDate(rangeStart.getDate() + 6);
      rangeEnd.setHours(23, 59, 59, 999);
    } else {
      // monthly
      rangeStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1, 0, 0, 0, 0);
      rangeEnd = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    // Get all students in scope
    let studentsQuery = supabase
      .from('students')
      .select('id, first_name, last_name, student_id_number, class_id, class:school_classes(id, name, grade)')
      .eq('school_id', resolvedSchoolId)
      .eq('is_active', true)
      .order('last_name');

    if (access.studentIds) {
      studentsQuery = studentsQuery.in('id', access.studentIds);
    }
    if (classId) {
      studentsQuery = studentsQuery.eq('class_id', classId);
    }

    const { data: students, error: studErr } = await studentsQuery;
    if (studErr) return NextResponse.json({ error: studErr.message }, { status: 500 });

    const studentIds = (students || []).map((s: any) => s.id);
    if (studentIds.length === 0) {
      return NextResponse.json({ report: [], students: [], range: { start: rangeStart, end: rangeEnd } });
    }

    // Fetch attendance records in range
    const { data: records, error: recErr } = await supabase
      .from('attendance_records')
      .select('student_id, type, status, timestamp, minutes_late, source')
      .eq('school_id', resolvedSchoolId)
      .in('student_id', studentIds)
      .gte('timestamp', rangeStart.toISOString())
      .lte('timestamp', rangeEnd.toISOString())
      .order('timestamp', { ascending: true });

    if (recErr) return NextResponse.json({ error: recErr.message }, { status: 500 });

    // Fetch dismissal records (check-out times)
    const { data: departures } = await supabase
      .from('attendance_records')
      .select('student_id, timestamp')
      .eq('school_id', resolvedSchoolId)
      .in('student_id', studentIds)
      .eq('type', 'departure')
      .gte('timestamp', rangeStart.toISOString())
      .lte('timestamp', rangeEnd.toISOString())
      .order('timestamp', { ascending: false });

    // Build lookup: student_id → latest departure per day
    const departureMap: Record<string, Record<string, string>> = {};
    for (const d of departures || []) {
      const dayKey = d.timestamp.split('T')[0];
      if (!departureMap[d.student_id]) departureMap[d.student_id] = {};
      if (!departureMap[d.student_id][dayKey]) {
        departureMap[d.student_id][dayKey] = d.timestamp;
      }
    }

    // Build arrival lookup: student_id → first arrival per day
    const arrivalMap: Record<string, Record<string, any>> = {};
    for (const r of records || []) {
      if (r.type !== 'arrival') continue;
      const dayKey = r.timestamp.split('T')[0];
      if (!arrivalMap[r.student_id]) arrivalMap[r.student_id] = {};
      if (!arrivalMap[r.student_id][dayKey]) {
        arrivalMap[r.student_id][dayKey] = r;
      }
    }

    if (reportType === 'daily') {
      const dayKey = dateParam;
      const report = (students || []).map((s: any) => {
        const arrival = arrivalMap[s.id]?.[dayKey];
        const departure = departureMap[s.id]?.[dayKey];
        const cls = Array.isArray(s.class) ? s.class[0] : s.class;
        const rawStatus = arrival ? arrival.status : 'absent';
        const status =
          rawStatus === 'on_time' ? 'present' : rawStatus === 'absent' ? 'absent' : rawStatus;
        return {
          student_id: s.id,
          student_id_number: s.student_id_number,
          first_name: s.first_name,
          last_name: s.last_name,
          class_name: cls?.name || '',
          class_id: s.class_id,
          status: departure && !arrival ? 'dismissed' : status,
          dismissed: !!departure,
          check_in_time: arrival?.timestamp || null,
          check_out_time: departure || null,
          minutes_late: arrival?.minutes_late || null,
          source: arrival?.source || null,
        };
      });

      if (format === 'csv') {
        return buildCsvResponse(report, `daily_${dateParam}`);
      }

      const present = report.filter((r: any) => r.status !== 'absent').length;
      const late = report.filter((r: any) => r.status === 'late').length;
      const absent = report.filter((r: any) => r.status === 'absent').length;

      return NextResponse.json({
        type: 'daily',
        date: dateParam,
        summary: { total: report.length, present, late, absent },
        report,
      });
    }

    // Weekly / Monthly: group by day
    const days = getDaysInRange(rangeStart, rangeEnd);
    const classMap: Record<string, any> = {};
    for (const s of students || []) {
      const cls = Array.isArray(s.class) ? s.class[0] : s.class;
      if (!classMap[s.class_id]) {
        classMap[s.class_id] = { class_id: s.class_id, class_name: cls?.name || '', students: [] };
      }
      classMap[s.class_id].students.push(s);
    }

    const dailySummaries = days.map((day) => {
      const dayKey = day.toISOString().split('T')[0];
      let present = 0, late = 0, absent = 0;
      for (const s of students || []) {
        const arrival = arrivalMap[s.id]?.[dayKey];
        if (!arrival) absent++;
        else if (arrival.status === 'late') late++;
        else present++;
      }
      return { date: dayKey, present, late, absent, total: (students || []).length };
    });

    // Per-class breakdown
    const classBreakdown = Object.values(classMap).map((cls: any) => {
      let totalPresent = 0, totalLate = 0, totalAbsent = 0;
      for (const s of cls.students) {
        for (const day of days) {
          const dayKey = day.toISOString().split('T')[0];
          const arrival = arrivalMap[s.id]?.[dayKey];
          if (!arrival) totalAbsent++;
          else if (arrival.status === 'late') totalLate++;
          else totalPresent++;
        }
      }
      const totalPossible = cls.students.length * days.length;
      return {
        class_id: cls.class_id,
        class_name: cls.class_name,
        student_count: cls.students.length,
        total_present: totalPresent,
        total_late: totalLate,
        total_absent: totalAbsent,
        attendance_pct: totalPossible > 0
          ? Math.round(((totalPresent + totalLate) / totalPossible) * 100)
          : 0,
      };
    });

    const totalDays = days.length;
    const totalStudents = (students || []).length;
    const grandPresent = dailySummaries.reduce((a, d) => a + d.present, 0);
    const grandLate = dailySummaries.reduce((a, d) => a + d.late, 0);
    const grandAbsent = dailySummaries.reduce((a, d) => a + d.absent, 0);
    const grandTotal = totalStudents * totalDays;

    if (format === 'csv') {
      // Flat CSV: one row per student per day
      const rows: any[] = [];
      for (const s of students || []) {
        const cls = Array.isArray(s.class) ? s.class[0] : s.class;
        for (const day of days) {
          const dayKey = day.toISOString().split('T')[0];
          const arrival = arrivalMap[s.id]?.[dayKey];
          const departure = departureMap[s.id]?.[dayKey];
          rows.push({
            date: dayKey,
            student_id_number: s.student_id_number,
            first_name: s.first_name,
            last_name: s.last_name,
            class_name: cls?.name || '',
            status: arrival ? arrival.status : 'absent',
            check_in_time: arrival?.timestamp || '',
            check_out_time: departure || '',
            minutes_late: arrival?.minutes_late || '',
          });
        }
      }
      return buildCsvResponse(rows, `${reportType}_${dateParam}`);
    }

    return NextResponse.json({
      type: reportType,
      range: { start: rangeStart.toISOString(), end: rangeEnd.toISOString() },
      summary: {
        total_students: totalStudents,
        total_days: totalDays,
        grand_present: grandPresent,
        grand_late: grandLate,
        grand_absent: grandAbsent,
        attendance_pct: grandTotal > 0
          ? Math.round(((grandPresent + grandLate) / grandTotal) * 100)
          : 0,
      },
      daily_summaries: dailySummaries,
      class_breakdown: classBreakdown,
    });
  } catch (err: any) {
    console.error('[attendance/reports]', err);
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

function buildCsvResponse(rows: any[], label: string) {
  if (rows.length === 0) {
    return new NextResponse('No data', {
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="${label}.csv"` },
    });
  }
  const headers = Object.keys(rows[0]);
  const lines = rows.map((r) =>
    headers.map((h) => {
      const v = String(r[h] ?? '');
      return v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v;
    }).join(',')
  );
  const csv = [headers.join(','), ...lines].join('\n');
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${label}.csv"`,
    },
  });
}
