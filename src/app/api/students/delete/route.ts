import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  try {
    const { student_id } = await request.json();
    const supabase = getAdminClient();

    // Delete related records first
    await supabase.from('student_parents').delete().eq('student_id', student_id);
    await supabase.from('attendance_records').delete().eq('student_id', student_id);
    await supabase.from('dismissal_requests').delete().eq('student_id', student_id);
    await supabase.from('notifications').delete().eq('student_id', student_id);
    
    // Delete student
    const { error } = await supabase.from('students').delete().eq('id', student_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
