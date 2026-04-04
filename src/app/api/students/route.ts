import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rows = await query(
      `SELECT s.*,
              COUNT(sm.id) as meeting_count,
              MAX(m.date) as last_session_date,
              COALESCE(SUM(m.duration), 0) as total_duration
       FROM students s
       LEFT JOIN student_meetings sm ON s.id = sm.student_id
       LEFT JOIN meetings m ON m.id = sm.meeting_id
       GROUP BY s.id
       ORDER BY s.updated_at DESC`
    );
    return NextResponse.json(rows);
  } catch (err) {
    console.error('Error fetching students:', err);
    return NextResponse.json({ error: 'Failed to fetch students' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, platform, notes } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const student = await queryOne(
      `INSERT INTO students (name, email, platform, notes, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'active', NOW(), NOW())
       RETURNING *`,
      [name, email || null, platform || null, notes || null]
    );

    return NextResponse.json(student, { status: 201 });
  } catch (err) {
    console.error('Error creating student:', err);
    return NextResponse.json({ error: 'Failed to create student' }, { status: 500 });
  }
}
