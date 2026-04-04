'use client';

import { useState, useEffect } from 'react';
import { MeetingSummary } from '@/lib/types';

interface SummaryPanelProps {
  meetingId: number;
}

export default function SummaryPanel({ meetingId }: SummaryPanelProps) {
  const [summary, setSummary] = useState<MeetingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSummary() {
      try {
        const res = await fetch(`/api/meetings/${meetingId}/summarize`);
        const data = await res.json();
        if (data.cached) {
          setSummary({
            meetingId: data.meetingId,
            summary: data.summary,
            takeaways: data.takeaways,
            actionItems: data.actionItems,
            generatedAt: data.generatedAt,
          });
        }
      } catch (err) {
        console.error('Failed to fetch summary:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchSummary();
  }, [meetingId]);

  async function generateSummary() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/summarize`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to generate summary');
        return;
      }
      setSummary({
        meetingId: data.meetingId,
        summary: data.summary,
        takeaways: data.takeaways,
        actionItems: data.actionItems,
        generatedAt: data.generatedAt,
      });
    } catch (err) {
      console.error('Failed to generate summary:', err);
      setError('Failed to generate summary');
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-[var(--surface-1)] border border-[var(--border)] rounded-xl p-5 animate-pulse">
        <div className="h-5 bg-[var(--surface-3)] rounded w-1/3 mb-4" />
        <div className="space-y-2">
          <div className="h-3 bg-[var(--surface-3)] rounded w-full" />
          <div className="h-3 bg-[var(--surface-3)] rounded w-5/6" />
          <div className="h-3 bg-[var(--surface-3)] rounded w-4/6" />
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="bg-[var(--surface-1)] border border-[var(--border)] rounded-xl p-5">
        <h3 className="text-[var(--text-primary)] font-semibold text-sm mb-3">AI Summary</h3>

        {error && (
          <p className="text-[var(--danger)] text-xs mb-3">{error}</p>
        )}

        {generating ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-3 bg-[var(--surface-3)] rounded w-full" />
            <div className="h-3 bg-[var(--surface-3)] rounded w-5/6" />
            <div className="h-3 bg-[var(--surface-3)] rounded w-4/6" />
            <p className="text-[var(--text-muted)] text-xs mt-3">Generating summary...</p>
          </div>
        ) : (
          <button
            onClick={generateSummary}
            className="bg-[var(--accent)] text-white text-sm px-4 py-2 rounded-lg
              hover:bg-[var(--accent-hover)] transition-colors"
          >
            Generate Summary
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-[var(--surface-1)] border border-[var(--border)] rounded-xl p-5 space-y-4">
      <h3 className="text-[var(--text-primary)] font-semibold text-sm">AI Summary</h3>

      <div>
        <p className="text-[var(--text-secondary)] text-sm leading-relaxed whitespace-pre-wrap">
          {summary.summary}
        </p>
      </div>

      {summary.takeaways.length > 0 && (
        <div>
          <h4 className="text-[var(--text-primary)] font-medium text-xs uppercase tracking-wider mb-2">
            Key Takeaways
          </h4>
          <ul className="space-y-1">
            {summary.takeaways.map((t, i) => (
              <li key={i} className="text-[var(--text-secondary)] text-sm flex gap-2">
                <span className="text-[var(--accent)] flex-shrink-0">-</span>
                <span>{typeof t === 'string' ? t : JSON.stringify(t)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {summary.actionItems.length > 0 && (
        <div>
          <h4 className="text-[var(--text-primary)] font-medium text-xs uppercase tracking-wider mb-2">
            Action Items
          </h4>
          <ul className="space-y-1">
            {summary.actionItems.map((a, i) => {
              const text = typeof a === 'string' ? a : (a as Record<string, unknown>)?.task || JSON.stringify(a);
              const assignee = typeof a === 'object' && a !== null ? (a as Record<string, unknown>)?.assignee : null;
              return (
                <li key={i} className="text-[var(--text-secondary)] text-sm flex gap-2">
                  <span className="text-[var(--success)] flex-shrink-0">-</span>
                  <span>
                    {String(text)}
                    {assignee ? <span className="text-[var(--text-muted)]"> ({String(assignee)})</span> : null}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
