import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSessionFromRequest } from '@/lib/session';
import { isLateByThreshold, minutesAfterThreshold, nowUtcIso } from '@/lib/timezone';

/**
 * POST /api/teacher/scan
 * Teacher marks a student present (arrival) from classroom.
 * Used when a student missed the gate check-in.
 * body: { student_id?, qr_code?, school_id }
 */
export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { student_id, qr_code, school_id } = await request.json();
    if (!school_id) {
      return NextResponse.json({ error: 'school_id required' }, { status: 400 });
    }

    const supabase = getAdminClient();

    // Resolve student
    let resolvedStudentId = student_id;
    if (!resolvedStudentId && qr_code) {
      const { data: s } = await supabase
        .from('students')
        .select('id')
        .eq('qr_code_data', qr_code)
        .eq('school_id', school_id)
        .eq('is_active', true)
        .maybeSingle();
      if (!s) {
        // Try by student_id_number
        const { data: s2 } = await supabase
          .from('students')
          .select('id')
          .eq('student_id_number', qr_code)
          .eq('school_id', school_id)
          .eq('is_active', true)
          .maybeSingle();
        resolvedStudentId = s2?.id;
      } else {
        resolvedStudentId = s.id;
      }
    }

    if (!resolvedStudentId) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    // Get school late threshold
    const { data: school } = await supabase
      .from('schools')
      .select('late_threshold, school_start_time')
      .eq('id', school_id)
      .single();

    const threshold = school?.late_threshold || '08:15';
    const isLate = isLateByThreshold(threshold);
    const minutesLate = isLate ? minutesAfterThreshold(threshold) : null;
    const nowIso = nowUtcIso();

    const { data: record, error } = await supabase
      .from('attendance_records')
      .insert({
        student_id: resolvedStudentId,
        school_id,
        type: 'arrival',
        verification_method: 'teacher_manual',
        verified_by_user_id: session.user_id,
        status: isLate ? 'late' : 'on_time',
        source: 'teacher',
        minutes_late: minutesLate,
        timestamp: nowIso,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, record, is_late: isLate, minutes_late: minutesLate });
  } catch (err: any) {
    console.error('[teacher/scan]', err);
    return NextResponse.json({ error: err.message || 'Failed' }, { status: 500 });
  }
}
