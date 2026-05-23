import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureAuthUser, ensureUserProfile } from '@/lib/auth/ensure-user';
import { getSessionFromRequest, sessionHasRole } from '@/lib/session';
import { Resend } from 'resend';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const resend = new Resend(process.env.RESEND_API_KEY);

// Default fields every school starts with (they can modify later)
const DEFAULT_STUDENT_FIELDS = [
  { field_name: 'date_of_birth', field_label: 'Date of Birth', field_type: 'date', is_required: false, sort_order: 0 },
  { field_name: 'gender', field_label: 'Gender', field_type: 'select', options: ['Male', 'Female'], is_required: true, sort_order: 1 },
  { field_name: 'parent_email', field_label: 'Parent Email', field_type: 'email', is_required: true, sort_order: 2 },
  { field_name: 'parent_name', field_label: 'Parent Full Name', field_type: 'text', is_required: true, sort_order: 3 },
  { field_name: 'parent_phone', field_label: 'Parent Phone', field_type: 'phone', is_required: false, sort_order: 4 },
  { field_name: 'relationship', field_label: 'Relationship to Student', field_type: 'select', options: ['Mother', 'Father', 'Guardian'], is_required: true, sort_order: 5 },
];

const DEFAULT_TEACHER_FIELDS = [
  { field_name: 'phone', field_label: 'Phone Number', field_type: 'phone', is_required: false, sort_order: 0 },
  { field_name: 'subject', field_label: 'Subject Taught', field_type: 'text', is_required: false, sort_order: 1 },
  { field_name: 'qualification', field_label: 'Qualification', field_type: 'text', is_required: false, sort_order: 2 },
];

export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session || !sessionHasRole(session, 'super_admin')) {
      return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });
    }

    const { name, address, logo_url, admin_email, admin_name, admin_phone } = await request.json();

    if (!name?.trim() || !admin_email?.trim() || !admin_name?.trim()) {
      return NextResponse.json({ error: 'School name, admin name, and admin email are required' }, { status: 400 });
    }

    const normalizedEmail = admin_email.toLowerCase().trim();
    const supabase = getAdminClient();

    // Create school (setup not completed yet)
    const { data: school, error: schoolError } = await supabase
      .from('schools')
      .insert({
        name: name.trim(),
        address: address || null,
        logo_url: logo_url || null,
        setup_completed: false,
        setup_step: 'classes',
      })
      .select()
      .single();

    if (schoolError || !school) {
      console.error('School insert error:', schoolError);
      return NextResponse.json({ error: 'Failed to create school' }, { status: 500 });
    }

    const rollbackSchool = async () => {
      await supabase.from('schools').delete().eq('id', school.id);
    };

    // Insert default custom fields
    const studentFields = DEFAULT_STUDENT_FIELDS.map(f => ({
      ...f,
      school_id: school.id,
      entity_type: 'student',
      options: f.options || null,
      placeholder: null,
      is_active: true,
    }));

    const teacherFields = DEFAULT_TEACHER_FIELDS.map(f => ({
      ...f,
      school_id: school.id,
      entity_type: 'teacher',
      options: null,
      placeholder: null,
      is_active: true,
    }));

    const { error: fieldsError } = await supabase.from('school_custom_fields').insert([...studentFields, ...teacherFields]);
    if (fieldsError) {
      console.error('Custom fields insert error:', fieldsError);
      await rollbackSchool();
      return NextResponse.json({ error: 'Failed to set up school fields' }, { status: 500 });
    }

    // Resolve or create admin user
    let adminUserId: string;

    const { data: existingProfile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existingProfile) {
      adminUserId = existingProfile.id;
    } else {
      const { userId, error: authErr } = await ensureAuthUser(supabase, normalizedEmail);
      if (!userId) {
        await rollbackSchool();
        return NextResponse.json(
          { error: `Failed to create admin account${authErr ? `: ${authErr}` : ''}` },
          { status: 500 }
        );
      }
      adminUserId = userId;
    }

    const { error: profileError } = await ensureUserProfile(supabase, {
      id: adminUserId,
      email: normalizedEmail,
      full_name: admin_name.trim(),
      phone: admin_phone || null,
    });

    if (profileError) {
      console.error('Profile upsert error:', profileError);
      await rollbackSchool();
      return NextResponse.json({ error: `Failed to save admin profile: ${profileError.message}` }, { status: 500 });
    }

    // Assign school_admin role (skip if already assigned)
    const { data: existingRole } = await supabase
      .from('user_school_roles')
      .select('id')
      .eq('user_id', adminUserId)
      .eq('school_id', school.id)
      .eq('role', 'school_admin')
      .maybeSingle();

    if (!existingRole) {
      const { error: roleError } = await supabase.from('user_school_roles').insert({
        user_id: adminUserId,
        school_id: school.id,
        role: 'school_admin',
        is_active: true,
      });

      if (roleError) {
        console.error('Role insert error:', roleError);
        await rollbackSchool();
        return NextResponse.json({ error: `Failed to assign admin role: ${roleError.message}` }, { status: 500 });
      }
    }

    // Send welcome email
    try {
      await resend.emails.send({
        from: 'MyEduRide <noreply@assetid.site>',
        to: normalizedEmail,
        subject: `Your school "${name}" is ready to set up`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto;">
            <div style="background: #1B4D3E; padding: 20px; text-align: center; border-radius: 12px 12px 0 0;">
              <h2 style="color: white; margin: 0; font-size: 18px;">Welcome to MyEduRide</h2>
            </div>
            <div style="padding: 24px; background: white; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
              <p>Hello ${admin_name},</p>
              <p>Your school <strong>${name}</strong> has been created on MyEduRide Gate Manager.</p>
              <p>When you log in for the first time, you will be guided through a setup wizard to:</p>
              <ul style="color: #374151;">
                <li>Define your classes</li>
                <li>Configure what student/teacher data to collect</li>
                <li>Add your teachers</li>
                <li>Add your students</li>
              </ul>
              <p><strong>To login:</strong> Visit <a href="${process.env.NEXT_PUBLIC_APP_URL}">${process.env.NEXT_PUBLIC_APP_URL}</a> and enter your email (${normalizedEmail}). You will receive a one-time code.</p>
              <br>
              <p style="color: #666; font-size: 12px;">MyEduRide — The Student Safety Platform</p>
            </div>
          </div>
        `,
      });
    } catch (emailErr) {
      console.error('Email send failed:', emailErr);
    }

    return NextResponse.json({
      success: true,
      school_id: school.id,
      school: {
        ...school,
        student_count: 0,
        staff_count: 1,
      },
    });
  } catch (error: any) {
    console.error('School creation error:', error?.message || error);
    const message = error?.message?.includes('SUPABASE')
      ? 'Server configuration error. Check Supabase environment variables.'
      : 'Failed to create school';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
