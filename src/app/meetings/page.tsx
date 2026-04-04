import MeetingList from '@/components/MeetingList';

export default function MeetingsPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-[var(--text-primary)] text-2xl font-semibold mb-6">Meetings</h1>
      <MeetingList />
    </div>
  );
}
