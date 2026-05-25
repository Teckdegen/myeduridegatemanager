import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSessionFromRequest } from '@/lib/session';
import { notifyParentsOfAttendance } from '@/lib/notifications/parent-notify';
import {
  isLateAtTimestamp,
  isLateByThreshold,
  minutesAfterThreshold,
  minutesLateAtTimestamp,
  nowUtcIso,
  todayInLagos,
} from '@/lib/timezone';
import {
  getStudentTodayStatus,
  getStaffTodayStatus,
  validateStudentGateAction,
  validateStaffGateAction,
} from '@/lib/gate/daily-limits';

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
      from_ready_queue,
    } = body;

    const supabase = getAdminClient();
    const nowIso = nowUtcIso();

    let lateThreshold = '08:15';
    if (bodySchoolId || student_id) {
      const sid = bodySchoolId || (student_id ? (await supabase.from('students').select('school_id').eq('id', student_id).single()).data?.school_id : null);
      if (sid) {
        const { data: sch } = await supabase.from('schools').select('late_threshold').eq('id', sid).single();
        if (sch?.late_threshold) lateThreshold = sch.late_threshold;
      }
    }

    const isLate = type === 'arrival' && isLateByThreshold(lateThreshold);
    const minutesLate = isLate ? minutesAfterThreshold(lateThreshold) : null;

    const verifiedBy = session?.user_id || null;
    const isAdminScan = session?.roles.some((r) => r.role === 'school_admin') ?? false;

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
      const staffToday = await getStaffTodayStatus(supabase, schoolId, user_id);
      const gateAction = type === 'departure' ? 'departure' : 'arrival';
      const validation = validateStaffGateAction(staffToday, gateAction);
      if (!validation.allowed) {
        return NextResponse.json(
          { error: validation.error, code: validation.code, already_recorded: true },
          { status: validation.code === 'must_check_in_first' ? 403 : 409 }
        );
      }

      const staffRecheck = await getStaffTodayStatus(supabase, schoolId, user_id);
      const revalidate = validateStaffGateAction(staffRecheck, gateAction);
      if (!revalidate.allowed) {
        return NextResponse.json(
          { error: revalidate.error, code: revalidate.code, already_recorded: true },
          { status: 409 }
        );
      }

      const staffIsLate =
        staffType === 'clock_in' && isLateAtTimestamp(nowIso, lateThreshold);
      const staffMinutesLate =
        staffType === 'clock_in' ? minutesLateAtTimestamp(nowIso, lateThreshold) : null;

      const staffPayload: Record<string, unknown> = {
        user_id,
        school_id: schoolId,
        gate_session_id: gate_session_id || null,
        type: staffType,
        verification_method: verification_method || 'id_card_scan',
        verified_by_user_id: verifiedBy,
        timestamp: nowIso,
        record_source: isAdminScan ? 'admin' : 'gate',
      };

      let { data, error } = await supabase
        .from('staff_attendance')
        .insert(staffPayload)
        .select()
        .single();

      if (error && /record_source/i.test(error.message)) {
        const legacy = await supabase
          .from('staff_attendance')
          .insert({
            user_id,
            school_id: schoolId,
            gate_session_id: gate_session_id || null,
            type: staffType,
            verification_method: verification_method || 'id_card_scan',
            verified_by_user_id: verifiedBy,
            timestamp: nowIso,
          })
          .select()
          .single();
        data = legacy.data;
        error = legacy.error;
      }

      if (error) {
        console.error('[gate/accept] staff_attendance:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        record: data,
        is_late: staffIsLate,
        minutes_late: staffMinutesLate,
        person_type: 'staff',
      });
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

    const studentToday = await getStudentTodayStatus(supabase, schoolId, student_id);
    const validation = validateStudentGateAction(studentToday, type);
    if (!validation.allowed) {
      return NextResponse.json(
        { error: validation.error, code: validation.code, already_recorded: true },
        { status: validation.code === 'must_check_in_first' ? 403 : 409 }
      );
    }

    const studentRecheck = await getStudentTodayStatus(supabase, schoolId, student_id);
    const revalidate = validateStudentGateAction(studentRecheck, type);
    if (!revalidate.allowed) {
      return NextResponse.json(
        { error: revalidate.error, code: revalidate.code, already_recorded: true },
        { status: 409 }
      );
    }

    if (type === 'departure' && !from_ready_queue) {
      const today = todayInLagos();
      const { data: readyReq } = await supabase
        .from('dismissal_requests')
        .select('id')
        .eq('student_id', student_id)
        .eq('school_id', schoolId)
        .eq('dismissal_date', today)
        .in('status', ['pending', 'approved'])
        .maybeSingle();

      if (!readyReq) {
        return NextResponse.json(
          { error: 'Release only from Ready for Pickup list — teacher must mark student ready first' },
          { status: 403 }
        );
      }
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
        minutes_late: minutesLate,
        timestamp: nowIso,
      })
      .select()
      .single();

    if (error) {
      console.error('[gate/accept] attendance_records:', error.message, { student_id, schoolId, type });
      return NextResponse.json({ error: `Could not save attendance: ${error.message}` }, { status: 500 });
    }

    if (type === 'departure') {
      const today = todayInLagos();
      const { error: dismissCompleteErr } = await supabase
        .from('dismissal_requests')
        .update({ status: 'completed', completed_at: nowIso })
        .eq('student_id', student_id)
        .eq('school_id', schoolId)
        .eq('dismissal_date', today)
        .in('status', ['pending', 'approved']);

      if (dismissCompleteErr) {
        console.error('[gate/accept] dismissal complete:', dismissCompleteErr.message);
      }
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
