import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { getAnthropicClient } from '@/lib/anthropic';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const studentId = params.id;
    const body = await request.json();
    const { meetingId, sessionNotes, homework, nextSessionPlan } = body;

    if (!meetingId) {
      return NextResponse.json({ error: 'meetingId is required' }, { status: 400 });
    }

    // Verify student exists
    const student = await queryOne<Record<string, unknown>>(
      'SELECT * FROM students WHERE id = $1',
      [studentId]
    );
    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    // Get the meeting transcript
    const meeting = await queryOne<Record<string, unknown>>(
      'SELECT * FROM meetings WHERE id = $1',
      [meetingId]
    );
    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    // Insert the student_meeting record
    const studentMeeting = await queryOne(
      `INSERT INTO student_meetings (student_id, meeting_id, session_notes, homework, next_session_plan, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [studentId, meetingId, sessionNotes || null, homework || null, nextSessionPlan || null]
    );

    // Count existing meetings for this student (including the one just inserted)
    const countRow = await queryOne<{ count: string }>(
      'SELECT COUNT(*) as count FROM student_meetings WHERE student_id = $1',
      [studentId]
    );
    const meetingCount = parseInt(countRow?.count || '0', 10);

    const transcript = (meeting.raw_content as string) || '';

    await log('summary', `Attaching meeting ${meetingId} to student ${studentId} (meeting #${meetingCount})`, { transcript: transcript.length });

    if (meetingCount === 1 && transcript) {
      // First meeting: generate learning plan and profile
      try {
        await log('summary', `Generating learning plan for ${student.name}`);
        const anthropic = await getAnthropicClient();
        const response = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 2048,
          messages: [
            {
              role: 'user',
              content: `Based on this first meeting transcript with a new student named ${student.name}, create:
1. A student profile (background, goals, experience level, learning style)
2. A personalized learning plan (topics, milestones, timeline)

Meeting transcript:
${transcript.substring(0, 8000)}

Return as JSON only, no markdown: { "profile": { "background": "...", "goals": "...", "level": "...", "style": "..." }, "learningPlan": { "topics": [...], "milestones": [...], "timeline": "..." } }`,
            },
          ],
        });

        const textBlock = response.content.find((b) => b.type === 'text');
        if (textBlock && textBlock.type === 'text') {
          const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
          const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : textBlock.text);

          await queryOne(
            `UPDATE students SET profile = $1, learning_plan = $2, updated_at = NOW() WHERE id = $3 RETURNING *`,
            [JSON.stringify(parsed.profile), JSON.stringify(parsed.learningPlan), studentId]
          );
          await log('summary', `Learning plan generated for ${student.name}`);
        }
      } catch (aiErr) {
        const errMsg = aiErr instanceof Error ? aiErr.message : String(aiErr);
        console.error('AI profile generation failed:', errMsg);
        await log('error', `AI profile generation failed for ${student.name}: ${errMsg}`);
      }
    } else if (meetingCount > 1 && transcript) {
      // Subsequent meetings: generate session notes and next plan
      try {
        const previousMeetings = await query(
          `SELECT sm.session_notes, sm.homework, sm.next_session_plan, m.title, m.date
           FROM student_meetings sm
           JOIN meetings m ON m.id = sm.meeting_id
           WHERE sm.student_id = $1 AND sm.meeting_id != $2
           ORDER BY m.date DESC
           LIMIT 3`,
          [studentId, meetingId]
        );

        const prevContext = previousMeetings
          .map(
            (pm: Record<string, unknown>) =>
              `Meeting: ${pm.title} (${pm.date})\nNotes: ${pm.session_notes || 'N/A'}\nHomework: ${pm.homework || 'N/A'}`
          )
          .join('\n\n');

        const learningPlan = student.learning_plan
          ? JSON.stringify(student.learning_plan)
          : 'No learning plan yet';

        const anthropic = await getAnthropicClient();
        const response = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 2048,
          messages: [
            {
              role: 'user',
              content: `Based on the student's learning plan, previous session notes, and this latest meeting transcript, generate:
1. Updated session notes for this meeting
2. Homework for the student
3. A plan for the next session

Student: ${student.name}
Learning Plan: ${learningPlan}

Previous sessions:
${prevContext}

Latest meeting transcript:
${transcript.substring(0, 8000)}

Return as JSON only, no markdown: { "sessionNotes": "...", "homework": "...", "nextSessionPlan": "..." }`,
            },
          ],
        });

        const textBlock = response.content.find((b) => b.type === 'text');
        if (textBlock && textBlock.type === 'text') {
          const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
          const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : textBlock.text);

          await queryOne(
            `UPDATE student_meetings
             SET session_notes = $1, homework = $2, next_session_plan = $3
             WHERE student_id = $4 AND meeting_id = $5
             RETURNING *`,
            [parsed.sessionNotes, parsed.homework, parsed.nextSessionPlan, studentId, meetingId]
          );
          await log('summary', `Session plan generated for ${student.name}`);
        }
      } catch (aiErr) {
        const errMsg = aiErr instanceof Error ? aiErr.message : String(aiErr);
        console.error('AI session plan generation failed:', errMsg);
        await log('error', `AI session plan failed for ${student.name}: ${errMsg}`);
      }
    }

    return NextResponse.json(studentMeeting, { status: 201 });
  } catch (err) {
    console.error('Error attaching meeting to student:', err);
    return NextResponse.json({ error: 'Failed to attach meeting' }, { status: 500 });
  }
}
