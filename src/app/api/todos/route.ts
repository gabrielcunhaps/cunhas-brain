import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface ActionItemRow {
  meeting_id: string;
  action_items: unknown;
  meeting_title: string;
  meeting_date: string;
}

interface TodoStatus {
  id: number;
  meeting_id: string;
  todo_text: string;
  done: boolean;
}

interface TodoItem {
  id: string;
  meetingId: string;
  meetingTitle: string;
  meetingDate: string;
  text: string;
  assignee: string | null;
  done: boolean;
}

export async function GET() {
  try {
    const rows = await query<ActionItemRow>(
      `SELECT ms.meeting_id, ms.action_items, m.title as meeting_title, m.date as meeting_date
       FROM meeting_summaries ms
       JOIN meetings m ON m.id = ms.meeting_id
       ORDER BY m.date DESC`
    );

    const statuses = await query<TodoStatus>(
      `SELECT meeting_id, todo_text, done FROM todo_status`
    );

    const statusMap = new Map<string, boolean>();
    for (const s of statuses) {
      statusMap.set(`${s.meeting_id}::${s.todo_text}`, s.done);
    }

    const todos: TodoItem[] = [];

    for (const row of rows) {
      let items: unknown[] = [];
      if (Array.isArray(row.action_items)) {
        items = row.action_items;
      } else if (typeof row.action_items === 'string') {
        try {
          items = JSON.parse(row.action_items);
        } catch {
          items = [];
        }
      }

      for (const item of items) {
        let text: string;
        let assignee: string | null = null;

        if (typeof item === 'string') {
          text = item;
        } else if (typeof item === 'object' && item !== null) {
          const obj = item as Record<string, unknown>;
          text = String(obj.task || obj.text || obj.description || JSON.stringify(obj));
          assignee = obj.assignee ? String(obj.assignee) : null;
        } else {
          text = String(item);
        }

        const key = `${row.meeting_id}::${text}`;
        const done = statusMap.get(key) ?? false;
        const id = Buffer.from(key).toString('base64');

        todos.push({
          id,
          meetingId: row.meeting_id,
          meetingTitle: row.meeting_title,
          meetingDate: row.meeting_date ? new Date(row.meeting_date).toISOString() : new Date().toISOString(),
          text,
          assignee,
          done,
        });
      }
    }

    return NextResponse.json({ todos });
  } catch (err) {
    console.error('Error fetching todos:', err);
    return NextResponse.json({ error: 'Failed to fetch todos' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { meetingId, todoText, done } = body;

    if (!meetingId || !todoText || typeof done !== 'boolean') {
      return NextResponse.json({ error: 'Missing required fields: meetingId, todoText, done' }, { status: 400 });
    }

    const existing = await queryOne<TodoStatus>(
      `SELECT id FROM todo_status WHERE meeting_id = $1 AND todo_text = $2`,
      [meetingId, todoText]
    );

    if (existing) {
      await query(
        `UPDATE todo_status SET done = $1 WHERE meeting_id = $2 AND todo_text = $3`,
        [done, meetingId, todoText]
      );
    } else {
      await query(
        `INSERT INTO todo_status (meeting_id, todo_text, done) VALUES ($1, $2, $3)`,
        [meetingId, todoText, done]
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error updating todo status:', err);
    return NextResponse.json({ error: 'Failed to update todo status' }, { status: 500 });
  }
}
