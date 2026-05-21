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

    // Auto-invite parent if email provided in custom_fields
    const parentEmail = custom_fields?.parent_email;
    if (parentEmail && parentEmail.includes('@') && data) {
      try {
        // Create parent user + link to student
        const { data: existingUser } = await supabase.from('user_profiles').select('id').eq('email', parentEmail.toLowerCase()).single();
        
        let parentUserId;
        if (existingUser) {
          parentUserId = existingUser.id;
        } else {
          // Create auth user for parent
          const { data: authUser } = await supabase.auth.admin.createUser({ email: parentEmail.toLowerCase(), email_confirm: true });
          if (authUser?.user) {
            parentUserId = authUser.user.id;
            await supabase.from('user_profiles').insert({ id: parentUserId, email: parentEmail.toLowerCase(), full_name: custom_fields?.parent_name || 'Parent', phone: custom_fields?.parent_phone || null });
          }
        }

        if (parentUserId) {
          // Assign parent role
          await supabase.from('user_school_roles').upsert({ user_id: parentUserId, school_id, role: 'parent', is_active: true }, { onConflict: 'user_id,school_id,role' });
          // Link parent to student
          await supabase.from('student_parents').upsert({ student_id: data.id, parent_user_id: parentUserId, relationship: custom_fields?.relationship || 'parent', is_primary: true }, { onConflict: 'student_id,parent_user_id' });
        }
      } catch (parentErr) {
        console.error('[STUDENT CREATE] Parent invite error:', parentErr);
        // Don't fail student creation if parent invite fails
      }
    }

    return NextResponse.json({ success: true, student: data });
  } catch (err: any) {
    console.error('[STUDENT CREATE] Crash:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
