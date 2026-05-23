import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSessionFromRequest, sessionHasRole } from '@/lib/session';

export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const schoolId = request.nextUrl.searchParams.get('school_id');
    if (!schoolId) {
      return NextResponse.json({ error: 'school_id required' }, { status: 400 });
    }

    const isSuperAdmin = sessionHasRole(session, 'super_admin');
    const isSchoolStaff = session.roles.some(
      (r) =>
        r.school_id === schoolId &&
        ['school_admin', 'teacher', 'gate_officer', 'staff'].includes(r.role)
    );

    if (!isSuperAdmin && !isSchoolStaff) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const supabase = getAdminClient();

    const selectWithCustom =
      '*, profile:user_profiles(*), staff_profile:teacher_profiles(staff_id_number, qr_code_data, photo_url, custom_role:school_custom_roles(name, can_assign_class))';

    let roles: Record<string, unknown>[] | null = null;
    const primary = await supabase
      .from('user_school_roles')
      .select(selectWithCustom)
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .in('role', ['school_admin', 'teacher', 'gate_officer', 'staff']);

    if (primary.error && /custom_role|school_custom_roles/i.test(primary.error.message)) {
      const fallback = await supabase
        .from('user_school_roles')
        .select('*, profile:user_profiles(*)')
        .eq('school_id', schoolId)
        .eq('is_active', true)
        .in('role', ['school_admin', 'teacher', 'gate_officer', 'staff']);
      if (fallback.error) {
        return NextResponse.json({ error: fallback.error.message }, { status: 500 });
      }
      roles = fallback.data;
    } else if (primary.error) {
      return NextResponse.json({ error: primary.error.message }, { status: 500 });
    } else {
      roles = primary.data;
    }

    const { data: staffProfiles } = await supabase
      .from('teacher_profiles')
      .select('user_id, staff_id_number, qr_code_data, photo_url, custom_role_id')
      .eq('school_id', schoolId);

    const staff = (roles || []).map((r: Record<string, unknown>) => {
      const embedded = r.staff_profile;
      const prof = Array.isArray(embedded) ? embedded[0] : embedded;
      const legacy =
        staffProfiles?.find((p) => p.user_id === r.user_id) ||
        (prof as { staff_id_number?: string } | undefined);
      const custom = prof
        ? (Array.isArray((prof as { custom_role?: unknown }).custom_role)
            ? (prof as { custom_role: { name?: string }[] }).custom_role[0]
            : (prof as { custom_role?: { name?: string } }).custom_role)
        : null;

      const accessLabel =
        r.role === 'staff' && custom?.name
          ? custom.name
          : String(r.role).replace(/_/g, ' ');

      return {
        ...r,
        job_title: accessLabel,
        staff: prof || legacy || null,
      };
    });

    return NextResponse.json({ staff });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
