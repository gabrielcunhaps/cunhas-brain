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
    const category = searchParams.get('category');
    const variable = searchParams.get('variable');
    const hasTodosParam = searchParams.get('hasTodos');
    const hasTodos = hasTodosParam === 'true';

    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (search) {
      conditions.push(`m.title ILIKE $${paramIdx}`);
      params.push(`%${search}%`);
      paramIdx++;
    }
    if (from) {
      conditions.push(`m.date >= $${paramIdx}`);
      params.push(from);
      paramIdx++;
    }
    if (to) {
      conditions.push(`m.date <= $${paramIdx}`);
      params.push(to);
      paramIdx++;
    }
    if (category) {
      conditions.push(`ms.category = $${paramIdx}`);
      params.push(category);
      paramIdx++;
    }

    // Placeholder index for variable subquery (used in SELECT and WHERE)
    let variableParamIdx: number | null = null;
    if (variable) {
      variableParamIdx = paramIdx;
      params.push(variable);
      paramIdx++;
      conditions.push(
        `EXISTS (SELECT 1 FROM meeting_metadata mm WHERE mm.meeting_id = m.id AND mm.variable = $${variableParamIdx})`
      );
    }

    if (hasTodos) {
      conditions.push(
        `((ms.action_items IS NOT NULL AND jsonb_array_length(ms.action_items) > 0)
          OR EXISTS (SELECT 1 FROM meeting_metadata mm WHERE mm.meeting_id = m.id AND mm.variable = 'todo'))`
      );
    }

    const matchCountSelect = variableParamIdx
      ? `(SELECT COUNT(*) FROM meeting_metadata mm WHERE mm.meeting_id = m.id AND mm.variable = $${variableParamIdx})::int as match_count`
      : `0::int as match_count`;

    let sql = `
      SELECT m.id, m.title, m.date, m.duration, m.participants, m.speakers,
             (length(m.raw_content) > 0) as has_transcript,
             ms.category, ms.category_confidence, ms.category_manual,
             ${matchCountSelect}
        FROM meetings m
        LEFT JOIN meeting_summaries ms ON ms.meeting_id = m.id`;

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ` ORDER BY m.date DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
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
        category: (row.category as string) || null,
        categoryConfidence: row.category_confidence ?? null,
        categoryManual: row.category_manual ?? false,
        matchCount: Number(row.match_count || 0),
      };
    });

    return NextResponse.json(meetings);
  } catch (err) {
    console.error('Error fetching meetings:', err);
    return NextResponse.json({ error: 'Failed to fetch meetings' }, { status: 500 });
  }
}
