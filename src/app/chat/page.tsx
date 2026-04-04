'use client';

import { useState } from 'react';
import MeetingSelector from '@/components/MeetingSelector';
import ChatInterface from '@/components/ChatInterface';

export default function ChatPage() {
  const [selectedMeetingIds, setSelectedMeetingIds] = useState<number[]>([]);
  const [showSelector, setShowSelector] = useState(false);

  return (
    <div className="flex h-screen bg-[var(--bg)]">
      {/* Mobile toggle */}
      <button
        onClick={() => setShowSelector(!showSelector)}
        className="md:hidden fixed top-3 left-3 z-50 p-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-primary)]"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d={showSelector ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'}
          />
        </svg>
      </button>

      {/* Sidebar — meeting selector */}
      <div
        className={`${
          showSelector ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0 fixed md:relative z-40 w-[300px] h-full transition-transform duration-200 ease-in-out`}
      >
        <MeetingSelector
          selectedIds={selectedMeetingIds}
          onSelectionChange={(ids) => {
            setSelectedMeetingIds(ids);
            setShowSelector(false);
          }}
        />
      </div>

      {/* Overlay for mobile */}
      {showSelector && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/50"
          onClick={() => setShowSelector(false)}
        />
      )}

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Page header */}
        <div className="px-4 py-3 border-b border-[var(--border)] flex items-center gap-3">
          <div className="md:hidden w-8" /> {/* Spacer for mobile toggle */}
          <h1 className="text-lg font-semibold text-[var(--text-primary)]">
            Chat with your meetings
          </h1>
        </div>

        <ChatInterface selectedMeetingIds={selectedMeetingIds} />
      </div>
    </div>
  );
}
