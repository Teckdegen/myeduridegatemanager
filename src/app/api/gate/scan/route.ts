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
    let { data: student } = await supabase
      .from('students')
      .select('*, class:school_classes(name)')
      .eq('qr_code_data', scan_data)
      .eq('is_active', true)
      .single();

    // If not found by QR, try by student_id_number
    if (!student) {
      const { data: byId } = await supabase
        .from('students')
        .select('*, class:school_classes(name)')
        .eq('student_id_number', scan_data)
        .eq('is_active', true)
        .single();
      student = byId;
    }

    // If not found, try staff by qr_code_data or staff_id_number
    if (!student) {
      const { data: staffProfile } = await supabase
        .from('teacher_profiles')
        .select('*, user:user_profiles(full_name, email)')
        .or(`qr_code_data.eq.${scan_data},staff_id_number.eq.${scan_data}`)
        .single();

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
