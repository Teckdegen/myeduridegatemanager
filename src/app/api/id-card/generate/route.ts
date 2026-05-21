import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

/**
 * Generates ID card data for a student or teacher.
 * Returns the card info (school name, person name, ID, QR data, etc.)
 * The actual PDF rendering happens client-side with jsPDF.
 */
export async function POST(request: NextRequest) {
  try {
    const { student_id, type } = await request.json(); // type: 'student' or 'teacher'
    const supabase = getAdminClient();

    if (type === 'student' || !type) {
      const { data: student } = await supabase
        .from('students')
        .select('*, school:schools(name, address, logo_url, primary_color), class:school_classes(name)')
        .eq('id', student_id)
        .single();

      if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 });

      return NextResponse.json({
        card: {
          type: 'student',
          school_name: student.school?.name || '',
          school_address: student.school?.address || '',
          school_logo: student.school?.logo_url || '',
          school_color: student.school?.primary_color || '#1B4D3E',
          name: `${student.first_name} ${student.last_name}`,
          id_number: student.student_id_number,
          class_name: student.class?.name || '',
          qr_code_data: student.qr_code_data,
          photo_url: student.photo_url,
          address: student.custom_fields?.address || '',
          dob: student.custom_fields?.date_of_birth || '',
        },
      });
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
