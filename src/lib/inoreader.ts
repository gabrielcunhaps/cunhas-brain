/**
 * Inoreader API client with automatic token refresh.
 *
 * Inoreader access tokens expire after 86400 seconds (24h). This module
 * handles the OAuth refresh flow transparently so callers don't need to
 * worry about token expiration.
 */

import { query, queryOne } from './db';
import { log } from './logger';

const INOREADER_CLIENT_ID = '1000008407';
const INOREADER_CLIENT_SECRET = '46alqRXIZOq75WhlWXsaPxC5Uz3wGAEE';
const TOKEN_ENDPOINT = 'https://www.inoreader.com/oauth2/token';

export async function getInoreaderToken(): Promise<string | null> {
  const row = await queryOne<{ value: string }>(
    'SELECT value FROM app_settings WHERE key = $1',
    ['inoreader_token']
  );
  return row?.value || null;
}

async function getInoreaderRefreshToken(): Promise<string | null> {
  const row = await queryOne<{ value: string }>(
    'SELECT value FROM app_settings WHERE key = $1',
    ['inoreader_refresh_token']
  );
  return row?.value || null;
}

async function saveTokens(accessToken: string, refreshToken?: string): Promise<void> {
  await query(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
    ['inoreader_token', accessToken]
  );
  if (refreshToken) {
    await query(
      `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      ['inoreader_refresh_token', refreshToken]
    );
  }
}

/**
 * Refresh the Inoreader access token using the stored refresh token.
 * Returns the new access token, or null if refresh failed.
 */
export async function refreshInoreaderToken(): Promise<string | null> {
  const refreshToken = await getInoreaderRefreshToken();
  if (!refreshToken) {
    await log('error', 'Inoreader refresh failed: no refresh token stored');
    return null;
  }

  try {
    const body = new URLSearchParams({
      client_id: INOREADER_CLIENT_ID,
      client_secret: INOREADER_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    const res = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    const responseText = await res.text();

    if (!res.ok) {
      await log('error', `Inoreader refresh failed: ${res.status}`, { response: responseText.slice(0, 300) });
      return null;
    }

    const data = JSON.parse(responseText);
    const newAccessToken = data.access_token;
    const newRefreshToken = data.refresh_token;

    if (!newAccessToken) {
      await log('error', 'Inoreader refresh: no access_token in response', { response: responseText.slice(0, 300) });
      return null;
    }

    await saveTokens(newAccessToken, newRefreshToken);
    await log('auth', 'Inoreader token refreshed successfully');
    return newAccessToken;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await log('error', `Inoreader refresh error: ${msg}`);
    return null;
  }
}

/**
 * Fetch from Inoreader with automatic token refresh on 401.
 * Returns the Response object on success, or throws with a user-facing error.
 */
export async function inoreaderFetch(url: string, init?: RequestInit): Promise<Response> {
  let token = await getInoreaderToken();
  if (!token) {
    throw new Error('Inoreader not connected. Go to Settings to connect.');
  }

  const makeRequest = (t: string) =>
    fetch(url, {
      ...init,
      headers: {
        ...(init?.headers || {}),
        Authorization: `Bearer ${t}`,
      },
    });

  let res = await makeRequest(token);

  // If 401, try refreshing the token once
  if (res.status === 401) {
    await log('auth', 'Inoreader token expired, attempting refresh');
    const newToken = await refreshInoreaderToken();
    if (!newToken) {
      throw new Error('Inoreader token expired and refresh failed. Go to Settings to reconnect.');
    }
    token = newToken;
    res = await makeRequest(newToken);
  }

  return res;
}
