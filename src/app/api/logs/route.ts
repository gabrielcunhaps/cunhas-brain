import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || null;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const rows = await query(
      'SELECT * FROM app_logs WHERE ($1::text IS NULL OR type = $1) ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [type, limit, offset]
    );

    return NextResponse.json(rows);
  } catch (err) {
    console.error('Logs API error:', err);
    return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 });
  }
}
