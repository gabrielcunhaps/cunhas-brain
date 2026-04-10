import { query, queryOne } from './db';
import { getAnthropicClient } from './anthropic';
import { log } from './logger';
import {
  DEFAULT_CLASSIFIER_PROMPT,
  DEFAULT_NETSUITE_KT_PROMPT,
  DEFAULT_MANAGER_PROMPT,
  DEFAULT_CUSTOMER_PROMPT,
  DEFAULT_STUDENT_FLAG_PROMPT,
  DEFAULT_OTHERS_PROMPT,
  getPrompt,
  fillPrompt,
} from './categoryPrompts';

const MODEL = 'claude-haiku-4-5-20251001';

export type MeetingCategory =
  | 'netsuite_kt'
  | 'manager_1on1'
  | 'customer_engagement'
  | 'student_lesson'
  | 'others';

const VALID_CATEGORIES: MeetingCategory[] = [
  'netsuite_kt',
  'manager_1on1',
  'customer_engagement',
  'student_lesson',
  'others',
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractJSON(text: string): any {
  // Try direct parse first
  try {
    return JSON.parse(text);
  } catch {
    /* continue */
  }

  // Balanced-brace scan for the first complete JSON object
  let depth = 0;
  let start = -1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && start >= 0) {
        try {
          return JSON.parse(text.substring(start, i + 1));
        } catch {
          start = -1;
        }
      }
    }
  }

  // Last-ditch greedy regex
  const match = text.match(/\{[\s\S]*\}/);
  if (match) return JSON.parse(match[0]);

  throw new Error('No valid JSON found in response');
}

interface MeetingContext {
  meetingId: number;
  title: string;
  summary: string;
  takeaways: string;
  actionItems: string;
  transcript: string;
  participants: string;
}

async function loadMeetingContext(meetingId: number): Promise<MeetingContext | null> {
  const meeting = await queryOne<Record<string, unknown>>(
    'SELECT id, title, raw_content, participants FROM meetings WHERE id = $1',
    [meetingId]
  );
  if (!meeting) return null;

  const summaryRow = await queryOne<Record<string, unknown>>(
    'SELECT summary, takeaways, action_items FROM meeting_summaries WHERE meeting_id = $1',
    [meetingId]
  );

  const title = (meeting.title as string) || 'Untitled Meeting';
  const rawContent = (meeting.raw_content as string) || '';

  const rawParticipants =
    (typeof meeting.participants === 'string'
      ? JSON.parse(meeting.participants as string)
      : meeting.participants) || [];
  const participants = Array.isArray(rawParticipants)
    ? rawParticipants
        .map((p: unknown) => {
          if (typeof p === 'string') return p;
          if (typeof p === 'object' && p !== null) {
            const o = p as Record<string, unknown>;
            return String(o.name || o.first_name || o.email || 'Unknown');
          }
          return String(p);
        })
        .join(', ')
    : '';

  const summary = (summaryRow?.summary as string) || '';
  const takeawaysRaw = summaryRow?.takeaways;
  const actionItemsRaw = summaryRow?.action_items;

  const toListString = (v: unknown): string => {
    if (!v) return '';
    let arr: unknown[] = [];
    if (typeof v === 'string') {
      try {
        arr = JSON.parse(v);
      } catch {
        return v;
      }
    } else if (Array.isArray(v)) {
      arr = v;
    }
    return arr
      .map((item) => {
        if (typeof item === 'string') return `- ${item}`;
        if (typeof item === 'object' && item !== null) return `- ${JSON.stringify(item)}`;
        return `- ${String(item)}`;
      })
      .join('\n');
  };

  return {
    meetingId,
    title,
    summary,
    takeaways: toListString(takeawaysRaw),
    actionItems: toListString(actionItemsRaw),
    transcript: rawContent.slice(0, 8000),
    participants,
  };
}

function ctxToVars(ctx: MeetingContext): Record<string, string> {
  return {
    title: ctx.title,
    summary: ctx.summary,
    takeaways: ctx.takeaways,
    actionItems: ctx.actionItems,
    transcript: ctx.transcript,
    participants: ctx.participants,
  };
}

async function callClaude(prompt: string, maxTokens = 2000): Promise<string> {
  const client = await getAnthropicClient();
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  });
  const block = msg.content.find((b) => b.type === 'text');
  if (block && block.type === 'text') return block.text;
  return '';
}

/**
 * Classify a meeting into one of the known categories and store
 * the category + confidence + reasoning on `meeting_summaries`.
 * Does NOT run the downstream pipeline — use `processMeetingCategory`
 * for the full flow.
 */
export async function classifyMeeting(meetingId: number): Promise<{
  category: MeetingCategory;
  confidence: number;
  reasoning: string;
}> {
  const ctx = await loadMeetingContext(meetingId);
  if (!ctx) throw new Error(`Meeting ${meetingId} not found`);

  const template = await getPrompt('prompt_classify', DEFAULT_CLASSIFIER_PROMPT);
  const prompt = fillPrompt(template, ctxToVars(ctx));

  await log('summary', `Classifying meeting: ${ctx.title}`, { meetingId });

  const text = await callClaude(prompt, 500);

  let parsed: { category: string; confidence: number; reasoning: string };
  try {
    parsed = extractJSON(text);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await log('error', `Classifier JSON parse failed for meeting ${meetingId}: ${msg}`);
    parsed = { category: 'others', confidence: 0, reasoning: 'Failed to parse classifier output' };
  }

  let category: MeetingCategory = 'others';
  if (typeof parsed.category === 'string' && (VALID_CATEGORIES as string[]).includes(parsed.category)) {
    category = parsed.category as MeetingCategory;
  }
  const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0;
  const reasoning = typeof parsed.reasoning === 'string' ? parsed.reasoning : '';

  await query(
    `UPDATE meeting_summaries
       SET category = $1,
           category_confidence = $2,
           category_reasoning = $3,
           category_manual = COALESCE(category_manual, FALSE)
     WHERE meeting_id = $4`,
    [category, confidence, reasoning, meetingId]
  );

  await log('summary', `Classified meeting ${meetingId} as ${category} (${confidence})`, {
    meetingId,
    category,
    confidence,
  });

  return { category, confidence, reasoning };
}

async function runNetSuiteKT(meetingId: number, ctx: MeetingContext) {
  const template = await getPrompt('prompt_netsuite_kt', DEFAULT_NETSUITE_KT_PROMPT);
  const prompt = fillPrompt(template, ctxToVars(ctx));
  const text = await callClaude(prompt, 2000);
  const data = extractJSON(text);

  // Clear existing auto-extracted reminders for this meeting, then re-insert
  await query('DELETE FROM netsuite_kt_reminders WHERE meeting_id = $1', [meetingId]);

  const reminders: Array<{ topic?: string; reminder?: string; remind_before_next?: boolean }> =
    Array.isArray(data?.reminders) ? data.reminders : [];

  for (const r of reminders) {
    await query(
      `INSERT INTO netsuite_kt_reminders (meeting_id, topic, reminder, status, remind_before_next)
       VALUES ($1, $2, $3, 'pending', $4)`,
      [meetingId, r.topic || null, r.reminder || '', r.remind_before_next ?? true]
    );
  }

  return data;
}

async function runManager1on1(meetingId: number, ctx: MeetingContext) {
  const template = await getPrompt('prompt_manager_1on1', DEFAULT_MANAGER_PROMPT);
  const prompt = fillPrompt(template, ctxToVars(ctx));
  const text = await callClaude(prompt, 2000);
  const data = extractJSON(text);

  await query('DELETE FROM manager_followups WHERE meeting_id = $1', [meetingId]);

  const buckets: Array<['priority' | 'todo' | 'prep' | 'decision', unknown]> = [
    ['priority', data?.priorities],
    ['todo', data?.todos],
    ['prep', data?.prep],
    ['decision', data?.decisions],
  ];

  for (const [type, arr] of buckets) {
    if (!Array.isArray(arr)) continue;
    for (const item of arr) {
      const content =
        typeof item === 'string'
          ? item
          : (item as { content?: string })?.content || '';
      const dueDate =
        typeof item === 'object' && item !== null
          ? (item as { due_date?: string | null }).due_date || null
          : null;
      if (!content) continue;
      await query(
        `INSERT INTO manager_followups (meeting_id, type, content, due_date, status)
         VALUES ($1, $2, $3, $4, 'pending')`,
        [meetingId, type, content, dueDate]
      );
    }
  }

  return data;
}

async function runCustomerEngagement(meetingId: number, ctx: MeetingContext) {
  const template = await getPrompt('prompt_customer_engagement', DEFAULT_CUSTOMER_PROMPT);
  const prompt = fillPrompt(template, ctxToVars(ctx));
  const text = await callClaude(prompt, 2500);
  const data = extractJSON(text);

  await query('DELETE FROM customer_insights WHERE meeting_id = $1', [meetingId]);

  const customer: string | null = typeof data?.customer === 'string' ? data.customer : null;

  const buckets: Array<
    ['use_case' | 'question' | 'comment' | 'objection' | 'feature_request', unknown]
  > = [
    ['use_case', data?.use_cases],
    ['question', data?.questions],
    ['comment', data?.comments],
    ['objection', data?.objections],
    ['feature_request', data?.feature_requests],
  ];

  for (const [type, arr] of buckets) {
    if (!Array.isArray(arr)) continue;
    for (const item of arr) {
      const content =
        typeof item === 'string'
          ? item
          : (item as { content?: string })?.content || '';
      const topic =
        typeof item === 'object' && item !== null
          ? (item as { topic?: string | null }).topic || null
          : null;
      if (!content) continue;
      await query(
        `INSERT INTO customer_insights (meeting_id, type, content, customer, topic)
         VALUES ($1, $2, $3, $4, $5)`,
        [meetingId, type, content, customer, topic]
      );
    }
  }

  return data;
}

async function runStudentFlag(meetingId: number, ctx: MeetingContext) {
  const template = await getPrompt('prompt_student_flag', DEFAULT_STUDENT_FLAG_PROMPT);
  const prompt = fillPrompt(template, ctxToVars(ctx));
  const text = await callClaude(prompt, 800);
  const data = extractJSON(text);
  // No dedicated table — the flag lives in category_data so the Students tab
  // can link/import it manually.
  return data;
}

async function runOthers(meetingId: number, ctx: MeetingContext) {
  const template = await getPrompt('prompt_others', DEFAULT_OTHERS_PROMPT);
  const prompt = fillPrompt(template, ctxToVars(ctx));
  const text = await callClaude(prompt, 1500);
  const data = extractJSON(text);
  return data;
}

/**
 * Extract a category-flavored `summary` string from the parsed pipeline data,
 * if present. Handles the student_lesson case where the summary lives under
 * `sessionInsights.sessionSummary` (first session) or top-level `sessionSummary`
 * (subsequent sessions).
 */
function extractCategorySummary(category: string, data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (category === 'student_lesson') {
    const insights = d.sessionInsights as Record<string, unknown> | undefined;
    if (insights && typeof insights.sessionSummary === 'string') {
      return insights.sessionSummary;
    }
    if (typeof d.sessionSummary === 'string') return d.sessionSummary;
    return null;
  }
  if (typeof d.summary === 'string' && d.summary.trim().length > 0) {
    return d.summary;
  }
  return null;
}

/**
 * Insert searchable facts from the parsed pipeline data into
 * `meeting_metadata`. Always wipes existing rows for this meeting + category
 * first so repeated runs stay fresh.
 */
async function indexMeetingMetadata(
  meetingId: number,
  category: string,
  data: unknown
): Promise<void> {
  // Wipe existing rows for this meeting first (all categories) so we never
  // leave stale entries from a previous pipeline run.
  await query('DELETE FROM meeting_metadata WHERE meeting_id = $1', [meetingId]);

  if (!data || typeof data !== 'object') return;
  const d = data as Record<string, unknown>;

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
  };

  try {
    if (category === 'netsuite_kt') {
      const reminders = Array.isArray(d.reminders) ? (d.reminders as unknown[]) : [];
      for (const r of reminders) {
        if (typeof r !== 'object' || r === null) continue;
        const rr = r as Record<string, unknown>;
        const text = typeof rr.reminder === 'string' ? rr.reminder : '';
        const topic = typeof rr.topic === 'string' ? rr.topic : null;
        const remind = rr.remind_before_next;
        await insertRow('reminder', text, { topic, remind_before_next: remind ?? null });
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
        await insertRow(
          'student_lesson',
          String(d.is_student_lesson),
          { student_name: student, topic }
        );
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
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await log('error', `indexMeetingMetadata failed for meeting ${meetingId}: ${msg}`, {
      meetingId,
      category,
    });
  }
}

/**
 * Run the per-category extraction pipeline for an already-classified meeting.
 * Stores structured results in the relevant table(s), mirrors the parsed JSON
 * into `meeting_summaries.category_data`, updates `meeting_summaries.summary`
 * with a category-flavored summary (when the prompt returns one), sets
 * `summary_source` to the category id, and populates `meeting_metadata` for
 * fast filtering and search.
 */
export async function runCategoryPipeline(
  meetingId: number,
  category: string
): Promise<unknown> {
  const ctx = await loadMeetingContext(meetingId);
  if (!ctx) throw new Error(`Meeting ${meetingId} not found`);

  await log('summary', `Running ${category} pipeline for meeting ${meetingId}`, { meetingId, category });

  let data: unknown;
  try {
    switch (category) {
      case 'netsuite_kt':
        data = await runNetSuiteKT(meetingId, ctx);
        break;
      case 'manager_1on1':
        data = await runManager1on1(meetingId, ctx);
        break;
      case 'customer_engagement':
        data = await runCustomerEngagement(meetingId, ctx);
        break;
      case 'student_lesson':
        data = await runStudentFlag(meetingId, ctx);
        break;
      case 'others':
      default:
        data = await runOthers(meetingId, ctx);
        break;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await log('error', `Pipeline ${category} failed for meeting ${meetingId}: ${msg}`, { meetingId });
    throw err;
  }

  const categorySummary = extractCategorySummary(category, data);
  if (categorySummary) {
    await query(
      `UPDATE meeting_summaries
          SET category_data = $1,
              summary = $2,
              summary_source = $3,
              generated_at = NOW()
        WHERE meeting_id = $4`,
      [JSON.stringify(data ?? {}), categorySummary, category, meetingId]
    );
  } else {
    await query(
      `UPDATE meeting_summaries
          SET category_data = $1,
              summary_source = COALESCE(summary_source, 'generic')
        WHERE meeting_id = $2`,
      [JSON.stringify(data ?? {}), meetingId]
    );
  }

  // Populate searchable metadata index (best-effort, logs errors on its own).
  await indexMeetingMetadata(meetingId, category, data);

  await log('summary', `Pipeline ${category} completed for meeting ${meetingId}`, { meetingId });

  return data;
}

/**
 * Orchestrates the full flow: classify the meeting, then run the matching
 * category pipeline. Returns the final state of the category fields.
 */
export async function processMeetingCategory(meetingId: number): Promise<{
  category: MeetingCategory;
  confidence: number;
  reasoning: string;
  data: unknown;
}> {
  const { category, confidence, reasoning } = await classifyMeeting(meetingId);
  const data = await runCategoryPipeline(meetingId, category);
  return { category, confidence, reasoning, data };
}
