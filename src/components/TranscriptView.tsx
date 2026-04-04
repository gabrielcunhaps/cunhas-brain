'use client';

import { SpeakerSegment } from '@/lib/types';

const SPEAKER_COLORS = [
  '#6366f1', // indigo
  '#f59e0b', // amber
  '#10b981', // emerald
  '#ef4444', // red
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#f97316', // orange
  '#ec4899', // pink
  '#14b8a6', // teal
  '#84cc16', // lime
];

interface TranscriptViewProps {
  segments: SpeakerSegment[];
}

export default function TranscriptView({ segments }: TranscriptViewProps) {
  const speakerColorMap = new Map<string, string>();
  let colorIndex = 0;

  function getColor(speaker: string): string {
    if (!speakerColorMap.has(speaker)) {
      speakerColorMap.set(speaker, SPEAKER_COLORS[colorIndex % SPEAKER_COLORS.length]);
      colorIndex++;
    }
    return speakerColorMap.get(speaker)!;
  }

  if (segments.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-[var(--text-muted)] text-sm">No transcript available.</p>
      </div>
    );
  }

  return (
    <div className="max-h-[70vh] overflow-y-auto space-y-3 pr-2">
      {segments.map((seg, i) => {
        const color = getColor(seg.speaker);
        return (
          <div key={i} className="flex gap-3">
            <div className="flex-shrink-0 pt-0.5">
              <span
                className="inline-block text-xs font-medium px-2 py-0.5 rounded-full"
                style={{ backgroundColor: `${color}20`, color }}
              >
                {seg.speaker}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              {seg.timestamp && (
                <span className="text-[var(--text-muted)] text-xs mr-2">{seg.timestamp}</span>
              )}
              <p className="text-[var(--text-secondary)] text-sm leading-relaxed whitespace-pre-wrap">
                {seg.text}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
