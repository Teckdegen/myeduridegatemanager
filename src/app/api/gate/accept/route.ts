import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { notifyParentsOfAttendance } from '@/lib/notifications/parent-notify';

/**
 * Gate accept API - logs attendance after gate officer accepts
 */
export async function POST(request: NextRequest) {
  try {
    const { student_id, school_id, type, verification_method } = await request.json();
    const supabase = getAdminClient();

    const now = new Date();
    const lateHour = 7;
    const lateMinute = 15;
    const isLate =
      type === 'arrival' &&
      (now.getHours() > lateHour || (now.getHours() === lateHour && now.getMinutes() > lateMinute));

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
