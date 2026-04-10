import { queryOne } from './db';

/**
 * Default prompt templates for meeting classification and per-category extraction.
 *
 * Each prompt uses `{placeholder}` tokens that are replaced at runtime via
 * `fillPrompt`. These defaults live in code; user-edited overrides are loaded
 * from the `app_settings` table via `getPrompt`.
 */

export const DEFAULT_CLASSIFIER_PROMPT = `You are a meeting classifier. Your job is to read meeting metadata and pick ONE category from this fixed list:

1. netsuite_kt — Internal NetSuite knowledge-transfer sessions. Technical walkthroughs, how features work, architecture discussions, things the user needs to remember for prep before the next KT meeting. Usually internal, no customers, focused on NetSuite functionality.
2. manager_1on1 — 1:1 meetings with the user's direct manager. Status updates, priorities, career, feedback, planning. Usually only 2 people and a recurring cadence.
3. customer_engagement — Customer-facing meetings where the user is mainly presenting or demoing and customers ask questions, raise use cases, objections, or feature requests. External attendees from a customer account.
4. student_lesson — Preply / tutoring sessions where the user teaches a student (usually 1:1, educational, language or technical tutoring).
5. others — Anything that does NOT clearly fit the above. BE CONSERVATIVE: when in doubt, pick others.

Meeting metadata:
Title: {title}
Participants: {participants}
Summary: {summary}
Key takeaways: {takeaways}
Action items: {actionItems}

Transcript excerpt:
{transcript}

Return ONLY a JSON object (no markdown, no code fences) with this exact shape:
{
  "category": "netsuite_kt" | "manager_1on1" | "customer_engagement" | "student_lesson" | "others",
  "confidence": 0.0-1.0,
  "reasoning": "one or two sentences explaining why"
}`;

export const DEFAULT_NETSUITE_KT_PROMPT = `You are extracting information from an internal NetSuite knowledge-transfer meeting so the user can prep well for their NEXT KT meeting.

Meeting metadata:
Title: {title}
Participants: {participants}
Summary: {summary}
Key takeaways: {takeaways}
Action items: {actionItems}

Transcript excerpt:
{transcript}

Extract things the user should REMEMBER for next time: technical topics covered, open questions to follow up on, concepts they should review, and any "remind me before the next meeting" items.

Return ONLY a JSON object (no markdown, no code fences) with this exact shape:
{
  "summary": "A 2-3 paragraph summary written from the NetSuite KT perspective — what technical topics were covered, the key learnings and architecture/behavior explained, and things the user should remember before the next KT session.",
  "reminders": [
    {
      "topic": "short topic label (e.g. 'Saved Search joins')",
      "reminder": "what to remember or do before the next meeting",
      "remind_before_next": true | false
    }
  ],
  "topics_covered": ["topic 1", "topic 2"],
  "open_questions": ["question to follow up on", "..."],
  "notes": "one paragraph of overall context"
}`;

export const DEFAULT_MANAGER_PROMPT = `You are extracting information from a 1:1 meeting between the user and their manager.

Meeting metadata:
Title: {title}
Participants: {participants}
Summary: {summary}
Key takeaways: {takeaways}
Action items: {actionItems}

Transcript excerpt:
{transcript}

Extract four buckets of follow-ups so the user can act on them and prep for the next 1:1.

Return ONLY a JSON object (no markdown, no code fences) with this exact shape:
{
  "summary": "A 2-3 paragraph summary written from a manager 1:1 perspective — what the manager said mattered most, decisions that were made, priorities that shifted, and what the user needs to prep or own before the next 1:1.",
  "priorities": [
    { "content": "what the manager said matters most", "due_date": "YYYY-MM-DD or null" }
  ],
  "todos": [
    { "content": "a concrete action the user should do", "due_date": "YYYY-MM-DD or null" }
  ],
  "prep": [
    { "content": "something the user should prep or bring to the next 1:1", "due_date": "YYYY-MM-DD or null" }
  ],
  "decisions": [
    { "content": "a decision that was made during the meeting", "due_date": null }
  ],
  "notes": "one paragraph of overall context"
}`;

export const DEFAULT_CUSTOMER_PROMPT = `You are extracting information from a customer-facing meeting where the user was mainly presenting or demoing. Focus on what the CUSTOMERS said — not what the user presented.

Meeting metadata:
Title: {title}
Participants: {participants}
Summary: {summary}
Key takeaways: {takeaways}
Action items: {actionItems}

Transcript excerpt:
{transcript}

Identify the customer (company or account name) if present. Then extract:
- use_cases: concrete use cases the customer brought up for the product
- questions: things the customer asked
- comments: noteworthy comments or feedback
- objections: concerns, blockers, pushback
- feature_requests: things the customer wishes existed or asked for

Return ONLY a JSON object (no markdown, no code fences) with this exact shape:
{
  "summary": "A 2-3 paragraph summary written from a customer engagement perspective — who the customer was, what use cases/questions/objections they raised, feature requests that came up, and the overall tone or interest level. Focus on what the customer said, not what the user presented.",
  "customer": "customer name or null",
  "use_cases":       [ { "content": "...", "topic": "optional short label" } ],
  "questions":       [ { "content": "...", "topic": "optional short label" } ],
  "comments":        [ { "content": "...", "topic": "optional short label" } ],
  "objections":      [ { "content": "...", "topic": "optional short label" } ],
  "feature_requests":[ { "content": "...", "topic": "optional short label" } ],
  "notes": "one paragraph of overall context"
}`;

export const DEFAULT_STUDENT_FLAG_PROMPT = `You are confirming that a meeting is a student tutoring/lesson session and extracting the student's name if it is mentioned.

Meeting metadata:
Title: {title}
Participants: {participants}
Summary: {summary}
Key takeaways: {takeaways}
Action items: {actionItems}

Transcript excerpt:
{transcript}

Return ONLY a JSON object (no markdown, no code fences) with this exact shape:
{
  "is_student_lesson": true | false,
  "student_name": "name or null",
  "topic": "short description of what was taught, or null",
  "notes": "one paragraph of overall context"
}`;

export const DEFAULT_STUDENT_FIRST_PROMPT = `You are an expert AI tutor assistant analyzing a first session with a new student.

Student: {studentName}

Meeting transcript:
{transcript}

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

export const DEFAULT_STUDENT_SUBSEQUENT_PROMPT = `You are an expert AI tutor assistant analyzing a follow-up session with a student.

Student: {studentName}
Learning Plan: {learningPlan}

Previous sessions:
{previousSessions}

Latest meeting transcript:
{transcript}

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

export const DEFAULT_OTHERS_PROMPT = `You are extracting notable information from a meeting that did not fit into a specific category.

Meeting metadata:
Title: {title}
Participants: {participants}
Summary: {summary}
Key takeaways: {takeaways}
Action items: {actionItems}

Transcript excerpt:
{transcript}

Return ONLY a JSON object (no markdown, no code fences) with this exact shape:
{
  "summary": "A 2-3 paragraph summary of what this meeting covered — the main topics, decisions, and follow-ups. Write it as a useful standalone recap since this meeting did not fit a specific category.",
  "topics": ["notable topic 1", "notable topic 2"],
  "decisions": ["decision made during the meeting"],
  "follow_ups": ["anything that needs follow-up"],
  "notes": "one paragraph of overall context"
}`;

/**
 * Load a prompt from `app_settings` if the user has overridden it; otherwise
 * return the provided default. Settings are keyed by strings like
 * `prompt_classify`, `prompt_netsuite_kt`, etc.
 */
export async function getPrompt(key: string, defaultValue: string): Promise<string> {
  try {
    const row = await queryOne<{ value: string }>(
      'SELECT value FROM app_settings WHERE key = $1',
      [key]
    );
    return row?.value || defaultValue;
  } catch {
    return defaultValue;
  }
}

/**
 * Replace `{placeholder}` tokens in a template with values from `vars`.
 * Missing keys are replaced with an empty string so prompts never break.
 */
export function fillPrompt(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    return Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : '';
  });
}
