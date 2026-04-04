import LogsView from '@/components/LogsView';

export default function LogsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-[var(--text-primary)] text-2xl font-bold mb-6">Activity Logs</h1>
      <LogsView />
    </div>
  );
}
