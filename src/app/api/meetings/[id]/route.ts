import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import { MeetingDetail, SpeakerSegment } from '@/lib/types';
import { parseRawContent, parseContentArray } from '@/lib/transcript';

export const dynamic = 'force-dynamic';

function parseJsonField<T>(val: unknown, fallback: T): T {
  if (!val) return fallback;
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return fallback; }
  }
  return val as T;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id, 10);

    const row = await queryOne(
      'SELECT * FROM meetings WHERE id = $1',
      [id]
    );

    if (!row) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    const rawContent = (row.raw_content as string) || '';
    const contentArray = parseJsonField<{ text: string; speaker: string; speakerIndex: number }[]>(row.content, []);
    const speakers = parseJsonField<{ name: string; index: number }[]>(row.speakers, []);
    const participants = parseJsonField<string[]>(row.participants, []);
    const date = row.date ? new Date(row.date as string).toISOString() : new Date().toISOString();

    let segments: SpeakerSegment[] = [];
    if (Array.isArray(contentArray) && contentArray.length > 0) {
      segments = parseContentArray(contentArray);
    } else if (rawContent) {
      segments = parseRawContent(rawContent);
    }

    const detail: MeetingDetail = {
      id: row.id as number,
      title: (row.title as string) || 'Untitled Meeting',
      date,
      duration: (row.duration as number) || 0,
      participants,
      speakers,
      hasTranscript: rawContent.length > 0 || contentArray.length > 0,
      rawContent,
      segments,
    };

    return NextResponse.json(detail);
  } catch (err) {
    console.error('Error fetching meeting detail:', err);
    return NextResponse.json({ error: 'Failed to fetch meeting' }, { status: 500 });
  }
}
