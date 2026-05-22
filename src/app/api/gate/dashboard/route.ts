import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSessionFromRequest } from '@/lib/session';

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
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' });

    const { data: students } = await supabase
      .from('students')
      .select('id, first_name, last_name, student_id_number, photo_url, qr_code_data, class:school_classes(name)')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .order('last_name');

    const { data: pickupQueue } = await supabase
      .from('dismissal_requests')
      .select(
        `id, status, created_at, notes,
         student:students(id, first_name, last_name, student_id_number, photo_url, class:school_classes(name)),
         requested_by:user_profiles!requested_by_user_id(full_name)`
      )
      .eq('school_id', schoolId)
      .eq('dismissal_date', today)
      .in('status', ['pending', 'approved'])
      .order('created_at', { ascending: true });

    const { data: pickupNotices } = await supabase
      .from('pickup_notices')
      .select(
        `*, student:students(id, first_name, last_name, student_id_number),
         parent:user_profiles!parent_user_id(full_name, phone)`
      )
      .eq('school_id', schoolId)
      .eq('notice_date', today)
      .order('created_at', { ascending: false });

    // Pickup requests for today
    const { data: pickupRequests } = await supabase
      .from('pickup_requests')
      .select(`
        *,
        student:students(id, first_name, last_name, student_id_number, photo_url, class:school_classes(name)),
        parent:user_profiles!parent_user_id(full_name, phone)
      `)
      .eq('school_id', schoolId)
      .eq('request_date', today)
      .order('created_at', { ascending: false });

    // Pickup persons for students in the ready queue
    const readyStudentIds = (pickupQueue || [])
      .map((q: any) => q.student?.id)
      .filter(Boolean);

    let pickupPersonsByStudent: Record<string, any[]> = {};
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
        if (link.pickup_person) {
          pickupPersonsByStudent[link.student_id].push(link.pickup_person);
        }
      }
    }

    return NextResponse.json({
      students: students || [],
      pickup_queue: pickupQueue || [],
      pickup_notices: pickupNotices || [],
      pickup_requests: pickupRequests || [],
      pickup_persons_by_student: pickupPersonsByStudent,
    });
  } catch (err: any) {
    console.error('[gate/dashboard]', err);
    return NextResponse.json({ error: err.message || 'Failed to load gate data' }, { status: 500 });
  }
}
