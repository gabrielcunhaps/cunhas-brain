'use client';

import { useParams } from 'next/navigation';
import MeetingDetail from '@/components/MeetingDetail';

export default function MeetingPage() {
  const params = useParams();
  const meetingId = parseInt(params.id as string, 10);

  if (isNaN(meetingId)) {
    return <div className="max-w-6xl mx-auto px-4 py-8 text-[var(--danger)]">Invalid meeting ID</div>;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <MeetingDetail meetingId={meetingId} />
    </div>
  );
}
