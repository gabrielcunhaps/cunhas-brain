import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * Reindex `meeting_metadata` from existing `meeting_summaries.category_data`.
 *
 * Walks every meeting that has a category + category_data and rebuilds the
 * metadata index in place. Useful for backfilling after the feature ships
 * without re-calling Anthropic for every meeting.
 */
export async function POST() {
  try {
    const rows = await query<{
      meeting_id: number;
      category: string | null;
      category_data: unknown;
    }>(
      `SELECT meeting_id, category, category_data
         FROM meeting_summaries
        WHERE category IS NOT NULL
          AND category_data IS NOT NULL`
    );

    let processed = 0;
    let inserted = 0;
    let failed = 0;

    // Wipe the metadata table once up front — we're rebuilding everything.
    await query('DELETE FROM meeting_metadata');

    for (const row of rows) {
      const meetingId = row.meeting_id;
      const category = row.category || 'others';
      let data: unknown = row.category_data;
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch {
          data = null;
        }
      }

      try {
        const count = await indexOne(meetingId, category, data);
        inserted += count;
        processed += 1;
      } catch (err) {
        failed += 1;
        const msg = err instanceof Error ? err.message : String(err);
        await log('error', `reindex failed for meeting ${meetingId}: ${msg}`, { meetingId });
      }
    }

    await log('summary', `Reindexed meeting_metadata: ${processed} meetings, ${inserted} rows`, {
      processed,
      inserted,
      failed,
    });

    return NextResponse.json({ processed, inserted, failed, total: rows.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Reindex failed:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * Insert metadata rows for a single meeting given its parsed `category_data`.
 * Returns the number of rows inserted. Does NOT delete existing rows — the
 * caller is expected to wipe the table first when doing a full reindex.
 */
async function indexOne(
  meetingId: number,
  category: string,
  data: unknown
): Promise<number> {
  if (!data || typeof data !== 'object') return 0;
  const d = data as Record<string, unknown>;

  let count = 0;
  const insertRow = async (
    variable: string,
    value: string,
    extra: Record<string, unknown> | null
  ) => {
    if (!value || !value.trim()) return;
    await query(
      `INSERT INTO meeting_metadata (meeting_id, category, variable, value, extra)
       VALUES ($1, $2, $3, $4, $5)`,
      [meetingId, category, variable, value, extra ? JSON.stringify(extra) : null]
    );
    count += 1;
  };

  if (category === 'netsuite_kt') {
    const reminders = Array.isArray(d.reminders) ? (d.reminders as unknown[]) : [];
    for (const r of reminders) {
      if (typeof r !== 'object' || r === null) continue;
      const rr = r as Record<string, unknown>;
      const text = typeof rr.reminder === 'string' ? rr.reminder : '';
      const topic = typeof rr.topic === 'string' ? rr.topic : null;
      await insertRow('reminder', text, {
        topic,
        remind_before_next: rr.remind_before_next ?? null,
      });
    }
    const topics = Array.isArray(d.topics_covered) ? (d.topics_covered as unknown[]) : [];
    for (const t of topics) {
      if (typeof t === 'string') await insertRow('topic_covered', t, null);
    }
    const openQs = Array.isArray(d.open_questions) ? (d.open_questions as unknown[]) : [];
    for (const q of openQs) {
      if (typeof q === 'string') await insertRow('open_question', q, null);
    }
  } else if (category === 'manager_1on1') {
    const buckets: Array<[string, unknown]> = [
      ['priority', d.priorities],
      ['todo', d.todos],
      ['prep', d.prep],
      ['decision', d.decisions],
    ];
    for (const [type, arr] of buckets) {
      if (!Array.isArray(arr)) continue;
      for (const item of arr) {
        if (typeof item === 'string') {
          await insertRow(type, item, { due_date: null, status: 'pending' });
        } else if (typeof item === 'object' && item !== null) {
          const it = item as Record<string, unknown>;
          const content = typeof it.content === 'string' ? it.content : '';
          const dueDate = typeof it.due_date === 'string' ? it.due_date : null;
          await insertRow(type, content, { due_date: dueDate, status: 'pending' });
        }
      }
    }
  } else if (category === 'customer_engagement') {
    const customer = typeof d.customer === 'string' ? d.customer : null;
    const buckets: Array<[string, unknown]> = [
      ['use_case', d.use_cases],
      ['question', d.questions],
      ['comment', d.comments],
      ['objection', d.objections],
      ['feature_request', d.feature_requests],
    ];
    for (const [type, arr] of buckets) {
      if (!Array.isArray(arr)) continue;
      for (const item of arr) {
        if (typeof item === 'string') {
          await insertRow(type, item, { customer, topic: null });
        } else if (typeof item === 'object' && item !== null) {
          const it = item as Record<string, unknown>;
          const content = typeof it.content === 'string' ? it.content : '';
          const topic = typeof it.topic === 'string' ? it.topic : null;
          await insertRow(type, content, { customer, topic });
        }
      }
    }
  } else if (category === 'student_lesson') {
    const student = typeof d.student_name === 'string' ? d.student_name : null;
    const topic = typeof d.topic === 'string' ? d.topic : null;
    if (typeof d.is_student_lesson === 'boolean') {
      await insertRow('student_lesson', String(d.is_student_lesson), {
        student_name: student,
        topic,
      });
    }
  } else if (category === 'others') {
    const topics = Array.isArray(d.topics) ? (d.topics as unknown[]) : [];
    for (const t of topics) {
      if (typeof t === 'string') await insertRow('topic', t, null);
    }
    const decisions = Array.isArray(d.decisions) ? (d.decisions as unknown[]) : [];
    for (const dec of decisions) {
      if (typeof dec === 'string') await insertRow('decision', dec, null);
    }
    const followUps = Array.isArray(d.follow_ups) ? (d.follow_ups as unknown[]) : [];
    for (const f of followUps) {
      if (typeof f === 'string') await insertRow('follow_up', f, null);
    }
  }

  return count;
}
