import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAnthropicClient } from '@/lib/anthropic';
import { CHAT_SYSTEM_PROMPT } from '@/lib/prompts';
import { parseRawContent, truncateForContext } from '@/lib/transcript';
import { log } from '@/lib/logger';
import { CATEGORIES, getCategoryMeta } from '@/lib/categoryMeta';

export const dynamic = 'force-dynamic';

const MAX_CONTEXT_CHARS = 150_000;
const MAX_FACTS_IN_PROMPT = 400;

interface ChatFilter {
  category?: string | null;
  variable?: string | null;
  search?: string | null;
}

interface MetaRow {
  id: number;
  meeting_id: number;
  category: string;
  variable: string;
  value: string;
  meeting_title: string | null;
  meeting_date: string | null;
}

async function loadMetadataFacts(filter: ChatFilter): Promise<MetaRow[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (filter.category) {
    conditions.push(`mm.category = $${idx++}`);
    params.push(filter.category);
  }
  if (filter.variable) {
    conditions.push(`mm.variable = $${idx++}`);
    params.push(filter.variable);
  }
  if (filter.search) {
    conditions.push(
      `to_tsvector('english', mm.value) @@ plainto_tsquery('english', $${idx++})`
    );
    params.push(filter.search);
  }

  if (conditions.length === 0) return [];

  const sql = `
    SELECT mm.id, mm.meeting_id, mm.category, mm.variable, mm.value,
           m.title AS meeting_title, m.date AS meeting_date
    FROM meeting_metadata mm
    LEFT JOIN meetings m ON m.id = mm.meeting_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY m.date DESC NULLS LAST, mm.id DESC
    LIMIT ${MAX_FACTS_IN_PROMPT}
  `;

  const rows = (await query(sql, params)) as unknown as MetaRow[];
  return rows;
}

function buildFactsContext(rows: MetaRow[], filter: ChatFilter): string {
  if (rows.length === 0) return '';

  // Group by meeting
  const byMeeting = new Map<
    number,
    { title: string; date: string | null; facts: MetaRow[] }
  >();
  for (const row of rows) {
    const id = Number(row.meeting_id);
    if (!byMeeting.has(id)) {
      byMeeting.set(id, {
        title: row.meeting_title || 'Untitled Meeting',
        date: row.meeting_date
          ? new Date(row.meeting_date as unknown as string).toISOString().slice(0, 10)
          : null,
        facts: [],
      });
    }
    byMeeting.get(id)!.facts.push(row);
  }

  const parts: string[] = [];
  const catLabel = filter.category ? getCategoryMeta(filter.category)?.label : null;

  const header: string[] = [];
  if (catLabel) header.push(`Category: ${catLabel}`);
  if (filter.variable) header.push(`Variable: ${filter.variable}`);
  if (filter.search) header.push(`Search: "${filter.search}"`);
  const headerLine = header.length > 0 ? ` (${header.join(', ')})` : '';

  parts.push(
    `The user has filtered their meetings${headerLine}. Below are the structured facts extracted from the matching meetings. When answering list/summary questions, PREFER these structured facts over raw transcripts — they are the source of truth.`
  );
  parts.push('');

  Array.from(byMeeting.entries()).forEach(([meetingId, info]) => {
    const datePart = info.date ? ` (${info.date})` : '';
    parts.push(`[Meeting: ${info.title}${datePart} — ID ${meetingId}]`);
    for (const fact of info.facts) {
      const value = fact.value.replace(/\s+/g, ' ').trim();
      parts.push(`- ${fact.variable}: "${value}"`);
    }
    parts.push('');
  });

  return parts.join('\n');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, sessionId } = body;
    const meetingIds: number[] = Array.isArray(body.meetingIds) ? body.meetingIds : [];
    const rawFilter: ChatFilter | undefined = body.filter;

    if (!message || !sessionId) {
      return NextResponse.json({ error: 'message and sessionId are required' }, { status: 400 });
    }

    // Validate filter
    let filter: ChatFilter | null = null;
    if (rawFilter && (rawFilter.category || rawFilter.variable || rawFilter.search)) {
      const validIds: string[] = CATEGORIES.map((c) => c.id);
      if (rawFilter.category && !validIds.includes(rawFilter.category)) {
        return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
      }
      filter = {
        category: rawFilter.category || null,
        variable: rawFilter.variable || null,
        search: rawFilter.search || null,
      };
    }

    const client = await getAnthropicClient();

    // Resolve the effective meeting IDs and structured facts
    let effectiveMeetingIds = [...meetingIds];
    let factsContext = '';

    if (filter) {
      const facts = await loadMetadataFacts(filter);
      if (facts.length > 0) {
        factsContext = buildFactsContext(facts, filter);

        // If no explicit meeting selection, use the meetings surfaced by the filter
        if (effectiveMeetingIds.length === 0) {
          const factMeetingIds = Array.from(
            new Set(facts.map((f) => Number(f.meeting_id)))
          );
          effectiveMeetingIds = factMeetingIds;
        }
      }
    }

    // Load transcripts for the effective meetings (capped in count to keep context small)
    let meetingContext = '';
    if (effectiveMeetingIds.length > 0) {
      // Cap the number of transcripts we load so a broad filter doesn't blow the context
      const capped = effectiveMeetingIds.slice(0, 20);
      const placeholders = capped.map((_, i) => `$${i + 1}`).join(',');
      const meetings = await query(
        `SELECT id, title, raw_content FROM meetings WHERE id IN (${placeholders}) ORDER BY date DESC NULLS LAST`,
        capped
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

    // Build system prompt
    const sections: string[] = [CHAT_SYSTEM_PROMPT];
    if (factsContext) {
      sections.push(`## Structured Facts\n\n${factsContext}`);
    }
    if (meetingContext) {
      sections.push(`## Meeting Transcripts\n\n${meetingContext}`);
    }
    const systemPrompt = sections.join('\n\n');

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
      [sessionId, 'user', message, effectiveMeetingIds]
    );

    await log('chat', `Chat message in session ${sessionId}`, {
      sessionId,
      meetingIds: effectiveMeetingIds,
      filter,
    });

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
            [sessionId, 'assistant', fullResponse, effectiveMeetingIds]
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
