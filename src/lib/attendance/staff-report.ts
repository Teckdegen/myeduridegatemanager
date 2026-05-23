import type { SupabaseClient } from '@supabase/supabase-js';
import { lagosDateStringsInRange, timestampToLagosDateKey } from '@/lib/attendance/lagos-dates';

export type StaffMonthlyRow = {
  user_id: string;
  full_name: string;
  role: string;
  days_present: number;
  days: { date: string; present: boolean }[];
};

export async function buildStaffMonthlyReport(
  supabase: SupabaseClient,
  schoolId: string,
  rangeStartIso: string,
  rangeEndIso: string,
  dayStrings: string[]
): Promise<StaffMonthlyRow[]> {
  const { data: roles } = await supabase
    .from('user_school_roles')
    .select('user_id, role, user:user_profiles(full_name)')
    .eq('school_id', schoolId)
    .in('role', ['teacher', 'gate_officer', 'school_admin'])
    .eq('is_active', true);

  if (!roles?.length) return [];

  const userIds = roles.map((r: { user_id: string }) => r.user_id);
  const { data: staffRecords } = await supabase
    .from('staff_attendance')
    .select('user_id, type, timestamp')
    .eq('school_id', schoolId)
    .in('user_id', userIds)
    .eq('type', 'clock_in')
    .gte('timestamp', rangeStartIso)
    .lte('timestamp', rangeEndIso);

  const presentByUserDay: Record<string, Record<string, boolean>> = {};
  for (const r of staffRecords || []) {
    const day = timestampToLagosDateKey(r.timestamp);
    if (!presentByUserDay[r.user_id]) presentByUserDay[r.user_id] = {};
    presentByUserDay[r.user_id][day] = true;
  }

  return roles.map((r: { user_id: string; role: string; user: unknown }) => {
    const user = Array.isArray(r.user) ? r.user[0] : r.user;
    const days = dayStrings.map((date) => ({
      date,
      present: !!presentByUserDay[r.user_id]?.[date],
    }));
    return {
      user_id: r.user_id,
      full_name: (user as { full_name?: string })?.full_name || 'Staff',
      role: r.role.replace('_', ' '),
      days_present: days.filter((d) => d.present).length,
      days,
    };
  });
}
