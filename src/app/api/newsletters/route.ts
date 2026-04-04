import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { getAnthropicClient } from '@/lib/anthropic';

export const dynamic = 'force-dynamic';

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .trim();
}

async function getInoreaderToken(): Promise<string | null> {
  const row = await queryOne<{ value: string }>(
    'SELECT value FROM app_settings WHERE key = $1',
    ['inoreader_token']
  );
  return row?.value || null;
}

function toDateRange(dateStr: string): { start: number; end: number } {
  const d = new Date(dateStr + 'T00:00:00Z');
  const start = Math.floor(d.getTime() / 1000);
  const end = start + 86400;
  return { start, end };
}

interface InoreaderItem {
  id: string;
  title: string;
  canonical?: { href: string }[];
  origin?: { title: string };
  published: number;
  summary?: { content: string };
}

async function fetchFromInoreader(token: string, from: string, to: string): Promise<InoreaderItem[]> {
  const { start } = toDateRange(from);
  const toDate = new Date(to + 'T00:00:00Z');
  const end = Math.floor(toDate.getTime() / 1000) + 86400;

  const url = `https://www.inoreader.com/reader/api/0/stream/contents?n=50&ot=${start}&nt=${end}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Inoreader API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data.items || [];
}

async function cacheArticles(items: InoreaderItem[]) {
  for (const item of items) {
    const title = item.title || 'Untitled';
    const source = item.origin?.title || 'Unknown';
    const url = item.canonical?.[0]?.href || '';
    const published = new Date(item.published * 1000);
    const date = published.toISOString().split('T')[0];
    const content = item.summary?.content ? stripHtml(item.summary.content) : '';

    // Check if article already exists for this title+date
    const existing = await queryOne(
      'SELECT id FROM newsletter_cache WHERE title = $1 AND date = $2',
      [title, date]
    );

    if (existing) {
      await query(
        'UPDATE newsletter_cache SET source = $1, content = $2, url = $3, fetched_at = NOW() WHERE title = $4 AND date = $5',
        [source, content, url, title, date]
      );
    } else {
      await query(
        'INSERT INTO newsletter_cache (date, title, source, content, url, fetched_at) VALUES ($1, $2, $3, $4, $5, NOW())',
        [date, title, source, content, url]
      );
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cached = searchParams.get('cached');
    const date = searchParams.get('date');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    // Return cached results
    if (cached === 'true') {
      let sql = 'SELECT * FROM newsletter_cache';
      const params: string[] = [];

      if (from && to) {
        sql += ' WHERE date >= $1 AND date <= $2';
        params.push(from, to);
      } else if (date) {
        sql += ' WHERE date = $1';
        params.push(date);
      }

      sql += ' ORDER BY date DESC, fetched_at DESC';
      const rows = await query(sql, params);
      return NextResponse.json({ articles: rows });
    }

    // Fetch from Inoreader
    const token = await getInoreaderToken();
    if (!token) {
      return NextResponse.json(
        { error: 'Inoreader token not configured', needsConfig: true },
        { status: 400 }
      );
    }

    const today = new Date().toISOString().split('T')[0];
    const fromDate = from || date || today;
    const toDate = to || date || today;

    const items = await fetchFromInoreader(token, fromDate, toDate);
    await cacheArticles(items);

    // Return cached results after fetching
    const sql = 'SELECT * FROM newsletter_cache WHERE date >= $1 AND date <= $2 ORDER BY date DESC, fetched_at DESC';
    const rows = await query(sql, [fromDate, toDate]);

    return NextResponse.json({ articles: rows, fetched: items.length });
  } catch (err) {
    console.error('Newsletters GET error:', err);
    const message = err instanceof Error ? err.message : 'Failed to fetch newsletters';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { from, to } = await request.json();

    if (!from || !to) {
      return NextResponse.json({ error: 'from and to dates are required' }, { status: 400 });
    }

    const rows = await query<{
      title: string;
      source: string;
      content: string;
      date: string;
      url: string;
    }>(
      'SELECT title, source, content, date, url FROM newsletter_cache WHERE date >= $1 AND date <= $2 ORDER BY date DESC',
      [from, to]
    );

    if (rows.length === 0) {
      return NextResponse.json({
        error: 'No cached articles found for this date range. Fetch articles first.',
      }, { status: 400 });
    }

    const articlesText = rows
      .map(
        (r, i) =>
          `${i + 1}. [${r.date}] "${r.title}" from ${r.source}\n${r.content}\nURL: ${r.url}`
      )
      .join('\n\n');

    const client = await getAnthropicClient();
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: `Summarize these newsletter articles. Group by topic. Highlight key insights and action items.\n\nArticles:\n${articlesText}`,
        },
      ],
    });

    const summary =
      response.content[0].type === 'text' ? response.content[0].text : '';

    return NextResponse.json({
      summary,
      articleCount: rows.length,
      dateRange: { from, to },
    });
  } catch (err) {
    console.error('Newsletters POST error:', err);
    const message = err instanceof Error ? err.message : 'Failed to generate summary';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
