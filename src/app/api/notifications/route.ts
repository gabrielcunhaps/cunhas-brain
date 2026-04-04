import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { getAnthropicClient } from '@/lib/anthropic';
import { SUMMARIZE_PROMPT } from '@/lib/prompts';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

interface MeetingRow {
  id: number;
  title: string;
  date: string;
  duration: number;
  raw_content: string | null;
}

interface SummaryRow {
  meeting_id: number;
  summary: string;
  takeaways: string[];
  action_items: string[];
}

async function getSummaryForMeeting(meeting: MeetingRow) {
  // Check for existing summary
  const existing = await queryOne<SummaryRow>(
    'SELECT * FROM meeting_summaries WHERE meeting_id = $1',
    [meeting.id]
  );

  if (existing) {
    return {
      id: meeting.id,
      title: meeting.title,
      date: meeting.date,
      duration: meeting.duration,
      summary: existing.summary,
      takeaways: existing.takeaways || [],
      actionItems: existing.action_items || [],
    };
  }

  // Auto-generate if raw content exists
  const rawContent = meeting.raw_content;
  if (!rawContent) {
    return {
      id: meeting.id,
      title: meeting.title,
      date: meeting.date,
      duration: meeting.duration,
      summary: null,
      takeaways: [],
      actionItems: [],
    };
  }

  try {
    const client = await getAnthropicClient();
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      system: SUMMARIZE_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Meeting: ${meeting.title}\n\nTranscript:\n${rawContent.slice(0, 100000)}`,
        },
      ],
    });

    const responseText = msg.content[0].type === 'text' ? msg.content[0].text : '';

    let parsed: { summary: string; takeaways: string[]; actionItems: string[] };
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);
    } catch {
      parsed = { summary: responseText, takeaways: [], actionItems: [] };
    }

    // Cache in meeting_summaries
    await query(
      `INSERT INTO meeting_summaries (meeting_id, summary, takeaways, action_items)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (meeting_id) DO UPDATE SET summary = $2, takeaways = $3, action_items = $4, generated_at = NOW()`,
      [meeting.id, parsed.summary, JSON.stringify(parsed.takeaways), JSON.stringify(parsed.actionItems)]
    );

    await log('notification', `Auto-generated summary for: ${meeting.title}`, { meetingId: meeting.id });

    return {
      id: meeting.id,
      title: meeting.title,
      date: meeting.date,
      duration: meeting.duration,
      summary: parsed.summary,
      takeaways: parsed.takeaways,
      actionItems: parsed.actionItems,
    };
  } catch (err) {
    console.error(`Failed to auto-generate summary for meeting ${meeting.id}:`, err);
    return {
      id: meeting.id,
      title: meeting.title,
      date: meeting.date,
      duration: meeting.duration,
      summary: null,
      takeaways: [],
      actionItems: [],
    };
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const since = searchParams.get('since');

    if (!since) {
      return NextResponse.json(
        { error: 'Missing required query parameter: since (ISO timestamp)' },
        { status: 400 }
      );
    }

    const meetings = await query<MeetingRow>(
      'SELECT id, title, date, duration, raw_content FROM meetings WHERE created_at > $1 ORDER BY created_at DESC LIMIT 10',
      [since]
    );

    const results = await Promise.all(meetings.map(getSummaryForMeeting));

    return NextResponse.json({ meetings: results });
  } catch (err) {
    console.error('Notifications GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, meetingId } = body;

    if (!action || !meetingId) {
      return NextResponse.json(
        { error: 'Missing required fields: action, meetingId' },
        { status: 400 }
      );
    }

    await log('notification', `Notification action: ${action}`, { meetingId, action });

    return NextResponse.json({ ok: true, action, meetingId });
  } catch (err) {
    console.error('Notifications POST error:', err);
    return NextResponse.json({ error: 'Failed to process notification action' }, { status: 500 });
  }
}
