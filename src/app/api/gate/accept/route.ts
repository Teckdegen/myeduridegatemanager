import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

/**
 * Gate accept API - logs attendance after gate officer accepts
 */
export async function POST(request: NextRequest) {
  try {
    const { student_id, school_id, type, verification_method } = await request.json();
    const supabase = getAdminClient();

    const now = new Date();
    
    // Determine if late (after 7:15 AM)
    const lateHour = 7;
    const lateMinute = 15;
    const isLate = type === 'arrival' && (now.getHours() > lateHour || (now.getHours() === lateHour && now.getMinutes() > lateMinute));

    const { data, error } = await supabase.from('attendance_records').insert({
      student_id,
      school_id,
      type,
      verification_method: verification_method || 'id_card_scan',
      status: isLate ? 'late' : 'on_time',
      source: 'gate',
      timestamp: now.toISOString(),
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Send notification to parent (fire and forget)
    try {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/notifications/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id, attendance_record_id: data.id, type }),
      });
    } catch {}

    return NextResponse.json({ success: true, record: data, is_late: isLate });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
