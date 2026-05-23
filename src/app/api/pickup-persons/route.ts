import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSessionFromRequest } from '@/lib/session';

export const dynamic = 'force-dynamic';

async function notifyStaffPickup(
  supabase: ReturnType<typeof getAdminClient>,
  schoolId: string,
  studentId: string,
  title: string,
  message: string,
  type: 'pickup_person' | 'pickup_request' = 'pickup_person'
) {
  const { data: staffRoles } = await supabase
    .from('user_school_roles')
    .select('user_id')
    .eq('school_id', schoolId)
    .in('role', ['school_admin', 'gate_officer'])
    .eq('is_active', true);

  for (const staff of staffRoles || []) {
    await supabase.from('notifications').insert({
      user_id: staff.user_id,
      school_id: schoolId,
      student_id: studentId,
      title,
      message,
      type,
      is_read: false,
    });
  }
}

/**
 * GET /api/pickup-persons?student_id=xxx
 * Returns all authorised pickup persons for a student (with photos).
 */
export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const studentId = request.nextUrl.searchParams.get('student_id');
    const schoolId = request.nextUrl.searchParams.get('school_id');

    const supabase = getAdminClient();

    if (studentId) {
      const { data, error } = await supabase
        .from('pickup_person_students')
        .select(`
          pickup_person:pickup_persons(id, name, relationship, phone, photo_url, created_at)
        `)
        .eq('student_id', studentId);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      const persons = (data || []).map((r: any) => r.pickup_person).filter(Boolean);
      return NextResponse.json({ pickup_persons: persons });
    }

    if (schoolId) {
      const { data, error } = await supabase
        .from('pickup_persons')
        .select(`
          *,
          students:pickup_person_students(
            student:students(id, first_name, last_name, student_id_number)
          )
        `)
        .eq('school_id', schoolId)
        .order('name');

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ pickup_persons: data || [] });
    }

    return NextResponse.json({ error: 'student_id or school_id required' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/pickup-persons
 * Create a pickup person and link to one or more students.
 * body: { school_id, name, relationship, phone, photo_url, student_ids: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { school_id, name, relationship, phone, photo_url, student_ids } = await request.json();

    if (!school_id || !name?.trim() || !relationship?.trim()) {
      return NextResponse.json({ error: 'school_id, name, relationship required' }, { status: 400 });
    }
    if (!student_ids?.length) {
      return NextResponse.json({ error: 'At least one student_id required' }, { status: 400 });
    }

    const supabase = getAdminClient();

    const isAdmin = session.roles.some(
      (r: { role: string; school_id: string }) =>
        r.role === 'super_admin' || (r.role === 'school_admin' && r.school_id === school_id)
    );
    const isParent = session.roles.some((r: { role: string }) => r.role === 'parent');

    if (!isAdmin && !isParent) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (isParent && !isAdmin) {
      for (const sid of student_ids) {
        const { data: link } = await supabase
          .from('student_parents')
          .select('student_id')
          .eq('student_id', sid)
          .eq('parent_user_id', session.user_id)
          .maybeSingle();
        if (!link) {
          return NextResponse.json({ error: 'You are not linked to one of the selected children' }, { status: 403 });
        }
      }
    }

    const { data: person, error: personErr } = await supabase
      .from('pickup_persons')
      .insert({
        school_id,
        name: name.trim(),
        relationship: relationship.trim(),
        phone: phone?.trim() || null,
        photo_url: photo_url || null,
        created_by: session.user_id,
      })
      .select()
      .single();

    if (personErr) return NextResponse.json({ error: personErr.message }, { status: 500 });

    const links = student_ids.map((sid: string) => ({
      pickup_person_id: person.id,
      student_id: sid,
      school_id,
    }));

    const { error: linkErr } = await supabase.from('pickup_person_students').insert(links);
    if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 500 });

    const { data: student } = await supabase
      .from('students')
      .select('first_name, last_name')
      .eq('id', student_ids[0])
      .single();

    await notifyStaffPickup(
      supabase,
      school_id,
      student_ids[0],
      `New pickup person: ${person.name}`,
      `${person.name} (${person.relationship}) registered for ${student?.first_name || 'student'}${isParent ? ' by parent' : ''}`,
      'pickup_person'
    );

    return NextResponse.json({ success: true, pickup_person: person });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * PUT /api/pickup-persons
 * Update a pickup person.
 */
export async function PUT(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id, school_id, name, relationship, phone, photo_url, student_ids } = await request.json();
    if (!id || !school_id) return NextResponse.json({ error: 'id and school_id required' }, { status: 400 });

    const supabase = getAdminClient();
    const updates: any = {};
    if (name !== undefined) updates.name = name.trim();
    if (relationship !== undefined) updates.relationship = relationship.trim();
    if (phone !== undefined) updates.phone = phone?.trim() || null;
    if (photo_url !== undefined) updates.photo_url = photo_url || null;

    const { data, error } = await supabase
      .from('pickup_persons')
      .update(updates)
      .eq('id', id)
      .eq('school_id', school_id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Update student links if provided
    if (student_ids) {
      await supabase.from('pickup_person_students').delete().eq('pickup_person_id', id);
      if (student_ids.length > 0) {
        const links = student_ids.map((sid: string) => ({
          pickup_person_id: id,
          student_id: sid,
          school_id,
        }));
        await supabase.from('pickup_person_students').insert(links);
      }
    }

    return NextResponse.json({ success: true, pickup_person: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * DELETE /api/pickup-persons?id=xxx&school_id=xxx
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const id = request.nextUrl.searchParams.get('id');
    const schoolId = request.nextUrl.searchParams.get('school_id');
    if (!id || !schoolId) return NextResponse.json({ error: 'id and school_id required' }, { status: 400 });

    const supabase = getAdminClient();
    const { error } = await supabase
      .from('pickup_persons')
      .delete()
      .eq('id', id)
      .eq('school_id', schoolId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
