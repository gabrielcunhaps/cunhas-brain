'use client';

import { useState, useEffect, useCallback } from 'react';

interface TodoItem {
  id: string;
  meetingId: string;
  meetingTitle: string;
  meetingDate: string;
  text: string;
  assignee: string | null;
  done: boolean;
}

type FilterTab = 'all' | 'open' | 'done';
type AssigneeFilter = 'everyone' | 'me' | 'others';

export default function Dashboard() {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<AssigneeFilter>('everyone');
  const [search, setSearch] = useState('');
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);

  const fetchTodos = useCallback(async () => {
    try {
      const res = await fetch('/api/todos');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setTodos(data.todos || []);
    } catch (err) {
      console.error('Error fetching todos:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTodos();
    const interval = setInterval(fetchTodos, 30000);
    return () => clearInterval(interval);
  }, [fetchTodos]);

  const toggleTodo = async (todo: TodoItem) => {
    setTogglingIds((prev) => new Set(prev).add(todo.id));

    // Optimistic update
    setTodos((prev) =>
      prev.map((t) => (t.id === todo.id ? { ...t, done: !t.done } : t))
    );

    try {
      const res = await fetch('/api/todos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meetingId: todo.meetingId,
          todoText: todo.text,
          done: !todo.done,
        }),
      });
      if (!res.ok) throw new Error('Failed to update');
    } catch (err) {
      console.error('Error toggling todo:', err);
      // Revert on failure
      setTodos((prev) =>
        prev.map((t) => (t.id === todo.id ? { ...t, done: todo.done } : t))
      );
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(todo.id);
        return next;
      });
    }
  };

  const uniqueMeetings = new Set(todos.map((t) => t.meetingId)).size;
  const openCount = todos.filter((t) => !t.done).length;
  const doneCount = todos.filter((t) => t.done).length;

  const isMe = (assignee: string | null) => {
    if (!assignee) return false;
    const lower = assignee.toLowerCase();
    return lower.includes('gabriel') || lower.includes('cunha') || lower.includes('gabe');
  };

  const filtered = todos.filter((t) => {
    if (filter === 'open' && t.done) return false;
    if (filter === 'done' && !t.done) return false;
    if (assigneeFilter === 'me' && !isMe(t.assignee)) return false;
    if (assigneeFilter === 'others' && (isMe(t.assignee) || !t.assignee)) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        t.text.toLowerCase().includes(q) ||
        t.meetingTitle.toLowerCase().includes(q) ||
        (t.assignee && t.assignee.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const generateClaudeCommand = (todo: TodoItem) => {
    return `claude -p "${todo.text.replace(/"/g, '\\"')}"`;
  };

  const copyClaudeCommand = (todo: TodoItem) => {
    navigator.clipboard.writeText(generateClaudeCommand(todo));
    setCopied(todo.id);
    setTimeout(() => setCopied(null), 2000);
  };

  const openInVSCode = (todo: TodoItem) => {
    const prompt = encodeURIComponent(todo.text);
    window.open(`vscode://file?prompt=${prompt}`, '_blank');
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '3rem 0' }}>
        Loading dashboard...
      </div>
    );
  }

  return (
    <div>
      {/* Stats Bar */}
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <StatCard label="Meetings" value={uniqueMeetings} color="var(--accent)" />
        <StatCard label="Open" value={openCount} color="var(--danger)" />
        <StatCard label="Done" value={doneCount} color="var(--success)" />
      </div>

      {/* Filter Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          marginBottom: '1rem',
        }}
      >
        {(['all', 'open', 'done'] as FilterTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            style={{
              padding: '0.375rem 0.75rem',
              borderRadius: '0.375rem',
              border: 'none',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
              backgroundColor: filter === tab ? 'var(--surface-3)' : 'transparent',
              color: filter === tab ? 'var(--text-primary)' : 'var(--text-secondary)',
              transition: 'all 0.15s ease',
            }}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Assignee Filter */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          marginBottom: '1rem',
        }}
      >
        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', alignSelf: 'center', marginRight: '0.25rem' }}>Assignee:</span>
        {(['everyone', 'me', 'others'] as AssigneeFilter[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setAssigneeFilter(tab)}
            style={{
              padding: '0.25rem 0.625rem',
              borderRadius: '0.375rem',
              border: 'none',
              fontSize: '0.75rem',
              fontWeight: 500,
              cursor: 'pointer',
              backgroundColor: assigneeFilter === tab ? 'var(--accent)' : 'transparent',
              color: assigneeFilter === tab ? 'white' : 'var(--text-secondary)',
              transition: 'all 0.15s ease',
            }}
          >
            {tab === 'me' ? 'Mine' : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Search Bar */}
      <input
        type="text"
        placeholder="Search todos..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          width: '100%',
          padding: '0.5rem 0.75rem',
          borderRadius: '0.375rem',
          border: '1px solid var(--border)',
          backgroundColor: 'var(--surface-1)',
          color: 'var(--text-primary)',
          fontSize: '0.875rem',
          marginBottom: '1rem',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />

      {/* Todo List */}
      {filtered.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>
          No action items found.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {filtered.map((todo) => (
            <div
              key={todo.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                borderRadius: '0.5rem',
                backgroundColor: 'var(--surface-1)',
                border: '1px solid var(--border)',
                opacity: todo.done ? 0.6 : 1,
                transition: 'opacity 0.15s ease',
              }}
            >
              <input
                type="checkbox"
                checked={todo.done}
                disabled={togglingIds.has(todo.id)}
                onChange={() => toggleTodo(todo)}
                style={{
                  marginTop: '0.2rem',
                  cursor: togglingIds.has(todo.id) ? 'wait' : 'pointer',
                  accentColor: 'var(--accent)',
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    color: 'var(--text-primary)',
                    fontSize: '0.875rem',
                    lineHeight: 1.5,
                    textDecoration: todo.done ? 'line-through' : 'none',
                  }}
                >
                  {todo.text}
                </div>
                {todo.assignee && (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.125rem' }}>
                    {todo.assignee}
                  </div>
                )}
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                  from: {todo.meetingTitle}
                  <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                    {formatDate(todo.meetingDate)}
                  </span>
                </div>
                {/* Claude Code Actions */}
                <div style={{ display: 'flex', gap: '0.375rem', marginTop: '0.5rem' }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); copyClaudeCommand(todo); }}
                    style={{
                      padding: '0.2rem 0.5rem',
                      borderRadius: '0.25rem',
                      border: '1px solid var(--border)',
                      backgroundColor: 'var(--surface-2)',
                      color: copied === todo.id ? 'var(--success)' : 'var(--text-muted)',
                      fontSize: '0.675rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {copied === todo.id ? 'Copied!' : 'Copy Claude cmd'}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); openInVSCode(todo); }}
                    style={{
                      padding: '0.2rem 0.5rem',
                      borderRadius: '0.25rem',
                      border: '1px solid var(--border)',
                      backgroundColor: 'var(--surface-2)',
                      color: 'var(--text-muted)',
                      fontSize: '0.675rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    Open in VS Code
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      style={{
        flex: 1,
        padding: '1rem',
        borderRadius: '0.5rem',
        backgroundColor: 'var(--surface-1)',
        border: '1px solid var(--border)',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{label}</div>
    </div>
  );
}
