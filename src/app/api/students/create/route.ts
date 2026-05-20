import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  try {
    const { school_id, class_id, first_name, last_name, custom_fields } = await request.json();
    const supabase = getAdminClient();

    if (!school_id || !first_name || !last_name) {
      return NextResponse.json({ error: 'school_id, first_name, and last_name are required' }, { status: 400 });
    }

    const studentIdNumber = `STU-${school_id.slice(0, 4).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
    const qrCodeData = `MYEDURIDE:${studentIdNumber}`;

    // If no class_id provided, try to get the first class for this school
    let finalClassId = class_id;
    if (!finalClassId) {
      const { data: firstClass } = await supabase
        .from('school_classes')
        .select('id')
        .eq('school_id', school_id)
        .eq('is_active', true)
        .limit(1)
        .single();
      
      if (firstClass) {
        finalClassId = firstClass.id;
      } else {
        // Create a default class if none exists
        const { data: newClass } = await supabase
          .from('school_classes')
          .insert({ school_id, name: 'General', grade: 'General', sort_order: 0, is_active: true })
          .select()
          .single();
        if (newClass) finalClassId = newClass.id;
      }
    }

    if (!finalClassId) {
      return NextResponse.json({ error: 'Could not assign a class. Create classes first.' }, { status: 400 });
    }

    const { data, error } = await supabase.from('students').insert({
      school_id,
      class_id: finalClassId,
      first_name,
      last_name,
      student_id_number: studentIdNumber,
      qr_code_data: qrCodeData,
      custom_fields: custom_fields || {},
      is_active: true,
    }).select().single();

    if (error) {
      console.error('[STUDENT CREATE] Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, student: data });
  } catch (err: any) {
    console.error('[STUDENT CREATE] Crash:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
