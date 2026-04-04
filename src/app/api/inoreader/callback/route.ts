import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const INOREADER_CLIENT_ID = '1000008407';
const INOREADER_CLIENT_SECRET = '46alqRXIZOq75WhlWXsaPxC5Uz3wGAEE';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const origin = request.headers.get('x-forwarded-host')
    ? `https://${request.headers.get('x-forwarded-host')}`
    : new URL(request.url).origin;

  if (error) {
    await log('error', `Inoreader OAuth error: ${error}`);
    return NextResponse.redirect(new URL('/settings?inoreader=error', origin));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/settings?inoreader=missing_code', origin));
  }

  const redirectUri = `${origin}/api/inoreader/callback`;

  try {
    const body = new URLSearchParams({
      code,
      redirect_uri: redirectUri,
      client_id: INOREADER_CLIENT_ID,
      client_secret: INOREADER_CLIENT_SECRET,
      grant_type: 'authorization_code',
    });

    const tokenRes = await fetch('https://www.inoreader.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    const responseText = await tokenRes.text();
    await log('auth', `Inoreader token exchange: status=${tokenRes.status} redirect=${redirectUri}`, { response: responseText.slice(0, 500) });

    if (!tokenRes.ok) {
      return NextResponse.redirect(new URL(`/settings?inoreader=token_error&detail=${encodeURIComponent(responseText.slice(0, 100))}`, origin));
    }

    const tokenData = JSON.parse(responseText);
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return NextResponse.redirect(new URL('/settings?inoreader=no_token', origin));
    }

    await query(
      `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      ['inoreader_token', accessToken]
    );

    if (tokenData.refresh_token) {
      await query(
        `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
        ['inoreader_refresh_token', tokenData.refresh_token]
      );
    }

    await log('auth', 'Inoreader connected successfully');
    return NextResponse.redirect(new URL('/settings?inoreader=connected', origin));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await log('error', `Inoreader OAuth error: ${msg}`);
    return NextResponse.redirect(new URL(`/settings?inoreader=error&detail=${encodeURIComponent(msg)}`, origin));
  }
}
