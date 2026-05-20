import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = (body.email || '').toLowerCase().trim();

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }

    const supabase = getAdminClient();

    const { data: profile, error: profileErr } = await supabase
      .from('user_profiles')
      .select('id, full_name')
      .eq('email', email)
      .single();

    if (profileErr || !profile) {
      return NextResponse.json({ error: 'No account found with this email.' }, { status: 404 });
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Invalidate old codes
    await supabase.from('otp_codes').update({ used: true }).eq('email', email).eq('used', false);

    // Store code
    const { error: insertErr } = await supabase.from('otp_codes').insert({ email, code, expires_at: expiresAt, used: false });

    if (insertErr) {
      return NextResponse.json({ error: 'Failed to generate code.' }, { status: 500 });
    }

    // Send email (don't fail if email doesn't send)
    try {
      await resend.emails.send({
        from: 'MyEduRide <noreply@assetid.site>',
        to: email,
        subject: `${code} is your MyEduRide login code`,
        html: `
          <div style="font-family: -apple-system, sans-serif; max-width: 400px; margin: 0 auto; padding: 20px;">
            <h2 style="text-align: center; color: #1f2937;">Your Login Code</h2>
            <p style="text-align: center; color: #6b7280;">Hi ${profile.full_name || 'there'}, use this code to sign in:</p>
            <div style="background: #f3f4f6; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1B4D3E; font-family: monospace;">${code}</span>
            </div>
            <p style="text-align: center; color: #9ca3af; font-size: 12px;">Expires in 10 minutes.</p>
          </div>
        `,
      });
    } catch (emailErr) {
      console.error('Email failed:', emailErr);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Send OTP error:', err?.message || err);
    return NextResponse.json({ error: 'Server error.' }, { status: 500 });
  }
}
