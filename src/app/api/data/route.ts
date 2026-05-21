import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getUiPresentWindowStart, ATTENDANCE_UI_NOTE } from '@/lib/attendance/window';

export async function POST(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get('myeduride_session')?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    let session: any;
    try {
      let decoded = sessionCookie;
      for (let i = 0; i < 3; i++) {
        try { session = JSON.parse(decoded); break; } catch { decoded = decodeURIComponent(decoded); }
      }
      if (!session) session = JSON.parse(decodeURIComponent(decodeURIComponent(sessionCookie)));
    } catch { return NextResponse.json({ error: 'Invalid session' }, { status: 401 }); }
    if (!session || !session.user_id) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

    const { action, params } = await request.json();
    console.log('[DATA API] action:', action, 'user:', session.user_id);
    
    const supabase = getAdminClient();

    const withTimeout = <T>(promise: PromiseLike<T>, ms = 10000): Promise<T> => {
      return Promise.race([
        Promise.resolve(promise),
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Query timeout')), ms)),
      ]);
    };

    switch (action) {
      case 'get_school_admin_data': {
        const { data: role } = await withTimeout(
          supabase.from('user_school_roles').select('school_id')
            .eq('user_id', session.user_id).eq('role', params?.role || 'school_admin').eq('is_active', true).limit(1).single(),
          8000
        ).catch(() => ({ data: null }));
        if (!role) return NextResponse.json({ error: 'No school found', school: null, school_id: null }, { status: 200 });
        const { data: school } = await withTimeout(supabase.from('schools').select('*').eq('id', role.school_id).single(), 8000).catch(() => ({ data: null }));
        return NextResponse.json({ school, school_id: role.school_id });
      }

      case 'get_school_dashboard': {
        const schoolId = params?.school_id;
        if (!schoolId) return NextResponse.json({ error: 'school_id required' }, { status: 400 });
        const presentSince = getUiPresentWindowStart().toISOString();
        const { count: totalStudents } = await supabase.from('students').select('*', { count: 'exact', head: true }).eq('school_id', schoolId).eq('is_active', true);
        const { count: totalTeachers } = await supabase.from('user_school_roles').select('*', { count: 'exact', head: true }).eq('school_id', schoolId).eq('role', 'teacher').eq('is_active', true);
        const { count: totalParents } = await supabase.from('user_school_roles').select('*', { count: 'exact', head: true }).eq('school_id', schoolId).eq('role', 'parent').eq('is_active', true);
        const { data: liveAttendance } = await supabase
          .from('attendance_records')
          .select('student_id, status')
          .eq('school_id', schoolId)
          .eq('type', 'arrival')
          .gte('timestamp', presentSince);
        const uniquePresent = new Set((liveAttendance || []).map((a: { student_id: string }) => a.student_id));
        const { data: recentActivity } = await supabase
          .from('attendance_records')
          .select('*, student:students(first_name, last_name, photo_url, student_id_number)')
          .eq('school_id', schoolId)
          .order('timestamp', { ascending: false })
          .limit(10);
        return NextResponse.json({
          total_students: totalStudents || 0,
          total_teachers: totalTeachers || 0,
          total_parents: totalParents || 0,
          present_today: uniquePresent.size,
          late_today: liveAttendance?.filter((a: { status: string }) => a.status === 'late').length || 0,
          absent_today: Math.max(0, (totalStudents || 0) - uniquePresent.size),
          recent_activity: recentActivity || [],
          attendance_ui_note: ATTENDANCE_UI_NOTE,
        });
      }

      case 'get_teacher_dashboard': {
        const { data: role } = await supabase
          .from('user_school_roles')
          .select('school_id')
          .eq('user_id', session.user_id)
          .eq('role', 'teacher')
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();

        if (!role?.school_id) {
          return NextResponse.json({ error: 'No teacher school', students: [], present_count: 0, absent_count: 0 });
        }

        const schoolId = role.school_id;
        const { data: school } = await supabase.from('schools').select('name').eq('id', schoolId).single();

        const { data: teacherProfile } = await supabase
          .from('teacher_profiles')
          .select('id')
          .eq('user_id', session.user_id)
          .eq('school_id', schoolId)
          .maybeSingle();

        let classIds: string[] = [];
        if (teacherProfile?.id) {
          const { data: assignments } = await supabase
            .from('teacher_class_assignments')
            .select('class_id')
            .eq('teacher_profile_id', teacherProfile.id);
          classIds = (assignments || []).map((a: { class_id: string }) => a.class_id);
        }

        let studentsQuery = supabase
          .from('students')
          .select('*, class:school_classes(name, grade)')
          .eq('school_id', schoolId)
          .eq('is_active', true)
          .order('last_name');

        if (classIds.length > 0) {
          studentsQuery = studentsQuery.in('class_id', classIds);
        }

        const { data: students } = await studentsQuery;

        const presentSince = getUiPresentWindowStart().toISOString();

        const studentIds = (students || []).map((s: { id: string }) => s.id);
        let arrivals: { student_id: string; status: string; timestamp: string; type: string }[] = [];

        if (studentIds.length > 0) {
          const { data: records } = await supabase
            .from('attendance_records')
            .select('student_id, status, timestamp, type')
            .eq('school_id', schoolId)
            .in('student_id', studentIds)
            .gte('timestamp', presentSince)
            .order('timestamp', { ascending: false });

          const seen = new Set<string>();
          for (const r of records || []) {
            if (r.type === 'arrival' && !seen.has(r.student_id)) {
              seen.add(r.student_id);
              arrivals.push(r);
            }
          }
        }

        const arrivalMap = new Map(arrivals.map((a) => [a.student_id, a]));

        const enriched = (students || []).map((s: { id: string }) => {
          const arrival = arrivalMap.get(s.id);
          return {
            ...s,
            present: !!arrival,
            late: arrival?.status === 'late',
            arrival_time: arrival?.timestamp || null,
          };
        });

        return NextResponse.json({
          school_id: schoolId,
          school,
          class_ids: classIds,
          students: enriched,
          present_count: enriched.filter((s: { present: boolean }) => s.present).length,
          absent_count: enriched.filter((s: { present: boolean }) => !s.present).length,
          late_count: enriched.filter((s: { late: boolean }) => s.late).length,
          attendance_ui_note: ATTENDANCE_UI_NOTE,
        });
      }

      case 'get_students': {
        const { data } = await supabase.from('students').select('*, class:school_classes(name, grade)').eq('school_id', params?.school_id).eq('is_active', true).order('last_name');
        return NextResponse.json({ students: data || [] });
      }

      case 'get_classes': {
        const { data } = await supabase.from('school_classes').select('*').eq('school_id', params?.school_id).eq('is_active', true).order('sort_order');
        return NextResponse.json({ classes: data || [] });
      }

      case 'get_custom_fields': {
        const { data } = await supabase.from('school_custom_fields').select('*').eq('school_id', params?.school_id).eq('is_active', true).order('sort_order');
        return NextResponse.json({ fields: data || [] });
      }

      case 'get_parent_children': {
        const { data: links } = await supabase
          .from('student_parents')
          .select('student_id, relationship, is_primary')
          .eq('parent_user_id', session.user_id);

        if (!links?.length) {
          return NextResponse.json({ children: [] });
        }

        const ids = links.map((l: any) => l.student_id);
        const { data: students } = await supabase
          .from('students')
          .select('*, class:school_classes(name, grade), school:schools(name, primary_color, logo_url)')
          .in('id', ids)
          .eq('is_active', true);

        const children = (students || []).map((s: any) => ({
          ...s,
          relationship: links.find((l: any) => l.student_id === s.id)?.relationship || 'parent',
        }));

        return NextResponse.json({ children });
      }

      case 'get_parent_notifications': {
        const { data, error } = await supabase
          .from('notifications')
          .select('*, student:students(first_name, last_name)')
          .eq('user_id', session.user_id)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) {
          return NextResponse.json({ notifications: [], error: error.message });
        }
        return NextResponse.json({ notifications: data || [] });
      }

      case 'mark_notification_read': {
        const notificationId = params?.notification_id;
        if (!notificationId) {
          return NextResponse.json({ error: 'notification_id required' }, { status: 400 });
        }
        await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('id', notificationId)
          .eq('user_id', session.user_id);
        return NextResponse.json({ success: true });
      }

      case 'query': {
        const { table, select, filters, order, limit: queryLimit } = params;
        console.log('[DATA API] query table:', table, 'filters:', filters);
        let query = supabase.from(table).select(select || '*');
        if (filters) {
          for (const [key, value] of Object.entries(filters)) {
            query = query.eq(key, value);
          }
        }
        if (order) query = query.order(order.column || 'created_at', { ascending: order.ascending ?? false });
        if (queryLimit) query = query.limit(queryLimit);
        
        const { data, error } = await withTimeout(query, 8000).catch((e: any) => ({ data: null, error: { message: e.message } }));
        if (error) {
          console.error('[DATA API] query error:', error);
          return NextResponse.json({ error: error.message, data: [] }, { status: 200 });
        }
        return NextResponse.json({ data: data || [] });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (err: any) {
    console.error('Data API error:', err?.message || err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
