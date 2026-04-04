'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MeetingDetail as MeetingDetailType } from '@/lib/types';
import { formatDuration, formatDate } from '@/lib/utils';
import TranscriptView from './TranscriptView';
import SummaryPanel from './SummaryPanel';

interface MeetingDetailProps {
  meetingId: number;
}

export default function MeetingDetail({ meetingId }: MeetingDetailProps) {
  const router = useRouter();
  const [meeting, setMeeting] = useState<MeetingDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMeeting() {
      try {
        const res = await fetch(`/api/meetings/${meetingId}`);
        if (!res.ok) {
          setError('Meeting not found');
          return;
        }
        const data = await res.json();
        setMeeting(data);
      } catch (err) {
        console.error('Failed to fetch meeting:', err);
        setError('Failed to load meeting');
      } finally {
        setLoading(false);
      }
    }
    fetchMeeting();
  }, [meetingId]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-6 bg-[var(--surface-3)] rounded w-1/3" />
        <div className="h-4 bg-[var(--surface-3)] rounded w-1/4" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
          <div className="lg:col-span-2 bg-[var(--surface-1)] border border-[var(--border)] rounded-xl p-5 h-96" />
          <div className="bg-[var(--surface-1)] border border-[var(--border)] rounded-xl p-5 h-64" />
        </div>
      </div>
    );
  }

  if (error || !meeting) {
    return (
      <div className="text-center py-12">
        <p className="text-[var(--danger)] text-sm mb-4">{error || 'Meeting not found'}</p>
        <button
          onClick={() => router.push('/meetings')}
          className="text-[var(--accent)] text-sm hover:underline"
        >
          Back to meetings
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/meetings')}
          className="text-[var(--text-muted)] text-sm hover:text-[var(--text-secondary)] transition-colors mb-3 flex items-center gap-1"
        >
          &larr; Back to meetings
        </button>

        <h1 className="text-[var(--text-primary)] text-xl font-semibold mb-2">
          {meeting.title}
        </h1>

        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[var(--text-secondary)] text-sm">
            {formatDate(meeting.date)}
          </span>
          <span className="bg-[var(--surface-3)] text-[var(--text-secondary)] text-xs px-2 py-0.5 rounded-full">
            {formatDuration(meeting.duration)}
          </span>
          {meeting.speakers.length > 0 && (
            <span className="text-[var(--text-muted)] text-xs">
              Speakers: {meeting.speakers.map((s) => s.name || s.first_name || `Speaker ${s.index}`).filter(Boolean).join(', ')}
            </span>
          )}
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Transcript (main) */}
        <div className="lg:col-span-2 bg-[var(--surface-1)] border border-[var(--border)] rounded-xl p-5">
          <h2 className="text-[var(--text-primary)] font-semibold text-sm mb-4">Transcript</h2>
          <TranscriptView segments={meeting.segments} />
        </div>

        {/* Summary (sidebar) */}
        <div>
          <SummaryPanel meetingId={meeting.id} />
        </div>
      </div>
    </div>
  );
}
