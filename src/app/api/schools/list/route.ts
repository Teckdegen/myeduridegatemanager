import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  try {
    const supabase = getAdminClient();
    const { data: schools, error } = await supabase.from('schools').select('*').order('name');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const { data: studentCounts } = await supabase.from('students').select('school_id').eq('is_active', true);
    const { data: staffCounts } = await supabase.from('user_school_roles').select('school_id').in('role', ['school_admin', 'teacher', 'gate_officer']).eq('is_active', true);

    const schoolsWithStats = (schools || []).map((school: any) => ({
      ...school,
      student_count: studentCounts?.filter((s: any) => s.school_id === school.id).length || 0,
      staff_count: staffCounts?.filter((s: any) => s.school_id === school.id).length || 0,
    }));

    return NextResponse.json({ schools: schoolsWithStats });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
