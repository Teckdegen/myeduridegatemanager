import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { school_id } = await request.json();
    
    const { createClient } = require('@supabase/supabase-js');
    let url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    url = url.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
    const supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY);

    // Delete in order to respect foreign keys
    // 1. Delete attendance records
    await supabase.from('attendance_records').delete().eq('school_id', school_id);
    await supabase.from('staff_attendance').delete().eq('school_id', school_id);
    // 2. Delete dismissal requests
    await supabase.from('dismissal_requests').delete().eq('school_id', school_id);
    // 3. Delete notifications
    await supabase.from('notifications').delete().eq('school_id', school_id);
    // 4. Delete gate sessions
    await supabase.from('gate_sessions').delete().eq('school_id', school_id);
    // 5. Delete student parents (need student IDs first)
    const { data: students } = await supabase.from('students').select('id').eq('school_id', school_id);
    if (students && students.length > 0) {
      const studentIds = students.map((s: any) => s.id);
      await supabase.from('student_parents').delete().in('student_id', studentIds);
    }
    // 6. Delete students
    await supabase.from('students').delete().eq('school_id', school_id);
    // 7. Delete teacher class assignments
    const { data: teacherProfiles } = await supabase.from('teacher_profiles').select('id').eq('school_id', school_id);
    if (teacherProfiles && teacherProfiles.length > 0) {
      const tpIds = teacherProfiles.map((t: any) => t.id);
      await supabase.from('teacher_class_assignments').delete().in('teacher_profile_id', tpIds);
    }
    // 8. Delete teacher profiles
    await supabase.from('teacher_profiles').delete().eq('school_id', school_id);
    // 9. Delete classes
    await supabase.from('school_classes').delete().eq('school_id', school_id);
    // 10. Delete custom fields
    await supabase.from('school_custom_fields').delete().eq('school_id', school_id);
    // 11. Delete user roles for this school
    await supabase.from('user_school_roles').delete().eq('school_id', school_id);
    // 12. Finally delete the school
    const { error } = await supabase.from('schools').delete().eq('id', school_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
