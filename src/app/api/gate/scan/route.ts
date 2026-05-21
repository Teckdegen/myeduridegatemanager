import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

/**
 * Gate scan API - looks up a student or staff by QR code data or student ID number
 * Returns the person's info for the gate officer to accept/reject
 */
export async function POST(request: NextRequest) {
  try {
    const { scan_data, school_id } = await request.json();
    const supabase = getAdminClient();

    if (!scan_data) return NextResponse.json({ error: 'No scan data' }, { status: 400 });

    // Try to find student by QR code
    let studentQuery = supabase
      .from('students')
      .select('*, class:school_classes(name)')
      .eq('qr_code_data', scan_data)
      .eq('is_active', true);
    if (school_id) studentQuery = studentQuery.eq('school_id', school_id);
    let { data: student } = await studentQuery.single();

    if (!student) {
      let byIdQuery = supabase
        .from('students')
        .select('*, class:school_classes(name)')
        .eq('student_id_number', scan_data)
        .eq('is_active', true);
      if (school_id) byIdQuery = byIdQuery.eq('school_id', school_id);
      const { data: byId } = await byIdQuery.single();
      student = byId;
    }

    if (!student) {
      let staffQuery = supabase
        .from('teacher_profiles')
        .select('*, user:user_profiles(full_name, email)')
        .or(`qr_code_data.eq.${scan_data},staff_id_number.eq.${scan_data}`);
      if (school_id) staffQuery = staffQuery.eq('school_id', school_id);
      const { data: staffProfile } = await staffQuery.single();

      if (staffProfile) {
        return NextResponse.json({
          type: 'staff',
          person: {
            id: staffProfile.id,
            user_id: staffProfile.user_id,
            name: staffProfile.user?.full_name || 'Staff',
            email: staffProfile.user?.email || '',
            staff_id: staffProfile.staff_id_number,
          },
        });
      }
    }

    if (!student) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    }

    return NextResponse.json({
      type: 'student',
      person: {
        id: student.id,
        name: `${student.first_name} ${student.last_name}`,
        student_id: student.student_id_number,
        class_name: student.class?.name || '',
        photo_url: student.photo_url,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
