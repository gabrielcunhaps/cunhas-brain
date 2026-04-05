export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { log } from '@/lib/logger';

export async function GET() {
  try {
    const nodes = await query<{ id: number; title: string; wikilinks: string[] | null }>(
      'SELECT id, title, wikilinks FROM notes ORDER BY created_at DESC'
    );

    const edges = await query<{ id: number; source_note_id: number; target_note_id: number; keyword: string }>(
      'SELECT id, source_note_id, target_note_id, keyword FROM knowledge_edges'
    );

    return NextResponse.json({
      nodes: nodes.map((n) => ({ id: n.id, title: n.title, wikilinks: n.wikilinks || [] })),
      edges: edges.map((e) => ({ source: e.source_note_id, target: e.target_note_id, keyword: e.keyword })),
    });
  } catch (error) {
    await log('error', 'Failed to get knowledge graph', { error: String(error) });
    return NextResponse.json({ error: 'Failed to get knowledge graph' }, { status: 500 });
  }
}
