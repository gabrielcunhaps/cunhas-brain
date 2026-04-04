import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * Krisp Webhook Receiver
 * Configure in Krisp: Settings → Integrations → Webhook
 * URL: https://your-app.vercel.app/api/webhook/krisp
 */
export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();

    // Parse nested Krisp payload
    const data = payload.data || {};
    const meeting = data.meeting || data.raw_meeting || {};

    const title = meeting.title || payload.title || payload.meetingTitle || 'Untitled Meeting';
    const rawContent = data.raw_content || '';
    const content = data.content || [];
    const duration = meeting.duration || payload.duration || 0;
    const participants = meeting.participants || payload.participants || [];
    const speakers = meeting.speakers || [];
    const startDate = meeting.start_date || payload.start_time || new Date().toISOString();
    const krispId = payload.id || meeting.id || '';

    // Insert into meetings table (skip if duplicate krisp_id)
    const rows = await query(
      `INSERT INTO meetings (krisp_id, title, date, duration, participants, speakers, raw_content, content, payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (krisp_id) DO UPDATE SET
         title = EXCLUDED.title,
         raw_content = EXCLUDED.raw_content,
         content = EXCLUDED.content,
         payload = EXCLUDED.payload
       RETURNING id`,
      [
        krispId || `krisp-${Date.now()}`,
        title,
        startDate,
        duration,
        JSON.stringify(participants),
        JSON.stringify(speakers),
        rawContent,
        JSON.stringify(content),
        JSON.stringify(payload),
      ]
    );

    const meetingId = rows[0]?.id;

    await log('webhook', `Received meeting: ${title}`, { meetingId, krispId });

    return NextResponse.json({
      status: 'ok',
      meetingId,
      title,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('Webhook error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ready',
    description: "Cunha's Brain — Krisp Webhook Receiver",
    usage: 'Configure in Krisp: Settings → Integrations → Webhook',
  });
}
