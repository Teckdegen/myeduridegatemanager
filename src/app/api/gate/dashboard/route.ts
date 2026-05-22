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
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date();
    dayEnd.setHours(23, 59, 59, 999);

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
      .in('status', ['pending', 'approved'])
      .gte('created_at', dayStart.toISOString())
      .lte('created_at', dayEnd.toISOString())
      .order('created_at', { ascending: true });

    const { data: pickupNotices } = await supabase
      .from('pickup_notices')
      .select(
        `*, student:students(id, first_name, last_name, student_id_number),
         parent:user_profiles!parent_user_id(full_name, phone)`
      )
      .eq('school_id', schoolId)
      .eq('notice_date', dayStart.toISOString().split('T')[0])
      .order('created_at', { ascending: false });

    return NextResponse.json({
      students: students || [],
      pickup_queue: pickupQueue || [],
      pickup_notices: pickupNotices || [],
    });
  } catch (err: any) {
    console.error('[gate/dashboard]', err);
    return NextResponse.json({ error: err.message || 'Failed to load gate data' }, { status: 500 });
  }
}
