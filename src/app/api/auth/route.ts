import { NextResponse } from 'next/server';
import { verifyPassword, createAuthCookie, isAuthenticated } from '@/lib/auth';
import { log } from '@/lib/logger';

export async function POST(request: Request) {
  const { password } = await request.json();

  if (!verifyPassword(password)) {
    await log('auth', 'Login failed');
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  }

  await log('auth', 'Login successful');
  const response = NextResponse.json({ success: true });
  response.headers.set('Set-Cookie', createAuthCookie());
  return response;
}

export async function GET(request: Request) {
  const authenticated = isAuthenticated(request);
  return NextResponse.json({ authenticated });
}
