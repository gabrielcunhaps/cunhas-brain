import { Pool } from '@neondatabase/serverless';

function getPool() {
  const url = process.env.DATABASE_URL || process.env.STORAGE_URL;
  if (!url) throw new Error('No database URL configured (DATABASE_URL or STORAGE_URL)');
  return new Pool({ connectionString: url });
}

export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const pool = getPool();
  try {
    const result = await pool.query(text, params);
    return result.rows as T[];
  } finally {
    await pool.end();
  }
}

export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] || null;
}
