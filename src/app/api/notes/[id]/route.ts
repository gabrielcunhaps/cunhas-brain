export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { getAnthropicClient } from '@/lib/anthropic';
import { log } from '@/lib/logger';

interface NoteRow {
  id: number;
  title: string;
  content: string;
  summary: string | null;
  wikilinks: string[] | null;
  tags: string[] | null;
  ai_metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

interface ConnectedNote {
  id: number;
  title: string;
  keyword: string;
}

interface AIAnalysis {
  summary: string;
  keyTopics: string[];
  suggestedWikilinks: string[];
}

async function analyzeNote(title: string, content: string): Promise<AIAnalysis> {
  const client = await getAnthropicClient();

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Analyze this markdown note and return ONLY valid JSON (no markdown, no code fences) with this exact structure:
{
  "summary": "2-3 sentence summary of the key ideas",
  "keyTopics": ["important concept 1", "important concept 2"],
  "suggestedWikilinks": ["keyword1", "keyword2"]
}
The suggestedWikilinks should be significant concepts, people, tools, or ideas that might appear in other notes. Think like Obsidian - what would you link?

Title: ${title}

Content:
${content}`,
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  try {
    return JSON.parse(text);
  } catch {
    return { summary: '', keyTopics: [], suggestedWikilinks: [] };
  }
}

function insertWikilinks(content: string, wikilinks: string[]): string {
  let result = content;
  for (const link of wikilinks) {
    const escaped = link.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(?<!\\[\\[)\\b(${escaped})\\b(?!\\]\\])`, 'gi');
    result = result.replace(pattern, '[[$1]]');
  }
  return result;
}

async function rebuildEdges(noteId: number, wikilinks: string[]) {
  // Remove old edges for this note
  await query('DELETE FROM knowledge_edges WHERE source_note_id = $1 OR target_note_id = $1', [noteId]);

  if (!wikilinks || wikilinks.length === 0) return;

  for (const keyword of wikilinks) {
    const matches = await query<{ id: number }>(
      `SELECT id FROM notes WHERE id != $1 AND $2 = ANY(wikilinks)`,
      [noteId, keyword.toLowerCase()]
    );

    for (const match of matches) {
      await query(
        `INSERT INTO knowledge_edges (source_note_id, target_note_id, keyword)
         VALUES ($1, $2, $3)
         ON CONFLICT (source_note_id, target_note_id, keyword) DO NOTHING`,
        [noteId, match.id, keyword.toLowerCase()]
      );
    }
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const note = await queryOne<NoteRow>('SELECT * FROM notes WHERE id = $1', [id]);

    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    // Get connected notes
    const connected = await query<ConnectedNote>(
      `SELECT DISTINCT n2.id, n2.title, ke.keyword FROM knowledge_edges ke
       JOIN notes n2 ON (n2.id = ke.target_note_id OR n2.id = ke.source_note_id)
       WHERE (ke.source_note_id = $1 OR ke.target_note_id = $1) AND n2.id != $1`,
      [id]
    );

    return NextResponse.json({ ...note, connectedNotes: connected });
  } catch (error) {
    await log('error', 'Failed to get note', { error: String(error) });
    return NextResponse.json({ error: 'Failed to get note' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, content, tags } = body;

    const existing = await queryOne<NoteRow>('SELECT * FROM notes WHERE id = $1', [id]);
    if (!existing) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    const noteTitle = title || existing.title;
    const noteContent = content || existing.content;

    // Re-run AI analysis
    const analysis = await analyzeNote(noteTitle, noteContent);
    const processedContent = insertWikilinks(noteContent, analysis.suggestedWikilinks);
    const wikilinksLower = analysis.suggestedWikilinks.map((w: string) => w.toLowerCase());

    const aiMetadata = {
      summary: analysis.summary,
      keyTopics: analysis.keyTopics,
      suggestedWikilinks: analysis.suggestedWikilinks.map((w: string) => `[[${w}]]`),
    };

    const note = await queryOne<NoteRow>(
      `UPDATE notes SET title = $1, content = $2, summary = $3, wikilinks = $4, tags = $5,
       ai_metadata = $6, updated_at = NOW()
       WHERE id = $7 RETURNING *`,
      [noteTitle, processedContent, analysis.summary, wikilinksLower, tags || existing.tags, JSON.stringify(aiMetadata), id]
    );

    // Rebuild edges
    await rebuildEdges(Number(id), wikilinksLower);

    await log('info', 'Note updated with AI re-processing', { id });
    return NextResponse.json(note);
  } catch (error) {
    await log('error', 'Failed to update note', { error: String(error) });
    return NextResponse.json({ error: 'Failed to update note' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Delete edges first (in case no cascade)
    await query('DELETE FROM knowledge_edges WHERE source_note_id = $1 OR target_note_id = $1', [id]);
    const result = await query('DELETE FROM notes WHERE id = $1 RETURNING id', [id]);

    if (result.length === 0) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    await log('info', 'Note deleted', { id });
    return NextResponse.json({ success: true });
  } catch (error) {
    await log('error', 'Failed to delete note', { error: String(error) });
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 });
  }
}
