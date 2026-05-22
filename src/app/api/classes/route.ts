import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSessionFromRequest } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** GET /api/classes?school_id=xxx  — list all classes for a school */
export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const schoolId = request.nextUrl.searchParams.get('school_id');
    if (!schoolId) return NextResponse.json({ error: 'school_id required' }, { status: 400 });

    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from('school_classes')
      .select(`
        *,
        assigned_teacher:teacher_profiles!assigned_teacher_id(
          id,
          user:user_profiles(full_name)
        )
      `)
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .order('sort_order')
      .order('name');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Count students per class
    const classIds = (data || []).map((c: any) => c.id);
    let studentCounts: Record<string, number> = {};
    if (classIds.length > 0) {
      const { data: counts } = await supabase
        .from('students')
        .select('class_id')
        .in('class_id', classIds)
        .eq('is_active', true);
      for (const s of counts || []) {
        studentCounts[s.class_id] = (studentCounts[s.class_id] || 0) + 1;
      }
    }

    const enriched = (data || []).map((c: any) => ({
      ...c,
      student_count: studentCounts[c.id] || 0,
    }));

    return NextResponse.json({ classes: enriched });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** POST /api/classes  — create a class */
export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await request.json();
    const { school_id, name, grade, section, assigned_teacher_id, sort_order } = body;

    if (!school_id || !name?.trim() || !grade?.trim()) {
      return NextResponse.json({ error: 'school_id, name, and grade are required' }, { status: 400 });
    }

    // Verify admin access
    const isAdmin = session.roles.some(
      (r: any) => r.school_id === school_id && ['school_admin', 'super_admin'].includes(r.role)
    );
    if (!isAdmin) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from('school_classes')
      .insert({
        school_id,
        name: name.trim(),
        grade: grade.trim(),
        section: section?.trim() || null,
        assigned_teacher_id: assigned_teacher_id || null,
        sort_order: sort_order ?? 0,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'A class with this name already exists' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (assigned_teacher_id && data?.id) {
      await supabase.from('teacher_class_assignments').upsert(
        { teacher_profile_id: assigned_teacher_id, class_id: data.id, is_primary: true },
        { onConflict: 'teacher_profile_id,class_id' }
      );
    }

    return NextResponse.json({ success: true, class: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** PUT /api/classes  — update a class */
export async function PUT(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await request.json();
    const { id, school_id, name, grade, section, assigned_teacher_id, sort_order } = body;

    if (!id || !school_id) {
      return NextResponse.json({ error: 'id and school_id required' }, { status: 400 });
    }

    const isAdmin = session.roles.some(
      (r: any) => r.school_id === school_id && ['school_admin', 'super_admin'].includes(r.role)
    );
    if (!isAdmin) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    const supabase = getAdminClient();
    const updates: any = {};
    if (name !== undefined) updates.name = name.trim();
    if (grade !== undefined) updates.grade = grade.trim();
    if (section !== undefined) updates.section = section?.trim() || null;
    if (assigned_teacher_id !== undefined) updates.assigned_teacher_id = assigned_teacher_id || null;
    if (sort_order !== undefined) updates.sort_order = sort_order;

    const { data, error } = await supabase
      .from('school_classes')
      .update(updates)
      .eq('id', id)
      .eq('school_id', school_id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'A class with this name already exists' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (assigned_teacher_id !== undefined && id) {
      await supabase.from('teacher_class_assignments').delete().eq('class_id', id);
      if (assigned_teacher_id) {
        await supabase.from('teacher_class_assignments').upsert(
          { teacher_profile_id: assigned_teacher_id, class_id: id, is_primary: true },
          { onConflict: 'teacher_profile_id,class_id' }
        );
      }
    }

    return NextResponse.json({ success: true, class: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** DELETE /api/classes?id=xxx&school_id=xxx  — soft-delete a class */
export async function DELETE(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const id = request.nextUrl.searchParams.get('id');
    const schoolId = request.nextUrl.searchParams.get('school_id');

    if (!id || !schoolId) {
      return NextResponse.json({ error: 'id and school_id required' }, { status: 400 });
    }

    const isAdmin = session.roles.some(
      (r: any) => r.school_id === schoolId && ['school_admin', 'super_admin'].includes(r.role)
    );
    if (!isAdmin) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    const supabase = getAdminClient();

    // Check if any active students are in this class
    const { count } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true })
      .eq('class_id', id)
      .eq('is_active', true);

    if ((count || 0) > 0) {
      return NextResponse.json(
        { error: `Cannot delete: ${count} active student(s) are assigned to this class. Reassign them first.` },
        { status: 409 }
      );
    }

    const { error } = await supabase
      .from('school_classes')
      .update({ is_active: false })
      .eq('id', id)
      .eq('school_id', schoolId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
