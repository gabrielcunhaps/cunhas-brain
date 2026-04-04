import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { getAnthropicClient } from '@/lib/anthropic';
import { SUMMARIZE_PROMPT } from '@/lib/prompts';
import { MeetingSummary } from '@/lib/types';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const meetingId = parseInt(params.id, 10);

    const row = await queryOne(
      'SELECT * FROM meeting_summaries WHERE meeting_id = $1',
      [meetingId]
    );

    if (!row) {
      return NextResponse.json({ cached: false });
    }

    const summary: MeetingSummary = {
      meetingId: row.meeting_id as number,
      summary: row.summary as string,
      takeaways: (row.takeaways as string[]) || [],
      actionItems: (row.action_items as string[]) || [],
      generatedAt: row.generated_at as string,
    };

    return NextResponse.json({ cached: true, ...summary });
  } catch (err) {
    console.error('Error fetching summary:', err);
    return NextResponse.json({ error: 'Failed to fetch summary' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const meetingId = parseInt(params.id, 10);

    const meeting = await queryOne(
      'SELECT title, raw_content FROM meetings WHERE id = $1',
      [meetingId]
    );

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    const title = (meeting.title as string) || 'Untitled Meeting';
    const rawContent = (meeting.raw_content as string) || '';

    if (!rawContent) {
      return NextResponse.json({ error: 'No transcript available for this meeting' }, { status: 400 });
    }

    let client;
    try {
      client = await getAnthropicClient();
    } catch {
      return NextResponse.json(
        { error: 'Anthropic API key not configured. Go to Settings to add it.' },
        { status: 400 }
      );
    }

    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      system: SUMMARIZE_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Meeting: ${title}\n\nTranscript:\n${rawContent.slice(0, 100000)}`,
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
      [meetingId, parsed.summary, JSON.stringify(parsed.takeaways), JSON.stringify(parsed.actionItems)]
    );

    await log('summary', `Generated summary for: ${title}`, { meetingId });

    const summary: MeetingSummary = {
      meetingId,
      summary: parsed.summary,
      takeaways: parsed.takeaways,
      actionItems: parsed.actionItems,
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json({ cached: false, ...summary });
  } catch (err) {
    console.error('Error generating summary:', err);
    return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 });
  }
}
