import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSessionFromRequest } from '@/lib/session';
import { notifyParentsOfAttendance } from '@/lib/notifications/parent-notify';

export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    const body = await request.json();
    const {
      student_id,
      school_id: bodySchoolId,
      type,
      verification_method,
      person_type,
      staff_profile_id,
      user_id,
      gate_session_id,
    } = body;

    const supabase = getAdminClient();
    const now = new Date();
    const lateHour = 7;
    const lateMinute = 15;
    const isLate =
      type === 'arrival' &&
      (now.getHours() > lateHour || (now.getHours() === lateHour && now.getMinutes() > lateMinute));

    const verifiedBy = session?.user_id || null;

    // Staff clock-in/out
    if (person_type === 'staff' && staff_profile_id && user_id) {
      let schoolId = bodySchoolId;
      if (!schoolId) {
        const { data: profile } = await supabase
          .from('teacher_profiles')
          .select('school_id')
          .eq('id', staff_profile_id)
          .single();
        schoolId = profile?.school_id;
      }
      if (!schoolId) {
        return NextResponse.json({ error: 'school_id required for staff attendance' }, { status: 400 });
      }

      const staffType = type === 'departure' ? 'clock_out' : 'clock_in';
      const { data, error } = await supabase
        .from('staff_attendance')
        .insert({
          user_id,
          school_id: schoolId,
          gate_session_id: gate_session_id || null,
          type: staffType,
          verification_method: verification_method || 'id_card_scan',
          verified_by_user_id: verifiedBy,
          timestamp: now.toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('[gate/accept] staff_attendance:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, record: data, is_late: false, person_type: 'staff' });
    }

    if (!student_id) {
      return NextResponse.json({ error: 'student_id required' }, { status: 400 });
    }

    if (!type || !['arrival', 'departure'].includes(type)) {
      return NextResponse.json({ error: 'type must be arrival or departure' }, { status: 400 });
    }

    const { data: student, error: studentErr } = await supabase
      .from('students')
      .select('id, school_id, first_name, last_name, is_active')
      .eq('id', student_id)
      .single();

    if (studentErr || !student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    if (!student.is_active) {
      return NextResponse.json({ error: 'Student is inactive' }, { status: 400 });
    }

    const schoolId = bodySchoolId || student.school_id;
    if (!schoolId) {
      return NextResponse.json({ error: 'school_id could not be determined' }, { status: 400 });
    }

    if (student.school_id !== schoolId) {
      return NextResponse.json({ error: 'Student does not belong to this school' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('attendance_records')
      .insert({
        student_id,
        school_id: schoolId,
        gate_session_id: gate_session_id || null,
        type,
        verification_method: verification_method || 'id_card_scan',
        verified_by_user_id: verifiedBy,
        status: type === 'arrival' ? (isLate ? 'late' : 'on_time') : 'on_time',
        source: 'gate',
        timestamp: now.toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('[gate/accept] attendance_records:', error.message, { student_id, schoolId, type });
      return NextResponse.json({ error: `Could not save attendance: ${error.message}` }, { status: 500 });
    }

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
    console.error('[gate/accept] crash:', err);
    return NextResponse.json({ error: err.message || 'Failed to log attendance' }, { status: 500 });
  }
}
