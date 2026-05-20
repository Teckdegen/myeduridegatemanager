import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  try {
    const { school_id } = await request.json();
    const supabase = getAdminClient();

    // Cascade delete
    await supabase.from('attendance_records').delete().eq('school_id', school_id);
    await supabase.from('staff_attendance').delete().eq('school_id', school_id);
    await supabase.from('dismissal_requests').delete().eq('school_id', school_id);
    await supabase.from('notifications').delete().eq('school_id', school_id);
    await supabase.from('gate_sessions').delete().eq('school_id', school_id);
    const { data: students } = await supabase.from('students').select('id').eq('school_id', school_id);
    if (students?.length) await supabase.from('student_parents').delete().in('student_id', students.map((s: any) => s.id));
    await supabase.from('students').delete().eq('school_id', school_id);
    const { data: tps } = await supabase.from('teacher_profiles').select('id').eq('school_id', school_id);
    if (tps?.length) await supabase.from('teacher_class_assignments').delete().in('teacher_profile_id', tps.map((t: any) => t.id));
    await supabase.from('teacher_profiles').delete().eq('school_id', school_id);
    await supabase.from('school_classes').delete().eq('school_id', school_id);
    await supabase.from('school_custom_fields').delete().eq('school_id', school_id);
    await supabase.from('user_school_roles').delete().eq('school_id', school_id);
    const { error } = await supabase.from('schools').delete().eq('id', school_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
