import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  try {
    const { school_id, class_id, first_name, last_name, custom_fields } = await request.json();
    const supabase = getAdminClient();

    const studentIdNumber = `STU-${school_id.slice(0, 4).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
    const qrCodeData = `MYEDURIDE:${studentIdNumber}`;

    const { data, error } = await supabase.from('students').insert({
      school_id, class_id, first_name, last_name,
      student_id_number: studentIdNumber, qr_code_data: qrCodeData,
      custom_fields: custom_fields || {}, is_active: true,
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, student: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
