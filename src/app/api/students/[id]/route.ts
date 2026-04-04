import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const student = await queryOne(
      'SELECT s.* FROM students s WHERE s.id = $1',
      [id]
    );

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    const meetings = await query(
      `SELECT sm.*, m.title, m.date, m.duration
       FROM student_meetings sm
       JOIN meetings m ON m.id = sm.meeting_id
       WHERE sm.student_id = $1
       ORDER BY m.date DESC`,
      [id]
    );

    return NextResponse.json({ ...student, meetings });
  } catch (err) {
    console.error('Error fetching student:', err);
    return NextResponse.json({ error: 'Failed to fetch student' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, email, notes, learning_plan, profile, status } = body;

    const student = await queryOne(
      `UPDATE students
       SET name = COALESCE($1, name),
           email = COALESCE($2, email),
           notes = COALESCE($3, notes),
           learning_plan = COALESCE($4, learning_plan),
           profile = COALESCE($5, profile),
           status = COALESCE($6, status),
           updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [
        name || null,
        email || null,
        notes || null,
        learning_plan ? JSON.stringify(learning_plan) : null,
        profile ? JSON.stringify(profile) : null,
        status || null,
        id,
      ]
    );

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    return NextResponse.json(student);
  } catch (err) {
    console.error('Error updating student:', err);
    return NextResponse.json({ error: 'Failed to update student' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await query('DELETE FROM student_meetings WHERE student_id = $1', [id]);
    const result = await queryOne(
      'DELETE FROM students WHERE id = $1 RETURNING id',
      [id]
    );

    if (!result) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error deleting student:', err);
    return NextResponse.json({ error: 'Failed to delete student' }, { status: 500 });
  }
}
