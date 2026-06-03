import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { validatePasswordPair } from '@/lib/auth/password-policy';
import {
  parentInfoFromCustomFields,
  provisionParentForStudent,
} from '@/lib/school/provision-parent-for-student';
import { getSessionFromRequest } from '@/lib/session';

export async function POST(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session?.user_id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const schoolIds = Array.from(
    new Set(
      (session.roles || [])
        .filter((r) => r.role === 'school_admin')
        .map((r) => r.school_id)
        .filter(Boolean)
    )
  );

  if (schoolIds.length === 0) {
    return NextResponse.json({ error: 'School admin access required' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const studentId = (body.student_id || '').trim();
    const password = (body.password || '').trim();
    const confirmPassword = (body.confirm_password || password).trim();

    if (!studentId) {
      return NextResponse.json({ error: 'student_id is required' }, { status: 400 });
    }

    const pwErr = validatePasswordPair(password, confirmPassword);
    if (pwErr) {
      return NextResponse.json({ error: pwErr }, { status: 400 });
    }

    const supabase = getAdminClient();
    const { data: student, error: studErr } = await supabase
      .from('students')
      .select('id, school_id, custom_fields')
      .eq('id', studentId)
      .maybeSingle();

    if (studErr || !student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    if (!schoolIds.includes(student.school_id)) {
      return NextResponse.json({ error: 'Student is not in your school' }, { status: 403 });
    }

    const onFile = parentInfoFromCustomFields(
      student.custom_fields as Record<string, string> | null
    );
    if (!onFile.parent_name) {
      return NextResponse.json(
        { error: 'Add parent name on the student record first (Students → edit student)' },
        { status: 400 }
      );
    }

    const result = await provisionParentForStudent(supabase, {
      student_id: studentId,
      school_id: student.school_id,
      parent_name: onFile.parent_name,
      parent_email: onFile.parent_email,
      parent_phone: onFile.parent_phone,
      relationship: onFile.relationship,
      password,
    });

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      parent_user_id: result.parent_user_id,
      parent_username: result.parent_username,
      password: result.password,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Could not create parent login';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
