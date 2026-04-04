'use client';

import { useState, useEffect } from 'react';
import { formatDate } from '@/lib/utils';

interface MeetingItem {
  id: number;
  title: string;
  date: string;
  hasTranscript: boolean;
}

interface MeetingSelectorProps {
  selectedIds: number[];
  onSelectionChange: (ids: number[]) => void;
}

export default function MeetingSelector({
  selectedIds,
  onSelectionChange,
}: MeetingSelectorProps) {
  const [meetings, setMeetings] = useState<MeetingItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMeetings() {
      try {
        const res = await fetch('/api/meetings?limit=50');
        if (res.ok) {
          const data = await res.json();
          setMeetings(data);
        }
      } catch (err) {
        console.error('Failed to fetch meetings:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchMeetings();
  }, []);

  const filtered = search
    ? meetings.filter((m) =>
        m.title.toLowerCase().includes(search.toLowerCase())
      )
    : meetings;

  const toggleMeeting = (id: number) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((sid) => sid !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--surface-1)] border-r border-[var(--border)]">
      <div className="p-3 border-b border-[var(--border)]">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            Meetings
          </h3>
          {selectedIds.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--accent)] text-white">
              {selectedIds.length}
            </span>
          )}
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search meetings..."
          className="w-full px-3 py-1.5 text-sm rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-sm text-[var(--text-muted)]">
            Loading meetings...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-4 text-sm text-[var(--text-muted)]">
            No meetings found
          </div>
        ) : (
          filtered.map((meeting) => (
            <label
              key={meeting.id}
              className="flex items-start gap-2 p-3 cursor-pointer hover:bg-[var(--surface-2)] border-b border-[var(--border)] transition-colors"
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(meeting.id)}
                onChange={() => toggleMeeting(meeting.id)}
                className="mt-0.5 rounded accent-[var(--accent)]"
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-[var(--text-primary)] truncate">
                  {meeting.title}
                </div>
                <div className="text-xs text-[var(--text-muted)]">
                  {formatDate(meeting.date)}
                </div>
                {!meeting.hasTranscript && (
                  <div className="text-xs text-[var(--text-muted)] italic">
                    No transcript
                  </div>
                )}
              </div>
            </label>
          ))
        )}
      </div>
    </div>
  );
}
