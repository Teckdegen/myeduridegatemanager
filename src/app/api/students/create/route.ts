import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { resolveInitialPassword, validatePasswordPair } from '@/lib/auth/password-policy';
import {
  parentInfoFromCustomFields,
  provisionParentForStudent,
} from '@/lib/school/provision-parent-for-student';
import { uploadBase64Photo } from '@/lib/storage/upload-photo';

export async function POST(request: NextRequest) {
  try {
    const {
      school_id,
      class_id,
      first_name,
      last_name,
      custom_fields,
      photo_base64,
      face_descriptor,
      parent_initial_password,
      parent_confirm_password,
    } = await request.json();
    const supabase = getAdminClient();

    if (!school_id || !first_name || !last_name) {
      return NextResponse.json({ error: 'school_id, first_name, and last_name are required' }, { status: 400 });
    }

    const studentIdNumber = `STU-${school_id.slice(0, 4).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
    const qrCodeData = `MYEDURIDE:${studentIdNumber}`;

    let photoUrl: string | null = null;
    if (photo_base64) {
      const storagePath = `students/${school_id}/${studentIdNumber}.jpg`;
      const { path, error: uploadErr } = await uploadBase64Photo(supabase, storagePath, photo_base64);
      if (uploadErr || !path) {
        return NextResponse.json(
          { error: `Photo could not be saved: ${uploadErr || 'upload failed'}. Ensure the "photos" bucket exists in Supabase Storage.` },
          { status: 500 }
        );
      }
      photoUrl = path;
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

    const parentEmail = custom_fields?.parent_email;
    const parentName = custom_fields?.parent_name;
    const parentPassword = resolveInitialPassword(parent_initial_password);
    if (parent_initial_password) {
      const pwErr = validatePasswordPair(parent_initial_password, parent_confirm_password || '');
      if (pwErr) {
        return NextResponse.json({ error: `Parent password: ${pwErr}` }, { status: 400 });
      }
    }

    if (parentName?.trim() && data) {
      try {
        const onFile = parentInfoFromCustomFields(custom_fields);
        const result = await provisionParentForStudent(supabase, {
          student_id: data.id,
          school_id,
          parent_name: onFile.parent_name || parentName.trim(),
          parent_email: onFile.parent_email,
          parent_phone: onFile.parent_phone,
          relationship: onFile.relationship,
          password: parentPassword || undefined,
        });

        if ('error' in result) {
          console.error('[PARENT] Error:', result.error);
        } else {
          const parentUsername = result.parent_username;
          const generatedPassword = result.password;

          if (parentEmail) {
            try {
              const { Resend } = require('resend');
              const resend = new Resend(process.env.RESEND_API_KEY);
              await resend.emails.send({
                from: 'MyEduRide <noreply@assetid.site>',
                to: parentEmail,
                subject: `Your child ${first_name} has been registered`,
                html: `<div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:20px;"><h2>Welcome to MyEduRide</h2><p>Hello ${parentName || 'Parent'},</p><p>Your child <strong>${first_name} ${last_name}</strong> has been registered at school.</p><p><strong>Username:</strong> ${parentUsername}</p>${generatedPassword ? `<p><strong>Password:</strong> ${generatedPassword}</p>` : ''}<p>Visit the app and sign in with your username and password.</p><p style="color:#666;font-size:12px;">MyEduRide — The Student Safety Platform</p></div>`,
              });
            } catch (emailErr) {
              console.error('[PARENT] Email failed:', emailErr);
            }
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
