import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

const INOREADER_CLIENT_ID = '1000008407';
const INOREADER_CLIENT_SECRET = '46alqRXIZOq75WhlWXsaPxC5Uz3wGAEE';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(new URL('/settings?inoreader=error', request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/settings?inoreader=missing_code', request.url));
  }

  // Exchange code for access token
  const redirectUri = `${new URL(request.url).origin}/api/inoreader/callback`;

  try {
    const tokenRes = await fetch('https://www.inoreader.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        redirect_uri: redirectUri,
        client_id: INOREADER_CLIENT_ID,
        client_secret: INOREADER_CLIENT_SECRET,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error('Inoreader token exchange failed:', err);
      return NextResponse.redirect(new URL('/settings?inoreader=token_error', request.url));
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return NextResponse.redirect(new URL('/settings?inoreader=no_token', request.url));
    }

    // Save token to app_settings
    await query(
      `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      ['inoreader_token', accessToken]
    );

    // Also save refresh token if provided
    if (tokenData.refresh_token) {
      await query(
        `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
        ['inoreader_refresh_token', tokenData.refresh_token]
      );
    }

    return NextResponse.redirect(new URL('/settings?inoreader=connected', request.url));
  } catch (err) {
    console.error('Inoreader OAuth error:', err);
    return NextResponse.redirect(new URL('/settings?inoreader=error', request.url));
  }
}
