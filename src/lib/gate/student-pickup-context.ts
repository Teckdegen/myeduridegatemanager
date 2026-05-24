import type { SupabaseClient } from '@supabase/supabase-js';
import { todayInLagos } from '@/lib/timezone';

export type PickupPersonRow = {
  id: string;
  name: string;
  relationship: string;
  phone: string | null;
  photo_url: string | null;
};

export type StudentPickupContext = {
  pickup_notice: Record<string, unknown> | null;
  pickup_request: Record<string, unknown> | null;
  pickup_persons: PickupPersonRow[];
};

function normalizePerson(raw: unknown): PickupPersonRow | null {
  if (!raw) return null;
  const p = Array.isArray(raw) ? raw[0] : raw;
  if (!p || typeof p !== 'object') return null;
  const row = p as PickupPersonRow;
  return row.id ? row : null;
}

function matchPickupPhoto(
  name: string | null | undefined,
  phone: string | null | undefined,
  persons: PickupPersonRow[]
): string | null {
  if (!name && !phone) return null;
  const n = (name || '').trim().toLowerCase();
  const ph = (phone || '').replace(/\s/g, '');
  for (const p of persons) {
    if (n && p.name?.trim().toLowerCase() === n) return p.photo_url;
    if (ph && p.phone && p.phone.replace(/\s/g, '') === ph) return p.photo_url;
  }
  return null;
}

/** Today's pickup notice, request, and authorised persons for gate release UI. */
export async function fetchStudentPickupContext(
  supabase: SupabaseClient,
  schoolId: string,
  studentId: string,
  dateStr?: string
): Promise<StudentPickupContext> {
  const day = dateStr || todayInLagos();

  const { data: ppLinks } = await supabase
    .from('pickup_person_students')
    .select(`
      pickup_person:pickup_persons(id, name, relationship, phone, photo_url)
    `)
    .eq('school_id', schoolId)
    .eq('student_id', studentId);

  const pickup_persons: PickupPersonRow[] = [];
  for (const link of ppLinks || []) {
    const person = normalizePerson(link.pickup_person);
    if (person) pickup_persons.push(person);
  }

  const { data: noticeRow } = await supabase
    .from('pickup_notices')
    .select('*')
    .eq('school_id', schoolId)
    .eq('student_id', studentId)
    .eq('notice_date', day)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: requestRow } = await supabase
    .from('pickup_requests')
    .select('*')
    .eq('school_id', schoolId)
    .eq('student_id', studentId)
    .eq('request_date', day)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let pickup_notice: Record<string, unknown> | null = null;
  if (noticeRow) {
    pickup_notice = {
      ...noticeRow,
      pickup_person_photo:
        matchPickupPhoto(noticeRow.pickup_person_name, noticeRow.pickup_person_phone, pickup_persons) ||
        null,
    };
  }

  let pickup_request: Record<string, unknown> | null = null;
  if (requestRow) {
    pickup_request = {
      ...requestRow,
      pickup_person_photo:
        matchPickupPhoto(requestRow.pickup_person_name, requestRow.pickup_person_phone, pickup_persons) ||
        null,
    };
  }

  return { pickup_notice, pickup_request, pickup_persons };
}
