'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface SessionInsights {
  sessionSummary?: string;
  todos?: string[];
  recommendations?: string[];
  topicsDiscussed?: string[];
  progressNotes?: string;
  nextSessionPlan?: string;
  homework?: string;
}

interface Meeting {
  id: string;
  meeting_id: string;
  title: string;
  date: string;
  duration: number;
  session_notes: string | null;
  homework: string | null;
  next_session_plan: string | null;
}

interface StudentData {
  id: string;
  name: string;
  email: string | null;
  platform: string | null;
  status: string;
  notes: string | null;
  learning_plan: { topics?: string[]; milestones?: string[]; timeline?: string } | null;
  profile: { background?: string; goals?: string; level?: string; style?: string } | null;
  meetings: Meeting[];
  created_at: string;
  updated_at: string;
}

interface AvailableMeeting {
  id: string;
  title: string;
  date: string;
  duration: number;
}

function parseInsights(sessionNotes: string | null): SessionInsights | null {
  if (!sessionNotes) return null;
  try {
    const parsed = JSON.parse(sessionNotes);
    if (typeof parsed === 'object' && parsed !== null) return parsed;
  } catch {
    // Not JSON, return as plain summary
    return { sessionSummary: sessionNotes };
  }
  return null;
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0m';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

// Collapsible section component
function CollapsibleSection({
  title,
  icon,
  defaultOpen = false,
  badge,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl bg-[var(--surface-1)] border border-[var(--border)] overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--surface-2)] transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            {title}
          </span>
          {badge}
        </div>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--text-muted)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && <div className="px-4 pb-4 border-t border-[var(--border)]">{children}</div>}
    </div>
  );
}

export default function StudentDetail({ studentId }: { studentId: string }) {
  const router = useRouter();
  const [student, setStudent] = useState<StudentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({ name: '', email: '', notes: '' });
  const [saving, setSaving] = useState(false);

  // Attach meeting state
  const [showAttach, setShowAttach] = useState(false);
  const [availableMeetings, setAvailableMeetings] = useState<AvailableMeeting[]>([]);
  const [loadingMeetings, setLoadingMeetings] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [aiProcessing, setAiProcessing] = useState(false);

  // Expanded sessions
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());

  const toggleSession = (id: string) => {
    setExpandedSessions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const fetchStudent = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/students/${studentId}`);
      if (!res.ok) throw new Error('Failed to fetch student');
      const data = await res.json();

      // Parse JSONB fields if they come as strings
      if (typeof data.learning_plan === 'string') {
        try { data.learning_plan = JSON.parse(data.learning_plan); } catch { data.learning_plan = null; }
      }
      if (typeof data.profile === 'string') {
        try { data.profile = JSON.parse(data.profile); } catch { data.profile = null; }
      }

      setStudent(data);
      setEditData({ name: data.name, email: data.email || '', notes: data.notes || '' });
    } catch (err) {
      console.error('Failed to fetch student:', err);
      setError('Failed to load student');
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    fetchStudent();
  }, [fetchStudent]);

  const fetchAvailableMeetings = async () => {
    setLoadingMeetings(true);
    try {
      const res = await fetch('/api/meetings?limit=100');
      if (!res.ok) throw new Error('Failed to fetch meetings');
      const allMeetings: AvailableMeeting[] = await res.json();

      const attachedIds = new Set(student?.meetings.map((m) => m.meeting_id) || []);
      setAvailableMeetings(allMeetings.filter((m) => !attachedIds.has(m.id)));
    } catch (err) {
      console.error('Failed to fetch meetings:', err);
    } finally {
      setLoadingMeetings(false);
    }
  };

  const handleAttach = async (meetingId: string) => {
    setAttaching(true);
    setAiProcessing(true);
    try {
      const res = await fetch(`/api/students/${studentId}/meetings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingId }),
      });
      if (!res.ok) throw new Error('Failed to attach meeting');
      setShowAttach(false);
      await fetchStudent();
    } catch (err) {
      console.error('Failed to attach meeting:', err);
      setError('Failed to attach meeting');
    } finally {
      setAttaching(false);
      setAiProcessing(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/students/${studentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData),
      });
      if (!res.ok) throw new Error('Failed to update student');
      setEditing(false);
      await fetchStudent();
    } catch (err) {
      console.error('Failed to update student:', err);
      setError('Failed to update student');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this student?')) return;
    try {
      const res = await fetch(`/api/students/${studentId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      router.push('/students');
    } catch (err) {
      console.error('Failed to delete student:', err);
      setError('Failed to delete student');
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'active': return 'var(--success)';
      case 'paused': return 'var(--text-muted)';
      case 'completed': return 'var(--accent)';
      case 'inactive': return 'var(--danger)';
      default: return 'var(--text-secondary)';
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-[var(--surface-2)] rounded w-1/3" />
        <div className="h-4 bg-[var(--surface-2)] rounded w-1/4" />
        <div className="h-32 bg-[var(--surface-1)] rounded-xl" />
        <div className="h-48 bg-[var(--surface-1)] rounded-xl" />
      </div>
    );
  }

  if (error && !student) {
    return (
      <div className="text-center py-12">
        <p className="text-[var(--danger)] text-sm">{error}</p>
        <button
          onClick={() => router.push('/students')}
          className="mt-4 text-sm text-[var(--accent)] hover:text-[var(--accent-hover)]"
        >
          Back to Students
        </button>
      </div>
    );
  }

  if (!student) return null;

  // Sort meetings by date ascending for session numbering
  const sortedMeetings = [...student.meetings].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  const totalHours = sortedMeetings.reduce((sum, m) => sum + (m.duration || 0), 0);

  return (
    <div className="space-y-5">
      {/* Back link */}
      <button
        onClick={() => router.push('/students')}
        className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] flex items-center gap-1 transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back to Students
      </button>

      {/* Header Card */}
      <div className="p-5 rounded-xl bg-[var(--surface-1)] border border-[var(--border)]">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">{student.name}</h1>
              <span
                className="text-[10px] font-medium px-2.5 py-1 rounded-full uppercase"
                style={{
                  color: statusColor(student.status),
                  backgroundColor: `color-mix(in srgb, ${statusColor(student.status)} 15%, transparent)`,
                }}
              >
                {student.status}
              </span>
              {student.platform && (
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-[var(--surface-2)] text-[var(--text-muted)] border border-[var(--border)]">
                  {student.platform}
                </span>
              )}
            </div>
            {student.email && (
              <p className="text-sm text-[var(--text-secondary)] mb-3">{student.email}</p>
            )}
            {/* Stats */}
            <div className="flex items-center gap-5 flex-wrap">
              <div className="flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <span className="text-sm text-[var(--text-primary)] font-medium">{sortedMeetings.length}</span>
                <span className="text-xs text-[var(--text-muted)]">{sortedMeetings.length === 1 ? 'session' : 'sessions'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
                <span className="text-sm text-[var(--text-primary)] font-medium">{formatDuration(totalHours)}</span>
                <span className="text-xs text-[var(--text-muted)]">total</span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => setEditing(!editing)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--surface-2)] text-[var(--text-secondary)] hover:bg-[var(--surface-3)] border border-[var(--border)] transition-colors"
            >
              {editing ? 'Cancel' : 'Edit'}
            </button>
            <button
              onClick={handleDelete}
              className="px-3 py-1.5 text-xs font-medium rounded-lg text-[var(--danger)] hover:bg-[var(--surface-2)] border border-[var(--border)] transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="px-3 py-2 text-sm rounded-lg bg-[var(--danger)]/10 text-[var(--danger)] border border-[var(--danger)]/20">
          {error}
        </div>
      )}

      {/* Edit Form */}
      {editing && (
        <div className="p-4 rounded-xl bg-[var(--surface-1)] border border-[var(--border)] space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[var(--text-muted)] mb-1 block">Name</label>
              <input
                type="text"
                value={editData.name}
                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
            <div>
              <label className="text-xs text-[var(--text-muted)] mb-1 block">Email</label>
              <input
                type="email"
                value={editData.email}
                onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-[var(--text-muted)] mb-1 block">Notes</label>
            <textarea
              value={editData.notes}
              onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] resize-none"
            />
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}

      {/* Notes (when not editing) */}
      {student.notes && !editing && (
        <div className="px-4 py-3 rounded-xl bg-[var(--surface-1)] border border-[var(--border)]">
          <span className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider">Notes</span>
          <p className="text-sm text-[var(--text-secondary)] mt-1">{student.notes}</p>
        </div>
      )}

      {/* Profile Section (collapsible) */}
      {student.profile && (
        <CollapsibleSection
          title="Student Profile"
          defaultOpen={false}
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
            </svg>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
            {student.profile.background && (
              <div>
                <span className="text-[10px] font-medium text-[var(--text-muted)] uppercase">Background</span>
                <p className="text-sm text-[var(--text-primary)] mt-0.5">{student.profile.background}</p>
              </div>
            )}
            {student.profile.goals && (
              <div>
                <span className="text-[10px] font-medium text-[var(--text-muted)] uppercase">Goals</span>
                <p className="text-sm text-[var(--text-primary)] mt-0.5">{student.profile.goals}</p>
              </div>
            )}
            {student.profile.level && (
              <div>
                <span className="text-[10px] font-medium text-[var(--text-muted)] uppercase">Level</span>
                <p className="text-sm text-[var(--text-primary)] mt-0.5">{student.profile.level}</p>
              </div>
            )}
            {student.profile.style && (
              <div>
                <span className="text-[10px] font-medium text-[var(--text-muted)] uppercase">Learning Style</span>
                <p className="text-sm text-[var(--text-primary)] mt-0.5">{student.profile.style}</p>
              </div>
            )}
          </div>
        </CollapsibleSection>
      )}

      {/* Learning Plan Section (collapsible) */}
      {student.learning_plan && (
        <CollapsibleSection
          title="Learning Plan"
          defaultOpen={false}
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
          }
        >
          <div className="mt-3 space-y-4">
            {student.learning_plan.topics && student.learning_plan.topics.length > 0 && (
              <div>
                <span className="text-[10px] font-medium text-[var(--text-muted)] uppercase">Topics</span>
                <ul className="mt-1.5 space-y-1.5">
                  {student.learning_plan.topics.map((topic, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-primary)]">
                      <input
                        type="checkbox"
                        disabled
                        className="mt-0.5 accent-[var(--accent)]"
                        style={{ accentColor: 'var(--accent)' }}
                      />
                      {topic}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {student.learning_plan.milestones && student.learning_plan.milestones.length > 0 && (
              <div>
                <span className="text-[10px] font-medium text-[var(--text-muted)] uppercase">Milestones</span>
                <ul className="mt-1.5 space-y-1.5">
                  {student.learning_plan.milestones.map((milestone, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-primary)]">
                      <span
                        className="inline-block w-2 h-2 rounded-full mt-1.5 shrink-0"
                        style={{ backgroundColor: 'var(--success)' }}
                      />
                      {milestone}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {student.learning_plan.timeline && (
              <div>
                <span className="text-[10px] font-medium text-[var(--text-muted)] uppercase">Timeline</span>
                <p className="text-sm text-[var(--text-primary)] mt-0.5">{student.learning_plan.timeline}</p>
              </div>
            )}
          </div>
        </CollapsibleSection>
      )}

      {/* Session History */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              Session History ({sortedMeetings.length})
            </h2>
          </div>
          <button
            onClick={() => {
              setShowAttach(!showAttach);
              if (!showAttach) fetchAvailableMeetings();
            }}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors flex items-center gap-1.5"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Attach Meeting
          </button>
        </div>

        {/* AI Processing Indicator */}
        {aiProcessing && (
          <div className="mb-3 px-4 py-3 text-sm rounded-xl bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20 flex items-center gap-3">
            <svg className="animate-spin h-4 w-4 shrink-0" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <div>
              <p className="font-medium">Analyzing meeting...</p>
              <p className="text-xs opacity-75 mt-0.5">
                {sortedMeetings.length === 0
                  ? 'Generating learning plan, student profile, and session insights'
                  : 'Generating session insights, todos, and recommendations'}
              </p>
            </div>
          </div>
        )}

        {/* Attach Meeting Dropdown */}
        {showAttach && (
          <div className="mb-3 p-3 rounded-xl bg-[var(--surface-1)] border border-[var(--border)] max-h-60 overflow-y-auto">
            {loadingMeetings ? (
              <p className="text-xs text-[var(--text-muted)] py-2 text-center">Loading available meetings...</p>
            ) : availableMeetings.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] py-2 text-center">No unattached meetings available.</p>
            ) : (
              <div className="space-y-1">
                <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-2 px-2">
                  Select a meeting to attach and analyze
                </p>
                {availableMeetings.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => handleAttach(m.id)}
                    disabled={attaching}
                    className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-[var(--surface-2)] transition-colors disabled:opacity-50 flex items-center justify-between group"
                  >
                    <span className="text-[var(--text-primary)] truncate group-hover:text-[var(--accent)] transition-colors">
                      {m.title}
                    </span>
                    <div className="flex items-center gap-2 ml-2 shrink-0">
                      <span className="text-xs text-[var(--text-muted)]">
                        {formatDuration(m.duration)}
                      </span>
                      <span className="text-xs text-[var(--text-muted)]">
                        {new Date(m.date).toLocaleDateString()}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Session Timeline */}
        {sortedMeetings.length === 0 ? (
          <div className="text-center py-12 rounded-xl bg-[var(--surface-1)] border border-[var(--border)]">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3 opacity-50">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <p className="text-sm text-[var(--text-muted)]">No sessions yet</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">Attach a meeting to get started with AI-powered session insights</p>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline vertical line */}
            <div
              className="absolute left-[15px] top-[24px] bottom-[24px] w-[2px]"
              style={{ backgroundColor: 'var(--border)' }}
            />

            <div className="space-y-3">
              {sortedMeetings.map((meeting, index) => {
                const sessionNum = index + 1;
                const isFirst = index === 0;
                const isExpanded = expandedSessions.has(meeting.id);
                const insights = parseInsights(meeting.session_notes);

                return (
                  <div key={meeting.id} className="relative pl-10">
                    {/* Timeline dot */}
                    <div
                      className="absolute left-[8px] top-[14px] w-[16px] h-[16px] rounded-full border-2 flex items-center justify-center z-10"
                      style={{
                        borderColor: isFirst ? 'var(--accent)' : 'var(--text-muted)',
                        backgroundColor: isFirst ? 'var(--accent)' : 'var(--surface-1)',
                      }}
                    >
                      {isFirst && (
                        <div className="w-[6px] h-[6px] rounded-full bg-white" />
                      )}
                    </div>

                    {/* Session Card */}
                    <div
                      className={`rounded-xl border transition-colors ${
                        isExpanded
                          ? 'bg-[var(--surface-1)] border-[var(--accent)]/30'
                          : 'bg-[var(--surface-1)] border-[var(--border)] hover:border-[var(--accent)]/20'
                      }`}
                    >
                      {/* Card Header (always visible) */}
                      <button
                        onClick={() => toggleSession(meeting.id)}
                        className="w-full text-left px-4 py-3 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {/* Session number */}
                          <span
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0"
                            style={{
                              color: isFirst ? 'var(--accent)' : 'var(--text-muted)',
                              backgroundColor: isFirst
                                ? 'color-mix(in srgb, var(--accent) 15%, transparent)'
                                : 'var(--surface-2)',
                            }}
                          >
                            #{sessionNum}
                          </span>

                          {/* Meeting title (clickable link) */}
                          <span
                            className="text-sm font-medium text-[var(--accent)] hover:underline truncate cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/meetings/${meeting.meeting_id}`);
                            }}
                          >
                            {meeting.title}
                          </span>

                          {/* First session badge */}
                          {isFirst && (
                            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full uppercase shrink-0"
                              style={{
                                color: 'var(--accent)',
                                backgroundColor: 'color-mix(in srgb, var(--accent) 12%, transparent)',
                              }}
                            >
                              First Session
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 shrink-0 ml-2">
                          <span className="text-xs text-[var(--text-muted)]">
                            {formatDuration(meeting.duration)}
                          </span>
                          <span className="text-xs text-[var(--text-muted)]">
                            {new Date(meeting.date).toLocaleDateString()}
                          </span>
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="var(--text-muted)"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          >
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </div>
                      </button>

                      {/* Expanded Content */}
                      {isExpanded && (
                        <div className="px-4 pb-4 border-t border-[var(--border)] space-y-4 pt-3">
                          {insights ? (
                            <>
                              {/* Session Summary */}
                              {insights.sessionSummary && (
                                <div>
                                  <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                                    Summary
                                  </span>
                                  <p className="text-sm text-[var(--text-secondary)] mt-1 leading-relaxed">
                                    {insights.sessionSummary}
                                  </p>
                                </div>
                              )}

                              {/* Topics Discussed */}
                              {insights.topicsDiscussed && insights.topicsDiscussed.length > 0 && (
                                <div>
                                  <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                                    Topics Discussed
                                  </span>
                                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                                    {insights.topicsDiscussed.map((topic, i) => (
                                      <span
                                        key={i}
                                        className="text-xs px-2 py-0.5 rounded-full"
                                        style={{
                                          color: 'var(--accent)',
                                          backgroundColor: 'color-mix(in srgb, var(--accent) 12%, transparent)',
                                        }}
                                      >
                                        {topic}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* To-Dos */}
                              {insights.todos && insights.todos.length > 0 && (
                                <div>
                                  <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                                    To-Dos
                                  </span>
                                  <ul className="mt-1.5 space-y-1">
                                    {insights.todos.map((todo, i) => (
                                      <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-primary)]">
                                        <input
                                          type="checkbox"
                                          disabled
                                          className="mt-0.5"
                                          style={{ accentColor: 'var(--accent)' }}
                                        />
                                        {todo}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* Recommendations */}
                              {insights.recommendations && insights.recommendations.length > 0 && (
                                <div>
                                  <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                                    Recommendations
                                  </span>
                                  <ul className="mt-1.5 space-y-1">
                                    {insights.recommendations.map((rec, i) => (
                                      <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                                        <span className="text-[var(--accent)] mt-0.5 shrink-0">&#8227;</span>
                                        {rec}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* Progress Notes (subsequent sessions) */}
                              {insights.progressNotes && (
                                <div>
                                  <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                                    Progress Notes
                                  </span>
                                  <p className="text-sm text-[var(--text-secondary)] mt-1 leading-relaxed">
                                    {insights.progressNotes}
                                  </p>
                                </div>
                              )}

                              {/* Homework */}
                              {(insights.homework || meeting.homework) && (
                                <div>
                                  <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                                    Homework
                                  </span>
                                  <p className="text-sm text-[var(--text-primary)] mt-1 px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)]">
                                    {insights.homework || meeting.homework}
                                  </p>
                                </div>
                              )}

                              {/* Next Session Plan */}
                              {(insights.nextSessionPlan || meeting.next_session_plan) && (
                                <div>
                                  <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                                    Next Session Plan
                                  </span>
                                  <p className="text-sm text-[var(--text-primary)] mt-1 px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)]">
                                    {insights.nextSessionPlan || meeting.next_session_plan}
                                  </p>
                                </div>
                              )}
                            </>
                          ) : (
                            <>
                              {/* Fallback for meetings without JSON insights */}
                              {meeting.session_notes && (
                                <div>
                                  <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Session Notes</span>
                                  <p className="text-sm text-[var(--text-secondary)] mt-1">{meeting.session_notes}</p>
                                </div>
                              )}
                              {meeting.homework && (
                                <div>
                                  <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Homework</span>
                                  <p className="text-sm text-[var(--text-secondary)] mt-1">{meeting.homework}</p>
                                </div>
                              )}
                              {meeting.next_session_plan && (
                                <div>
                                  <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Next Session Plan</span>
                                  <p className="text-sm text-[var(--text-secondary)] mt-1">{meeting.next_session_plan}</p>
                                </div>
                              )}
                              {!meeting.session_notes && !meeting.homework && !meeting.next_session_plan && (
                                <p className="text-xs text-[var(--text-muted)] italic">
                                  No AI insights generated for this session. The meeting may not have had a transcript.
                                </p>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
