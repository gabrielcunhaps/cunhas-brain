import { query } from './db';

export async function log(type: string, message: string, metadata?: Record<string, unknown>) {
  try {
    await query(
      'INSERT INTO app_logs (type, message, metadata) VALUES ($1, $2, $3)',
      [type, message, metadata ? JSON.stringify(metadata) : '{}']
    );
  } catch {
    // Don't let logging failures break the app
    console.error('Failed to log:', type, message);
  }
}
