'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';

interface Repo {
  name: string;
  full_name: string;
  description: string | null;
  language: string | null;
  pushed_at: string;
  html_url: string;
  open_issues_count: number;
  stargazers_count: number;
  private: boolean;
}

interface ActivityEvent {
  type: string;
  repo: string;
  description: string;
  date: string;
  url: string;
}

const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572A5',
  Rust: '#dea584',
  Go: '#00ADD8',
  Java: '#b07219',
  Ruby: '#701516',
  PHP: '#4F5D95',
  'C++': '#f34b7d',
  C: '#555555',
  'C#': '#239120',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Shell: '#89e051',
  Lua: '#000080',
  Dart: '#00B4AB',
  Vue: '#41b883',
  Svelte: '#ff3e00',
};

const EVENT_TYPE_COLORS: Record<string, string> = {
  Push: 'var(--accent)',
  PullRequest: '#a855f7',
  Issues: 'var(--success)',
  Create: '#f59e0b',
  Star: '#f59e0b',
  Fork: '#06b6d4',
  Delete: 'var(--danger)',
};

function relativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString();
}

function SkeletonCard() {
  return (
    <div className="bg-[var(--surface-1)] border border-[var(--border)] rounded-xl p-5 animate-pulse">
      <div className="h-4 bg-[var(--surface-3)] rounded w-2/3 mb-3" />
      <div className="h-3 bg-[var(--surface-3)] rounded w-full mb-2" />
      <div className="h-3 bg-[var(--surface-3)] rounded w-1/2 mb-4" />
      <div className="flex gap-3">
        <div className="h-3 bg-[var(--surface-3)] rounded w-16" />
        <div className="h-3 bg-[var(--surface-3)] rounded w-12" />
      </div>
    </div>
  );
}

function SkeletonEvent() {
  return (
    <div className="flex items-start gap-3 py-3 animate-pulse">
      <div className="h-5 bg-[var(--surface-3)] rounded w-16 shrink-0 mt-0.5" />
      <div className="flex-1">
        <div className="h-3.5 bg-[var(--surface-3)] rounded w-3/4 mb-2" />
        <div className="h-3 bg-[var(--surface-3)] rounded w-1/4" />
      </div>
    </div>
  );
}

export default function GitHubView() {
  const [tab, setTab] = useState<'repos' | 'activity'>('repos');
  const [repos, setRepos] = useState<Repo[]>([]);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const [rateLimit, setRateLimit] = useState<{ remaining: string; limit: string } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async (type: 'repos' | 'activity') => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/github?type=${type}`);
      const data = await res.json();

      if (data.error === 'GitHub token not configured') {
        setNotConfigured(true);
        return;
      }

      if (data.error) {
        setError(data.error);
        return;
      }

      if (data.rateLimit) {
        setRateLimit(data.rateLimit);
      }

      if (type === 'repos') {
        setRepos(data.repos || []);
      } else {
        setEvents(data.events || []);
      }
    } catch {
      setError('Failed to fetch GitHub data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setNotConfigured(false);
    fetchData(tab);
  }, [tab, fetchData]);

  // Auto-refresh activity every 60s
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (tab === 'activity') {
      intervalRef.current = setInterval(() => {
        fetchData('activity');
      }, 60000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [tab, fetchData]);

  if (notConfigured) {
    return (
      <div className="bg-[var(--surface-1)] border border-[var(--border)] rounded-xl p-8 text-center">
        <div className="text-3xl mb-3">&#128273;</div>
        <h3 className="text-[var(--text-primary)] font-semibold mb-2">
          GitHub Token Not Configured
        </h3>
        <p className="text-sm text-[var(--text-muted)] mb-4">
          Add a GitHub Personal Access Token in Settings to view your repositories and activity.
        </p>
        <Link
          href="/settings"
          className="inline-block px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors"
        >
          Go to Settings
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-[var(--border)]">
        <button
          onClick={() => setTab('repos')}
          className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
            tab === 'repos'
              ? 'text-[var(--accent)] border-[var(--accent)]'
              : 'text-[var(--text-muted)] border-transparent hover:text-[var(--text-secondary)]'
          }`}
        >
          Repos
        </button>
        <button
          onClick={() => setTab('activity')}
          className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
            tab === 'activity'
              ? 'text-[var(--accent)] border-[var(--accent)]'
              : 'text-[var(--text-muted)] border-transparent hover:text-[var(--text-secondary)]'
          }`}
        >
          Activity
        </button>
        {rateLimit && (
          <span className="ml-auto text-xs text-[var(--text-muted)]">
            API: {rateLimit.remaining}/{rateLimit.limit} requests remaining
          </span>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-[var(--danger)]/10 border border-[var(--danger)]/30 rounded-xl p-4 mb-6">
          <p className="text-sm text-[var(--danger)] font-medium">{error}</p>
          <button
            onClick={() => fetchData(tab)}
            className="text-xs text-[var(--danger)] underline mt-1"
          >
            Retry
          </button>
        </div>
      )}

      {/* Repos Tab */}
      {tab === 'repos' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
            : repos.map((repo) => (
                <div
                  key={repo.full_name}
                  className="bg-[var(--surface-1)] border border-[var(--border)] rounded-xl p-5 flex flex-col gap-2 hover:border-[var(--accent)]/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <a
                      href={repo.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)] truncate"
                    >
                      {repo.name}
                    </a>
                    {repo.private && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-3)] text-[var(--text-muted)] font-medium shrink-0">
                        &#128274; Private
                      </span>
                    )}
                  </div>

                  {repo.description && (
                    <p className="text-xs text-[var(--text-muted)] line-clamp-2 leading-relaxed">
                      {repo.description}
                    </p>
                  )}

                  <div className="flex items-center gap-3 mt-auto pt-2 flex-wrap">
                    {repo.language && (
                      <span className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                        <span
                          style={{
                            display: 'inline-block',
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            backgroundColor: LANGUAGE_COLORS[repo.language] || '#888',
                          }}
                        />
                        {repo.language}
                      </span>
                    )}
                    {repo.stargazers_count > 0 && (
                      <span className="text-xs text-[var(--text-muted)]">
                        &#9733; {repo.stargazers_count}
                      </span>
                    )}
                    {repo.open_issues_count > 0 && (
                      <span className="text-xs text-[var(--text-muted)]">
                        &#9679; {repo.open_issues_count} issue{repo.open_issues_count !== 1 ? 's' : ''}
                      </span>
                    )}
                    <span className="text-xs text-[var(--text-muted)] ml-auto">
                      {relativeTime(repo.pushed_at)}
                    </span>
                  </div>
                </div>
              ))}
        </div>
      )}

      {/* Activity Tab */}
      {tab === 'activity' && (
        <div className="bg-[var(--surface-1)] border border-[var(--border)] rounded-xl divide-y divide-[var(--border)]">
          {loading
            ? Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="px-5">
                  <SkeletonEvent />
                </div>
              ))
            : events.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-sm text-[var(--text-muted)]">No recent activity found.</p>
                </div>
              ) : (
                events.map((event, i) => (
                  <div key={i} className="flex items-start gap-3 px-5 py-3.5">
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded shrink-0 mt-0.5"
                      style={{
                        backgroundColor: `${EVENT_TYPE_COLORS[event.type] || 'var(--text-muted)'}20`,
                        color: EVENT_TYPE_COLORS[event.type] || 'var(--text-muted)',
                      }}
                    >
                      {event.type}
                    </span>
                    <div className="flex-1 min-w-0">
                      <a
                        href={event.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors"
                      >
                        {event.description}
                      </a>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">
                        {relativeTime(event.date)}
                      </p>
                    </div>
                  </div>
                ))
              )}
        </div>
      )}
    </div>
  );
}
