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
    // Don't double-wrap already existing wikilinks
    const escaped = link.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(?<!\\[\\[)\\b(${escaped})\\b(?!\\]\\])`, 'gi');
    result = result.replace(pattern, '[[$1]]');
  }
  return result;
}

async function buildEdges(noteId: number, wikilinks: string[]) {
  if (!wikilinks || wikilinks.length === 0) return;

  for (const keyword of wikilinks) {
    // Find other notes that share this wikilink
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

export async function GET() {
  try {
    const notes = await query<NoteRow>(
      `SELECT id, title, summary, wikilinks, tags, created_at
       FROM notes ORDER BY created_at DESC`
    );

    return NextResponse.json(notes);
  } catch (error) {
    await log('error', 'Failed to list notes', { error: String(error) });
    return NextResponse.json({ error: 'Failed to list notes' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, content, tags = [] } = body;

    if (!title || !content) {
      return NextResponse.json({ error: 'Title and content are required' }, { status: 400 });
    }

    // AI analysis
    const analysis = await analyzeNote(title, content);

    // Insert wikilinks into content
    const processedContent = insertWikilinks(content, analysis.suggestedWikilinks);
    const wikilinksLower = analysis.suggestedWikilinks.map((w: string) => w.toLowerCase());

    const aiMetadata = {
      summary: analysis.summary,
      keyTopics: analysis.keyTopics,
      suggestedWikilinks: analysis.suggestedWikilinks.map((w: string) => `[[${w}]]`),
    };

    // Save to database
    const note = await queryOne<NoteRow>(
      `INSERT INTO notes (title, content, summary, wikilinks, tags, ai_metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        title,
        processedContent,
        analysis.summary,
        wikilinksLower,
        tags,
        JSON.stringify(aiMetadata),
      ]
    );

    if (!note) {
      return NextResponse.json({ error: 'Failed to create note' }, { status: 500 });
    }

    // Build knowledge edges
    await buildEdges(note.id, wikilinksLower);

    await log('info', 'Note created with AI processing', { id: note.id, title });
    return NextResponse.json(note);
  } catch (error) {
    await log('error', 'Failed to create note', { error: String(error) });
    return NextResponse.json({ error: 'Failed to create note' }, { status: 500 });
  }
}
