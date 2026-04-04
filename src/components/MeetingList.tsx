'use client';

import { useState, useEffect, useCallback } from 'react';
import { Meeting } from '@/lib/types';
import MeetingCard from './MeetingCard';
import SearchBar from './SearchBar';

export default function MeetingList() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
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

      try {
        const res = await fetch(`/api/meetings?${params}`);
        const data: Meeting[] = await res.json();

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
    [search, offset]
  );

  // Initial fetch and search changes
  useEffect(() => {
    setOffset(0);
    setHasMore(true);
    fetchMeetings(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      fetchMeetings(true);
    }, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const handleSearch = useCallback((query: string) => {
    setSearch(query);
  }, []);

  return (
    <div className="space-y-4">
      <SearchBar onSearch={handleSearch} />

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
            {search ? 'No meetings match your search.' : 'No meetings found.'}
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
