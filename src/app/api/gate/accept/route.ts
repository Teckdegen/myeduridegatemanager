import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { notifyParentsOfAttendance } from '@/lib/notifications/parent-notify';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      student_id,
      school_id,
      type,
      verification_method,
      person_type,
      staff_profile_id,
      user_id,
    } = body;

    const supabase = getAdminClient();
    const now = new Date();
    const lateHour = 7;
    const lateMinute = 15;
    const isLate =
      type === 'arrival' &&
      (now.getHours() > lateHour || (now.getHours() === lateHour && now.getMinutes() > lateMinute));

    // Staff clock-in/out
    if (person_type === 'staff' && staff_profile_id && user_id) {
      const staffType = type === 'departure' ? 'clock_out' : 'clock_in';
      const { data, error } = await supabase
        .from('staff_attendance')
        .insert({
          user_id,
          school_id,
          type: staffType,
          verification_method: verification_method || 'id_card_scan',
          timestamp: now.toISOString(),
        })
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      return NextResponse.json({ success: true, record: data, is_late: false, person_type: 'staff' });
    }

    if (!student_id) {
      return NextResponse.json({ error: 'student_id required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('attendance_records')
      .insert({
        student_id,
        school_id,
        type,
        verification_method: verification_method || 'id_card_scan',
        status: isLate ? 'late' : 'on_time',
        source: 'gate',
        timestamp: now.toISOString(),
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const notifyType = type === 'departure' ? 'departure' : 'arrival';
    const notifyResult = await notifyParentsOfAttendance({
      student_id,
      attendance_record_id: data.id,
      type: notifyType,
    }).catch((err) => {
      console.error('[gate/accept] parent notify failed:', err);
      return { notified: 0, skipped: String(err) };
    });

    return NextResponse.json({
      success: true,
      record: data,
      is_late: isLate,
      parents_notified: notifyResult.notified,
      notify_skipped: notifyResult.skipped,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
