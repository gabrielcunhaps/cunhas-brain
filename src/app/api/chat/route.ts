import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAnthropicClient } from '@/lib/anthropic';
import { CHAT_SYSTEM_PROMPT } from '@/lib/prompts';
import { parseRawContent, truncateForContext } from '@/lib/transcript';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const MAX_CONTEXT_CHARS = 150_000;

export async function POST(request: NextRequest) {
  try {
    const { message, sessionId, meetingIds } = await request.json();

    if (!message || !sessionId) {
      return NextResponse.json({ error: 'message and sessionId are required' }, { status: 400 });
    }

    const client = await getAnthropicClient();

    // Load transcripts for selected meetings
    let meetingContext = '';
    if (meetingIds && meetingIds.length > 0) {
      const placeholders = meetingIds.map((_: number, i: number) => `$${i + 1}`).join(',');
      const meetings = await query(
        `SELECT id, title, raw_content FROM meetings WHERE id IN (${placeholders})`,
        meetingIds
      );

      if (meetings.length > 0) {
        const perMeetingMax = Math.floor(MAX_CONTEXT_CHARS / meetings.length);
        const parts: string[] = [];

        for (const row of meetings) {
          const title = (row.title as string) || 'Untitled Meeting';
          const rawContent = (row.raw_content as string) || '';
          if (rawContent) {
            const segments = parseRawContent(rawContent);
            const truncated = truncateForContext(segments, perMeetingMax);
            parts.push(`--- Meeting: ${title} (ID: ${row.id}) ---\n${truncated}`);
          }
        }
        meetingContext = parts.join('\n\n');
      }
    }

    const systemPrompt = meetingContext
      ? `${CHAT_SYSTEM_PROMPT}\n\n## Meeting Transcripts\n\n${meetingContext}`
      : CHAT_SYSTEM_PROMPT;

    // Load chat history (last 20 messages)
    const historyRows = await query(
      'SELECT role, content FROM chat_messages WHERE session_id = $1 ORDER BY created_at ASC LIMIT 20',
      [sessionId]
    );

    const history = historyRows.map((row) => ({
      role: row.role as 'user' | 'assistant',
      content: row.content as string,
    }));

    // Save user message
    await query(
      'INSERT INTO chat_messages (session_id, role, content, meeting_ids) VALUES ($1, $2, $3, $4)',
      [sessionId, 'user', message, meetingIds || []]
    );

    await log('chat', `Chat message in session ${sessionId}`, { sessionId, meetingIds });

    // Stream response
    const stream = await client.messages.stream({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4000,
      system: systemPrompt,
      messages: [...history, { role: 'user', content: message }],
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        let fullResponse = '';
        try {
          for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              fullResponse += event.delta.text;
              controller.enqueue(encoder.encode(event.delta.text));
            }
          }
          // Save assistant message
          await query(
            'INSERT INTO chat_messages (session_id, role, content, meeting_ids) VALUES ($1, $2, $3, $4)',
            [sessionId, 'assistant', fullResponse, meetingIds || []]
          );
        } catch (err) {
          console.error('Stream error:', err);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch (err) {
    console.error('Chat API error:', err);
    const msg = err instanceof Error ? err.message : 'Failed to process chat';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    const rows = await query(
      'SELECT id, session_id, role, content, meeting_ids, created_at FROM chat_messages WHERE session_id = $1 ORDER BY created_at ASC',
      [sessionId]
    );

    const messages = rows.map((row) => ({
      id: row.id,
      sessionId: row.session_id,
      role: row.role,
      content: row.content,
      meetingIds: row.meeting_ids || [],
      createdAt: row.created_at,
    }));

    return NextResponse.json(messages);
  } catch (err) {
    console.error('Chat history error:', err);
    return NextResponse.json({ error: 'Failed to fetch chat history' }, { status: 500 });
  }
}
