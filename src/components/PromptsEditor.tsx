'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

type PromptKey =
  | 'prompt_classify'
  | 'prompt_netsuite_kt'
  | 'prompt_manager'
  | 'prompt_customer'
  | 'prompt_student_first'
  | 'prompt_student_subsequent'
  | 'prompt_others'
  | 'prompt_newsletter';

interface TabDef {
  key: PromptKey;
  label: string;
  title: string;
  description: string;
  placeholders: { token: string; desc: string }[];
  pipeline: { field: string; dest: string }[];
  schemaExample: string;
}

const COMMON_PLACEHOLDERS: { token: string; desc: string }[] = [
  { token: '{title}', desc: 'Meeting title' },
  { token: '{summary}', desc: 'AI-generated summary' },
  { token: '{takeaways}', desc: 'Key takeaways list' },
  { token: '{actionItems}', desc: 'Action items list' },
  { token: '{transcript}', desc: 'Raw transcript (first 8000 chars)' },
  { token: '{participants}', desc: 'Speaker names' },
];

const STUDENT_PLACEHOLDERS: { token: string; desc: string }[] = [
  { token: '{studentName}', desc: 'Student name (for student prompts)' },
  { token: '{learningPlan}', desc: 'Current learning plan for the student' },
  { token: '{previousSessions}', desc: 'Recent session notes for the student' },
];

const TABS: TabDef[] = [
  {
    key: 'prompt_classify',
    label: 'Classifier',
    title: 'Meeting Classifier',
    description:
      'Picks ONE category (netsuite_kt, manager_1on1, customer_engagement, student_lesson, others) for every new meeting.',
    placeholders: COMMON_PLACEHOLDERS,
    schemaExample: `{
  "category": "netsuite_kt" | "manager_1on1" | "customer_engagement" | "student_lesson" | "others",
  "confidence": 0.0-1.0,
  "reasoning": "one or two sentences"
}`,
    pipeline: [
      { field: 'category', dest: 'meetings.category' },
      { field: 'confidence', dest: 'meetings.category_confidence' },
      { field: 'reasoning', dest: 'meetings.category_reasoning' },
    ],
  },
  {
    key: 'prompt_netsuite_kt',
    label: 'NetSuite KT',
    title: 'NetSuite KT Extractor',
    description:
      'Extracts technical topics, open questions, and prep reminders from internal NetSuite knowledge transfer sessions.',
    placeholders: COMMON_PLACEHOLDERS,
    schemaExample: `{
  "reminders": [
    { "topic": "...", "reminder": "...", "remind_before_next": true | false }
  ],
  "topics_covered": ["..."],
  "open_questions": ["..."],
  "notes": "overall context paragraph"
}`,
    pipeline: [
      { field: 'reminders[]', dest: 'netsuite_kt_reminders' },
      { field: 'topics_covered[]', dest: 'netsuite_kt_topics' },
      { field: 'open_questions[]', dest: 'netsuite_kt_questions' },
      { field: 'notes', dest: 'meetings.category_notes' },
    ],
  },
  {
    key: 'prompt_manager',
    label: 'Manager 1:1',
    title: 'Manager 1:1 Extractor',
    description:
      'Extracts priorities, todos, prep items, and decisions from manager 1:1 meetings.',
    placeholders: COMMON_PLACEHOLDERS,
    schemaExample: `{
  "priorities": [{ "content": "...", "due_date": "YYYY-MM-DD or null" }],
  "todos":      [{ "content": "...", "due_date": "YYYY-MM-DD or null" }],
  "prep":       [{ "content": "...", "due_date": "YYYY-MM-DD or null" }],
  "decisions":  [{ "content": "...", "due_date": null }],
  "notes": "overall context paragraph"
}`,
    pipeline: [
      { field: 'priorities[]', dest: 'manager_items (type=priority)' },
      { field: 'todos[]', dest: 'manager_items (type=todo)' },
      { field: 'prep[]', dest: 'manager_items (type=prep)' },
      { field: 'decisions[]', dest: 'manager_items (type=decision)' },
      { field: 'notes', dest: 'meetings.category_notes' },
    ],
  },
  {
    key: 'prompt_customer',
    label: 'Customer',
    title: 'Customer Engagement Extractor',
    description:
      'Extracts customer use cases, questions, comments, objections, and feature requests from customer-facing meetings.',
    placeholders: COMMON_PLACEHOLDERS,
    schemaExample: `{
  "customer": "name or null",
  "use_cases":        [{ "content": "...", "topic": "..." }],
  "questions":        [{ "content": "...", "topic": "..." }],
  "comments":         [{ "content": "...", "topic": "..." }],
  "objections":       [{ "content": "...", "topic": "..." }],
  "feature_requests": [{ "content": "...", "topic": "..." }],
  "notes": "overall context paragraph"
}`,
    pipeline: [
      { field: 'customer', dest: 'customer_engagements.customer_name' },
      { field: 'use_cases[]', dest: 'customer_items (type=use_case)' },
      { field: 'questions[]', dest: 'customer_items (type=question)' },
      { field: 'comments[]', dest: 'customer_items (type=comment)' },
      { field: 'objections[]', dest: 'customer_items (type=objection)' },
      { field: 'feature_requests[]', dest: 'customer_items (type=feature_request)' },
      { field: 'notes', dest: 'meetings.category_notes' },
    ],
  },
  {
    key: 'prompt_student_first',
    label: 'Student First Meeting',
    title: 'Student First Meeting Analyzer',
    description:
      'First meeting with a new student — infers a learning plan, level, goals, and initial notes. Used by the students pipeline.',
    placeholders: [...COMMON_PLACEHOLDERS, ...STUDENT_PLACEHOLDERS],
    schemaExample: `{
  "student_name": "...",
  "level": "beginner | intermediate | advanced",
  "goals": ["..."],
  "learning_plan": "multi-line plan",
  "notes": "overall context paragraph"
}`,
    pipeline: [
      { field: 'student_name', dest: 'students.name' },
      { field: 'level', dest: 'students.level' },
      { field: 'learning_plan', dest: 'students.learning_plan' },
      { field: 'goals[]', dest: 'student_goals' },
      { field: 'notes', dest: 'student_sessions.notes' },
    ],
  },
  {
    key: 'prompt_student_subsequent',
    label: 'Student Subsequent',
    title: 'Student Follow-up Analyzer',
    description:
      'Follow-up meetings with an existing student — tracks progress against the current learning plan and logs what was taught.',
    placeholders: [...COMMON_PLACEHOLDERS, ...STUDENT_PLACEHOLDERS],
    schemaExample: `{
  "topics_taught": ["..."],
  "progress_notes": "what improved, what still needs work",
  "next_steps": ["..."],
  "homework": ["..."],
  "updated_plan": "optional refreshed learning plan",
  "notes": "overall context paragraph"
}`,
    pipeline: [
      { field: 'topics_taught[]', dest: 'student_sessions.topics' },
      { field: 'progress_notes', dest: 'student_sessions.progress' },
      { field: 'next_steps[]', dest: 'student_sessions.next_steps' },
      { field: 'homework[]', dest: 'student_sessions.homework' },
      { field: 'updated_plan', dest: 'students.learning_plan (when set)' },
      { field: 'notes', dest: 'student_sessions.notes' },
    ],
  },
  {
    key: 'prompt_others',
    label: 'Others',
    title: 'Others Extractor',
    description:
      'Fallback extractor for meetings that do not fit any specific category — captures topics, decisions, and follow-ups.',
    placeholders: COMMON_PLACEHOLDERS,
    schemaExample: `{
  "topics": ["..."],
  "decisions": ["..."],
  "follow_ups": ["..."],
  "notes": "overall context paragraph"
}`,
    pipeline: [
      { field: 'topics[]', dest: 'other_meeting_topics' },
      { field: 'decisions[]', dest: 'other_meeting_decisions' },
      { field: 'follow_ups[]', dest: 'other_meeting_followups' },
      { field: 'notes', dest: 'meetings.category_notes' },
    ],
  },
  {
    key: 'prompt_newsletter',
    label: 'Newsletter',
    title: 'Newsletter AI Recap',
    description:
      'Generates the AI-powered newsletter digest from Inoreader articles. Uses the industry-recap format: Executive Summary, Product Matrix, Key Themes, Thought Leadership, Market Moves, What to Watch.',
    placeholders: [
      { token: '{from}', desc: 'Start date (YYYY-MM-DD)' },
      { token: '{to}', desc: 'End date (YYYY-MM-DD)' },
      { token: '{articleCount}', desc: 'Number of articles being analyzed' },
      { token: '{articles}', desc: 'Full article text (title, source, date, URL, content per article)' },
    ],
    schemaExample: `# Newsletter Recap: {from} to {to}
## Executive Summary
## Product & Release Matrix (table)
## Key Themes & Cross-Newsletter Signals
## Thought Leadership & Debates
## Market Moves & Competitive Landscape
## What to Watch`,
    pipeline: [
      { field: 'summary', dest: 'newsletter_cache (AI summary)' },
      { field: '(cached)', dest: 'app_settings.daily_summary_{date}' },
    ],
  },
];

export default function PromptsEditor({
  onToast,
}: {
  onToast: (type: 'success' | 'error', message: string) => void;
}) {
  const [activeKey, setActiveKey] = useState<PromptKey>('prompt_classify');
  const [values, setValues] = useState<Record<PromptKey, string>>(() =>
    TABS.reduce((acc, t) => {
      acc[t.key] = '';
      return acc;
    }, {} as Record<PromptKey, string>)
  );
  const [defaults, setDefaults] = useState<Record<PromptKey, string>>(() =>
    TABS.reduce((acc, t) => {
      acc[t.key] = '';
      return acc;
    }, {} as Record<PromptKey, string>)
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const activeTab = useMemo(
    () => TABS.find((t) => t.key === activeKey)!,
    [activeKey]
  );

  const loadPrompts = useCallback(async () => {
    try {
      setLoading(true);
      const [settingsRes, defaultsRes] = await Promise.all([
        fetch('/api/settings'),
        fetch('/api/prompts/defaults'),
      ]);
      const settings = settingsRes.ok ? await settingsRes.json() : {};
      const defs = defaultsRes.ok ? await defaultsRes.json() : {};

      const nextValues = { ...values };
      const nextDefaults = { ...defaults };
      for (const t of TABS) {
        nextDefaults[t.key] = defs[t.key] || '';
        nextValues[t.key] = settings[t.key] || defs[t.key] || '';
      }
      setDefaults(nextDefaults);
      setValues(nextValues);
    } catch (err) {
      console.error('Failed to load prompts:', err);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadPrompts();
  }, [loadPrompts]);

  const handleChange = (val: string) => {
    setValues((prev) => ({ ...prev, [activeKey]: val }));
  };

  const handleReset = () => {
    const def = defaults[activeKey];
    if (!def) {
      onToast('error', 'No default available for this prompt');
      return;
    }
    setValues((prev) => ({ ...prev, [activeKey]: def }));
    onToast('success', 'Reset to default (click Save to persist)');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: activeKey,
          value: values[activeKey] || '',
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      onToast('success', `${activeTab.label} prompt saved`);
    } catch (err) {
      console.error('Failed to save prompt:', err);
      onToast('error', 'Failed to save prompt');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="bg-[var(--surface-1)] border border-[var(--border)] rounded-2xl p-6">
      <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
        Prompts &amp; Pipelines
      </h2>
      <p className="text-sm text-[var(--text-muted)] mb-4">
        Edit the prompts used to classify meetings and extract structured data
        per category. Each prompt returns JSON that gets inserted into the
        database.
      </p>

      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.375rem',
          marginBottom: '1rem',
          borderBottom: '1px solid var(--border)',
          paddingBottom: '0.5rem',
        }}
      >
        {TABS.map((t) => {
          const isActive = t.key === activeKey;
          return (
            <button
              key={t.key}
              onClick={() => setActiveKey(t.key)}
              style={{
                padding: '0.375rem 0.75rem',
                borderRadius: '0.375rem',
                border: 'none',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                backgroundColor: isActive ? 'var(--accent)' : 'var(--surface-2)',
                color: isActive ? 'white' : 'var(--text-secondary)',
                transition: 'all 0.15s ease',
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Title + description */}
      <div style={{ marginBottom: '0.75rem' }}>
        <h3
          style={{
            fontSize: '0.95rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
            margin: 0,
          }}
        >
          {activeTab.title}
        </h3>
        <p
          style={{
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            margin: '0.25rem 0 0',
          }}
        >
          {activeTab.description}
        </p>
      </div>

      {/* Textarea */}
      <div style={{ marginBottom: '0.75rem' }}>
        <textarea
          value={values[activeKey]}
          onChange={(e) => handleChange(e.target.value)}
          disabled={loading}
          rows={18}
          spellCheck={false}
          style={{
            width: '100%',
            padding: '0.75rem',
            borderRadius: '0.5rem',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            fontSize: '0.75rem',
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            lineHeight: 1.5,
            resize: 'vertical',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Action buttons */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          marginBottom: '1.25rem',
        }}
      >
        <button
          onClick={handleSave}
          disabled={saving || loading}
          className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          onClick={handleReset}
          disabled={loading}
          className="px-4 py-2 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] text-sm font-medium hover:bg-[var(--surface-2)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Reset to Default
        </button>
      </div>

      {/* Placeholder legend */}
      <div
        style={{
          marginBottom: '1.25rem',
          padding: '0.75rem 0.875rem',
          borderRadius: '0.5rem',
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
        }}
      >
        <div
          style={{
            fontSize: '0.7rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--text-muted)',
            marginBottom: '0.5rem',
          }}
        >
          Available Placeholders
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: '0.375rem',
          }}
        >
          {activeTab.placeholders.map((p) => (
            <div
              key={p.token}
              style={{
                display: 'flex',
                gap: '0.5rem',
                alignItems: 'baseline',
                fontSize: '0.7rem',
              }}
            >
              <code
                style={{
                  fontFamily:
                    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  color: 'var(--accent)',
                  background: 'var(--surface-3)',
                  padding: '1px 5px',
                  borderRadius: 3,
                  whiteSpace: 'nowrap',
                }}
              >
                {p.token}
              </code>
              <span style={{ color: 'var(--text-secondary)' }}>{p.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Pipeline output */}
      <div
        style={{
          padding: '0.75rem 0.875rem',
          borderRadius: '0.5rem',
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
        }}
      >
        <div
          style={{
            fontSize: '0.7rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--text-muted)',
            marginBottom: '0.5rem',
          }}
        >
          Pipeline Output
        </div>

        <div style={{ marginBottom: '0.75rem' }}>
          <div
            style={{
              fontSize: '0.7rem',
              color: 'var(--text-secondary)',
              marginBottom: '0.25rem',
            }}
          >
            Expected JSON schema:
          </div>
          <pre
            style={{
              margin: 0,
              padding: '0.625rem 0.75rem',
              background: 'var(--surface-1)',
              border: '1px solid var(--border)',
              borderRadius: '0.375rem',
              color: 'var(--text-secondary)',
              fontSize: '0.7rem',
              lineHeight: 1.4,
              overflow: 'auto',
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              whiteSpace: 'pre',
            }}
          >
            {activeTab.schemaExample}
          </pre>
        </div>

        <div>
          <div
            style={{
              fontSize: '0.7rem',
              color: 'var(--text-secondary)',
              marginBottom: '0.375rem',
            }}
          >
            Data flow:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {activeTab.pipeline.map((row) => (
              <div
                key={row.field}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.7rem',
                }}
              >
                <code
                  style={{
                    fontFamily:
                      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                    color: 'var(--accent)',
                    background: 'var(--surface-3)',
                    padding: '1px 6px',
                    borderRadius: 3,
                    minWidth: 160,
                  }}
                >
                  {row.field}
                </code>
                <span style={{ color: 'var(--text-muted)' }}>→</span>
                <code
                  style={{
                    fontFamily:
                      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                    color: 'var(--success)',
                    background: 'var(--surface-3)',
                    padding: '1px 6px',
                    borderRadius: 3,
                  }}
                >
                  {row.dest}
                </code>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
