import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    let sql = 'SELECT id, title, date, duration, participants, speakers, (length(raw_content) > 0) as has_transcript FROM meetings';
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (search) {
      conditions.push(`title ILIKE $${paramIdx}`);
      params.push(`%${search}%`);
      paramIdx++;
    }
    if (from) {
      conditions.push(`date >= $${paramIdx}`);
      params.push(from);
      paramIdx++;
    }
    if (to) {
      conditions.push(`date <= $${paramIdx}`);
      params.push(to);
      paramIdx++;
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ` ORDER BY date DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
    params.push(limit, offset);

    const rows = await query(sql, params);

    const meetings = rows.map((row: Record<string, unknown>) => ({
      id: row.id,
      title: row.title,
      date: row.date,
      duration: row.duration || 0,
      participants: row.participants || [],
      speakers: row.speakers || [],
      hasTranscript: row.has_transcript || false,
    }));

    return NextResponse.json(meetings);
  } catch (err) {
    console.error('Error fetching meetings:', err);
    return NextResponse.json({ error: 'Failed to fetch meetings' }, { status: 500 });
  }
}
