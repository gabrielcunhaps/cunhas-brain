'use client';

import { useState, useEffect, useCallback } from 'react';

interface LogEntry {
  id: number;
  type: string;
  message: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  webhook: { bg: '#1e3a5f', text: '#60a5fa' },
  summary: { bg: '#3b1f6e', text: '#a78bfa' },
  chat: { bg: '#14532d', text: '#4ade80' },
  error: { bg: '#7f1d1d', text: '#f87171' },
  auth: { bg: '#713f12', text: '#facc15' },
};

const FILTER_TABS = ['all', 'webhook', 'summary', 'chat', 'error', 'auth'] as const;

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);

  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function LogsView() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const LIMIT = 50;

  const fetchLogs = useCallback(async (currentOffset: number, append: boolean) => {
    try {
      const typeParam = filter === 'all' ? '' : `&type=${filter}`;
      const res = await fetch(`/api/logs?limit=${LIMIT}&offset=${currentOffset}${typeParam}`);
      if (!res.ok) return;
      const data: LogEntry[] = await res.json();

      if (append) {
        setLogs((prev) => [...prev, ...data]);
      } else {
        setLogs(data);
      }
      setHasMore(data.length === LIMIT);
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  // Initial fetch and filter change
  useEffect(() => {
    setLoading(true);
    setOffset(0);
    setExpandedIds(new Set());
    fetchLogs(0, false);
  }, [filter, fetchLogs]);

  // Auto-refresh every 15s
  useEffect(() => {
    const interval = setInterval(() => {
      fetchLogs(0, false);
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchLogs]);

  const loadMore = () => {
    const newOffset = offset + LIMIT;
    setOffset(newOffset);
    fetchLogs(newOffset, true);
  };

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div>
      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {FILTER_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            style={{
              padding: '6px 16px',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 500,
              textTransform: 'capitalize',
              background: filter === tab ? 'var(--accent)' : 'var(--surface-2)',
              color: filter === tab ? '#fff' : 'var(--text-secondary)',
              transition: 'all 0.15s ease',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Loading state */}
      {loading && logs.length === 0 && (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0' }}>
          Loading logs...
        </p>
      )}

      {/* Empty state */}
      {!loading && logs.length === 0 && (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0' }}>
          No logs found.
        </p>
      )}

      {/* Log entries */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {logs.map((entry) => {
          const colors = TYPE_COLORS[entry.type] || { bg: 'var(--surface-2)', text: 'var(--text-secondary)' };
          const hasMetadata = entry.metadata && Object.keys(entry.metadata).length > 0;
          const isExpanded = expandedIds.has(entry.id);

          return (
            <div
              key={entry.id}
              style={{
                background: 'var(--surface-1)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '12px 16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                {/* Type badge */}
                <span
                  style={{
                    display: 'inline-block',
                    padding: '2px 10px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    background: colors.bg,
                    color: colors.text,
                    flexShrink: 0,
                  }}
                >
                  {entry.type}
                </span>

                {/* Message */}
                <span style={{ color: 'var(--text-primary)', fontSize: '14px', flex: 1 }}>
                  {entry.message}
                </span>

                {/* Timestamp */}
                <span
                  style={{
                    color: 'var(--text-muted)',
                    fontSize: '12px',
                    flexShrink: 0,
                  }}
                >
                  {relativeTime(entry.created_at)}
                </span>

                {/* Expand button */}
                {hasMetadata && (
                  <button
                    onClick={() => toggleExpand(entry.id)}
                    style={{
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border)',
                      borderRadius: '4px',
                      padding: '2px 8px',
                      cursor: 'pointer',
                      color: 'var(--text-muted)',
                      fontSize: '11px',
                      flexShrink: 0,
                    }}
                  >
                    {isExpanded ? 'Hide' : 'Meta'}
                  </button>
                )}
              </div>

              {/* Expanded metadata */}
              {isExpanded && hasMetadata && (
                <pre
                  style={{
                    marginTop: '10px',
                    padding: '10px',
                    background: 'var(--surface-2)',
                    borderRadius: '6px',
                    color: 'var(--text-secondary)',
                    fontSize: '12px',
                    overflow: 'auto',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                  }}
                >
                  {JSON.stringify(entry.metadata, null, 2)}
                </pre>
              )}
            </div>
          );
        })}
      </div>

      {/* Load more */}
      {hasMore && logs.length > 0 && (
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <button
            onClick={loadMore}
            style={{
              padding: '8px 24px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              background: 'var(--surface-2)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Load more
          </button>
        </div>
      )}
    </div>
  );
}
