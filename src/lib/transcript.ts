import { SpeakerSegment } from './types';

export function parseRawContent(raw: string): SpeakerSegment[] {
  const segments: SpeakerSegment[] = [];
  const lines = raw.split('\n');

  let currentSpeaker = '';
  let currentTimestamp = '';
  let currentText: string[] = [];

  for (const line of lines) {
    const headerMatch = line.match(/^(.+?)\s*\|\s*(\d{1,2}:\d{2})\s*$/);

    if (headerMatch) {
      if (currentSpeaker && currentText.length > 0) {
        segments.push({
          speaker: currentSpeaker,
          text: currentText.join('\n').trim(),
          timestamp: currentTimestamp,
        });
      }
      currentSpeaker = headerMatch[1].trim();
      currentTimestamp = headerMatch[2];
      currentText = [];
    } else if (line.trim()) {
      currentText.push(line.trim());
    }
  }

  if (currentSpeaker && currentText.length > 0) {
    segments.push({
      speaker: currentSpeaker,
      text: currentText.join('\n').trim(),
      timestamp: currentTimestamp,
    });
  }

  return segments;
}

export function parseContentArray(
  content: { text: string; speaker: string; speakerIndex: number }[]
): SpeakerSegment[] {
  return content.map((item) => ({
    speaker: item.speaker,
    text: item.text,
    timestamp: '',
  }));
}

export function truncateForContext(
  segments: SpeakerSegment[],
  maxChars: number
): string {
  const lines = segments.map((s) => `${s.speaker}: ${s.text}`);
  const full = lines.join('\n');

  if (full.length <= maxChars) return full;

  return full.slice(0, maxChars) + '\n...[truncated]';
}
