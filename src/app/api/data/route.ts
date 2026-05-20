import { NextRequest, NextResponse } from 'next/server';

/**
 * Generic data API - all dashboard pages fetch through here.
 * Uses service role key to bypass RLS.
 * Validates user session from cookie.
 */
export async function POST(request: NextRequest) {
  try {
    // Validate session cookie
    const sessionCookie = request.cookies.get('myeduride_session')?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    let session: any;
    try {
      session = JSON.parse(sessionCookie);
    } catch {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    if (!session.user_id) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const { action, params } = await request.json();

    // Create supabase client with service role
    const { createClient } = require('@supabase/supabase-js');
    let url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    url = url.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
    const supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY);

    // Route to the correct handler
    switch (action) {
      case 'get_school_admin_data': {
        // Get school for this user
        const { data: role } = await supabase
          .from('user_school_roles')
          .select('school_id')
          .eq('user_id', session.user_id)
          .eq('role', params?.role || 'school_admin')
          .eq('is_active', true)
          .single();

        if (!role) return NextResponse.json({ error: 'No school found' }, { status: 404 });

        const { data: school } = await supabase
          .from('schools')
          .select('*')
          .eq('id', role.school_id)
          .single();

        return NextResponse.json({ school, school_id: role.school_id });
      }

      case 'get_school_dashboard': {
        const schoolId = params?.school_id;
        if (!schoolId) return NextResponse.json({ error: 'school_id required' }, { status: 400 });

        const today = new Date().toISOString().split('T')[0];

        const { count: totalStudents } = await supabase
          .from('students').select('*', { count: 'exact', head: true })
          .eq('school_id', schoolId).eq('is_active', true);

        const { count: totalTeachers } = await supabase
          .from('user_school_roles').select('*', { count: 'exact', head: true })
          .eq('school_id', schoolId).eq('role', 'teacher').eq('is_active', true);

        const { count: totalParents } = await supabase
          .from('user_school_roles').select('*', { count: 'exact', head: true })
          .eq('school_id', schoolId).eq('role', 'parent').eq('is_active', true);

        const { data: todayAttendance } = await supabase
          .from('attendance_records')
          .select('student_id, status')
          .eq('school_id', schoolId).eq('type', 'arrival')
          .gte('timestamp', `${today}T00:00:00`)
          .lte('timestamp', `${today}T23:59:59`);

        const { data: recentActivity } = await supabase
          .from('attendance_records')
          .select('*, student:students(first_name, last_name, class_id, photo_url, student_id_number)')
          .eq('school_id', schoolId)
          .order('timestamp', { ascending: false })
          .limit(10);

        return NextResponse.json({
          total_students: totalStudents || 0,
          total_teachers: totalTeachers || 0,
          total_parents: totalParents || 0,
          present_today: todayAttendance?.length || 0,
          late_today: todayAttendance?.filter((a: any) => a.status === 'late').length || 0,
          absent_today: (totalStudents || 0) - (todayAttendance?.length || 0),
          recent_activity: recentActivity || [],
        });
      }

      case 'get_students': {
        const schoolId = params?.school_id;
        const { data } = await supabase
          .from('students')
          .select('*, class:school_classes(name, grade)')
          .eq('school_id', schoolId)
          .eq('is_active', true)
          .order('last_name');
        return NextResponse.json({ students: data || [] });
      }

      case 'get_classes': {
        const schoolId = params?.school_id;
        const { data } = await supabase
          .from('school_classes')
          .select('*')
          .eq('school_id', schoolId)
          .eq('is_active', true)
          .order('sort_order');
        return NextResponse.json({ classes: data || [] });
      }

      case 'get_custom_fields': {
        const schoolId = params?.school_id;
        const { data } = await supabase
          .from('school_custom_fields')
          .select('*')
          .eq('school_id', schoolId)
          .eq('is_active', true)
          .order('sort_order');
        return NextResponse.json({ fields: data || [] });
      }

      case 'query': {
        // Generic query - table, select, filters
        const { table, select, filters, order, limit: queryLimit } = params;
        let query = supabase.from(table).select(select || '*');
        
        if (filters) {
          for (const [key, value] of Object.entries(filters)) {
            if (value === true || value === false) {
              query = query.eq(key, value);
            } else {
              query = query.eq(key, value as any);
            }
          }
        }
        if (order) query = query.order(order.column || 'created_at', { ascending: order.ascending ?? false });
        if (queryLimit) query = query.limit(queryLimit);

        const { data, error } = await query;
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
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
