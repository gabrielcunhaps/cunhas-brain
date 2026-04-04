import { createHash } from 'crypto';

const AUTH_COOKIE = 'cunhas-brain-auth';

function hashValue(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function verifyPassword(password: string): boolean {
  return password === process.env.APP_PASSWORD;
}

export function createAuthCookie(): string {
  const token = hashValue(process.env.APP_PASSWORD! + 'cunhas-brain-salt');
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString();
  return `${AUTH_COOKIE}=${token}; HttpOnly; Secure; Path=/; SameSite=Lax; Expires=${expires}`;
}

export function isAuthenticated(request: Request): boolean {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return false;

  const cookies = Object.fromEntries(
    cookieHeader.split(';').map((c) => {
      const [key, ...rest] = c.trim().split('=');
      return [key, rest.join('=')];
    })
  );

  const token = cookies[AUTH_COOKIE];
  if (!token) return false;

  const expected = hashValue(process.env.APP_PASSWORD! + 'cunhas-brain-salt');
  return token === expected;
}
