'use client';

import { useState, useEffect, useCallback } from 'react';
import { Meeting } from '@/lib/types';
import MeetingCard from './MeetingCard';
import SearchBar from './SearchBar';

type DurationFilter = 'any' | 'short' | 'medium' | 'long';

export default function MeetingList() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [durationFilter, setDurationFilter] = useState<DurationFilter>('any');
  const limit = 20;

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
    [search, offset, dateFrom, dateTo, durationFilter]
  );

  useEffect(() => {
    setOffset(0);
    setHasMore(true);
    fetchMeetings(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, dateFrom, dateTo, durationFilter]);

  useEffect(() => {
    const interval = setInterval(() => fetchMeetings(true), 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, dateFrom, dateTo, durationFilter]);

  const handleSearch = useCallback((query: string) => {
    setSearch(query);
  }, []);

  const clearFilters = () => {
    setDateFrom('');
    setDateTo('');
    setDurationFilter('any');
    setSearch('');
  };

  const hasActiveFilters = dateFrom || dateTo || durationFilter !== 'any';

  return (
    <div className="space-y-4">
      {/* Search */}
      <SearchBar onSearch={handleSearch} />

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
              <MeetingCard key={meeting.id} meeting={meeting} />
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
