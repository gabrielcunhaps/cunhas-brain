export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAnthropicClient } from '@/lib/anthropic';
import { log } from '@/lib/logger';

const MAX_CONTEXT_CHARS = 150_000;

const SYSTEM_PROMPT = `You are a knowledge assistant with access to the user's notes. Answer questions using the notes as reference. Cite which note the information comes from by mentioning the note title. Be helpful, concise, and accurate. If the notes don't contain relevant information, say so.`;

export async function POST(request: NextRequest) {
  try {
    const { message, sessionId } = await request.json();

    if (!message || !sessionId) {
      return NextResponse.json({ error: 'message and sessionId are required' }, { status: 400 });
    }

    const client = await getAnthropicClient();

    // Load all notes as context
    const notes = await query<{ id: number; title: string; content: string }>(
      'SELECT id, title, content FROM notes ORDER BY created_at DESC'
    );

    let notesContext = '';
    if (notes.length > 0) {
      const perNoteMax = Math.floor(MAX_CONTEXT_CHARS / notes.length);
      const parts: string[] = [];

      for (const note of notes) {
        const truncated = (note.content || '').slice(0, perNoteMax);
        parts.push(`--- Note: ${note.title} (ID: ${note.id}) ---\n${truncated}`);
      }
      notesContext = parts.join('\n\n');
    }

    const systemPrompt = notesContext
      ? `${SYSTEM_PROMPT}\n\n## Your Knowledge Base\n\n${notesContext}`
      : `${SYSTEM_PROMPT}\n\nNote: The knowledge base is currently empty. No notes have been uploaded yet.`;

    // Load chat history
    const historyRows = await query(
      `SELECT role, content FROM chat_messages WHERE session_id = $1 ORDER BY created_at ASC LIMIT 20`,
      [sessionId]
    );

    const history = historyRows.map((row) => ({
      role: row.role as 'user' | 'assistant',
      content: row.content as string,
    }));

    // Save user message (empty meeting_ids to distinguish from meeting chat)
    await query(
      'INSERT INTO chat_messages (session_id, role, content, meeting_ids) VALUES ($1, $2, $3, $4)',
      [sessionId, 'user', message, []]
    );

    await log('chat', `Knowledge chat in session ${sessionId}`, { sessionId });

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
            [sessionId, 'assistant', fullResponse, []]
          );
        } catch (err) {
          console.error('Knowledge chat stream error:', err);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch (err) {
    console.error('Knowledge chat API error:', err);
    const msg = err instanceof Error ? err.message : 'Failed to process chat';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
