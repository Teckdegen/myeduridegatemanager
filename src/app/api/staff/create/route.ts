import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const { email, full_name, phone, role, school_id, class_id, custom_fields } = await request.json();

    const supabase = createServiceRoleClient();

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('email', email)
      .single();

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
    } else {
      // Create new user via Supabase Auth
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
      });

      if (authError || !authUser.user) {
        return NextResponse.json({ error: 'Failed to create user account' }, { status: 500 });
      }

      userId = authUser.user.id;

      // Create user profile
      await supabase.from('user_profiles').insert({
        id: userId,
        email,
        full_name,
        phone: phone || null,
      });
    }

    // Check if role already exists
    const { data: existingRole } = await supabase
      .from('user_school_roles')
      .select('id')
      .eq('user_id', userId)
      .eq('school_id', school_id)
      .eq('role', role)
      .single();

    if (existingRole) {
      return NextResponse.json({ error: 'This person already has this role at this school' }, { status: 400 });
    }

    // Assign role
    await supabase.from('user_school_roles').insert({
      user_id: userId,
      school_id: school_id,
      role,
      is_active: true,
    });

    // If teacher, create teacher profile with class assignment and custom fields
    if (role === 'teacher') {
      const { data: teacherProfile } = await supabase.from('teacher_profiles').upsert({
        user_id: userId,
        school_id: school_id,
        custom_fields: custom_fields || {},
      }, { onConflict: 'user_id,school_id' }).select().single();

      // Assign to class if provided
      if (class_id && teacherProfile) {
        await supabase.from('teacher_class_assignments').upsert({
          teacher_profile_id: teacherProfile.id,
          class_id: class_id,
          is_primary: true,
        }, { onConflict: 'teacher_profile_id,class_id' });
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
        to: email,
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
      // Don't fail the whole request if email fails
      console.error('Email send failed:', emailErr);
    }

    return NextResponse.json({ success: true, userId });
  } catch (error) {
    console.error('Staff creation error:', error);
    return NextResponse.json({ error: 'Failed to create staff member' }, { status: 500 });
  }
}


