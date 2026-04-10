import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    // Accept client-provided start/end to respect user's local timezone
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');

    let startIso: string;
    let endIso: string;

    if (fromParam && toParam) {
      startIso = fromParam;
      endIso = toParam;
    } else {
      // Fallback: last 24 hours (covers most "today" cases regardless of timezone)
      const now = new Date();
      const start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      startIso = start.toISOString();
      endIso = now.toISOString();
    }

    const rows = await query<Record<string, unknown>>(
      `SELECT m.id, m.title, m.date, m.duration, m.speakers,
              ms.category, ms.category_confidence, ms.category_manual, ms.summary
         FROM meetings m
         LEFT JOIN meeting_summaries ms ON ms.meeting_id = m.id
        WHERE m.date >= $1 AND m.date < $2
        ORDER BY m.date DESC`,
      [startIso, endIso]
    );

    const meetings = rows.map((row) => {
      const rawSpeakers =
        (typeof row.speakers === 'string'
          ? JSON.parse(row.speakers as string)
          : row.speakers) || [];
      return {
        id: row.id,
        title: row.title,
        date: row.date
          ? new Date(row.date as string).toISOString()
          : new Date().toISOString(),
        duration: row.duration || 0,
        speakers: Array.isArray(rawSpeakers)
          ? rawSpeakers.map((s: Record<string, unknown>) => ({
              name: String(s.name || s.first_name || `Speaker ${s.index || '?'}`),
              index: Number(s.index || 0),
            }))
          : [],
        category: (row.category as string) || null,
        categoryConfidence: row.category_confidence ?? null,
        categoryManual: row.category_manual ?? false,
        summary: (row.summary as string) || null,
      };
    });

    return NextResponse.json(meetings);
  } catch (err) {
    console.error("Error fetching today's meetings:", err);
    return NextResponse.json(
      { error: "Failed to fetch today's meetings" },
      { status: 500 }
    );
  }
}
