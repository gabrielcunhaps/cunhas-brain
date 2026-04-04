'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

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

      // Filter out already-attached meetings
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <button
            onClick={() => router.push('/students')}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] mb-2 block"
          >
            &larr; Back to Students
          </button>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">{student.name}</h1>
          <div className="flex items-center gap-3 mt-1">
            {student.email && (
              <span className="text-sm text-[var(--text-secondary)]">{student.email}</span>
            )}
            {student.platform && (
              <span className="text-xs px-2 py-0.5 rounded-md bg-[var(--surface-2)] text-[var(--text-muted)]">
                {student.platform}
              </span>
            )}
            <span
              className="text-[10px] font-medium px-2 py-0.5 rounded-full uppercase"
              style={{
                color: statusColor(student.status),
                backgroundColor: `color-mix(in srgb, ${statusColor(student.status)} 15%, transparent)`,
              }}
            >
              {student.status}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setEditing(!editing)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--surface-2)] text-[var(--text-secondary)] hover:bg-[var(--surface-3)] border border-[var(--border)] transition-colors"
          >
            {editing ? 'Cancel' : 'Edit Profile'}
          </button>
          <button
            onClick={handleDelete}
            className="px-3 py-1.5 text-xs font-medium rounded-lg text-[var(--danger)] hover:bg-[var(--surface-2)] border border-[var(--border)] transition-colors"
          >
            Delete
          </button>
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

      {/* Notes */}
      {student.notes && !editing && (
        <div className="p-4 rounded-xl bg-[var(--surface-1)] border border-[var(--border)]">
          <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
            Notes
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">{student.notes}</p>
        </div>
      )}

      {/* Profile */}
      {student.profile && (
        <div className="p-4 rounded-xl bg-[var(--surface-1)] border border-[var(--border)]">
          <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
            Student Profile
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {student.profile.background && (
              <div>
                <span className="text-xs text-[var(--text-muted)]">Background</span>
                <p className="text-sm text-[var(--text-primary)] mt-0.5">{student.profile.background}</p>
              </div>
            )}
            {student.profile.goals && (
              <div>
                <span className="text-xs text-[var(--text-muted)]">Goals</span>
                <p className="text-sm text-[var(--text-primary)] mt-0.5">{student.profile.goals}</p>
              </div>
            )}
            {student.profile.level && (
              <div>
                <span className="text-xs text-[var(--text-muted)]">Level</span>
                <p className="text-sm text-[var(--text-primary)] mt-0.5">{student.profile.level}</p>
              </div>
            )}
            {student.profile.style && (
              <div>
                <span className="text-xs text-[var(--text-muted)]">Learning Style</span>
                <p className="text-sm text-[var(--text-primary)] mt-0.5">{student.profile.style}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Learning Plan */}
      {student.learning_plan && (
        <div className="p-4 rounded-xl bg-[var(--surface-1)] border border-[var(--border)]">
          <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
            Learning Plan
          </h2>
          {student.learning_plan.topics && student.learning_plan.topics.length > 0 && (
            <div className="mb-3">
              <span className="text-xs text-[var(--text-muted)]">Topics</span>
              <ul className="mt-1 space-y-1">
                {student.learning_plan.topics.map((topic, i) => (
                  <li key={i} className="text-sm text-[var(--text-primary)] flex items-start gap-2">
                    <span className="text-[var(--accent)] mt-0.5">&#8226;</span>
                    {topic}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {student.learning_plan.milestones && student.learning_plan.milestones.length > 0 && (
            <div className="mb-3">
              <span className="text-xs text-[var(--text-muted)]">Milestones</span>
              <ul className="mt-1 space-y-1">
                {student.learning_plan.milestones.map((milestone, i) => (
                  <li key={i} className="text-sm text-[var(--text-primary)] flex items-start gap-2">
                    <span className="text-[var(--success)] mt-0.5">&#9679;</span>
                    {milestone}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {student.learning_plan.timeline && (
            <div>
              <span className="text-xs text-[var(--text-muted)]">Timeline</span>
              <p className="text-sm text-[var(--text-primary)] mt-0.5">{student.learning_plan.timeline}</p>
            </div>
          )}
        </div>
      )}

      {/* Meetings Section */}
      <div className="p-4 rounded-xl bg-[var(--surface-1)] border border-[var(--border)]">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            Meeting History ({student.meetings.length})
          </h2>
          <button
            onClick={() => {
              setShowAttach(!showAttach);
              if (!showAttach) fetchAvailableMeetings();
            }}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors"
          >
            Attach Meeting
          </button>
        </div>

        {/* AI Processing Indicator */}
        {aiProcessing && (
          <div className="mb-3 px-3 py-2 text-sm rounded-lg bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20 flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {student.meetings.length === 0
              ? 'Generating learning plan and student profile...'
              : 'Generating session notes and next session plan...'}
          </div>
        )}

        {/* Attach Meeting Dropdown */}
        {showAttach && (
          <div className="mb-3 p-3 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] max-h-60 overflow-y-auto">
            {loadingMeetings ? (
              <p className="text-xs text-[var(--text-muted)]">Loading meetings...</p>
            ) : availableMeetings.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">No unattached meetings available.</p>
            ) : (
              <div className="space-y-1">
                {availableMeetings.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => handleAttach(m.id)}
                    disabled={attaching}
                    className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-[var(--surface-3)] transition-colors disabled:opacity-50 flex items-center justify-between"
                  >
                    <span className="text-[var(--text-primary)] truncate">{m.title}</span>
                    <span className="text-xs text-[var(--text-muted)] ml-2 shrink-0">
                      {new Date(m.date).toLocaleDateString()}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Meeting List */}
        {student.meetings.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)] py-4 text-center">
            No meetings attached yet. Attach a meeting to get started.
          </p>
        ) : (
          <div className="space-y-3">
            {student.meetings.map((meeting) => (
              <div
                key={meeting.id}
                className="p-3 rounded-lg bg-[var(--surface-2)] border border-[var(--border)]"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3
                    className="text-sm font-medium text-[var(--accent)] hover:underline cursor-pointer"
                    onClick={() => router.push(`/meetings/${meeting.meeting_id}`)}
                  >
                    {meeting.title}
                  </h3>
                  <span className="text-xs text-[var(--text-muted)]">
                    {new Date(meeting.date).toLocaleDateString()}
                  </span>
                </div>
                {meeting.session_notes && (
                  <div className="mb-2">
                    <span className="text-[10px] font-medium text-[var(--text-muted)] uppercase">
                      Session Notes
                    </span>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">{meeting.session_notes}</p>
                  </div>
                )}
                {meeting.homework && (
                  <div className="mb-2">
                    <span className="text-[10px] font-medium text-[var(--text-muted)] uppercase">
                      Homework
                    </span>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">{meeting.homework}</p>
                  </div>
                )}
                {meeting.next_session_plan && (
                  <div>
                    <span className="text-[10px] font-medium text-[var(--text-muted)] uppercase">
                      Next Session Plan
                    </span>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                      {meeting.next_session_plan}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
