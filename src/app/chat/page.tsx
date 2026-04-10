'use client';

import { useState, useEffect, useRef } from 'react';
import MeetingSelector from '@/components/MeetingSelector';
import ChatInterface from '@/components/ChatInterface';
import { CATEGORIES, getVariablesForCategory, getCategoryMeta } from '@/lib/categoryMeta';

export interface ChatFilter {
  category: string | null;
  variable: string | null;
  search: string | null;
}

interface Fact {
  id: number;
  meeting_id: number;
  category: string;
  variable: string;
  value: string;
  meeting_title: string;
  meeting_date: string | null;
}

interface MetadataResponse {
  meetingIds: number[];
  facts: Fact[];
  counts: Record<string, number>;
  total: number;
}

const EMPTY_FILTER: ChatFilter = { category: null, variable: null, search: null };

export default function ChatPage() {
  const [selectedMeetingIds, setSelectedMeetingIds] = useState<number[]>([]);
  const [showSelector, setShowSelector] = useState(false);
  const [filter, setFilter] = useState<ChatFilter>(EMPTY_FILTER);
  const [searchInput, setSearchInput] = useState('');
  const [metadata, setMetadata] = useState<MetadataResponse | null>(null);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [expandedMeetings, setExpandedMeetings] = useState<Set<number>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasFilter = !!(filter.category || filter.variable || filter.search);

  // Debounce search input into filter
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setFilter((prev) => ({ ...prev, search: searchInput.trim() || null }));
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

  // Fetch metadata whenever the filter changes
  useEffect(() => {
    if (!hasFilter) {
      setMetadata(null);
      return;
    }
    let cancelled = false;
    setMetadataLoading(true);
    fetch('/api/chat/metadata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: filter.category,
        variable: filter.variable,
        search: filter.search,
      }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: MetadataResponse | null) => {
        if (!cancelled) setMetadata(data);
      })
      .catch((err) => {
        console.error('Failed to fetch metadata:', err);
        if (!cancelled) setMetadata(null);
      })
      .finally(() => {
        if (!cancelled) setMetadataLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filter, hasFilter]);

  const availableVariables = getVariablesForCategory(filter.category);
  const effectiveMeetingCount =
    selectedMeetingIds.length > 0
      ? selectedMeetingIds.length
      : metadata?.meetingIds.length || 0;
  const factCount = metadata?.total || 0;

  const clearFilter = () => {
    setFilter(EMPTY_FILTER);
    setSearchInput('');
  };

  const toggleMeetingExpanded = (id: number) => {
    setExpandedMeetings((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Group facts by meeting for sidebar display
  const factsByMeeting = new Map<
    number,
    { title: string; date: string | null; facts: Fact[] }
  >();
  if (metadata) {
    for (const f of metadata.facts) {
      if (!factsByMeeting.has(f.meeting_id)) {
        factsByMeeting.set(f.meeting_id, {
          title: f.meeting_title,
          date: f.meeting_date,
          facts: [],
        });
      }
      factsByMeeting.get(f.meeting_id)!.facts.push(f);
    }
  }

  return (
    <div className="flex h-screen bg-[var(--bg)]">
      {/* Mobile toggle */}
      <button
        onClick={() => setShowSelector(!showSelector)}
        className="md:hidden fixed top-3 left-3 z-50 p-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-primary)]"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d={showSelector ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'}
          />
        </svg>
      </button>

      {/* Sidebar */}
      <div
        className={`${
          showSelector ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0 fixed md:relative z-40 w-[320px] h-full transition-transform duration-200 ease-in-out flex flex-col bg-[var(--surface-1)] border-r border-[var(--border)]`}
      >
        {/* Filter section */}
        <div className="p-3 border-b border-[var(--border)]">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              Filter
            </h3>
            {hasFilter && (
              <button
                onClick={clearFilter}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                Clear
              </button>
            )}
          </div>

          <select
            value={filter.category || ''}
            onChange={(e) => {
              const category = e.target.value || null;
              setFilter({ category, variable: null, search: filter.search });
            }}
            className="w-full px-2 py-1.5 mb-2 text-sm rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
          >
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>

          {filter.category && availableVariables.length > 0 && (
            <select
              value={filter.variable || ''}
              onChange={(e) =>
                setFilter({ ...filter, variable: e.target.value || null })
              }
              className="w-full px-2 py-1.5 mb-2 text-sm rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
            >
              <option value="">All variables</option>
              {availableVariables.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          )}

          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Full-text search..."
            className="w-full px-2 py-1.5 text-sm rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
          />

          {/* Summary bar */}
          {hasFilter && (
            <div className="mt-2 text-xs text-[var(--text-muted)]">
              {metadataLoading ? (
                <span>Searching...</span>
              ) : (
                <span>
                  {effectiveMeetingCount} meeting
                  {effectiveMeetingCount !== 1 ? 's' : ''} ({factCount} matching fact
                  {factCount !== 1 ? 's' : ''})
                </span>
              )}
            </div>
          )}
        </div>

        {/* Facts list (when filter active) */}
        {hasFilter && metadata && metadata.facts.length > 0 && (
          <div className="border-b border-[var(--border)] max-h-[40%] overflow-y-auto">
            <div className="px-3 py-2 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">
              Matching Facts
            </div>
            {Array.from(factsByMeeting.entries()).map(([mid, info]) => {
              const isExpanded = expandedMeetings.has(mid);
              return (
                <div key={mid} className="border-t border-[var(--border)]">
                  <button
                    onClick={() => toggleMeetingExpanded(mid)}
                    className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-[var(--surface-2)] transition-colors"
                  >
                    <span className="text-xs text-[var(--text-muted)] mt-0.5">
                      {isExpanded ? '▼' : '▶'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-[var(--text-primary)] truncate">
                        {info.title}
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)]">
                        {info.facts.length} fact{info.facts.length !== 1 ? 's' : ''}
                        {info.date ? ` · ${new Date(info.date).toLocaleDateString()}` : ''}
                      </div>
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="px-3 pb-2 space-y-1">
                      {info.facts.map((f) => {
                        const meta = getCategoryMeta(f.category);
                        return (
                          <a
                            key={f.id}
                            href={`/meetings/${f.meeting_id}`}
                            className="block px-2 py-1 rounded bg-[var(--surface-2)] hover:bg-[var(--surface-3)] transition-colors"
                          >
                            <div className="flex items-center gap-1 mb-0.5">
                              <span
                                className="text-[10px] px-1 py-0.5 rounded"
                                style={{
                                  backgroundColor: (meta?.color || '#64748b') + '33',
                                  color: meta?.color || '#64748b',
                                }}
                              >
                                {f.variable}
                              </span>
                            </div>
                            <div className="text-[11px] text-[var(--text-secondary)] line-clamp-2">
                              {f.value}
                            </div>
                          </a>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Meeting selector */}
        <div className="flex-1 min-h-0">
          <MeetingSelector
            selectedIds={selectedMeetingIds}
            onSelectionChange={(ids) => {
              setSelectedMeetingIds(ids);
              setShowSelector(false);
            }}
          />
        </div>
      </div>

      {/* Overlay for mobile */}
      {showSelector && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/50"
          onClick={() => setShowSelector(false)}
        />
      )}

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Page header */}
        <div className="px-4 py-3 border-b border-[var(--border)] flex items-center gap-3">
          <div className="md:hidden w-8" />
          <h1 className="text-lg font-semibold text-[var(--text-primary)]">
            Chat with your meetings
          </h1>
        </div>

        <ChatInterface
          selectedMeetingIds={selectedMeetingIds}
          filter={filter}
          filteredMeetingIds={metadata?.meetingIds || []}
          filteredFactCount={factCount}
        />
      </div>
    </div>
  );
}
