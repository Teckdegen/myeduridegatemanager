import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { school_id, class_id, first_name, last_name, custom_fields } = await request.json();

    const { createClient } = require('@supabase/supabase-js');
    let url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    url = url.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
    const supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const studentIdNumber = `STU-${school_id.slice(0, 4).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
    const qrCodeData = `MYEDURIDE:${studentIdNumber}`;

    const { data, error } = await supabase.from('students').insert({
      school_id,
      class_id,
      first_name,
      last_name,
      student_id_number: studentIdNumber,
      qr_code_data: qrCodeData,
      custom_fields: custom_fields || {},
      is_active: true,
    }).select().single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // If parent email in custom fields, invite them
    const parentEmail = custom_fields?.parent_email;
    if (parentEmail && parentEmail.includes('@')) {
      // Fire and forget — don't block student creation
      fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/parents/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: data.id,
          school_id,
          parent_email: parentEmail,
          parent_name: custom_fields?.parent_name || 'Parent',
          parent_phone: custom_fields?.parent_phone || '',
          relationship: custom_fields?.relationship || 'parent',
        }),
      }).catch(() => {});
    }

    return NextResponse.json({ success: true, student: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
