'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import CategoryBadge from './CategoryBadge';
import { CATEGORIES, CategoryId, getCategoryMeta } from '@/lib/categoryMeta';

interface TodayMeeting {
  id: string;
  title: string;
  date: string;
  duration: number | null;
  summary: string | null;
  category: CategoryId | null;
  category_confidence: number | null;
  category_manual: boolean;
  has_summary: boolean;
}

interface TodayResponse {
  meetings: TodayMeeting[];
}

function formatTime(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function formatDuration(duration: number | null): string {
  if (!duration || duration <= 0) return '';
  const mins = Math.round(duration / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem ? `${hrs}h ${rem}m` : `${hrs}h`;
}

export default function TodaysMeetings() {
  const [meetings, setMeetings] = useState<TodayMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement | null>(null);

  const fetchMeetings = useCallback(async () => {
    try {
      const res = await fetch('/api/meetings/today');
      if (!res.ok) throw new Error('Failed to fetch today meetings');
      const data: TodayResponse = await res.json();
      setMeetings(data.meetings || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching today meetings:', err);
      setError('Failed to load meetings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMeetings();
    const interval = setInterval(fetchMeetings, 60000);
    return () => clearInterval(interval);
  }, [fetchMeetings]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!openDropdown) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openDropdown]);

  const setBusy = useCallback((id: string, busy: boolean) => {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const pickCategory = async (meetingId: string, category: CategoryId) => {
    setOpenDropdown(null);
    // Optimistic update
    setMeetings((prev) =>
      prev.map((m) =>
        m.id === meetingId
          ? { ...m, category, category_manual: true, category_confidence: 1 }
          : m
      )
    );
    setBusy(meetingId, true);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/categorize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, manual: true }),
      });
      if (!res.ok) throw new Error('Failed to categorize');
      await fetchMeetings();
    } catch (err) {
      console.error('Error setting category:', err);
      await fetchMeetings();
    } finally {
      setBusy(meetingId, false);
    }
  };

  const reclassify = async (meetingId: string) => {
    setBusy(meetingId, true);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/categorize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error('Failed to reclassify');
      await fetchMeetings();
    } catch (err) {
      console.error('Error reclassifying:', err);
    } finally {
      setBusy(meetingId, false);
    }
  };

  const summarize = async (meetingId: string) => {
    setBusy(meetingId, true);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/summarize`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to summarize');
      // The summarize route auto-triggers categorization; refetch
      await fetchMeetings();
    } catch (err) {
      console.error('Error summarizing:', err);
    } finally {
      setBusy(meetingId, false);
    }
  };

  return (
    <section
      ref={containerRef}
      style={{
        marginBottom: '2rem',
        padding: '1rem 1.25rem',
        borderRadius: '0.75rem',
        background: 'var(--surface-1)',
        border: '1px solid var(--border)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '0.75rem',
        }}
      >
        <h2
          style={{
            fontSize: '0.95rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
            margin: 0,
          }}
        >
          Today&apos;s Meetings
        </h2>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          {loading ? 'Loading…' : `${meetings.length} meeting${meetings.length === 1 ? '' : 's'}`}
        </span>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                height: 64,
                borderRadius: '0.5rem',
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                opacity: 0.6,
                animation: 'pulse 2s ease-in-out infinite',
              }}
            />
          ))}
        </div>
      ) : error ? (
        <p style={{ color: 'var(--danger)', fontSize: '0.8rem' }}>{error}</p>
      ) : meetings.length === 0 ? (
        <p
          style={{
            color: 'var(--text-muted)',
            fontSize: '0.8rem',
            textAlign: 'center',
            padding: '1rem 0',
          }}
        >
          No meetings today
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {meetings.map((m) => {
            const meta = getCategoryMeta(m.category);
            const busy = busyIds.has(m.id);
            return (
              <div
                key={m.id}
                style={{
                  position: 'relative',
                  padding: '0.75rem 0.875rem',
                  borderRadius: '0.5rem',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.375rem',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    flexWrap: 'wrap',
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      flex: 1,
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={m.title}
                  >
                    {m.title}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {formatTime(m.date)}
                    {m.duration ? ` · ${formatDuration(m.duration)}` : ''}
                  </span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ position: 'relative' }}>
                    {meta ? (
                      <CategoryBadge
                        category={m.category}
                        manual={m.category_manual}
                        clickable
                        confidence={m.category_confidence}
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenDropdown(openDropdown === m.id ? null : m.id);
                        }}
                      />
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenDropdown(openDropdown === m.id ? null : m.id);
                        }}
                        style={{
                          padding: '2px 8px',
                          borderRadius: 999,
                          fontSize: 10,
                          fontWeight: 600,
                          color: 'var(--text-muted)',
                          background: 'var(--surface-3)',
                          border: '1px dashed var(--border)',
                          cursor: 'pointer',
                        }}
                      >
                        Set category
                      </button>
                    )}
                    {openDropdown === m.id && (
                      <CategoryDropdown
                        onPick={(cat) => pickCategory(m.id, cat)}
                        currentId={m.category}
                      />
                    )}
                  </div>

                  {!m.category_manual && m.category_confidence != null && (
                    <span
                      style={{
                        fontSize: 9,
                        padding: '2px 6px',
                        borderRadius: 999,
                        background: 'var(--surface-3)',
                        color: 'var(--text-muted)',
                        border: '1px solid var(--border)',
                      }}
                      title="Auto-classified confidence"
                    >
                      {Math.round(m.category_confidence * 100)}%
                    </span>
                  )}

                  <div style={{ flex: 1 }} />

                  {!m.has_summary ? (
                    <button
                      onClick={() => summarize(m.id)}
                      disabled={busy}
                      style={actionBtnStyle(busy)}
                    >
                      {busy ? 'Working…' : 'Summarize'}
                    </button>
                  ) : (
                    <button
                      onClick={() => reclassify(m.id)}
                      disabled={busy}
                      style={actionBtnStyle(busy)}
                    >
                      {busy ? 'Working…' : 'Re-classify'}
                    </button>
                  )}
                </div>

                {m.summary && (
                  <p
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary)',
                      margin: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 1,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {m.summary}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function actionBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: '3px 8px',
    borderRadius: '0.25rem',
    border: '1px solid var(--border)',
    background: 'var(--surface-3)',
    color: 'var(--text-secondary)',
    fontSize: '0.675rem',
    fontWeight: 500,
    cursor: disabled ? 'wait' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    transition: 'all 0.15s ease',
  };
}

function CategoryDropdown({
  onPick,
  currentId,
}: {
  onPick: (cat: CategoryId) => void;
  currentId: CategoryId | null;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 'calc(100% + 4px)',
        left: 0,
        zIndex: 20,
        minWidth: 180,
        padding: 4,
        background: 'var(--surface-3)',
        border: '1px solid var(--border)',
        borderRadius: '0.5rem',
        boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {CATEGORIES.map((c) => {
        const isCurrent = c.id === currentId;
        return (
          <button
            key={c.id}
            onClick={() => onPick(c.id)}
            style={{
              textAlign: 'left',
              padding: '6px 8px',
              border: 'none',
              background: isCurrent ? 'var(--surface-2)' : 'transparent',
              borderRadius: '0.25rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: 'var(--text-primary)',
              fontSize: '0.75rem',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                'var(--surface-2)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = isCurrent
                ? 'var(--surface-2)'
                : 'transparent';
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 3,
                background: c.color,
                flexShrink: 0,
              }}
            />
            <span style={{ fontWeight: 600 }}>{c.label}</span>
            <span
              style={{
                fontSize: '0.65rem',
                color: 'var(--text-muted)',
                marginLeft: 'auto',
              }}
            >
              {c.description}
            </span>
          </button>
        );
      })}
    </div>
  );
}
