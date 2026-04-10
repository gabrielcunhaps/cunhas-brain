'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Meeting } from '@/lib/types';
import MeetingCard from './MeetingCard';
import SearchBar from './SearchBar';
import { CATEGORIES, getCategoryMeta } from '@/lib/categoryMeta';

type DurationFilter = 'any' | 'short' | 'medium' | 'long';

const VARIABLES_BY_CATEGORY: Record<string, string[]> = {
  netsuite_kt: ['reminder'],
  manager_1on1: ['priority', 'todo', 'prep', 'decision'],
  customer_engagement: ['use_case', 'question', 'comment', 'objection', 'feature_request'],
  student_lesson: ['topic', 'decision', 'follow_up'],
  others: ['topic', 'decision', 'follow_up'],
};

export default function MeetingList() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [durationFilter, setDurationFilter] = useState<DurationFilter>('any');
  const [category, setCategory] = useState<string | null>(null);
  const [variable, setVariable] = useState<string | null>(null);
  const [hasTodos, setHasTodos] = useState(false);
  const limit = 20;

  const availableVariables = useMemo(
    () => (category ? VARIABLES_BY_CATEGORY[category] || [] : []),
    [category]
  );

  const fetchMeetings = useCallback(
    async (reset: boolean = false) => {
      setLoading(true);
      const currentOffset = reset ? 0 : offset;
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(currentOffset),
      });
      if (search) params.set('search', search);
      if (dateFrom) params.set('from', new Date(dateFrom).toISOString());
      if (dateTo) params.set('to', new Date(dateTo + 'T23:59:59').toISOString());
      if (category) params.set('category', category);
      if (variable) params.set('variable', variable);
      if (hasTodos) params.set('hasTodos', 'true');

      try {
        const res = await fetch(`/api/meetings?${params}`);
        let data: Meeting[] = await res.json();

        // Client-side duration filter
        if (durationFilter !== 'any') {
          data = data.filter((m) => {
            const mins = m.duration / 60;
            if (durationFilter === 'short') return mins <= 15;
            if (durationFilter === 'medium') return mins > 15 && mins <= 60;
            if (durationFilter === 'long') return mins > 60;
            return true;
          });
        }

        if (reset) {
          setMeetings(data);
          setOffset(data.length);
        } else {
          setMeetings((prev) => [...prev, ...data]);
          setOffset((prev) => prev + data.length);
        }
        setHasMore(data.length === limit);
      } catch (err) {
        console.error('Failed to fetch meetings:', err);
      } finally {
        setLoading(false);
      }
    },
    [search, offset, dateFrom, dateTo, durationFilter, category, variable, hasTodos]
  );

  useEffect(() => {
    setOffset(0);
    setHasMore(true);
    fetchMeetings(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, dateFrom, dateTo, durationFilter, category, variable, hasTodos]);

  useEffect(() => {
    const interval = setInterval(() => fetchMeetings(true), 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, dateFrom, dateTo, durationFilter, category, variable, hasTodos]);

  // Reset variable when category changes and variable isn't valid for new category
  useEffect(() => {
    if (variable && !availableVariables.includes(variable)) {
      setVariable(null);
    }
  }, [availableVariables, variable]);

  const handleSearch = useCallback((query: string) => {
    setSearch(query);
  }, []);

  const handleCategoryClick = (id: string | null) => {
    setCategory((prev) => (prev === id ? null : id));
    if (id === null) setVariable(null);
  };

  const clearFilters = () => {
    setDateFrom('');
    setDateTo('');
    setDurationFilter('any');
    setSearch('');
    setCategory(null);
    setVariable(null);
    setHasTodos(false);
  };

  const hasActiveFilters =
    !!dateFrom ||
    !!dateTo ||
    durationFilter !== 'any' ||
    !!category ||
    !!variable ||
    hasTodos;

  return (
    <div className="space-y-4">
      {/* Search */}
      <SearchBar onSearch={handleSearch} />

      {/* Category pills */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => handleCategoryClick(null)}
          className={`px-3 py-1 text-xs rounded-full transition-colors border ${
            category === null
              ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
              : 'bg-[var(--surface-2)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--surface-3)]'
          }`}
        >
          All
        </button>
        {CATEGORIES.map((c) => {
          const active = category === c.id;
          return (
            <button
              key={c.id}
              onClick={() => handleCategoryClick(c.id)}
              style={
                active
                  ? {
                      backgroundColor: `${c.color}20`,
                      color: c.color,
                      borderColor: `${c.color}80`,
                    }
                  : undefined
              }
              className={`px-3 py-1 text-xs rounded-full transition-colors border font-semibold ${
                active
                  ? ''
                  : 'bg-[var(--surface-2)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--surface-3)]'
              }`}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      {/* Filters row */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Date range */}
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-[var(--text-muted)]">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-2 py-1 text-xs rounded-lg bg-[var(--surface-1)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-[var(--text-muted)]">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-2 py-1 text-xs rounded-lg bg-[var(--surface-1)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>

        {/* Duration filter */}
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-[var(--text-muted)]">Duration</label>
          <div className="flex gap-1">
            {([
              { key: 'any', label: 'Any' },
              { key: 'short', label: '<15m' },
              { key: 'medium', label: '15-60m' },
              { key: 'long', label: '>1h' },
            ] as { key: DurationFilter; label: string }[]).map((d) => (
              <button
                key={d.key}
                onClick={() => setDurationFilter(d.key)}
                className={`px-2 py-0.5 text-xs rounded-md transition-colors ${
                  durationFilter === d.key
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--surface-2)] text-[var(--text-secondary)] border border-[var(--border)] hover:bg-[var(--surface-3)]'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Variable filter — only when a category is picked */}
        {category && availableVariables.length > 0 && (
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-[var(--text-muted)]">Variable</label>
            <select
              value={variable || ''}
              onChange={(e) => setVariable(e.target.value || null)}
              className="px-2 py-1 text-xs rounded-lg bg-[var(--surface-1)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
            >
              <option value="">All</option>
              {availableVariables.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Has todos toggle */}
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={hasTodos}
            onChange={(e) => setHasTodos(e.target.checked)}
            className="accent-[var(--accent)]"
          />
          <span className="text-xs text-[var(--text-muted)]">Only with todos</span>
        </label>

        {/* Clear filters */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Active variable context line */}
      {variable && category && (
        <div className="text-xs text-[var(--text-muted)]">
          Showing meetings with{' '}
          <span className="font-semibold text-[var(--text-secondary)]">{variable}</span> in{' '}
          <span
            className="font-semibold"
            style={{ color: getCategoryMeta(category)?.color || undefined }}
          >
            {getCategoryMeta(category)?.label || category}
          </span>
        </div>
      )}

      {/* Meeting grid */}
      {loading && meetings.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="bg-[var(--surface-1)] border border-[var(--border)] rounded-xl p-4 animate-pulse"
            >
              <div className="h-4 bg-[var(--surface-3)] rounded w-3/4 mb-3" />
              <div className="h-3 bg-[var(--surface-3)] rounded w-1/2 mb-3" />
              <div className="flex gap-2">
                <div className="h-5 bg-[var(--surface-3)] rounded-full w-12" />
                <div className="h-5 bg-[var(--surface-3)] rounded-full w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : meetings.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-[var(--text-muted)] text-sm">
            {search || hasActiveFilters ? 'No meetings match your filters.' : 'No meetings found.'}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {meetings.map((meeting) => (
              <MeetingCard
                key={meeting.id}
                meeting={meeting}
                activeVariable={variable}
              />
            ))}
          </div>

          {hasMore && (
            <div className="flex justify-center pt-2">
              <button
                onClick={() => fetchMeetings(false)}
                disabled={loading}
                className="bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-secondary)]
                  text-sm px-6 py-2 rounded-lg hover:bg-[var(--surface-3)] transition-colors
                  disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
