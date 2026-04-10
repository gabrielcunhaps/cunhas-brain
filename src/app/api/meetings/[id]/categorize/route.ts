import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import {
  processMeetingCategory,
  runCategoryPipeline,
  classifyMeeting,
} from '@/lib/meetingClassifier';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const VALID_CATEGORIES = [
  'netsuite_kt',
  'manager_1on1',
  'customer_engagement',
  'student_lesson',
  'others',
];

async function loadCategoryRow(meetingId: number) {
  return queryOne<Record<string, unknown>>(
    `SELECT meeting_id, category, category_confidence, category_manual,
            category_reasoning, category_data
       FROM meeting_summaries
      WHERE meeting_id = $1`,
    [meetingId]
  );
}

function shapeRow(row: Record<string, unknown> | null) {
  if (!row) return null;
  let data: unknown = row.category_data ?? null;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      /* leave as string */
    }
  }
  return {
    meetingId: row.meeting_id,
    category: (row.category as string) || 'others',
    confidence: row.category_confidence ?? null,
    manual: row.category_manual ?? false,
    reasoning: row.category_reasoning ?? null,
    data,
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const meetingId = parseInt(params.id, 10);
    if (Number.isNaN(meetingId)) {
      return NextResponse.json({ error: 'Invalid meeting id' }, { status: 400 });
    }
    const row = await loadCategoryRow(meetingId);
    if (!row) {
      return NextResponse.json(
        { error: 'No summary row for this meeting' },
        { status: 404 }
      );
    }
    return NextResponse.json(shapeRow(row));
  } catch (err) {
    console.error('Error fetching category:', err);
    return NextResponse.json(
      { error: 'Failed to fetch category' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const meetingId = parseInt(params.id, 10);
    if (Number.isNaN(meetingId)) {
      return NextResponse.json({ error: 'Invalid meeting id' }, { status: 400 });
    }

    // Make sure a meeting_summaries row exists so we can persist category fields
    const summaryExists = await queryOne<{ meeting_id: number }>(
      'SELECT meeting_id FROM meeting_summaries WHERE meeting_id = $1',
      [meetingId]
    );
    if (!summaryExists) {
      return NextResponse.json(
        { error: 'No summary exists for this meeting yet. Summarize it first.' },
        { status: 400 }
      );
    }

    let body: { category?: string; manual?: boolean } = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const manualOverride = body.manual === true && typeof body.category === 'string';

    if (manualOverride) {
      const category = body.category as string;
      if (!VALID_CATEGORIES.includes(category)) {
        return NextResponse.json(
          { error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` },
          { status: 400 }
        );
      }
      await query(
        `UPDATE meeting_summaries
            SET category = $1,
                category_manual = TRUE,
                category_confidence = 1,
                category_reasoning = 'Manually set by user'
          WHERE meeting_id = $2`,
        [category, meetingId]
      );
      await log('summary', `User manually set category=${category} for meeting ${meetingId}`, {
        meetingId,
        category,
      });
      try {
        await runCategoryPipeline(meetingId, category);
      } catch (pipelineErr) {
        const msg = pipelineErr instanceof Error ? pipelineErr.message : String(pipelineErr);
        await log('error', `Manual pipeline failed for meeting ${meetingId}: ${msg}`);
      }
    } else if (typeof body.category === 'string') {
      // category provided but manual !== true → treat as auto-classify but with
      // an explicit category hint: just run the specified pipeline.
      const category = body.category;
      if (!VALID_CATEGORIES.includes(category)) {
        return NextResponse.json(
          { error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` },
          { status: 400 }
        );
      }
      await classifyMeeting(meetingId);
      try {
        await runCategoryPipeline(meetingId, category);
      } catch (pipelineErr) {
        const msg = pipelineErr instanceof Error ? pipelineErr.message : String(pipelineErr);
        await log('error', `Pipeline failed for meeting ${meetingId}: ${msg}`);
      }
    } else {
      // Full auto: classify + pipeline
      try {
        await processMeetingCategory(meetingId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await log('error', `processMeetingCategory failed for meeting ${meetingId}: ${msg}`);
        return NextResponse.json({ error: msg }, { status: 500 });
      }
    }

    const row = await loadCategoryRow(meetingId);
    return NextResponse.json(shapeRow(row));
  } catch (err) {
    console.error('Error categorizing meeting:', err);
    return NextResponse.json({ error: 'Failed to categorize meeting' }, { status: 500 });
  }
}
