'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface Student {
  id: string;
  name: string;
  email: string | null;
  platform: string | null;
  status: string;
  notes: string | null;
  meeting_count: string;
  updated_at: string;
}

export default function StudentList() {
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', platform: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fetchStudents = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/students');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setStudents(data);
    } catch (err) {
      console.error('Failed to fetch students:', err);
      setError('Failed to load students');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error('Failed to create student');
      setFormData({ name: '', email: '', platform: '', notes: '' });
      setShowForm(false);
      fetchStudents();
    } catch (err) {
      console.error('Failed to create student:', err);
      setError('Failed to create student');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = students.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const statusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'var(--success)';
      case 'paused':
        return 'var(--text-muted)';
      case 'inactive':
        return 'var(--danger)';
      default:
        return 'var(--text-secondary)';
    }
  };

  return (
    <div className="space-y-4">
      {/* Search and Add */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Search students..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 text-sm rounded-lg bg-[var(--surface-1)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
        />
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors"
        >
          {showForm ? 'Cancel' : 'Add Student'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="px-3 py-2 text-sm rounded-lg bg-[var(--danger)]/10 text-[var(--danger)] border border-[var(--danger)]/20">
          {error}
        </div>
      )}

      {/* Add Student Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="p-4 rounded-xl bg-[var(--surface-1)] border border-[var(--border)] space-y-3"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Name *"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="px-3 py-2 text-sm rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
              required
            />
            <input
              type="email"
              placeholder="Email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="px-3 py-2 text-sm rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
            />
            <input
              type="text"
              placeholder="Platform (e.g. Zoom, Discord)"
              value={formData.platform}
              onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
              className="px-3 py-2 text-sm rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
            />
            <input
              type="text"
              placeholder="Notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="px-3 py-2 text-sm rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
          <button
            type="submit"
            disabled={submitting || !formData.name.trim()}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50"
          >
            {submitting ? 'Creating...' : 'Create Student'}
          </button>
        </form>
      )}

      {/* Student Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="bg-[var(--surface-1)] border border-[var(--border)] rounded-xl p-4 animate-pulse"
            >
              <div className="h-4 bg-[var(--surface-3)] rounded w-3/4 mb-3" />
              <div className="h-3 bg-[var(--surface-3)] rounded w-1/2 mb-3" />
              <div className="flex gap-2">
                <div className="h-5 bg-[var(--surface-3)] rounded-full w-12" />
                <div className="h-5 bg-[var(--surface-3)] rounded-full w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-[var(--text-muted)] text-sm">
            {search ? 'No students match your search.' : 'No students yet. Add your first student!'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((student) => (
            <button
              key={student.id}
              onClick={() => router.push(`/students/${student.id}`)}
              className="text-left bg-[var(--surface-1)] border border-[var(--border)] rounded-xl p-4 hover:bg-[var(--surface-2)] hover:border-[var(--accent)] transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] truncate">
                  {student.name}
                </h3>
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
              {student.email && (
                <p className="text-xs text-[var(--text-muted)] truncate mb-2">{student.email}</p>
              )}
              <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
                <span>{parseInt(student.meeting_count)} meetings</span>
                {student.platform && (
                  <span className="px-2 py-0.5 rounded-md bg-[var(--surface-2)] text-[var(--text-muted)]">
                    {student.platform}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
