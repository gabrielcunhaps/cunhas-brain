import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { getAnthropicClient } from '@/lib/anthropic';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const FIRST_MEETING_PROMPT = (name: string, transcript: string) => `You are an expert AI tutor assistant analyzing a first session with a new student.

Student: ${name}

Meeting transcript:
${transcript.substring(0, 12000)}

Analyze this first meeting and return a comprehensive JSON response. Think about what will help this student BUILD useful things and grow through hands-on practice.

Return as JSON only, no markdown:
{
  "profile": {
    "background": "Student's professional and educational background",
    "goals": "What they want to achieve — be specific",
    "level": "Current skill level (beginner/intermediate/advanced) with nuance",
    "style": "How they learn best based on the conversation",
    "strengths": "What they already know well",
    "gaps": "Key knowledge gaps identified"
  },
  "learningPlan": {
    "topics": ["Topic 1: description", "Topic 2: description"],
    "milestones": ["Milestone 1: what success looks like", "Milestone 2"],
    "timeline": "Realistic timeline with phases"
  },
  "sessionInsights": {
    "sessionSummary": "What was discussed, what was demonstrated, what clicked for the student",
    "keyLearnings": ["Specific thing the student learned or understood during this session"],
    "bestPractices": ["Good practice or principle that was taught/demonstrated"],
    "topicsDiscussed": ["topic 1", "topic 2"],
    "todos": ["Specific actionable task for the student"],
    "buildProjects": [
      {
        "project": "Name of something to build",
        "description": "One line on what to build",
        "instruction": "One-line instruction they can give to an AI to start building this",
        "whatTheyLearn": "What skill/concept this teaches",
        "whyItMatters": "Why this is valuable for their goals"
      }
    ],
    "recommendations": ["Recommendation for what to explore or practice next"],
    "homework": "Specific homework assignment with clear deliverables",
    "nextSessionPlan": "What to cover next session based on where we left off"
  }
}`;

const SUBSEQUENT_MEETING_PROMPT = (name: string, learningPlan: string, prevContext: string, transcript: string) => `You are an expert AI tutor assistant analyzing a follow-up session with a student.

Student: ${name}
Learning Plan: ${learningPlan}

Previous sessions:
${prevContext}

Latest meeting transcript:
${transcript.substring(0, 12000)}

Analyze this session in the context of the student's learning journey. Focus on what they BUILT, what they LEARNED, and what they should BUILD next.

Return as JSON only, no markdown:
{
  "sessionSummary": "Detailed summary — what was covered, what was demonstrated, what the student practiced",
  "keyLearnings": ["Specific concept or skill the student grasped during this session"],
  "bestPractices": ["Good practice or principle that was taught/reinforced"],
  "topicsDiscussed": ["topic 1", "topic 2"],
  "progressNotes": "What improved since last session, what skills are developing, what's still challenging",
  "todos": ["Specific actionable task with clear outcome"],
  "buildProjects": [
    {
      "project": "Name of something to build",
      "description": "One line on what to build",
      "instruction": "One-line instruction they can give to an AI to start building this",
      "whatTheyLearn": "What skill/concept this teaches",
      "whyItMatters": "Why this is valuable for their goals"
    }
  ],
  "recommendations": ["Recommendation for resources, tools, or practices to explore"],
  "homework": "Specific homework with clear deliverables and deadline suggestion",
  "nextSessionPlan": "Concrete plan for next session — what to review, what new ground to cover"
}`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractJSON(text: string): any {
  // Try direct parse first
  try { return JSON.parse(text); } catch { /* continue */ }

  // Try to find JSON block — match balanced braces
  let depth = 0;
  let start = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (text[i] === '}') {
      depth--;
      if (depth === 0 && start >= 0) {
        try {
          return JSON.parse(text.substring(start, i + 1));
        } catch {
          // Keep looking
          start = -1;
        }
      }
    }
  }

  // Last resort: greedy regex
  const match = text.match(/\{[\s\S]*\}/);
  if (match) return JSON.parse(match[0]);

  throw new Error('No valid JSON found in response');
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const studentId = params.id;
    const body = await request.json();
    // Support both single meetingId and array of meetingIds
    const meetingIds: string[] = body.meetingIds || (body.meetingId ? [body.meetingId] : []);

    if (meetingIds.length === 0) {
      return NextResponse.json({ error: 'meetingId or meetingIds is required' }, { status: 400 });
    }

    const student = await queryOne<Record<string, unknown>>(
      'SELECT * FROM students WHERE id = $1',
      [studentId]
    );
    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    // Fetch all selected meetings
    const meetings: Record<string, unknown>[] = [];
    for (const mid of meetingIds) {
      const m = await queryOne<Record<string, unknown>>('SELECT * FROM meetings WHERE id = $1', [mid]);
      if (m) meetings.push(m);
    }
    if (meetings.length === 0) {
      return NextResponse.json({ error: 'No valid meetings found' }, { status: 404 });
    }

    // Use the first meeting as the primary record
    const primaryMeetingId = meetingIds[0];

    // Insert student_meeting records for each meeting
    let studentMeeting;
    for (const mid of meetingIds) {
      const sm = await queryOne(
        `INSERT INTO student_meetings (student_id, meeting_id, session_notes, homework, next_session_plan, created_at)
         VALUES ($1, $2, NULL, NULL, NULL, NOW())
         ON CONFLICT DO NOTHING RETURNING *`,
        [studentId, mid]
      );
      if (!studentMeeting) studentMeeting = sm;
    }

    const countRow = await queryOne<{ count: string }>(
      'SELECT COUNT(*) as count FROM student_meetings WHERE student_id = $1',
      [studentId]
    );
    const meetingCount = parseInt(countRow?.count || '0', 10);

    // Consolidate transcripts from all selected meetings
    const transcriptParts = meetings.map((m, i) => {
      const title = m.title as string || 'Untitled';
      const content = (m.raw_content as string) || '';
      if (meetings.length > 1) {
        return `--- Part ${i + 1}: ${title} ---\n${content}`;
      }
      return content;
    });
    const transcript = transcriptParts.join('\n\n').substring(0, 16000);

    await log('summary', `Attaching meeting ${meetingId} to student ${studentId} (meeting #${meetingCount})`, { transcript: transcript.length });

    if (meetingCount === 1 && transcript) {
      try {
        await log('summary', `Generating learning plan and session insights for ${student.name}`);
        const anthropic = await getAnthropicClient();
        const response = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 4096,
          messages: [{ role: 'user', content: FIRST_MEETING_PROMPT(String(student.name), transcript) }],
        });

        const textBlock = response.content.find((b) => b.type === 'text');
        if (textBlock && textBlock.type === 'text') {
          const parsed = extractJSON(textBlock.text);

          await queryOne(
            `UPDATE students SET profile = $1, learning_plan = $2, updated_at = NOW() WHERE id = $3 RETURNING *`,
            [JSON.stringify(parsed.profile), JSON.stringify(parsed.learningPlan), studentId]
          );

          const insights = parsed.sessionInsights || {};
          await queryOne(
            `UPDATE student_meetings SET session_notes = $1, homework = $2, next_session_plan = $3
             WHERE student_id = $4 AND meeting_id = $5 RETURNING *`,
            [JSON.stringify(insights), insights.homework || null, insights.nextSessionPlan || null, studentId, primaryMeetingId]
          );
          await log('summary', `Learning plan and session insights generated for ${student.name}`);
        }
      } catch (aiErr) {
        const errMsg = aiErr instanceof Error ? aiErr.message : String(aiErr);
        console.error('AI profile generation failed:', errMsg);
        await log('error', `AI profile generation failed for ${student.name}: ${errMsg}`);
      }
    } else if (meetingCount > 1 && transcript) {
      try {
        const previousMeetings = await query(
          `SELECT sm.session_notes, sm.homework, sm.next_session_plan, m.title, m.date
           FROM student_meetings sm JOIN meetings m ON m.id = sm.meeting_id
           WHERE sm.student_id = $1 AND sm.meeting_id != ALL($2::int[])
           ORDER BY m.date DESC LIMIT 3`,
          [studentId, meetingIds]
        );

        const prevContext = previousMeetings
          .map((pm: Record<string, unknown>) => {
            let notes = pm.session_notes || 'N/A';
            if (typeof notes === 'string') {
              try { const p = JSON.parse(notes); notes = p.sessionSummary || notes; } catch { /* keep */ }
            }
            return `Meeting: ${pm.title} (${pm.date})\nSummary: ${notes}\nHomework: ${pm.homework || 'N/A'}`;
          })
          .join('\n\n');

        const learningPlan = student.learning_plan
          ? (typeof student.learning_plan === 'string' ? student.learning_plan : JSON.stringify(student.learning_plan))
          : 'No learning plan yet';

        const anthropic = await getAnthropicClient();
        const response = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 4096,
          messages: [{ role: 'user', content: SUBSEQUENT_MEETING_PROMPT(String(student.name), learningPlan, prevContext, transcript) }],
        });

        const textBlock = response.content.find((b) => b.type === 'text');
        if (textBlock && textBlock.type === 'text') {
          const parsed = extractJSON(textBlock.text);

          await queryOne(
            `UPDATE student_meetings SET session_notes = $1, homework = $2, next_session_plan = $3
             WHERE student_id = $4 AND meeting_id = $5 RETURNING *`,
            [JSON.stringify(parsed), parsed.homework || null, parsed.nextSessionPlan || null, studentId, meetingId]
          );
          await log('summary', `Session insights generated for ${student.name} (meeting #${meetingCount})`);
        }
      } catch (aiErr) {
        const errMsg = aiErr instanceof Error ? aiErr.message : String(aiErr);
        console.error('AI session insights failed:', errMsg);
        await log('error', `AI session insights failed for ${student.name}: ${errMsg}`);
      }
    }

    return NextResponse.json(studentMeeting, { status: 201 });
  } catch (err) {
    console.error('Error attaching meeting to student:', err);
    return NextResponse.json({ error: 'Failed to attach meeting' }, { status: 500 });
  }
}
