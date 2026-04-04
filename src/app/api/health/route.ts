import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Database health check
    const dbOk = await query('SELECT COUNT(*) as count FROM meetings')
      .then((r) => ({ ok: true, count: r[0].count }))
      .catch((e: Error) => ({ ok: false, error: e.message }));

    // 2. Anthropic API key check
    const apiKey = await queryOne<{ value: string }>(
      "SELECT value FROM app_settings WHERE key = 'anthropic_api_key'"
    );
    const anthropicOk = { ok: !!apiKey?.value, configured: !!apiKey?.value };

    // 3. Model preference
    const modelRow = await queryOne<{ value: string }>(
      "SELECT value FROM app_settings WHERE key = 'anthropic_model'"
    );
    const model = modelRow?.value || 'claude-haiku-4-5-20251001';

    // 4. Krisp webhook: check last meeting received
    const lastMeeting = await queryOne<{ title: string; created_at: string }>(
      'SELECT title, created_at FROM meetings ORDER BY created_at DESC LIMIT 1'
    );

    // 5. Stats
    const stats = await query<{ meetings: string; summaries: string; chats: string }>(
      "SELECT (SELECT COUNT(*) FROM meetings) as meetings, (SELECT COUNT(*) FROM meeting_summaries) as summaries, (SELECT COUNT(*) FROM chat_messages) as chats"
    );

    return NextResponse.json({
      database: dbOk,
      anthropic: { ...anthropicOk, model },
      krisp: { lastMeeting },
      stats: stats[0],
    });
  } catch (err) {
    console.error('Health check error:', err);
    return NextResponse.json({ error: 'Health check failed' }, { status: 500 });
  }
}
