'use client';

export default function MeetingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 text-center">
      <h2 className="text-[var(--text-primary)] text-lg font-semibold mb-2">
        Something went wrong
      </h2>
      <p className="text-[var(--text-muted)] text-sm mb-4">
        {error.message || 'Failed to load meeting'}
      </p>
      <button
        onClick={reset}
        className="bg-[var(--accent)] text-white text-sm px-4 py-2 rounded-lg hover:bg-[var(--accent-hover)] transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
