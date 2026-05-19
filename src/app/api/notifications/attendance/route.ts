import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { Resend } from 'resend';
import { sendPushToUser } from '@/lib/push/send';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const { student_id, attendance_record_id, type } = await request.json();

    const supabase = createServiceRoleClient();

    // Get student info with school branding
    const { data: student } = await supabase
      .from('students')
      .select('*, school:schools(name, logo_url, primary_color, secondary_color)')
      .eq('id', student_id)
      .single();

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    // Get attendance record for timestamp
    const { data: record } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('id', attendance_record_id)
      .single();

    if (!record) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    // Get parent user IDs
    const { data: parentLinks } = await supabase
      .from('student_parents')
      .select('parent_user_id')
      .eq('student_id', student_id);

    if (!parentLinks || parentLinks.length === 0) {
      return NextResponse.json({ message: 'No parents linked' });
    }

    const parentIds = parentLinks.map(l => l.parent_user_id);
    const { data: parents } = await supabase
      .from('user_profiles')
      .select('id, email, full_name')
      .in('id', parentIds);

    if (!parents || parents.length === 0) {
      return NextResponse.json({ message: 'No parent emails found' });
    }

    // Format timestamp
    const timestamp = new Date(record.timestamp);
    const timeStr = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = timestamp.toLocaleDateString();

    // School branding
    const schoolColor = student.school.primary_color || '#1B4D3E';
    const schoolName = student.school.name;

    // Notification content
    const title = type === 'arrival'
      ? `✓ ${student.first_name} arrived at school`
      : `${student.first_name} has left school`;

    const shortMessage = type === 'arrival'
      ? `${student.first_name} arrived at ${schoolName} at ${timeStr}`
      : `${student.first_name} left ${schoolName} at ${timeStr}`;

    // Email HTML with school branding
    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto;">
        <div style="background: ${schoolColor}; padding: 20px; text-align: center; border-radius: 12px 12px 0 0;">
          ${student.school.logo_url ? `<img src="${student.school.logo_url}" alt="${schoolName}" style="height: 40px; margin-bottom: 8px;" />` : ''}
          <h2 style="color: white; margin: 0; font-size: 16px;">${schoolName}</h2>
        </div>
        <div style="padding: 24px; background: white; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <span style="font-size: 48px;">${type === 'arrival' ? '🏫' : '👋'}</span>
          </div>
          <h3 style="text-align: center; color: #1f2937; margin: 0 0 16px;">${title}</h3>
          <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
            <p style="margin: 4px 0; color: #374151;"><strong>Student:</strong> ${student.first_name} ${student.last_name}</p>
            <p style="margin: 4px 0; color: #374151;"><strong>Time:</strong> ${timeStr}</p>
            <p style="margin: 4px 0; color: #374151;"><strong>Date:</strong> ${dateStr}</p>
            <p style="margin: 4px 0; color: #374151;"><strong>Class:</strong> ${student.class_name}</p>
            ${record.status === 'late' ? '<p style="margin: 4px 0; color: #dc2626;"><strong>⚠️ Status:</strong> Arrived Late</p>' : ''}
          </div>
          <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 20px;">
            MyEduRide — The Student Safety Platform
          </p>
        </div>
      </div>
    `;

    for (const parent of parents) {
      // 1. Send EMAIL via Resend
      await resend.emails.send({
        from: `${schoolName} via MyEduRide <notifications@myeduride.com>`,
        to: parent.email,
        subject: title,
        html: emailHtml,
      });

      // 2. Send PUSH notification
      await sendPushToUser(supabase, parent.id, {
        title,
        message: shortMessage,
        type: type as any,
        student_id: student.id,
        url: '/dashboard/parent',
        tag: `attendance-${student.id}-${type}`,
      });

      // 3. Log notification in database
      await supabase.from('notifications').insert({
        user_id: parent.id,
        school_id: student.school_id,
        student_id: student.id,
        title,
        message: shortMessage,
        type,
        is_read: false,
        email_sent: true,
        push_sent: true,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Notification error:', error);
    return NextResponse.json({ error: 'Failed to send notification' }, { status: 500 });
  }
}
