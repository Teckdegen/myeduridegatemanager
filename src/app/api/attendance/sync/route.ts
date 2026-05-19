import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { records } = await request.json();

    if (!records || records.length === 0) {
      return NextResponse.json({ message: 'No records to sync' });
    }

    const supabase = createServiceRoleClient();

    // Insert all offline attendance records
    const { error } = await supabase
      .from('attendance_records')
      .insert(
        records.map((r: any) => ({
          student_id: r.student_id,
          school_id: r.school_id,
          type: r.type,
          verification_method: r.verification_method,
          timestamp: r.timestamp,
          status: 'on_time', // Will be recalculated
          notes: 'Synced from offline',
        }))
      );

    if (error) {
      return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true, synced: records.length });
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}
