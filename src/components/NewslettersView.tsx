'use client';

import { useState, useCallback } from 'react';

interface Article {
  id: number;
  date: string;
  title: string;
  source: string;
  content: string;
  url: string;
  fetched_at: string;
}

type ViewMode = 'feed' | 'summary';

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function today(): string {
  return new Date().toISOString().split('T')[0];
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

export default function NewslettersView() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsConfig, setNeedsConfig] = useState(false);
  const [fromDate, setFromDate] = useState(today());
  const [toDate, setToDate] = useState(today());
  const [viewMode, setViewMode] = useState<ViewMode>('feed');
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryArticleCount, setSummaryArticleCount] = useState(0);
  const [activeRange, setActiveRange] = useState<string>('');

  const fetchArticles = useCallback(async (from: string, to: string, label: string) => {
    setLoading(true);
    setError(null);
    setNeedsConfig(false);
    setActiveRange(label);
    setFromDate(from);
    setToDate(to);
    setViewMode('feed');
    setSummary(null);

    try {
      const res = await fetch(`/api/newsletters?from=${from}&to=${to}`);
      const data = await res.json();

      if (!res.ok) {
        if (data.needsConfig) {
          setNeedsConfig(true);
        } else {
          setError(data.error || 'Failed to fetch newsletters');
        }
        setArticles([]);
        return;
      }

      setArticles(data.articles || []);
    } catch {
      setError('Failed to connect to server');
      setArticles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleGenerateSummary = async () => {
    if (articles.length === 0) return;

    setSummaryLoading(true);
    setViewMode('summary');
    setSummary(null);
    setError(null);

    try {
      const res = await fetch('/api/newsletters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: fromDate, to: toDate }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to generate summary');
        return;
      }

      setSummary(data.summary);
      setSummaryArticleCount(data.articleCount || 0);
    } catch {
      setError('Failed to generate AI summary');
    } finally {
      setSummaryLoading(false);
    }
  };

  const quickRanges = [
    { label: 'Today', from: today(), to: today() },
    { label: 'Yesterday', from: daysAgo(1), to: daysAgo(1) },
    { label: 'Last 7 Days', from: daysAgo(7), to: today() },
    { label: 'Last 30 Days', from: daysAgo(30), to: today() },
  ];

  // Group articles by date
  const grouped: Record<string, Article[]> = {};
  for (const article of articles) {
    const key = article.date;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(article);
  }
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-6">
      {/* Top bar: quick ranges */}
      <div className="bg-[var(--surface-1)] border border-[var(--border)] rounded-2xl p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {quickRanges.map((r) => (
            <button
              key={r.label}
              onClick={() => fetchArticles(r.from, r.to, r.label)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeRange === r.label
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--surface-2)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)]'
              }`}
            >
              {r.label}
            </button>
          ))}

          <div className="h-6 w-px bg-[var(--border)] mx-1" />

          <div className="flex items-center gap-2">
            <label className="text-xs text-[var(--text-muted)]">From</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-2 py-1 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent)]"
            />
            <label className="text-xs text-[var(--text-muted)]">To</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-2 py-1 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent)]"
            />
            <button
              onClick={() => fetchArticles(fromDate, toDate, 'Custom')}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors"
            >
              Fetch
            </button>
          </div>
        </div>

        {articles.length > 0 && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setViewMode('feed')}
                className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                  viewMode === 'feed'
                    ? 'bg-[var(--surface-3)] text-[var(--text-primary)] font-medium'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                Daily Feed
              </button>
              <button
                onClick={() => summary ? setViewMode('summary') : handleGenerateSummary()}
                className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                  viewMode === 'summary'
                    ? 'bg-[var(--surface-3)] text-[var(--text-primary)] font-medium'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                AI Summary
              </button>
            </div>

            <button
              onClick={handleGenerateSummary}
              disabled={summaryLoading}
              className="ml-auto px-3 py-1.5 rounded-lg border border-[var(--accent)] text-[var(--accent)] text-sm font-medium hover:bg-[var(--accent)] hover:text-white disabled:opacity-50 transition-colors"
            >
              {summaryLoading ? 'Generating...' : 'Generate AI Summary'}
            </button>

            <span className="text-xs text-[var(--text-muted)]">
              {articles.length} article{articles.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-[var(--danger)]/10 border border-[var(--danger)]/30 rounded-xl p-4">
          <p className="text-sm text-[var(--danger)]">{error}</p>
        </div>
      )}

      {/* Needs config state */}
      {needsConfig && (
        <div className="bg-[var(--surface-1)] border border-[var(--border)] rounded-2xl p-8 text-center">
          <p className="text-[var(--text-secondary)] mb-2">Inoreader token not configured</p>
          <a
            href="/settings"
            className="text-[var(--accent)] hover:text-[var(--accent-hover)] text-sm font-medium"
          >
            Configure in Settings
          </a>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-[var(--surface-1)] border border-[var(--border)] rounded-2xl p-5 animate-pulse"
            >
              <div className="h-4 bg-[var(--surface-3)] rounded w-3/4 mb-3" />
              <div className="h-3 bg-[var(--surface-2)] rounded w-1/4 mb-4" />
              <div className="h-3 bg-[var(--surface-2)] rounded w-full mb-2" />
              <div className="h-3 bg-[var(--surface-2)] rounded w-5/6" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !needsConfig && !error && articles.length === 0 && activeRange && (
        <div className="bg-[var(--surface-1)] border border-[var(--border)] rounded-2xl p-8 text-center">
          <p className="text-[var(--text-muted)]">No articles found for this date range.</p>
        </div>
      )}

      {/* Initial state - no range selected yet */}
      {!loading && !needsConfig && !error && articles.length === 0 && !activeRange && (
        <div className="bg-[var(--surface-1)] border border-[var(--border)] rounded-2xl p-8 text-center">
          <p className="text-[var(--text-secondary)] mb-1">Select a date range to get started</p>
          <p className="text-xs text-[var(--text-muted)]">
            Articles will be fetched from your Inoreader feeds and cached locally.
          </p>
        </div>
      )}

      {/* Daily Feed view */}
      {!loading && viewMode === 'feed' && sortedDates.length > 0 && (
        <div className="space-y-6">
          {sortedDates.map((date) => (
            <div key={date}>
              <h3 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
                {formatDate(date)}
              </h3>
              <div className="space-y-3">
                {grouped[date].map((article) => (
                  <div
                    key={article.id}
                    className="bg-[var(--surface-1)] border border-[var(--border)] rounded-xl p-4 hover:border-[var(--accent)]/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <a
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors leading-snug"
                      >
                        {article.title}
                      </a>
                      <span className="shrink-0 px-2 py-0.5 rounded-full bg-[var(--surface-3)] text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider">
                        {article.source}
                      </span>
                    </div>
                    {article.content && (
                      <p className="text-xs text-[var(--text-muted)] leading-relaxed line-clamp-3">
                        {article.content.slice(0, 200)}
                        {article.content.length > 200 ? '...' : ''}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* AI Summary view */}
      {!loading && viewMode === 'summary' && (
        <div className="bg-[var(--surface-1)] border border-[var(--border)] rounded-2xl p-6">
          {summaryLoading ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-5 bg-[var(--surface-3)] rounded w-1/3 mb-4" />
              <div className="h-3 bg-[var(--surface-2)] rounded w-full" />
              <div className="h-3 bg-[var(--surface-2)] rounded w-5/6" />
              <div className="h-3 bg-[var(--surface-2)] rounded w-4/6" />
              <div className="h-3 bg-[var(--surface-2)] rounded w-full mt-4" />
              <div className="h-3 bg-[var(--surface-2)] rounded w-3/4" />
            </div>
          ) : summary ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                  AI Summary
                </h3>
                <span className="text-xs text-[var(--text-muted)]">
                  Based on {summaryArticleCount} article{summaryArticleCount !== 1 ? 's' : ''} ({fromDate} to {toDate})
                </span>
              </div>
              <div className="prose prose-invert prose-sm max-w-none text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">
                {summary}
              </div>
            </>
          ) : (
            <p className="text-sm text-[var(--text-muted)] text-center py-4">
              Click &quot;Generate AI Summary&quot; to create a summary of the fetched articles.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
