import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { CATEGORIES } from '@/lib/categoryMeta';

export const dynamic = 'force-dynamic';

interface MetadataFilter {
  category?: string | null;
  variable?: string | null;
  search?: string | null;
}

interface FactRow {
  id: number;
  meeting_id: number;
  category: string;
  variable: string;
  value: string;
  meeting_title: string | null;
  meeting_date: string | null;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as MetadataFilter;
    const category = body.category?.trim() || null;
    const variable = body.variable?.trim() || null;
    const search = body.search?.trim() || null;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (category) {
      const validIds: string[] = CATEGORIES.map((c) => c.id);
      if (!validIds.includes(category)) {
        return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
      }
      conditions.push(`mm.category = $${idx++}`);
      params.push(category);
    }

    if (variable) {
      conditions.push(`mm.variable = $${idx++}`);
      params.push(variable);
    }

    if (search) {
      conditions.push(
        `to_tsvector('english', mm.value) @@ plainto_tsquery('english', $${idx++})`
      );
      params.push(search);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT mm.id, mm.meeting_id, mm.category, mm.variable, mm.value,
             m.title AS meeting_title, m.date AS meeting_date
      FROM meeting_metadata mm
      LEFT JOIN meetings m ON m.id = mm.meeting_id
      ${where}
      ORDER BY m.date DESC NULLS LAST, mm.id DESC
      LIMIT 500
    `;

    const rows = (await query(sql, params)) as unknown as FactRow[];

    const meetingIdSet = new Set<number>();
    const counts: Record<string, number> = {};
    const facts = rows.map((row) => {
      meetingIdSet.add(Number(row.meeting_id));
      counts[row.category] = (counts[row.category] || 0) + 1;
      return {
        id: Number(row.id),
        meeting_id: Number(row.meeting_id),
        category: row.category,
        variable: row.variable,
        value: row.value,
        meeting_title: row.meeting_title || 'Untitled Meeting',
        meeting_date: row.meeting_date
          ? new Date(row.meeting_date as unknown as string).toISOString()
          : null,
      };
    });

    return NextResponse.json({
      meetingIds: Array.from(meetingIdSet),
      facts,
      counts,
      total: facts.length,
    });
  } catch (err) {
    console.error('Chat metadata API error:', err);
    const msg = err instanceof Error ? err.message : 'Failed to query metadata';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
