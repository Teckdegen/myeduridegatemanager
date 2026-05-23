import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSessionFromRequest } from '@/lib/session';
import { lagosDayBounds } from '@/lib/timezone';

/** Gate officer: pickup queue, all students, parent pickup notices for today. */
export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const schoolId = request.nextUrl.searchParams.get('school_id');
    if (!schoolId) {
      return NextResponse.json({ error: 'school_id required' }, { status: 400 });
    }

    const allowed = session.roles.some(
      (r) =>
        r.school_id === schoolId &&
        ['gate_officer', 'school_admin', 'super_admin'].includes(r.role)
    );
    if (!allowed && !session.roles.some((r) => r.role === 'super_admin')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const supabase = getAdminClient();
    const { dateStr, startIso, endIso } = lagosDayBounds();

    const { data: students, error: studListErr } = await supabase
      .from('students')
      .select('id, first_name, last_name, student_id_number, photo_url, qr_code_data, class:school_classes(name)')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .order('last_name');

    if (studListErr) {
      console.error('[gate/dashboard] students:', studListErr.message);
      return NextResponse.json({ error: studListErr.message }, { status: 500 });
    }

    // Ready queue: match Lagos calendar day via dismissal_date OR created_at (fixes UTC date mismatch)
    const { data: pickupQueue, error: queueErr } = await supabase
      .from('dismissal_requests')
      .select(
        `id, status, created_at, notes, dismissal_date,
         student:students(id, first_name, last_name, student_id_number, photo_url, class:school_classes(name))`
      )
      .eq('school_id', schoolId)
      .in('status', ['pending', 'approved'])
      .gte('created_at', startIso)
      .lte('created_at', endIso)
      .order('created_at', { ascending: true });

    if (queueErr) {
      console.error('[gate/dashboard] pickup_queue:', queueErr.message);
      return NextResponse.json({ error: queueErr.message }, { status: 500 });
    }

    const { data: pickupNotices } = await supabase
      .from('pickup_notices')
      .select(
        `*, student:students(id, first_name, last_name, student_id_number),
         parent:user_profiles!parent_user_id(full_name, phone)`
      )
      .eq('school_id', schoolId)
      .eq('notice_date', dateStr)
      .order('created_at', { ascending: false });

    const { data: pickupRequests } = await supabase
      .from('pickup_requests')
      .select(`
        *,
        student:students(id, first_name, last_name, student_id_number, photo_url, class:school_classes(name)),
        parent:user_profiles!parent_user_id(full_name, phone)
      `)
      .eq('school_id', schoolId)
      .eq('request_date', dateStr)
      .order('created_at', { ascending: false });

    const readyStudentIds = (pickupQueue || [])
      .map((q: any) => (Array.isArray(q.student) ? q.student[0]?.id : q.student?.id))
      .filter(Boolean);

    let pickupPersonsByStudent: Record<string, unknown[]> = {};
    if (readyStudentIds.length > 0) {
      const { data: ppLinks } = await supabase
        .from('pickup_person_students')
        .select(`
          student_id,
          pickup_person:pickup_persons(id, name, relationship, phone, photo_url)
        `)
        .in('student_id', readyStudentIds);

      for (const link of ppLinks || []) {
        if (!pickupPersonsByStudent[link.student_id]) {
          pickupPersonsByStudent[link.student_id] = [];
        }
        const person = link.pickup_person as unknown;
        if (person) pickupPersonsByStudent[link.student_id].push(person);
      }
    }

    return NextResponse.json({
      students: students || [],
      pickup_queue: pickupQueue || [],
      pickup_notices: pickupNotices || [],
      pickup_requests: pickupRequests || [],
      pickup_persons_by_student: pickupPersonsByStudent,
      day: dateStr,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load gate data';
    console.error('[gate/dashboard]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
