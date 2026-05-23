import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSessionFromRequest } from '@/lib/session';
import { resolveAttendanceAccess } from '@/lib/attendance/access';
import { todayInLagos } from '@/lib/timezone';
import {
  lagosDateStringsInRange,
  lagosWeekend,
  resolveLagosReportRange,
  timestampToLagosDateKey,
} from '@/lib/attendance/lagos-dates';
import { buildStaffMonthlyReport } from '@/lib/attendance/staff-report';
import { normalizeArrivalStatus } from '@/lib/attendance/status';

export const dynamic = 'force-dynamic';

/**
 * GET /api/attendance/reports
 * Query params:
 *   school_id  — required for admin/teacher
 *   type       — 'daily' | 'weekly' | 'monthly'
 *   date       — YYYY-MM-DD (daily / week anchor)
 *   month      — YYYY-MM full calendar month (monthly only; preferred over date)
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
    const monthParam = sp.get('month');
    let dateParam = sp.get('date') || todayInLagos();
    if (reportType === 'monthly' && monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
      dateParam = `${monthParam}-01`;
    }
    const classId = sp.get('class_id');
    const format = sp.get('format') || 'json';
    const monthLabel = reportType === 'monthly' ? (monthParam || dateParam.slice(0, 7)) : null;

    const supabase = getAdminClient();
    const access = await resolveAttendanceAccess(supabase, session, schoolId);
    if ('error' in access) return NextResponse.json({ error: access.error }, { status: 403 });

    const resolvedSchoolId = access.schoolId!;

    const { startDateStr, endDateStr, rangeStartIso, rangeEndIso } = resolveLagosReportRange(
      reportType,
      dateParam
    );

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

    const studentIds = (students || []).map((s: { id: string }) => s.id);
    if (studentIds.length === 0) {
      return NextResponse.json({
        report: [],
        students: [],
        range: { start: rangeStartIso, end: rangeEndIso },
      });
    }

    const { data: records, error: recErr } = await supabase
      .from('attendance_records')
      .select('student_id, type, status, timestamp, minutes_late, source')
      .eq('school_id', resolvedSchoolId)
      .in('student_id', studentIds)
      .gte('timestamp', rangeStartIso)
      .lte('timestamp', rangeEndIso)
      .order('timestamp', { ascending: true });

    if (recErr) return NextResponse.json({ error: recErr.message }, { status: 500 });

    const { data: departures } = await supabase
      .from('attendance_records')
      .select('student_id, timestamp')
      .eq('school_id', resolvedSchoolId)
      .in('student_id', studentIds)
      .eq('type', 'departure')
      .gte('timestamp', rangeStartIso)
      .lte('timestamp', rangeEndIso)
      .order('timestamp', { ascending: false });

    const departureMap: Record<string, Record<string, string>> = {};
    for (const d of departures || []) {
      const dayKey = timestampToLagosDateKey(d.timestamp);
      if (!departureMap[d.student_id]) departureMap[d.student_id] = {};
      if (!departureMap[d.student_id][dayKey]) {
        departureMap[d.student_id][dayKey] = d.timestamp;
      }
    }

    const arrivalMap: Record<string, Record<string, { status: string; timestamp: string; minutes_late: number | null; source: string | null }>> = {};
    for (const r of records || []) {
      if (r.type !== 'arrival') continue;
      const dayKey = timestampToLagosDateKey(r.timestamp);
      if (!arrivalMap[r.student_id]) arrivalMap[r.student_id] = {};
      if (!arrivalMap[r.student_id][dayKey]) {
        arrivalMap[r.student_id][dayKey] = r;
      }
    }

    if (reportType === 'daily') {
      const dayKey = dateParam;
      const report = (students || []).map((s: {
        id: string;
        first_name: string;
        last_name: string;
        student_id_number: string;
        class_id: string;
        class: unknown;
      }) => {
        const arrival = arrivalMap[s.id]?.[dayKey];
        const departure = departureMap[s.id]?.[dayKey];
        const cls = Array.isArray(s.class) ? s.class[0] : s.class as { name?: string } | null;
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
          minutes_late: arrival?.minutes_late ?? null,
          source: arrival?.source || null,
        };
      });

      if (format === 'csv') {
        return buildCsvResponse(report, `daily_${dateParam}`);
      }

      const present = report.filter((r: { status: string }) => r.status !== 'absent').length;
      const late = report.filter((r: { status: string }) => r.status === 'late').length;
      const absent = report.filter((r: { status: string }) => r.status === 'absent').length;

      return NextResponse.json({
        type: 'daily',
        date: dateParam,
        summary: { total: report.length, present, late, absent },
        report,
      });
    }

    const dayStrings = lagosDateStringsInRange(startDateStr, endDateStr);
    const classMap: Record<string, { class_id: string; class_name: string; students: typeof students }> = {};
    for (const s of students || []) {
      const cls = Array.isArray(s.class) ? s.class[0] : s.class as { name?: string } | null;
      if (!classMap[s.class_id]) {
        classMap[s.class_id] = { class_id: s.class_id, class_name: cls?.name || '', students: [] };
      }
      classMap[s.class_id].students.push(s);
    }

    const dailySummaries = dayStrings.map((dayKey) => {
      let present = 0, late = 0, absent = 0;
      for (const s of students || []) {
        const arrival = arrivalMap[s.id]?.[dayKey];
        if (!arrival) absent++;
        else if (arrival.status === 'late') late++;
        else present++;
      }
      return { date: dayKey, present, late, absent, total: (students || []).length };
    });

    const classBreakdown = Object.values(classMap).map((cls) => {
      let totalPresent = 0, totalLate = 0, totalAbsent = 0;
      for (const s of cls.students) {
        for (const dayKey of dayStrings) {
          const arrival = arrivalMap[s.id]?.[dayKey];
          if (!arrival) totalAbsent++;
          else if (arrival.status === 'late') totalLate++;
          else totalPresent++;
        }
      }
      const totalPossible = cls.students.length * dayStrings.length;
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

    const totalDays = dayStrings.length;
    const totalStudents = (students || []).length;
    const grandPresent = dailySummaries.reduce((a, d) => a + d.present, 0);
    const grandLate = dailySummaries.reduce((a, d) => a + d.late, 0);
    const grandAbsent = dailySummaries.reduce((a, d) => a + d.absent, 0);
    const grandTotal = totalStudents * totalDays;

    const schoolDayStrings = dayStrings.filter((d) => !lagosWeekend(d));
    const monthCalendarDays = reportType === 'monthly' ? dayStrings : schoolDayStrings;

    const studentMonthly = (students || []).map((s: {
      id: string;
      first_name: string;
      last_name: string;
      student_id_number: string;
      class: unknown;
    }) => {
      const cls = Array.isArray(s.class) ? s.class[0] : s.class as { name?: string } | null;
      let present = 0;
      let late = 0;
      let absent = 0;
      const days = monthCalendarDays.map((dayKey) => {
        if (lagosWeekend(dayKey)) {
          return { date: dayKey, status: 'weekend' as const };
        }
        const arrival = arrivalMap[s.id]?.[dayKey];
        const normalized = normalizeArrivalStatus(arrival);
        const status = normalized || 'absent';
        if (status === 'late') late++;
        else if (status === 'on_time') present++;
        else absent++;
        return { date: dayKey, status };
      });
      const total = schoolDayStrings.length;
      return {
        student_id: s.id,
        student_id_number: s.student_id_number,
        first_name: s.first_name,
        last_name: s.last_name,
        class_name: cls?.name || '',
        present,
        late,
        absent,
        attendance_pct: total > 0 ? Math.round(((present + late) / total) * 100) : 0,
        days,
      };
    });

    const staffReport =
      reportType === 'monthly'
        ? await buildStaffMonthlyReport(supabase, resolvedSchoolId, rangeStartIso, rangeEndIso, monthCalendarDays)
        : [];

    if (format === 'csv') {
      const rows: Record<string, string | number | null>[] = [];
      for (const s of students || []) {
        const cls = Array.isArray(s.class) ? s.class[0] : s.class as { name?: string } | null;
        for (const dayKey of dayStrings) {
          const arrival = arrivalMap[s.id]?.[dayKey];
          const departure = departureMap[s.id]?.[dayKey];
          const normalized = normalizeArrivalStatus(arrival);
          rows.push({
            entity: 'student',
            date: dayKey,
            student_id_number: s.student_id_number,
            first_name: s.first_name,
            last_name: s.last_name,
            class_name: cls?.name || '',
            status: normalized || 'absent',
            check_in_time: arrival?.timestamp || '',
            check_out_time: departure || '',
            minutes_late: arrival?.minutes_late ?? '',
          });
        }
      }
      for (const staff of staffReport) {
        for (const day of staff.days) {
          rows.push({
            entity: 'staff',
            date: day.date,
            student_id_number: '',
            first_name: staff.full_name,
            last_name: '',
            class_name: staff.role,
            status: day.present ? 'present' : 'absent',
            check_in_time: '',
            check_out_time: '',
            minutes_late: '',
          });
        }
      }
      const label = reportType === 'monthly' && monthLabel ? `monthly_${monthLabel}` : `${reportType}_${dateParam}`;
      return buildCsvResponse(rows, label);
    }

    return NextResponse.json({
      type: reportType,
      month: monthLabel,
      range: { start: rangeStartIso, end: rangeEndIso, start_date: startDateStr, end_date: endDateStr },
      summary: {
        total_students: totalStudents,
        total_days: totalDays,
        school_days: schoolDayStrings.length,
        grand_present: grandPresent,
        grand_late: grandLate,
        grand_absent: grandAbsent,
        attendance_pct: grandTotal > 0
          ? Math.round(((grandPresent + grandLate) / grandTotal) * 100)
          : 0,
        total_staff: staffReport.length,
      },
      daily_summaries: dailySummaries,
      class_breakdown: classBreakdown,
      student_monthly: reportType === 'monthly' ? studentMonthly : undefined,
      staff_report: reportType === 'monthly' ? staffReport : undefined,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed';
    console.error('[attendance/reports]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function buildCsvResponse(rows: Record<string, unknown>[], label: string) {
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
