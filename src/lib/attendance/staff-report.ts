import type { SupabaseClient } from '@supabase/supabase-js';
import { timestampToLagosDateKey, lagosWeekend } from '@/lib/attendance/lagos-dates';
import type { NonSchoolDay } from '@/lib/attendance/non-school-days';

export type StaffMonthlyRow = {
  user_id: string;
  full_name: string;
  role: string;
  days_present: number;
  days: { date: string; present: boolean; status: 'present' | 'absent' | 'weekend' | 'excluded' }[];
};

export async function buildStaffMonthlyReport(
  supabase: SupabaseClient,
  schoolId: string,
  rangeStartIso: string,
  rangeEndIso: string,
  dayStrings: string[],
  opts?: { staffUserIds?: string[] | null; nonSchoolDays?: Map<string, NonSchoolDay> }
): Promise<StaffMonthlyRow[]> {
  const { data: roles } = await supabase
    .from('user_school_roles')
    .select('user_id, role, user:user_profiles(full_name)')
    .eq('school_id', schoolId)
    .in('role', ['teacher', 'gate_officer', 'school_admin'])
    .eq('is_active', true);

  if (!roles?.length) return [];

  let filteredRoles = roles;
  if (opts?.staffUserIds?.length) {
    const allowed = new Set(opts.staffUserIds);
    filteredRoles = roles.filter((r: { user_id: string }) => allowed.has(r.user_id));
  }
  if (!filteredRoles.length) return [];

  const userIds = filteredRoles.map((r: { user_id: string }) => r.user_id);
  type StaffRow = { user_id: string; type: string; timestamp: string };
  let staffRecords: StaffRow[] | null = null;

  const primary = await supabase
    .from('staff_attendance')
    .select('user_id, type, timestamp, record_source')
    .eq('school_id', schoolId)
    .in('user_id', userIds)
    .eq('type', 'clock_in')
    .eq('record_source', 'admin')
    .gte('timestamp', rangeStartIso)
    .lte('timestamp', rangeEndIso);

  if (primary.error && /record_source/i.test(primary.error.message)) {
    const fallback = await supabase
      .from('staff_attendance')
      .select('user_id, type, timestamp')
      .eq('school_id', schoolId)
      .in('user_id', userIds)
      .eq('type', 'clock_in')
      .gte('timestamp', rangeStartIso)
      .lte('timestamp', rangeEndIso);
    staffRecords = fallback.data;
  } else {
    staffRecords = primary.data;
  }

  const presentByUserDay: Record<string, Record<string, boolean>> = {};
  for (const r of staffRecords || []) {
    const day = timestampToLagosDateKey(r.timestamp);
    if (!presentByUserDay[r.user_id]) presentByUserDay[r.user_id] = {};
    presentByUserDay[r.user_id][day] = true;
  }

  const nonSchool = opts?.nonSchoolDays;

  return filteredRoles.map((r: { user_id: string; role: string; user: unknown }) => {
    const user = Array.isArray(r.user) ? r.user[0] : r.user;
    const days = dayStrings.map((date) => {
      if (lagosWeekend(date)) {
        return { date, present: false, status: 'weekend' as const };
      }
      if (nonSchool?.has(date)) {
        return { date, present: false, status: 'excluded' as const };
      }
      const present = !!presentByUserDay[r.user_id]?.[date];
      return { date, present, status: present ? ('present' as const) : ('absent' as const) };
    });
    return {
      user_id: r.user_id,
      full_name: (user as { full_name?: string })?.full_name || 'Staff',
      role: r.role.replace('_', ' '),
      days_present: days.filter((d) => d.status === 'present').length,
      days,
    };
  });
}
