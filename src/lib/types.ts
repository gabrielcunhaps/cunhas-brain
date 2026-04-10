export interface Meeting {
  id: number;
  title: string;
  date: string;
  duration: number; // minutes
  participants: string[];
  speakers: { name?: string; first_name?: string; last_name?: string; index: number }[];
  hasTranscript: boolean;
  category?: string | null;
  categoryConfidence?: number | null;
  categoryManual?: boolean;
  matchCount?: number;
}

export interface SpeakerSegment {
  speaker: string;
  text: string;
  timestamp?: string;
}

export interface MeetingDetail extends Meeting {
  rawContent: string;
  segments: SpeakerSegment[];
}

export interface MeetingSummary {
  meetingId: number;
  summary: string;
  takeaways: unknown[];
  actionItems: unknown[];
  generatedAt: string;
}

export interface ChatMessage {
  id: number;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  meetingIds: number[];
  createdAt: string;
}
