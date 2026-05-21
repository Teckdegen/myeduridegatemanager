import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

const PLATFORM_SCHOOL_ID = '00000000-0000-0000-0000-000000000001';

export async function GET(request: NextRequest) {
  try {
    const supabase = getAdminClient();
    
    // Exclude the platform school (used only for super admin role)
    const { data: schools, error } = await supabase
      .from('schools')
      .select('*')
      .neq('id', PLATFORM_SCHOOL_ID)
      .order('name');
      
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const { data: studentCounts } = await supabase.from('students').select('school_id').eq('is_active', true);
    const { data: staffCounts } = await supabase.from('user_school_roles').select('school_id').in('role', ['school_admin', 'teacher', 'gate_officer']).eq('is_active', true);

    const schoolsWithStats = (schools || []).map((school: any) => ({
      ...school,
      student_count: studentCounts?.filter((s: any) => s.school_id === school.id).length || 0,
      staff_count: staffCounts?.filter((s: any) => s.school_id === school.id).length || 0,
    }));

    return NextResponse.json(
      { schools: schoolsWithStats },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate', 'Pragma': 'no-cache' } }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
