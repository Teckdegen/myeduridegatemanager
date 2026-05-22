import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSessionFromRequest } from '@/lib/session';

/**
 * POST /api/teacher/extra-lesson
 * body: { student_id, school_id, lesson_end_time?, action: 'add' | 'release' }
 *
 * add     → mark student as staying for extra lesson (not ready for pickup)
 * release → mark extra lesson done → student is now ready for pickup
 */
export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { student_id, school_id, lesson_end_time, action } = await request.json();
    if (!student_id || !school_id || !action) {
      return NextResponse.json({ error: 'student_id, school_id, action required' }, { status: 400 });
    }

    const supabase = getAdminClient();
    const today = new Date().toISOString().split('T')[0];

    if (action === 'add') {
      const { data, error } = await supabase
        .from('extra_lessons')
        .upsert(
          {
            student_id,
            school_id,
            teacher_user_id: session.user_id,
            lesson_end_time: lesson_end_time || null,
            date: today,
            is_released: false,
          },
          { onConflict: 'student_id,date' }
        )
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, extra_lesson: data });
    }

    if (action === 'release') {
      // Mark extra lesson as released
      const { error } = await supabase
        .from('extra_lessons')
        .update({ is_released: true, released_at: new Date().toISOString() })
        .eq('student_id', student_id)
        .eq('date', today);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    console.error('[extra-lesson]', err);
    return NextResponse.json({ error: err.message || 'Failed' }, { status: 500 });
  }
}
