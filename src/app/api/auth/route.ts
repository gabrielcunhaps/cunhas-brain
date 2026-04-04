import { NextResponse } from 'next/server';
import { verifyPassword, createAuthCookie, isAuthenticated } from '@/lib/auth';

export async function POST(request: Request) {
  const { password } = await request.json();

  if (!verifyPassword(password)) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  }

  const response = NextResponse.json({ success: true });
  response.headers.set('Set-Cookie', createAuthCookie());
  return response;
}

export async function GET(request: Request) {
  const authenticated = isAuthenticated(request);
  return NextResponse.json({ authenticated });
}
