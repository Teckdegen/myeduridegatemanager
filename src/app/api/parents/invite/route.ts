import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const { student_id, school_id, parent_email, parent_name, parent_phone, relationship } = await request.json();

    const supabase = createServiceRoleClient();

    // Check if parent already has an account
    const { data: existingUser } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('email', parent_email)
      .single();

    let parentUserId: string;

    if (existingUser) {
      // Parent already exists — just link the student
      parentUserId = existingUser.id;
    } else {
      // Create new user via Supabase Auth (they'll use OTP to login)
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: parent_email,
        email_confirm: true, // Auto-confirm since school admin is adding them
      });

      if (authError || !authUser.user) {
        return NextResponse.json({ error: 'Failed to create parent account' }, { status: 500 });
      }

      parentUserId = authUser.user.id;

      // Create user profile
      await supabase.from('user_profiles').insert({
        id: parentUserId,
        email: parent_email,
        full_name: parent_name,
        phone: parent_phone || null,
      });
    }

    // Assign parent role for this school (if not already assigned)
    const { data: existingRole } = await supabase
      .from('user_school_roles')
      .select('id')
      .eq('user_id', parentUserId)
      .eq('school_id', school_id)
      .eq('role', 'parent')
      .single();

    if (!existingRole) {
      await supabase.from('user_school_roles').insert({
        user_id: parentUserId,
        school_id: school_id,
        role: 'parent',
        is_active: true,
      });
    }

    // Link parent to student
    const { data: existingLink } = await supabase
      .from('student_parents')
      .select('id')
      .eq('student_id', student_id)
      .eq('parent_user_id', parentUserId)
      .single();

    if (!existingLink) {
      await supabase.from('student_parents').insert({
        student_id: student_id,
        parent_user_id: parentUserId,
        relationship: relationship || 'parent',
        is_primary: true,
      });
    }

    // Send welcome email to parent
    const { data: school } = await supabase
      .from('schools')
      .select('name')
      .eq('id', school_id)
      .single();

    const { data: student } = await supabase
      .from('students')
      .select('first_name, last_name')
      .eq('id', student_id)
      .single();

    if (school && student) {
      await resend.emails.send({
        from: 'MyEduRide <notifications@myeduride.com>',
        to: parent_email,
        subject: `Your child ${student.first_name} has been registered at ${school.name}`,
        html: `
          <h2>Welcome to MyEduRide!</h2>
          <p>Hello ${parent_name},</p>
          <p><strong>${student.first_name} ${student.last_name}</strong> has been registered at <strong>${school.name}</strong>.</p>
          <p>You can now access your parent dashboard to:</p>
          <ul>
            <li>See when your child arrives and leaves school</li>
            <li>View attendance history</li>
            <li>Receive real-time notifications</li>
          </ul>
          <p><strong>To login:</strong> Visit <a href="${process.env.NEXT_PUBLIC_APP_URL}">${process.env.NEXT_PUBLIC_APP_URL}</a> and enter your email (${parent_email}). You'll receive a one-time code to access your dashboard.</p>
          <br>
          <p style="color: #666;">— MyEduRide Team</p>
        `,
      });
    }

    return NextResponse.json({ success: true, parentUserId });
  } catch (error) {
    console.error('Parent invite error:', error);
    return NextResponse.json({ error: 'Failed to invite parent' }, { status: 500 });
  }
}
