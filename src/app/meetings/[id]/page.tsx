'use client';

import { useParams } from 'next/navigation';
import { Suspense } from 'react';
import MeetingDetail from '@/components/MeetingDetail';

export default function MeetingPage() {
  const params = useParams();
  const id = params?.id;
  const meetingId = typeof id === 'string' ? parseInt(id, 10) : NaN;

  if (!id || isNaN(meetingId)) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8 text-[var(--danger)]">
        Invalid meeting ID
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <Suspense fallback={<div className="animate-pulse h-96 bg-[var(--surface-1)] rounded-xl" />}>
        <MeetingDetail meetingId={meetingId} />
      </Suspense>
    </div>
  );
}
