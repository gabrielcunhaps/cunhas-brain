import MeetingDetail from '@/components/MeetingDetail';

interface MeetingPageProps {
  params: { id: string };
}

export default function MeetingPage({ params }: MeetingPageProps) {
  const meetingId = parseInt(params.id, 10);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <MeetingDetail meetingId={meetingId} />
    </div>
  );
}
