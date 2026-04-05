export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { getAnthropicClient } from '@/lib/anthropic';
import { log } from '@/lib/logger';

interface Artifact {
  id: number;
  title: string;
  description: string | null;
  file_content: string;
  file_type: string;
  ai_explanation: Record<string, unknown> | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

async function generateExplanation(fileContent: string, fileType: string): Promise<Record<string, unknown>> {
  const client = await getAnthropicClient();
  const typeLabel = fileType === 'html' ? 'HTML' : 'React component';

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Analyze this ${typeLabel} code and return ONLY valid JSON (no markdown, no code fences) with this exact structure:
{
  "whatItIs": "A brief description of what this artifact is and does",
  "keyInsights": ["insight 1", "insight 2", "insight 3"],
  "relatedConcepts": ["concept 1", "concept 2"],
  "technologiesUsed": ["technology 1", "technology 2"]
}

Here is the code:

${fileContent}`,
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  try {
    return JSON.parse(text);
  } catch {
    return {
      whatItIs: 'Could not parse AI explanation',
      keyInsights: [],
      relatedConcepts: [],
      technologiesUsed: [],
    };
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const artifact = await queryOne<Artifact>(
      'SELECT * FROM artifacts WHERE id = $1',
      [id]
    );

    if (!artifact) {
      return NextResponse.json({ error: 'Artifact not found' }, { status: 404 });
    }

    return NextResponse.json(artifact);
  } catch (error) {
    await log('error', 'Failed to get artifact', { error: String(error) });
    return NextResponse.json({ error: 'Failed to get artifact' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await query('DELETE FROM artifacts WHERE id = $1 RETURNING id', [id]);

    if (result.length === 0) {
      return NextResponse.json({ error: 'Artifact not found' }, { status: 404 });
    }

    await log('info', 'Artifact deleted', { id });
    return NextResponse.json({ success: true });
  } catch (error) {
    await log('error', 'Failed to delete artifact', { error: String(error) });
    return NextResponse.json({ error: 'Failed to delete artifact' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, description, tags, fileContent } = body;

    // Check if artifact exists
    const existing = await queryOne<Artifact>('SELECT * FROM artifacts WHERE id = $1', [id]);
    if (!existing) {
      return NextResponse.json({ error: 'Artifact not found' }, { status: 404 });
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      values.push(title);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(description);
    }
    if (tags !== undefined) {
      updates.push(`tags = $${paramIndex++}`);
      values.push(tags);
    }
    if (fileContent !== undefined) {
      updates.push(`file_content = $${paramIndex++}`);
      values.push(fileContent);
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const artifact = await queryOne<Artifact>(
      `UPDATE artifacts SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    // Re-generate AI explanation if file content changed
    if (fileContent !== undefined && artifact) {
      try {
        const explanation = await generateExplanation(fileContent, artifact.file_type);
        const updated = await queryOne<Artifact>(
          'UPDATE artifacts SET ai_explanation = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
          [JSON.stringify(explanation), id]
        );
        await log('info', 'Artifact updated with new AI explanation', { id });
        return NextResponse.json(updated);
      } catch (aiError) {
        await log('error', 'AI re-explanation failed on update', { id, error: String(aiError) });
      }
    }

    await log('info', 'Artifact updated', { id });
    return NextResponse.json(artifact);
  } catch (error) {
    await log('error', 'Failed to update artifact', { error: String(error) });
    return NextResponse.json({ error: 'Failed to update artifact' }, { status: 500 });
  }
}
