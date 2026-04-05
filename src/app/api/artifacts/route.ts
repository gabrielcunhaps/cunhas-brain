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

export async function GET() {
  try {
    const artifacts = await query<Artifact>(
      `SELECT id, title, description, file_type, tags, created_at,
              (ai_explanation IS NOT NULL) as has_explanation
       FROM artifacts
       ORDER BY created_at DESC`
    );

    return NextResponse.json(artifacts);
  } catch (error) {
    await log('error', 'Failed to list artifacts', { error: String(error) });
    return NextResponse.json({ error: 'Failed to list artifacts' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, fileContent, fileType = 'html', description = '', tags = [] } = body;

    if (!title || !fileContent) {
      return NextResponse.json({ error: 'Title and fileContent are required' }, { status: 400 });
    }

    // Insert the artifact first
    const artifact = await queryOne<Artifact>(
      `INSERT INTO artifacts (title, description, file_content, file_type, tags)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [title, description, fileContent, fileType, tags]
    );

    if (!artifact) {
      return NextResponse.json({ error: 'Failed to create artifact' }, { status: 500 });
    }

    // Generate AI explanation
    try {
      const explanation = await generateExplanation(fileContent, fileType);
      const updated = await queryOne<Artifact>(
        `UPDATE artifacts SET ai_explanation = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
        [JSON.stringify(explanation), artifact.id]
      );
      await log('info', 'Artifact created with AI explanation', { id: artifact.id, title });
      return NextResponse.json(updated);
    } catch (aiError) {
      await log('error', 'AI explanation failed, artifact saved without it', {
        id: artifact.id,
        error: String(aiError),
      });
      return NextResponse.json(artifact);
    }
  } catch (error) {
    await log('error', 'Failed to create artifact', { error: String(error) });
    return NextResponse.json({ error: 'Failed to create artifact' }, { status: 500 });
  }
}
