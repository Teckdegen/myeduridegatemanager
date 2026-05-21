import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureAuthUser, ensureUserProfile } from '@/lib/auth/ensure-user';
import { uploadBase64Photo } from '@/lib/storage/upload-photo';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const {
      email,
      full_name,
      phone,
      role,
      school_id,
      class_id,
      custom_fields,
      photo_base64,
      face_descriptor,
      face_photos,
    } = await request.json();

    if (!email?.trim() || !full_name?.trim() || !role || !school_id) {
      return NextResponse.json({ error: 'Email, name, role, and school are required' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const supabase = getAdminClient();

    const { data: existingUser } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
    } else {
      const { userId: authId, error: authErr } = await ensureAuthUser(supabase, normalizedEmail);
      if (!authId) {
        return NextResponse.json(
          { error: `Failed to create user account${authErr ? `: ${authErr}` : ''}` },
          { status: 500 }
        );
      }
      userId = authId;
    }

    const { error: profileError } = await ensureUserProfile(supabase, {
      id: userId,
      email: normalizedEmail,
      full_name: full_name.trim(),
      phone: phone || null,
    });

    if (profileError) {
      return NextResponse.json({ error: `Failed to save user profile: ${profileError.message}` }, { status: 500 });
    }

    // Check if role already exists
    const { data: existingRole } = await supabase
      .from('user_school_roles')
      .select('id')
      .eq('user_id', userId)
      .eq('school_id', school_id)
      .eq('role', role)
      .maybeSingle();

    if (existingRole) {
      return NextResponse.json({ error: 'This person already has this role at this school' }, { status: 400 });
    }

    // Assign role
    const { error: roleError } = await supabase.from('user_school_roles').insert({
      user_id: userId,
      school_id: school_id,
      role,
      is_active: true,
    });

    if (roleError) {
      return NextResponse.json({ error: `Failed to assign role: ${roleError.message}` }, { status: 500 });
    }

    // Staff profile (teacher, gate officer, school admin) — used for ID cards & gate scan
    const staffRoles = ['teacher', 'gate_officer', 'school_admin'];
    if (staffRoles.includes(role)) {
      const staffIdNumber = `STF-${school_id.slice(0, 4).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
      const qrCodeData = `MYEDURIDE:STAFF:${staffIdNumber}`;

      let photoUrl: string | null = null;
      const photoSource = photo_base64 || (Array.isArray(face_photos) && face_photos[0]) || null;
      if (photoSource) {
        const storagePath = `staff/${school_id}/${staffIdNumber}.jpg`;
        const { path, error: uploadErr } = await uploadBase64Photo(supabase, storagePath, photoSource);
        if (uploadErr || !path) {
          return NextResponse.json(
            { error: `Photo could not be saved: ${uploadErr || 'upload failed'}` },
            { status: 500 }
          );
        }
        photoUrl = path;
      }

      const { data: staffProfile, error: staffProfileErr } = await supabase
        .from('teacher_profiles')
        .upsert(
          {
            user_id: userId,
            school_id: school_id,
            staff_id_number: staffIdNumber,
            qr_code_data: qrCodeData,
            photo_url: photoUrl,
            face_descriptor: face_descriptor || null,
            custom_fields: custom_fields || {},
          },
          { onConflict: 'user_id,school_id' }
        )
        .select()
        .single();

      if (staffProfileErr) {
        return NextResponse.json({ error: `Failed to save staff profile: ${staffProfileErr.message}` }, { status: 500 });
      }

      if (role === 'teacher' && class_id && staffProfile) {
        await supabase.from('teacher_class_assignments').upsert(
          {
            teacher_profile_id: staffProfile.id,
            class_id: class_id,
            is_primary: true,
          },
          { onConflict: 'teacher_profile_id,class_id' }
        );
      }
    }

    // Get school name for email
    const { data: school } = await supabase
      .from('schools')
      .select('name')
      .eq('id', school_id)
      .single();

    // Send welcome email
    try {
      await resend.emails.send({
        from: `MyEduRide <noreply@assetid.site>`,
        to: normalizedEmail,
        subject: `You have been added as ${role.replace('_', ' ')} at ${school?.name || 'a school'}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto;">
            <div style="background: #1B4D3E; padding: 20px; text-align: center; border-radius: 12px 12px 0 0;">
              <h2 style="color: white; margin: 0; font-size: 18px;">Welcome to MyEduRide</h2>
            </div>
            <div style="padding: 24px; background: white; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
              <p>Hello ${full_name},</p>
              <p>You have been added as a <strong>${role.replace('_', ' ')}</strong> at <strong>${school?.name || 'your school'}</strong>.</p>
              <p><strong>To login:</strong> Visit <a href="${process.env.NEXT_PUBLIC_APP_URL}">${process.env.NEXT_PUBLIC_APP_URL}</a> and enter your email. You will receive a one-time code.</p>
              <br>
              <p style="color: #666; font-size: 12px;">MyEduRide — The Student Safety Platform</p>
            </div>
          </div>
        `,
      });
    } catch (emailErr) {
      console.error('Email send failed:', emailErr);
    }

    return NextResponse.json({ success: true, userId, role });
  } catch (error) {
    console.error('Staff creation error:', error);
    return NextResponse.json({ error: 'Failed to create staff member' }, { status: 500 });
  }
}
