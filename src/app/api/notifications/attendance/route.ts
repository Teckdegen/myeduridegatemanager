import { NextRequest, NextResponse } from 'next/server';
import { notifyParentsOfAttendance } from '@/lib/notifications/parent-notify';

export async function POST(request: NextRequest) {
  try {
    const { student_id, attendance_record_id, type } = await request.json();

    if (!student_id || !attendance_record_id || !type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const result = await notifyParentsOfAttendance({
      student_id,
      attendance_record_id,
      type: type === 'departure' ? 'departure' : 'arrival',
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Notification error:', error);
    return NextResponse.json({ error: 'Failed to send notification' }, { status: 500 });
  }
}
