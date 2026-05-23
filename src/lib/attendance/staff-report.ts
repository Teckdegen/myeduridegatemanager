import type { SupabaseClient } from '@supabase/supabase-js';
import { timestampToLagosDateKey, lagosWeekend } from '@/lib/attendance/lagos-dates';
import type { NonSchoolDay } from '@/lib/attendance/non-school-days';

const STAFF_REPORT_ROLES = ['staff', 'teacher', 'gate_officer', 'school_admin'] as const;
const ALLOWED_SCAN_METHODS = new Set(['id_card_scan', 'face_recognition']);

type StaffRoleRow = { user_id: string; role: string; full_name: string; job_title: string };
type StaffScanRow = { user_id: string; type: string; timestamp: string };

function isCountableStaffScan(row: { verification_method?: string | null }) {
  if (!row.verification_method) return true;
  return ALLOWED_SCAN_METHODS.has(row.verification_method);
}

function roleLabel(role: string) {
  return role.replace(/_/g, ' ');
}

function profileName(user: unknown): string {
  const u = Array.isArray(user) ? user[0] : user;
  return (u as { full_name?: string })?.full_name || 'Staff';
}

async function fetchSchoolStaffRoles(
  supabase: SupabaseClient,
  schoolId: string,
  staffUserIds?: string[] | null
): Promise<StaffRoleRow[]> {
  const selectWithCustom =
    'user_id, role, user:user_profiles(full_name), profile:teacher_profiles(custom_role:school_custom_roles(name))';

  let roles: {
    user_id: string;
    role: string;
    user: unknown;
    profile?: unknown;
  }[] | null = null;

  const primary = await supabase
    .from('user_school_roles')
    .select(selectWithCustom)
    .eq('school_id', schoolId)
    .in('role', [...STAFF_REPORT_ROLES])
    .eq('is_active', true);

  if (primary.error && /custom_role|school_custom_roles|teacher_profiles/i.test(primary.error.message)) {
    const fallback = await supabase
      .from('user_school_roles')
      .select('user_id, role, user:user_profiles(full_name)')
      .eq('school_id', schoolId)
      .in('role', [...STAFF_REPORT_ROLES])
      .eq('is_active', true);
    if (fallback.error) {
      console.warn('[staff-report] roles:', fallback.error.message);
      return [];
    }
    roles = fallback.data;
  } else if (primary.error) {
    console.warn('[staff-report] roles:', primary.error.message);
    return [];
  } else {
    roles = primary.data;
  }

  if (!roles?.length) return [];

  let filtered = roles;
  if (staffUserIds?.length) {
    const allowed = new Set(staffUserIds);
    filtered = roles.filter((r: { user_id: string }) => allowed.has(r.user_id));
  }

  return filtered.map((r) => {
    const prof = Array.isArray(r.profile) ? r.profile[0] : r.profile;
    const custom = prof
      ? (Array.isArray((prof as { custom_role?: unknown }).custom_role)
          ? (prof as { custom_role: { name?: string }[] }).custom_role[0]
          : (prof as { custom_role?: { name?: string } }).custom_role)
      : null;
    const jobTitle =
      r.role === 'staff' && custom?.name
        ? custom.name
        : roleLabel(r.role);

    return {
      user_id: r.user_id,
      role: r.role,
      full_name: profileName(r.user),
      job_title: jobTitle,
    };
  });
}

async function fetchStaffAttendanceScans(
  supabase: SupabaseClient,
  schoolId: string,
  userIds: string[],
  rangeStartIso: string,
  rangeEndIso: string
): Promise<StaffScanRow[]> {
  if (!userIds.length) return [];

  const { data, error } = await supabase
    .from('staff_attendance')
    .select('user_id, type, timestamp, verification_method')
    .eq('school_id', schoolId)
    .in('user_id', userIds)
    .in('type', ['clock_in', 'clock_out'])
    .gte('timestamp', rangeStartIso)
    .lte('timestamp', rangeEndIso)
    .order('timestamp', { ascending: true });

  if (error) {
    console.warn('[staff-report] attendance:', error.message);
    return [];
  }

  return (data || []).filter(isCountableStaffScan);
}

export type StaffMonthlyRow = {
  user_id: string;
  full_name: string;
  role: string;
  days_present: number;
  days: { date: string; present: boolean; status: 'present' | 'absent' | 'weekend' | 'excluded' }[];
};

export type StaffDailyRow = {
  user_id: string;
  full_name: string;
  role: string;
  status: 'present' | 'absent' | 'excluded';
  clock_in_time: string | null;
  clock_out_time: string | null;
};

export async function buildStaffDailyReport(
  supabase: SupabaseClient,
  schoolId: string,
  dayKey: string,
  rangeStartIso: string,
  rangeEndIso: string,
  opts?: { staffUserIds?: string[] | null; excluded?: boolean }
): Promise<StaffDailyRow[]> {
  const roles = await fetchSchoolStaffRoles(supabase, schoolId, opts?.staffUserIds);
  if (!roles.length) return [];

  if (opts?.excluded) {
    return roles.map((r) => ({
      user_id: r.user_id,
      full_name: r.full_name,
      role: roleLabel(r.role),
      status: 'excluded' as const,
      clock_in_time: null,
      clock_out_time: null,
    }));
  }

  const userIds = roles.map((r) => r.user_id);
  const scans = await fetchStaffAttendanceScans(supabase, schoolId, userIds, rangeStartIso, rangeEndIso);

  const clockInByUser: Record<string, string> = {};
  const clockOutByUser: Record<string, string> = {};

  for (const r of scans) {
    if (timestampToLagosDateKey(r.timestamp) !== dayKey) continue;
    if (r.type === 'clock_in' && !clockInByUser[r.user_id]) {
      clockInByUser[r.user_id] = r.timestamp;
    }
    if (r.type === 'clock_out' && !clockOutByUser[r.user_id]) {
      clockOutByUser[r.user_id] = r.timestamp;
    }
  }

  return roles.map((r) => {
    const clockIn = clockInByUser[r.user_id] || null;
    return {
      user_id: r.user_id,
      full_name: r.full_name,
      role: r.job_title,
      status: clockIn ? ('present' as const) : ('absent' as const),
      clock_in_time: clockIn,
      clock_out_time: clockOutByUser[r.user_id] || null,
    };
  });
}

export async function buildStaffMonthlyReport(
  supabase: SupabaseClient,
  schoolId: string,
  rangeStartIso: string,
  rangeEndIso: string,
  dayStrings: string[],
  opts?: { staffUserIds?: string[] | null; nonSchoolDays?: Map<string, NonSchoolDay> }
): Promise<StaffMonthlyRow[]> {
  const roles = await fetchSchoolStaffRoles(supabase, schoolId, opts?.staffUserIds);
  if (!roles.length) return [];

  const userIds = roles.map((r) => r.user_id);
  const scans = await fetchStaffAttendanceScans(supabase, schoolId, userIds, rangeStartIso, rangeEndIso);

  const presentByUserDay: Record<string, Record<string, boolean>> = {};
  for (const r of scans) {
    if (r.type !== 'clock_in') continue;
    const day = timestampToLagosDateKey(r.timestamp);
    if (!presentByUserDay[r.user_id]) presentByUserDay[r.user_id] = {};
    presentByUserDay[r.user_id][day] = true;
  }

  const nonSchool = opts?.nonSchoolDays;

  return roles.map((r) => {
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
      full_name: r.full_name,
      role: r.job_title,
      days_present: days.filter((d) => d.status === 'present').length,
      days,
    };
  });
}
