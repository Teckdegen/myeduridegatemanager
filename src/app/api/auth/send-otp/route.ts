import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }

    const supabase = createServiceRoleClient();

    // Check if user exists in our system
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id, full_name')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'No account found with this email.' }, { status: 404 });
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Expire in 10 minutes
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Invalidate any existing unused codes for this email
    await supabase
      .from('otp_codes')
      .update({ used: true })
      .eq('email', email.toLowerCase().trim())
      .eq('used', false);

    // Store new code
    const { error: insertError } = await supabase
      .from('otp_codes')
      .insert({
        email: email.toLowerCase().trim(),
        code,
        expires_at: expiresAt,
        used: false,
      });

    if (insertError) {
      console.error('OTP insert error:', insertError);
      return NextResponse.json({ error: 'Failed to generate code' }, { status: 500 });
    }

    // Send code via Resend
    const { error: emailError } = await resend.emails.send({
      from: 'MyEduRide <noreply@assetid.site>',
      to: email,
      subject: `${code} is your MyEduRide login code`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 400px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <img src="https://www.image2url.com/r2/default/images/1779230378321-292c7b74-6217-41ff-832a-180a535ea4cb.png" alt="MyEduRide" style="height: 48px;" />
          </div>
          <h2 style="text-align: center; color: #1f2937; margin: 0 0 8px;">Your Login Code</h2>
          <p style="text-align: center; color: #6b7280; font-size: 14px; margin: 0 0 24px;">
            Hi ${profile.full_name || 'there'}, use this code to sign in:
          </p>
          <div style="background: #f3f4f6; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1B4D3E; font-family: monospace;">
              ${code}
            </span>
          </div>
          <p style="text-align: center; color: #9ca3af; font-size: 12px; margin: 0;">
            This code expires in 10 minutes. Do not share it with anyone.
          </p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="text-align: center; color: #9ca3af; font-size: 11px;">
            MyEduRide — The Student Safety Platform
          </p>
        </div>
      `,
    });

    if (emailError) {
      console.error('Email send error:', emailError);
      return NextResponse.json({ error: 'Failed to send code. Try again.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Code sent' });
  } catch (error) {
    console.error('Send OTP error:', error);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
