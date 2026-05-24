import { lagosWeekend } from '@/lib/attendance/lagos-dates';

/** Weekdays only — weekends never count as school days in attendance reports/calendars. */
export function isCountableSchoolDay(
  dateStr: string,
  nonSchoolDays?: ReadonlySet<string> | ReadonlyMap<string, unknown>
): boolean {
  if (lagosWeekend(dateStr)) return false;
  if (nonSchoolDays?.has(dateStr)) return false;
  return true;
}

export function filterCountableSchoolDays(
  dateStrings: string[],
  nonSchoolDays?: ReadonlySet<string> | ReadonlyMap<string, unknown>
): string[] {
  return dateStrings.filter((d) => isCountableSchoolDay(d, nonSchoolDays));
}
