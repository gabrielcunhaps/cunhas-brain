import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import { MeetingDetail, SpeakerSegment } from '@/lib/types';
import { parseRawContent, parseContentArray } from '@/lib/transcript';

export const dynamic = 'force-dynamic';

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
    const contentArray = (row.content as { text: string; speaker: string; speakerIndex: number }[]) || [];

    let segments: SpeakerSegment[] = [];
    if (contentArray.length > 0) {
      segments = parseContentArray(contentArray);
    } else if (rawContent) {
      segments = parseRawContent(rawContent);
    }

    const detail: MeetingDetail = {
      id: row.id as number,
      title: (row.title as string) || 'Untitled Meeting',
      date: row.date as string,
      duration: (row.duration as number) || 0,
      participants: (row.participants as string[]) || [],
      speakers: (row.speakers as { name: string; index: number }[]) || [],
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
