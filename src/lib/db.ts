import { Pool } from '@neondatabase/serverless';

function getPool() {
  return new Pool({ connectionString: process.env.DATABASE_URL! });
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
