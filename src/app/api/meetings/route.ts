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

    const meetings = rows.map((row: Record<string, unknown>) => {
      const rawSpeakers = (typeof row.speakers === 'string' ? JSON.parse(row.speakers) : row.speakers) || [];
      const rawParticipants = (typeof row.participants === 'string' ? JSON.parse(row.participants) : row.participants) || [];
      return {
        id: row.id,
        title: row.title,
        date: row.date ? new Date(row.date as string).toISOString() : new Date().toISOString(),
        duration: row.duration || 0,
        participants: rawParticipants.map((p: unknown) => {
          if (typeof p === 'string') return p;
          if (typeof p === 'object' && p !== null) {
            const o = p as Record<string, unknown>;
            return String(o.name || o.first_name || o.email || 'Unknown');
          }
          return String(p);
        }),
        speakers: rawSpeakers.map((s: Record<string, unknown>) => ({
          name: String(s.name || s.first_name || `Speaker ${s.index || '?'}`),
          index: Number(s.index || 0),
        })),
        hasTranscript: row.has_transcript || false,
      };
    });

    return NextResponse.json(meetings);
  } catch (err) {
    console.error('Error fetching meetings:', err);
    return NextResponse.json({ error: 'Failed to fetch meetings' }, { status: 500 });
  }
}
