import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSessionFromRequest, sessionHasRole } from '@/lib/session';
import { TIME_FIELDS, timeInputToDb } from '@/lib/time-input';

export const dynamic = 'force-dynamic';

const SCHOOL_SELECT =
  'id, name, address, logo_url, primary_color, secondary_color, gate_open_time, school_start_time, late_threshold, gate_close_time, dismissal_start_time, dismissal_end_time, timezone, setup_completed, setup_step';

function canEditSchool(
  session: NonNullable<ReturnType<typeof getSessionFromRequest>>,
  schoolId: string
): boolean {
  if (sessionHasRole(session, 'super_admin')) return true;
  return session.roles.some(
    (r) => r.role === 'school_admin' && r.school_id === schoolId
  );
}

function canViewSchool(
  session: NonNullable<ReturnType<typeof getSessionFromRequest>>,
  schoolId: string
): boolean {
  if (sessionHasRole(session, 'super_admin')) return true;
  return session.roles.some((r) => r.school_id === schoolId);
}

/** GET /api/schools/settings?school_id=xxx */
export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const schoolId = request.nextUrl.searchParams.get('school_id');
    if (!schoolId) {
      return NextResponse.json({ error: 'school_id required' }, { status: 400 });
    }
    if (!canViewSchool(session, schoolId)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from('schools')
      .select(SCHOOL_SELECT)
      .eq('id', schoolId)
      .single();

    if (error) {
      console.error('[schools/settings GET]', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ school: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load settings';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PUT /api/schools/settings
 * body: { school_id, name?, address?, logo_url?, primary_color?, secondary_color?,
 *         gate_open_time?, school_start_time?, late_threshold?, gate_close_time?,
 *         dismissal_start_time?, dismissal_end_time? }
 */
export async function PUT(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await request.json();
    const schoolId = body.school_id as string | undefined;
    if (!schoolId) {
      return NextResponse.json({ error: 'school_id required' }, { status: 400 });
    }

    if (!canEditSchool(session, schoolId)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const updates: Record<string, unknown> = {};

    if (body.name !== undefined) {
      const trimmed = String(body.name).trim();
      if (!trimmed) {
        return NextResponse.json({ error: 'School name is required' }, { status: 400 });
      }
      updates.name = trimmed;
    }
    if (body.address !== undefined) updates.address = body.address?.trim() || null;
    if (body.logo_url !== undefined) updates.logo_url = body.logo_url?.trim() || null;
    if (body.primary_color !== undefined) updates.primary_color = body.primary_color;
    if (body.secondary_color !== undefined) updates.secondary_color = body.secondary_color;

    for (const field of TIME_FIELDS) {
      if (body[field] !== undefined && body[field] !== '') {
        const dbTime = timeInputToDb(body[field]);
        if (dbTime) updates[field] = dbTime;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from('schools')
      .update(updates)
      .eq('id', schoolId)
      .select(SCHOOL_SELECT)
      .single();

    if (error) {
      console.error('[schools/settings PUT]', error.message, updates);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'School not found or update failed' }, { status: 404 });
    }

    return NextResponse.json({ success: true, school: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save settings';
    console.error('[schools/settings PUT]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
