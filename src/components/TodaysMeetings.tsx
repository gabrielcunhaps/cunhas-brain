'use client';

import { useState, useEffect, useCallback } from 'react';
import CategoryBadge from './CategoryBadge';
import { CATEGORIES, CategoryId, getCategoryMeta } from '@/lib/categoryMeta';

interface TodayMeeting {
  id: string;
  title: string;
  date: string;
  duration: number | null;
  summary: string | null;
  category: CategoryId | null;
  categoryConfidence: number | null;
  categoryManual: boolean;
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
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [errorToast, setErrorToast] = useState<string | null>(null);

  const fetchMeetings = useCallback(async () => {
    try {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      const params = new URLSearchParams({
        from: start.toISOString(),
        to: end.toISOString(),
      });
      const res = await fetch(`/api/meetings/today?${params}`);
      if (!res.ok) throw new Error('Failed to fetch today meetings');
      const data: TodayMeeting[] = await res.json();
      setMeetings(Array.isArray(data) ? data : []);
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

  // Auto-dismiss error toast after 4 seconds
  useEffect(() => {
    if (!errorToast) return;
    const t = setTimeout(() => setErrorToast(null), 4000);
    return () => clearTimeout(t);
  }, [errorToast]);

  const setBusy = useCallback((id: string, busy: boolean) => {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const pickAndGenerate = useCallback(
    async (meetingId: string, category: CategoryId) => {
      // Optimistic update: mark as selected immediately
      setMeetings((prev) =>
        prev.map((m) =>
          m.id === meetingId
            ? { ...m, category, categoryManual: true, categoryConfidence: 1 }
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
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload?.error || 'Failed to categorize meeting');
        }
        await fetchMeetings();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('Error setting category:', msg);
        setErrorToast(msg);
        await fetchMeetings();
      } finally {
        setBusy(meetingId, false);
      }
    },
    [fetchMeetings, setBusy]
  );

  const reclassify = useCallback(
    async (meetingId: string) => {
      setBusy(meetingId, true);
      try {
        const res = await fetch(`/api/meetings/${meetingId}/categorize`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload?.error || 'Failed to reclassify');
        }
        await fetchMeetings();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('Error reclassifying:', msg);
        setErrorToast(msg);
      } finally {
        setBusy(meetingId, false);
      }
    },
    [fetchMeetings, setBusy]
  );

  return (
    <section
      style={{
        marginBottom: '2rem',
        padding: '1rem 1.25rem',
        borderRadius: '0.75rem',
        background: 'var(--surface-1)',
        border: '1px solid var(--border)',
        position: 'relative',
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

      {errorToast && (
        <div
          role="alert"
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            padding: '8px 12px',
            borderRadius: 6,
            background: 'var(--danger, #ef4444)',
            color: 'white',
            fontSize: 12,
            fontWeight: 500,
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            zIndex: 30,
            maxWidth: 320,
          }}
        >
          {errorToast}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                height: 220,
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {meetings.map((m) => (
            <MeetingCard
              key={m.id}
              meeting={m}
              busy={busyIds.has(m.id)}
              onPickCategory={pickAndGenerate}
              onReclassify={reclassify}
            />
          ))}
        </div>
      )}
    </section>
  );
}

interface MeetingCardProps {
  meeting: TodayMeeting;
  busy: boolean;
  onPickCategory: (meetingId: string, category: CategoryId) => void;
  onReclassify: (meetingId: string) => void;
}

function MeetingCard({ meeting, busy, onPickCategory, onReclassify }: MeetingCardProps) {
  const meta = getCategoryMeta(meeting.category);

  return (
    <div
      style={{
        position: 'relative',
        padding: '1rem 1.125rem',
        borderRadius: '0.625rem',
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        minHeight: 220,
      }}
    >
      {busy && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.35)',
            backdropFilter: 'blur(1px)',
            borderRadius: '0.625rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
          }}
        >
          <Spinner />
        </div>
      )}

      {/* Top row: time + duration / reclassify button */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
        }}
      >
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>
          {formatTime(meeting.date)}
          {meeting.duration ? ` · ${formatDuration(meeting.duration)}` : ''}
        </span>
        <button
          onClick={() => onReclassify(meeting.id)}
          disabled={busy}
          aria-label="Re-classify meeting"
          title="Re-run auto-classification"
          style={{
            padding: '4px 8px',
            borderRadius: 6,
            border: '1px solid var(--border)',
            background: 'var(--surface-3)',
            color: 'var(--text-secondary)',
            fontSize: 11,
            fontWeight: 500,
            cursor: busy ? 'wait' : 'pointer',
            opacity: busy ? 0.6 : 1,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span style={{ fontSize: 12 }}>↻</span>
          Re-classify
        </button>
      </div>

      {/* Title */}
      <h3
        style={{
          fontSize: '1rem',
          fontWeight: 700,
          color: 'var(--text-primary)',
          margin: 0,
          lineHeight: 1.3,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}
        title={meeting.title}
      >
        {meeting.title}
      </h3>

      {/* Category picker boxes */}
      <div
        style={{
          display: 'flex',
          gap: '0.375rem',
          flexWrap: 'wrap',
        }}
      >
        {CATEGORIES.map((cat) => {
          const isActive = meeting.category === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => onPickCategory(meeting.id, cat.id)}
              disabled={busy}
              aria-pressed={isActive}
              style={{
                flex: '1 1 0',
                minWidth: 70,
                padding: '6px 10px',
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 600,
                cursor: busy ? 'wait' : 'pointer',
                border: `1px solid ${cat.color}60`,
                background: isActive ? cat.color : `${cat.color}15`,
                color: isActive ? 'white' : cat.color,
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
                textAlign: 'center',
                opacity: busy ? 0.7 : 1,
              }}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Current category + confidence row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Current:</span>
        {meta ? (
          <CategoryBadge
            category={meeting.category}
            manual={meeting.categoryManual}
            confidence={meeting.categoryConfidence}
          />
        ) : (
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
            Not classified
          </span>
        )}
        {!meeting.categoryManual && meeting.categoryConfidence != null && (
          <span
            style={{
              fontSize: 10,
              padding: '2px 6px',
              borderRadius: 999,
              background: 'var(--surface-3)',
              color: 'var(--text-muted)',
              border: '1px solid var(--border)',
            }}
            title="Auto-classification confidence"
          >
            Auto {Math.round(meeting.categoryConfidence * 100)}%
          </span>
        )}
      </div>

      {/* Summary preview with gradient fade */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          minHeight: 48,
          maxHeight: 72,
          overflow: 'hidden',
        }}
      >
        {meeting.summary ? (
          <>
            <p
              style={{
                fontSize: 12,
                lineHeight: 1.5,
                color: 'var(--text-secondary)',
                margin: 0,
                display: '-webkit-box',
                WebkitLineClamp: 4,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {meeting.summary}
            </p>
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: 24,
                background: 'linear-gradient(to bottom, transparent, var(--surface-2))',
                pointerEvents: 'none',
              }}
            />
          </>
        ) : (
          <p
            style={{
              fontSize: 12,
              color: 'var(--text-muted)',
              fontStyle: 'italic',
              margin: 0,
            }}
          >
            Pick a category above to generate a summary.
          </p>
        )}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div
      style={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        border: '3px solid rgba(255,255,255,0.2)',
        borderTopColor: 'white',
        animation: 'spin 0.9s linear infinite',
      }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
