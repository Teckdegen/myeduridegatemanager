import type { SupabaseClient } from '@supabase/supabase-js';
import { lagosDayBounds } from '@/lib/timezone';

export type TodayGateStatus = {
  has_arrival: boolean;
  has_departure: boolean;
};

export async function getStudentTodayStatus(
  supabase: SupabaseClient,
  schoolId: string,
  studentId: string
): Promise<TodayGateStatus> {
  const { startIso, endIso } = lagosDayBounds();
  const { data } = await supabase
    .from('attendance_records')
    .select('type')
    .eq('school_id', schoolId)
    .eq('student_id', studentId)
    .gte('timestamp', startIso)
    .lte('timestamp', endIso);

  let has_arrival = false;
  let has_departure = false;
  for (const r of data || []) {
    if (r.type === 'arrival') has_arrival = true;
    if (r.type === 'departure') has_departure = true;
  }
  return { has_arrival, has_departure };
}

export async function getStaffTodayStatus(
  supabase: SupabaseClient,
  schoolId: string,
  userId: string
): Promise<{ has_clock_in: boolean; has_clock_out: boolean }> {
  const { startIso, endIso } = lagosDayBounds();
  const { data } = await supabase
    .from('staff_attendance')
    .select('type')
    .eq('school_id', schoolId)
    .eq('user_id', userId)
    .gte('timestamp', startIso)
    .lte('timestamp', endIso);

  let has_clock_in = false;
  let has_clock_out = false;
  for (const r of data || []) {
    if (r.type === 'clock_in') has_clock_in = true;
    if (r.type === 'clock_out') has_clock_out = true;
  }
  return { has_clock_in, has_clock_out };
}
