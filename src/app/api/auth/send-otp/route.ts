import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = (body.email || '').toLowerCase().trim();

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }

    // Create supabase client with service role
    const { createClient } = require('@supabase/supabase-js');
    let url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    url = url.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    console.log('[OTP] Supabase URL:', url);
    console.log('[OTP] Service key exists:', !!serviceKey);
    console.log('[OTP] Looking up email:', email);

    const supabase = createClient(url, serviceKey);

    // Check if user exists
    const { data: profile, error: profileErr } = await supabase
      .from('user_profiles')
      .select('id, full_name')
      .eq('email', email)
      .single();

    if (profileErr || !profile) {
      console.error('[OTP] Profile lookup failed:', profileErr?.message || 'not found');
      return NextResponse.json({ error: 'No account found with this email.' }, { status: 404 });
    }

    console.log('[OTP] Profile found:', profile.id, profile.full_name);

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Invalidate old codes
    await supabase
      .from('otp_codes')
      .update({ used: true })
      .eq('email', email)
      .eq('used', false);

    // Store code FIRST (before trying to send email)
    const { error: insertErr } = await supabase
      .from('otp_codes')
      .insert({ email, code, expires_at: expiresAt, used: false });

    if (insertErr) {
      console.error('[OTP] Insert failed:', insertErr.message);
      return NextResponse.json({ error: 'Failed to generate code. Try again.' }, { status: 500 });
    }

    console.log('[OTP] Code stored successfully:', code);

    // Try to send email (don't fail if this doesn't work)
    try {
      await resend.emails.send({
        from: 'MyEduRide <noreply@assetid.site>',
        to: email,
        subject: `${code} is your MyEduRide login code`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 400px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 24px;">
              <img src="https://www.image2url.com/r2/default/images/1779230378321-292c7b74-6217-41ff-832a-180a535ea4cb.png" alt="MyEduRide" style="height: 48px;" />
            </div>
            <h2 style="text-align: center; color: #1f2937;">Your Login Code</h2>
            <p style="text-align: center; color: #6b7280; font-size: 14px;">
              Hi ${profile.full_name || 'there'}, use this code to sign in:
            </p>
            <div style="background: #f3f4f6; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1B4D3E; font-family: monospace;">
                ${code}
              </span>
            </div>
            <p style="text-align: center; color: #9ca3af; font-size: 12px;">
              This code expires in 10 minutes.
            </p>
          </div>
        `,
      });
    } catch (emailErr) {
      // Email failed but code is stored — user can check Supabase table for now
      console.error('Email send failed:', emailErr);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Send OTP crash:', err?.message || err);
    return NextResponse.json({ error: 'Server error. Please try again.' }, { status: 500 });
  }
}
