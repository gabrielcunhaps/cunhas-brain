'use client';

import { useRouter } from 'next/navigation';
import { Meeting } from '@/lib/types';
import { formatDuration, formatRelativeDate } from '@/lib/utils';

interface MeetingCardProps {
  meeting: Meeting;
}

export default function MeetingCard({ meeting }: MeetingCardProps) {
  const router = useRouter();

  return (
    <div
      onClick={() => router.push(`/meetings/${meeting.id}`)}
      className="bg-[var(--surface-1)] border border-[var(--border)] rounded-xl p-4 cursor-pointer
        hover:border-[var(--accent)] hover:bg-[var(--surface-2)] transition-all duration-200"
    >
      <h3 className="text-[var(--text-primary)] font-semibold text-sm truncate mb-2">
        {meeting.title}
      </h3>

      <p className="text-[var(--text-secondary)] text-xs mb-3">
        {formatRelativeDate(meeting.date)}
      </p>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="bg-[var(--surface-3)] text-[var(--text-secondary)] text-xs px-2 py-0.5 rounded-full">
          {formatDuration(meeting.duration)}
        </span>

        {meeting.speakers.length > 0 && (
          <span className="bg-[var(--surface-3)] text-[var(--text-secondary)] text-xs px-2 py-0.5 rounded-full">
            {meeting.speakers.length} speaker{meeting.speakers.length !== 1 ? 's' : ''}
          </span>
        )}

        {meeting.participants.length > 0 && (
          <span className="bg-[var(--surface-3)] text-[var(--text-secondary)] text-xs px-2 py-0.5 rounded-full">
            {meeting.participants.length} participant{meeting.participants.length !== 1 ? 's' : ''}
          </span>
        )}

        {meeting.hasTranscript && (
          <span className="bg-[var(--accent)]/10 text-[var(--accent)] text-xs px-2 py-0.5 rounded-full">
            Transcript
          </span>
        )}
      </div>
    </div>
  );
}
