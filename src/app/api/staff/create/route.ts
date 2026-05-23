import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureAuthUser, ensureUserProfile } from '@/lib/auth/ensure-user';
import { uploadBase64Photo } from '@/lib/storage/upload-photo';
import { Resend } from 'resend';
import {
  STAFF_PROFILE_ACCESS_ROLES,
  getCustomRole,
} from '@/lib/staff/custom-roles';

const resend = new Resend(process.env.RESEND_API_KEY);

const SYSTEM_ACCESS_ROLES = new Set(['staff', 'teacher', 'gate_officer', 'school_admin']);

export async function POST(request: NextRequest) {
  try {
    const {
      email,
      full_name,
      phone,
      role,
      school_id,
      class_id,
      custom_role_id,
      custom_fields,
      photo_base64,
      face_descriptor,
      face_photos,
      skip_face,
    } = await request.json();

    const accessRole = role || 'staff';

    if (!email?.trim() || !full_name?.trim() || !accessRole || !school_id) {
      return NextResponse.json({ error: 'Email, name, role, and school are required' }, { status: 400 });
    }

    if (!SYSTEM_ACCESS_ROLES.has(accessRole)) {
      return NextResponse.json({ error: 'Invalid access role' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const supabase = getAdminClient();

    let customRole = null;
    if (accessRole === 'staff') {
      if (!custom_role_id) {
        return NextResponse.json({ error: 'Select a job role (e.g. Accountant, Cleaner)' }, { status: 400 });
      }
      customRole = await getCustomRole(supabase, custom_role_id, school_id);
      if (!customRole) {
        return NextResponse.json({ error: 'Job role not found' }, { status: 400 });
      }
    }

    const mayAssignClass =
      accessRole === 'teacher' || (accessRole === 'staff' && !!customRole?.can_assign_class);

    if (class_id && !mayAssignClass) {
      return NextResponse.json(
        { error: 'This role cannot be assigned to a class — only class teachers need a class' },
        { status: 400 }
      );
    }

    const needsFace = accessRole === 'gate_officer' && !skip_face;
    const hasFace =
      !!photo_base64 || (Array.isArray(face_photos) && face_photos.length >= 3) || skip_face;

    if (needsFace && !hasFace) {
      return NextResponse.json({ error: 'Gate officers need 3 face photos for recognition' }, { status: 400 });
    }

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

    const { data: existingRole } = await supabase
      .from('user_school_roles')
      .select('id')
      .eq('user_id', userId)
      .eq('school_id', school_id)
      .eq('role', accessRole)
      .maybeSingle();

    if (existingRole) {
      return NextResponse.json({ error: 'This person already has this access at this school' }, { status: 400 });
    }

    const { error: roleError } = await supabase.from('user_school_roles').insert({
      user_id: userId,
      school_id: school_id,
      role: accessRole,
      is_active: true,
    });

    if (roleError) {
      return NextResponse.json({ error: `Failed to assign role: ${roleError.message}` }, { status: 500 });
    }

    const roleLabel =
      accessRole === 'staff'
        ? customRole!.name
        : accessRole.replace(/_/g, ' ');

    if (STAFF_PROFILE_ACCESS_ROLES.has(accessRole)) {
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

      const profilePayload: Record<string, unknown> = {
        user_id: userId,
        school_id: school_id,
        staff_id_number: staffIdNumber,
        qr_code_data: qrCodeData,
        photo_url: photoUrl,
        face_descriptor: face_descriptor || null,
        custom_fields: custom_fields || {},
        custom_role_id: accessRole === 'staff' ? custom_role_id : null,
      };

      let { data: staffProfile, error: staffProfileErr } = await supabase
        .from('teacher_profiles')
        .upsert(profilePayload, { onConflict: 'user_id,school_id' })
        .select()
        .single();

      if (staffProfileErr && /custom_role_id/i.test(staffProfileErr.message)) {
        const legacy = { ...profilePayload };
        delete legacy.custom_role_id;
        const retry = await supabase
          .from('teacher_profiles')
          .upsert(legacy, { onConflict: 'user_id,school_id' })
          .select()
          .single();
        staffProfile = retry.data;
        staffProfileErr = retry.error;
      }

      if (staffProfileErr) {
        return NextResponse.json({ error: `Failed to save staff profile: ${staffProfileErr.message}` }, { status: 500 });
      }

      if (mayAssignClass && class_id && staffProfile) {
        await supabase.from('teacher_class_assignments').upsert(
          {
            teacher_profile_id: staffProfile.id,
            class_id: class_id,
            is_primary: true,
          },
          { onConflict: 'teacher_profile_id,class_id' }
        );

        if (accessRole === 'teacher' || customRole?.can_assign_class) {
          await supabase
            .from('school_classes')
            .update({ assigned_teacher_id: staffProfile.id })
            .eq('id', class_id)
            .eq('school_id', school_id);
        }
      }
    }

    const { data: school } = await supabase.from('schools').select('name').eq('id', school_id).single();

    try {
      await resend.emails.send({
        from: `MyEduRide <noreply@assetid.site>`,
        to: normalizedEmail,
        subject: `You have been added as ${roleLabel} at ${school?.name || 'a school'}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto;">
            <div style="background: #1B4D3E; padding: 20px; text-align: center; border-radius: 12px 12px 0 0;">
              <h2 style="color: white; margin: 0; font-size: 18px;">Welcome to MyEduRide</h2>
            </div>
            <div style="padding: 24px; background: white; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
              <p>Hello ${full_name},</p>
              <p>You have been added as <strong>${roleLabel}</strong> at <strong>${school?.name || 'your school'}</strong>.</p>
              <p>Use your staff ID card to sign in and out at the gate. View your attendance from your staff dashboard after login.</p>
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

    return NextResponse.json({ success: true, userId, role: accessRole, job_title: roleLabel });
  } catch (error) {
    console.error('Staff creation error:', error);
    return NextResponse.json({ error: 'Failed to create staff member' }, { status: 500 });
  }
}
