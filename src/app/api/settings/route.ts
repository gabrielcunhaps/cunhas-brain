import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rows = await query('SELECT key, value FROM app_settings');

    const settings: Record<string, string> = {};
    for (const row of rows) {
      const key = row.key as string;
      const val = row.value as string;
      if (key.includes('key') || key.includes('secret')) {
        settings[key] = val.length > 4 ? '****' + val.slice(-4) : '****';
      } else {
        settings[key] = val;
      }
    }

    return NextResponse.json(settings);
  } catch (err) {
    console.error('Settings GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { key, value } = await request.json();

    if (!key || !value) {
      return NextResponse.json({ error: 'key and value are required' }, { status: 400 });
    }

    await query(
      'INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()',
      [key, value]
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Settings PUT error:', err);
    return NextResponse.json({ error: 'Failed to update setting' }, { status: 500 });
  }
}
