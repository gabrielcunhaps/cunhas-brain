import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { getAnthropicClient } from '@/lib/anthropic';
import { log } from '@/lib/logger';
import { inoreaderFetch, getInoreaderToken } from '@/lib/inoreader';
import { getPrompt, fillPrompt, DEFAULT_NEWSLETTER_PROMPT } from '@/lib/categoryPrompts';

export const dynamic = 'force-dynamic';

// Inoreader newsletter stream: user/-/state/com.google/created-by-newsletter

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

interface InoreaderItem {
  id: string;
  title: string;
  canonical?: { href: string }[];
  origin?: { title: string };
  published: number;
  summary?: { content: string };
  categories?: string[];
}

async function fetchFromInoreader(from: string, to: string): Promise<InoreaderItem[]> {
  const startTs = Math.floor(new Date(from + 'T00:00:00Z').getTime() / 1000);
  const endTs = Math.floor(new Date(to + 'T23:59:59Z').getTime() / 1000);

  // Fetch from the Newsletter email subscription (feed/dailynewsletter3@ino.to)
  const nlStream = encodeURIComponent('feed/dailynewsletter3@ino.to');
  const nlUrl = `https://www.inoreader.com/reader/api/0/stream/contents/${nlStream}?n=100&ot=${startTs}&nt=${endTs}`;
  const res = await inoreaderFetch(nlUrl);

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

    const existing = await queryOne(
      'SELECT id FROM newsletter_cache WHERE title = $1 AND date = $2',
      [title, date]
    );

    if (!existing) {
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
    const summaryOnly = searchParams.get('summary');

    // Return cached daily summary
    if (summaryOnly === 'true' && date) {
      const row = await queryOne<{ value: string }>(
        "SELECT value FROM app_settings WHERE key = $1",
        [`daily_summary_${date}`]
      );
      if (row) {
        return NextResponse.json({ summary: row.value, date, cached: true });
      }
      return NextResponse.json({ summary: null, date, cached: false });
    }

    // Return cached articles
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

    // Fetch from Inoreader newsletter folders (auto-refreshes token on 401)
    const token = await getInoreaderToken();
    if (!token) {
      return NextResponse.json(
        { error: 'Inoreader token not configured. Go to Settings to connect.', needsConfig: true },
        { status: 400 }
      );
    }

    const today = new Date().toISOString().split('T')[0];
    const fromDate = from || date || today;
    const toDate = to || date || today;

    const items = await fetchFromInoreader(fromDate, toDate);
    await cacheArticles(items);
    await log('webhook', `Fetched ${items.length} newsletter articles`, { from: fromDate, to: toDate });

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

    // Check for cached summary first
    if (from === to) {
      const cached = await queryOne<{ value: string }>(
        "SELECT value FROM app_settings WHERE key = $1",
        [`daily_summary_${from}`]
      );
      if (cached) {
        return NextResponse.json({ summary: cached.value, articleCount: 0, dateRange: { from, to }, cached: true });
      }
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
        error: 'No articles found for this date range. Click Fetch first to load articles.',
      }, { status: 400 });
    }

    const articlesFormatted = rows
      .map((r, i) => `--- ARTICLE ${i + 1} ---\nTitle: ${r.title}\nSource: ${r.source}\nDate: ${r.date}\nURL: ${r.url}\n\n${r.content?.slice(0, 3000) || 'No content'}\n`)
      .join('\n');

    const client = await getAnthropicClient();
    const promptTemplate = await getPrompt('prompt_newsletter', DEFAULT_NEWSLETTER_PROMPT);
    const filledPrompt = fillPrompt(promptTemplate, {
      from,
      to,
      articleCount: String(rows.length),
      articles: articlesFormatted.slice(0, 80000),
    });

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{ role: 'user', content: filledPrompt }],
    });

    const summary = response.content[0].type === 'text' ? response.content[0].text : '';

    // Cache daily summary if single day
    if (from === to) {
      await query(
        `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
        [`daily_summary_${from}`, summary]
      );
    }

    await log('summary', `Generated newsletter summary: ${rows.length} articles, ${from} to ${to}`);

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
