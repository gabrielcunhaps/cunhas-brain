import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';

export const dynamic = 'force-dynamic';

const GITHUB_API = 'https://api.github.com';
const HEADERS = (token: string) => ({
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'User-Agent': 'CunhasBrain/1.0',
});

interface GitHubRepo {
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

interface GitHubEvent {
  type: string;
  repo: { name: string };
  payload: Record<string, unknown>;
  created_at: string;
}

function formatEvent(event: GitHubEvent): {
  type: string;
  repo: string;
  description: string;
  date: string;
  url: string;
} | null {
  const repo = event.repo.name;
  const date = event.created_at;
  const repoUrl = `https://github.com/${repo}`;

  switch (event.type) {
    case 'PushEvent': {
      const commits = (event.payload.commits as unknown[]) || [];
      return {
        type: 'Push',
        repo,
        description: `Pushed ${commits.length} commit${commits.length !== 1 ? 's' : ''} to ${repo}`,
        date,
        url: repoUrl,
      };
    }
    case 'CreateEvent': {
      const refType = event.payload.ref_type as string;
      const ref = event.payload.ref as string;
      return {
        type: 'Create',
        repo,
        description: `Created ${refType}${ref ? ` "${ref}"` : ''} in ${repo}`,
        date,
        url: repoUrl,
      };
    }
    case 'PullRequestEvent': {
      const pr = event.payload.pull_request as Record<string, unknown>;
      const action = event.payload.action as string;
      const number = pr?.number;
      const prUrl = (pr?.html_url as string) || repoUrl;
      return {
        type: 'PullRequest',
        repo,
        description: `${action === 'closed' && (pr?.merged as boolean) ? 'Merged' : action.charAt(0).toUpperCase() + action.slice(1)} PR #${number} in ${repo}`,
        date,
        url: prUrl,
      };
    }
    case 'IssuesEvent': {
      const issue = event.payload.issue as Record<string, unknown>;
      const action = event.payload.action as string;
      const number = issue?.number;
      const issueUrl = (issue?.html_url as string) || repoUrl;
      return {
        type: 'Issues',
        repo,
        description: `${action.charAt(0).toUpperCase() + action.slice(1)} issue #${number} in ${repo}`,
        date,
        url: issueUrl,
      };
    }
    case 'WatchEvent':
      return {
        type: 'Star',
        repo,
        description: `Starred ${repo}`,
        date,
        url: repoUrl,
      };
    case 'ForkEvent':
      return {
        type: 'Fork',
        repo,
        description: `Forked ${repo}`,
        date,
        url: repoUrl,
      };
    case 'DeleteEvent': {
      const refType = event.payload.ref_type as string;
      const ref = event.payload.ref as string;
      return {
        type: 'Delete',
        repo,
        description: `Deleted ${refType} "${ref}" in ${repo}`,
        date,
        url: repoUrl,
      };
    }
    default:
      return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const row = await queryOne<{ value: string }>(
      "SELECT value FROM app_settings WHERE key = 'github_token'"
    );

    if (!row?.value) {
      return NextResponse.json({ error: 'GitHub token not configured' }, { status: 200 });
    }

    const token = row.value;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'repos';

    if (type === 'repos') {
      const res = await fetch(`${GITHUB_API}/user/repos?sort=pushed&per_page=20`, {
        headers: HEADERS(token),
      });

      if (!res.ok) {
        const rateRemaining = res.headers.get('x-ratelimit-remaining');
        if (res.status === 403 && rateRemaining === '0') {
          const resetTime = res.headers.get('x-ratelimit-reset');
          return NextResponse.json(
            { error: 'GitHub API rate limit exceeded', resetAt: resetTime ? new Date(parseInt(resetTime) * 1000).toISOString() : null },
            { status: 429 }
          );
        }
        return NextResponse.json({ error: `GitHub API error: ${res.status}` }, { status: res.status });
      }

      const repos: GitHubRepo[] = await res.json();
      const rateRemaining = res.headers.get('x-ratelimit-remaining');
      const rateLimit = res.headers.get('x-ratelimit-limit');

      return NextResponse.json({
        repos: repos.map((r) => ({
          name: r.name,
          full_name: r.full_name,
          description: r.description,
          language: r.language,
          pushed_at: r.pushed_at,
          html_url: r.html_url,
          open_issues_count: r.open_issues_count,
          stargazers_count: r.stargazers_count,
          private: r.private,
        })),
        rateLimit: { remaining: rateRemaining, limit: rateLimit },
      });
    }

    if (type === 'activity') {
      // Get username first
      const userRes = await fetch(`${GITHUB_API}/user`, {
        headers: HEADERS(token),
      });

      if (!userRes.ok) {
        return NextResponse.json({ error: `GitHub API error: ${userRes.status}` }, { status: userRes.status });
      }

      const user = await userRes.json();
      const username = user.login;

      const eventsRes = await fetch(`${GITHUB_API}/users/${username}/events?per_page=30`, {
        headers: HEADERS(token),
      });

      if (!eventsRes.ok) {
        const rateRemaining = eventsRes.headers.get('x-ratelimit-remaining');
        if (eventsRes.status === 403 && rateRemaining === '0') {
          const resetTime = eventsRes.headers.get('x-ratelimit-reset');
          return NextResponse.json(
            { error: 'GitHub API rate limit exceeded', resetAt: resetTime ? new Date(parseInt(resetTime) * 1000).toISOString() : null },
            { status: 429 }
          );
        }
        return NextResponse.json({ error: `GitHub API error: ${eventsRes.status}` }, { status: eventsRes.status });
      }

      const events: GitHubEvent[] = await eventsRes.json();
      const rateRemaining = eventsRes.headers.get('x-ratelimit-remaining');
      const rateLimit = eventsRes.headers.get('x-ratelimit-limit');

      const formatted = events.map(formatEvent).filter(Boolean);

      return NextResponse.json({
        events: formatted,
        username,
        rateLimit: { remaining: rateRemaining, limit: rateLimit },
      });
    }

    return NextResponse.json({ error: 'Invalid type parameter. Use "repos" or "activity".' }, { status: 400 });
  } catch (err) {
    console.error('GitHub API error:', err);
    return NextResponse.json({ error: 'Failed to fetch GitHub data' }, { status: 500 });
  }
}
