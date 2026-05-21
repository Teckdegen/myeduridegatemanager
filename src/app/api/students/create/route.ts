import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureAuthUser, ensureUserProfile } from '@/lib/auth/ensure-user';

export async function POST(request: NextRequest) {
  try {
    const { school_id, class_id, first_name, last_name, custom_fields, photo_base64, face_descriptor } = await request.json();
    const supabase = getAdminClient();

    if (!school_id || !first_name || !last_name) {
      return NextResponse.json({ error: 'school_id, first_name, and last_name are required' }, { status: 400 });
    }

    const studentIdNumber = `STU-${school_id.slice(0, 4).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
    const qrCodeData = `MYEDURIDE:${studentIdNumber}`;

    // Upload photo if provided
    let photoUrl = null;
    if (photo_base64) {
      try {
        const base64Data = photo_base64.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const fileName = `students/${school_id}/${studentIdNumber}.jpg`;
        const { error: uploadErr } = await supabase.storage
          .from('photos')
          .upload(fileName, buffer, { contentType: 'image/jpeg', upsert: true });

        if (!uploadErr) {
          const { data: { publicUrl } } = supabase.storage.from('photos').getPublicUrl(fileName);
          photoUrl = publicUrl;
        } else {
          console.error('[STUDENT CREATE] Photo upload error:', uploadErr.message);
        }
      } catch (photoErr) {
        console.error('[STUDENT CREATE] Photo upload error:', photoErr);
      }
    }

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
      photo_url: photoUrl,
      face_descriptor: face_descriptor || null,
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
        const email = parentEmail.toLowerCase().trim();
        console.log('[PARENT] Registering parent:', email);

        const { data: existingUser } = await supabase.from('user_profiles').select('id').eq('email', email).maybeSingle();

        let parentUserId: string | undefined;
        if (existingUser) {
          parentUserId = existingUser.id;
        } else {
          const { userId } = await ensureAuthUser(supabase, email);
          parentUserId = userId || undefined;
        }

        if (parentUserId) {
          await ensureUserProfile(supabase, {
            id: parentUserId,
            email,
            full_name: custom_fields?.parent_name || 'Parent',
            phone: custom_fields?.parent_phone || null,
          });
        }

        if (parentUserId) {
          // Assign parent role
          const { error: roleErr } = await supabase.from('user_school_roles').upsert({
            user_id: parentUserId, school_id, role: 'parent', is_active: true
          }, { onConflict: 'user_id,school_id,role' });
          console.log('[PARENT] Role assigned, error:', roleErr?.message);

          // Link parent to student
          const { error: linkErr } = await supabase.from('student_parents').upsert({
            student_id: data.id, parent_user_id: parentUserId, relationship: custom_fields?.relationship || 'parent', is_primary: true
          }, { onConflict: 'student_id,parent_user_id' });
          console.log('[PARENT] Linked to student, error:', linkErr?.message);

          // Send welcome email
          try {
            const { Resend } = require('resend');
            const resend = new Resend(process.env.RESEND_API_KEY);
            await resend.emails.send({
              from: 'MyEduRide <noreply@assetid.site>',
              to: email,
              subject: `Your child ${first_name} has been registered`,
              html: `<div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:20px;"><h2>Welcome to MyEduRide</h2><p>Hello ${custom_fields?.parent_name || 'Parent'},</p><p>Your child <strong>${first_name} ${last_name}</strong> has been registered at school.</p><p>You can now log in to view their attendance:</p><p><strong>Email:</strong> ${email}</p><p>Visit the app and enter your email to receive a login code.</p><p style="color:#666;font-size:12px;">MyEduRide — The Student Safety Platform</p></div>`,
            });
            console.log('[PARENT] Welcome email sent');
          } catch (emailErr) {
            console.error('[PARENT] Email failed:', emailErr);
          }
        }
      } catch (parentErr) {
        console.error('[PARENT] Error:', parentErr);
      }
    }

    return NextResponse.json({ success: true, student: data });
  } catch (err: any) {
    console.error('[STUDENT CREATE] Crash:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
