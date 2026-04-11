# Dashboard Improvements — Making the Vision Real

This is a build plan for the concrete improvements to **Cunha's Brain** (`cunhas-brain/`) that will turn it into the personal operating system described in Gabriel's brain dump.

It's written as tickets you can hand to an agent (or do yourself). Each ticket references specific files and existing primitives. Every ticket ends with rough effort (S/M/L) and impact (1-5).

**Context**: the app lives at `/Users/gabrielcunhaps/Desktop/workspace/cunhas-brain/`. Stack: Next.js 14 App Router, TypeScript, Tailwind + inline styles with CSS vars, Neon Postgres (`src/lib/db.ts`), Anthropic Claude Haiku (`src/lib/anthropic.ts`), `'use client'` for interactive components, `export const dynamic = 'force-dynamic'` on API routes.

---

## 1. Idea Inbox — single capture surface

**Problem**: Gabriel has brain dumps like tonight's stuck in Slack DMs, Notion pages, voice memos, text files, and his head. No single place to dump.

**Solution**: A persistent floating text area on `/dashboard` at the top of the page. Paste anything. Hit save. An AI call parses it into categorized items and routes them to the right place.

**Files to create**:
- `src/components/IdeaInbox.tsx` — the UI component (client)
- `src/app/api/ideas/route.ts` — POST receives the raw text, classifies, persists
- `src/lib/ideaPrompts.ts` — prompts for extraction
- DB migration: new table `ideas (id, raw_text, items JSONB, created_at, processed BOOLEAN)`

**AI prompt shape**:
```
Extract actionable items from this brain dump. For each item, identify:
- category: 'work' | 'product_idea' | 'personal_project' | 'learning' | 'person' | 'errand' | 'content'
- title: short actionable title
- notes: extended context
- link_to: suggested link (person name, project name, etc)

Return JSON array.
```

**Routing on save**:
- `work` → `todos` via dashboard stats OR new meeting prep
- `product_idea` → new `product_ideas` table (ticket #6)
- `personal_project` → project tracker (ticket #6)
- `learning` → reading queue (ticket #10)
- `person` → People CRM (ticket #7)
- `content` → Content Production Pipeline (ticket #9)

**UI placement**: top of `src/components/Dashboard.tsx`, above `TodaysMeetings`. Collapsed to a single "+" button until clicked, then expands into a textarea.

**Effort**: M. **Impact**: 5 (everything else depends on this capture surface).

---

## 2. Daily Brief — morning ritual, voice-enabled

**Problem**: Gabriel explicitly asked for enforcement. He wants voice + face + daily check-in. ADHD constraint is real. He said: *"PRECISA PEGAR MINHAS IDEIAS E FAZER AS COISAS PRA MIM E FAZER EU REVISAR TODOS OS DIAS"*.

**Solution**: A scheduled morning brief at 08:00 PT that fires:
1. A macOS popup (using existing `scripts/notifier.js` infrastructure)
2. Voice output via macOS `say` or ElevenLabs
3. Desktop notification with "Start the day" button that opens `/dashboard`

**Content of the brief**:
- Today's calendar meetings (from `meetings` table) + category pills
- Pending NetSuite KT reminders for any KT meeting today
- Top 3 pending todos
- Top 1-2 suggested "deep work" focus areas based on project status
- 1 "reach out" suggestion from People CRM (longest time since contact)
- 1 "reading" suggestion from reading queue

**Files to create/modify**:
- `src/app/api/daily-brief/route.ts` — GET generates the brief
- Extend `scripts/notifier.js` — add a cron-style morning check (check time each poll, fire brief once per day, persist "last_brief_date" in state file)
- Optional: `src/lib/tts.ts` — text-to-speech helper (start with `say`, upgrade to ElevenLabs)
- New table: `daily_briefs (id, date, content TEXT, completed BOOLEAN, created_at)`

**UI**: `/dashboard` top card "Today's Brief" that renders the current day's brief with a "Mark complete" button.

**Phase 2**: voice input. Whisper via `scripts/notifier.js` + `sox` or macOS `rec` for capture, send transcript to `/api/daily-brief/reply` which parses the user's spoken response and updates today's todos / captures ideas.

**Effort**: M (morning brief) + L (voice). **Impact**: 5.

---

## 3. Meeting Prep page

**Problem**: Gabriel has KT reminders extracted but no place to see them before his next meeting. They just sit in `netsuite_kt_reminders`.

**Solution**: `/prep` page showing:
- **Upcoming** meetings (next 48h) with a briefing card each
- Each card shows:
  - Past context (summary of previous similar meetings with same participants)
  - Pending KT reminders relevant to this meeting (`remind_before_next = true`)
  - Open questions from previous meetings
  - Manager priorities not yet addressed (if it's a 1:1)
  - Customer open use cases (if it's a customer meeting)
- A big "Generate briefing" button that runs a prep prompt against all this context

**Files to create**:
- `src/app/prep/page.tsx`
- `src/components/MeetingPrep.tsx`
- `src/app/api/prep/upcoming/route.ts` — GET returns upcoming meetings with prep context
- `src/app/api/prep/[meetingId]/briefing/route.ts` — POST generates briefing

**Data source**:
- `meetings` table (future dates — Gabriel needs to start adding upcoming meetings, or integrate Google Calendar)
- `netsuite_kt_reminders` (existing)
- `manager_followups` (existing)
- `customer_insights` (existing)
- `meeting_metadata` (existing)

**Google Calendar integration**: later phase — add OAuth, pull next 7 days of events, match to categories.

**Effort**: M. **Impact**: 4 (huge for pre-meeting Gabriel).

---

## 4. Auto-ingest meetings into Knowledge Base

**Problem**: The `Knowledge Base` (`src/components/KnowledgeBase.tsx`) has a knowledge graph but it's disconnected from meetings. Every meeting should be a note in the graph.

**Solution**: On meeting summary generation, also create/update a note in the `notes` table. The note contains the summary, takeaways, and key people mentioned — with auto-wikilinks.

**Wikilinks to generate**:
- `[[Person Name]]` for each speaker
- `[[Project Name]]` for project mentions (detected via AI)
- `[[Topic]]` for key topics from takeaways
- `[[Meeting: Title]]` backlink

**Files to modify**:
- `src/app/api/meetings/[id]/summarize/route.ts` — after summary, call `ingestMeetingAsNote(meetingId)`
- `src/lib/meetingNoteIngest.ts` — new; creates/updates notes, links wikilinks, rebuilds `knowledge_edges`
- `src/app/api/meetings/reindex-notes/route.ts` — POST backfills all meetings into notes

**Side effect**: the Knowledge Graph (`/knowledge` → Graph view) becomes 10× richer. The Files vs Words toggle starts showing people and topic clusters.

**Effort**: M. **Impact**: 5 (connects everything).

---

## 5. Obsidian vault sync

**Problem**: Gabriel explicitly mentioned Obsidian as the reference. He wants his knowledge local + portable + plugin-compatible. He said *"ORGANIZAR MINHAS TABS E MEU CONHECIMENTO - OBSIDIAN?"*.

**Solution**: Two-way sync between the `notes` table and a local Obsidian vault folder.

**Approach**:
- Add a setting `obsidian_vault_path` to `app_settings`
- Build a local daemon (extend `scripts/notifier.js`) that:
  - On startup, reads all `.md` files in the vault and imports into `notes`
  - Watches the vault folder with `fs.watch` for changes
  - Polls `/api/notes` for remote changes and writes them to disk
  - Conflict resolution: last-write-wins initially, later CRDT-based
- Wikilinks in Obsidian format work natively with the existing `KnowledgeBase` parser

**Files to create**:
- `scripts/obsidian-sync.js` — standalone Node process or part of the notifier
- `src/app/api/notes/sync/route.ts` — POST receives batch updates from daemon

**Phase 2**: Obsidian plugin that calls the cunhas-brain API directly instead of file-based sync.

**Effort**: L. **Impact**: 4 (satisfies a core Gabriel ask).

---

## 6. Project Tracker — SaaS ideas + personal projects + work projects

**Problem**: Gabriel has 15+ project-level things floating: Autonomous Finance SuiteApp, Data Quality for AI SuiteApp, BBB Virtual, Café com Filosofia, Book Club, Music, Podcast, AI Data Readiness with Tom Kelly, SuiteAgents talk track, etc. Nowhere to see them all.

**Solution**: `/projects` page with a kanban-style board grouped by status (`ideation` / `active` / `paused` / `shipped`). Each project has:
- Title, one-liner, tags (work/personal/product), owner(s), linked meetings, linked notes, next action
- Status field with visual indicator
- Last activity (auto-updated when anything is linked to it)

**Files to create**:
- DB migration: `projects (id, title, one_liner, status, tags TEXT[], next_action, last_activity_at, created_at, updated_at)`
- DB migration: `project_links (id, project_id, link_type, link_id)` — polymorphic links to meetings/notes/artifacts
- `src/app/projects/page.tsx`
- `src/components/ProjectBoard.tsx` — kanban view
- `src/components/ProjectDetail.tsx` — one project
- `src/app/api/projects/route.ts` (GET, POST)
- `src/app/api/projects/[id]/route.ts` (GET, PUT, DELETE)
- `src/app/api/projects/[id]/links/route.ts` (POST to link a meeting/note/artifact)

**Integration**:
- When a meeting is categorized, detect project mentions via AI and auto-link
- When an idea is captured via Inbox, project_idea items create new projects
- Knowledge Base notes can be tagged `#project:xxx` which auto-links

**Effort**: L. **Impact**: 5.

---

## 7. People CRM — relationship tracker

**Problem**: Gabriel has a huge people graph (Karl, Tom Kelly, Joe, Arthur, Oracle Education lead, Larry Ellison, Duval, Brazilian journalists, Preply students). No central place, no nudges, no "when did I last talk to Y".

**Solution**: `/people` page. For each person:
- Name, role, company, relationship type (colleague / manager / customer / student / network)
- Last contact date (auto-derived from meetings/emails)
- Open topics (AI-extracted from their meeting transcripts)
- Next suggested action
- Linked meetings, notes, projects

**Files**:
- DB migration: `people (id, name, role, company, relationship_type, email, notes, last_contact_at, created_at)`
- DB migration: `person_mentions (id, person_id, source_type, source_id, mentioned_at)`
- `src/app/people/page.tsx`
- `src/components/PeopleList.tsx`, `src/components/PersonDetail.tsx`
- `src/app/api/people/route.ts`, `src/app/api/people/[id]/route.ts`
- `src/app/api/people/resolve/route.ts` — POST: given a name from a meeting speaker, match or create a person

**Auto-population**: when a meeting is ingested, match speaker names to people (fuzzy match). Ask on ambiguity.

**Nudges**: daily brief (ticket #2) suggests 1 person with >14 days since last contact.

**Integration with Students**: students already have a `/students` page. People CRM can be a superset — or keep them separate. **Recommendation**: keep students separate (they have their own learning-plan UX) but have a "View as person" cross-link.

**Effort**: L. **Impact**: 4.

---

## 8. Talk Track / Argument Library

**Problem**: Gabriel wants to be the best AI communicator in history. He said *"Fazer lista de argumentos pra tudo"*. Currently he has no place to store reusable talk tracks, arguments, counter-arguments, demos, one-liners.

**Solution**: `/talks` page. Each talk is a structured markdown document with sections:
- Hook
- Problem
- Agitation
- Solution
- Proof (linked evidence from Knowledge Base or meetings)
- Ask / CTA
- Counter-arguments + responses

Plus an **Argument Library** — a flat list of reusable arguments, each with:
- Claim
- Evidence (linked notes/meetings)
- Counter-argument
- Response

**Files**:
- DB migration: `talks (id, title, type, content JSONB, status, created_at)`
- DB migration: `arguments (id, claim, evidence, counter, response, tags, created_at)`
- `src/app/talks/page.tsx`
- `src/components/TalkEditor.tsx`
- `src/components/ArgumentLibrary.tsx`
- `src/app/api/talks/route.ts`, `src/app/api/talks/[id]/route.ts`
- `src/app/api/arguments/route.ts`

**AI assist**: a "Generate talk from these notes" button that takes selected Knowledge Base notes and drafts a full talk.

**Practice mode**: a teleprompter view for rehearsal. Optional: record audio, transcribe, compare to script.

**Effort**: M. **Impact**: 4.

---

## 9. Content Production Pipeline — idea → outline → draft → publish

**Problem**: Gabriel needs to ship content regularly — Oracle Newsletter on AI, leadership email, article with Joe, LinkedIn posts, demos. Each piece currently starts from scratch.

**Solution**: `/content` page. Each piece flows through stages:
1. **Idea** — captured title + one-liner
2. **Research** — AI gathers relevant context from Knowledge Base + meetings + newsletters
3. **Outline** — AI-generated structured outline, human-edited
4. **Draft** — AI-generated full draft in Gabriel's voice
5. **Review** — Gabriel edits, AI suggests improvements
6. **Published** — archived with link to output

**Files**:
- DB migration: `content_pieces (id, title, type, stage, outline JSONB, draft TEXT, published_url, linked_sources JSONB, created_at, updated_at)`
- `src/app/content/page.tsx`
- `src/components/ContentList.tsx`, `src/components/ContentPipeline.tsx`
- `src/app/api/content/route.ts`, `src/app/api/content/[id]/route.ts`
- `src/app/api/content/[id]/generate/route.ts` — POST runs the next stage

**Types**:
- `newsletter` (monthly Oracle leadership newsletter)
- `article` (thought leadership)
- `email` (strategic outbound)
- `slides` (demo deck)
- `linkedin_post`
- `talk` (links to `/talks` entry)

**Voice matching**: store a "style guide" prompt in `app_settings` — Gabriel's tone, favorite phrases, things to avoid. Every draft gen uses this.

**Integration**: each content piece can link to `meeting_metadata` facts (use cases, insights) as sources. Traceable provenance.

**Effort**: L. **Impact**: 5.

---

## 10. Reading Queue — unified inbox for books + newsletters + articles + videos

**Problem**: Gabriel is falling behind on Brazilian literature, newsletters, Karpathy videos, magazines. No central place, no prioritization.

**Solution**: `/reading` page. One unified inbox with items from multiple sources:
- Newsletters (auto-synced from existing `newsletter_cache` table)
- Books (manual add)
- Videos (manual add or from browser extension)
- Articles (manual add or from browser extension)
- Papers (manual add)

Each item: title, source, type, status (new / reading / done), priority (AI-suggested), my notes, linked Knowledge Base note.

**Files**:
- DB migration: `reading_items (id, title, source, type, url, status, priority, my_notes, linked_note_id, added_at, completed_at)`
- `src/app/reading/page.tsx`
- `src/components/ReadingQueue.tsx`
- `src/app/api/reading/route.ts`

**AI prioritization**: every morning, re-rank the queue. Priority heuristics:
- Topic alignment with declared focus areas (stored in settings)
- Age (older items decay)
- Source weight (high-signal newsletters rank higher)
- User click/read history

**Output**: "Top 3 to read today" suggestion in the daily brief.

**Effort**: M. **Impact**: 4.

---

## 11. Weekly Review — Friday retrospective

**Problem**: Gabriel wants to avoid drifting. He needs regular review, not just daily ritual.

**Solution**: Every Friday at 17:00, fire a weekly review:
- What shipped this week (completed todos, published content, attached meetings)
- What stalled (open todos >7 days, projects with no activity >14 days)
- Top insights from customer meetings this week
- Pending follow-ups
- Next week's priorities (suggested based on open items + calendar)

**Files**:
- `src/app/api/weekly-review/route.ts` — GET generates
- `src/app/review/page.tsx` — interactive review page with "keep/drop" on each item
- Extend `scripts/notifier.js` — Friday 17:00 trigger

**Output**: a markdown summary saved as a note in Knowledge Base with tag `#weekly-review`. Searchable later.

**Effort**: M. **Impact**: 4.

---

## 12. Voice / Face assistant (ADHD enforcement layer)

**Problem**: Gabriel explicitly said he wants to buy a monitor, put Claude with voice + face on it, daily check-ins. This is the ADHD enforcement.

**Solution**: local Mac desktop app or menu-bar app that:
- Displays an always-visible avatar (simple SVG face that blinks)
- Fires the morning brief with voice (ElevenLabs or macOS `say`)
- Periodic check-ins (every 2h): "What are you working on? Did you finish X?"
- Accepts voice replies (Whisper)
- Sends back to cunhas-brain API
- Shows red dot on the avatar when there's a pending popup

**Two options**:
1. **Electron app** — standalone. More work but better UX.
2. **Extend `scripts/notifier.js`** — add a simple tkinter/SwiftUI wrapper with an avatar image + button. Scrappy but works.

Recommendation: start with option 2. If it sticks, upgrade to Electron.

**Files**:
- `scripts/avatar-app/` — new subfolder
- `scripts/avatar-app/main.swift` or `main.py` — simple macOS menubar app
- Reuses `scripts/notifier.js` polling logic

**Effort**: L. **Impact**: 5 (this is the enforcement gabriel asked for, without it nothing sticks).

---

## 13. Meeting → Artifact bridge (demos)

**Problem**: Gabriel needs a new demo every week and wants one-click prototyping from ideas.

**Solution**: Add a button on each meeting detail page: "Prototype this". It takes:
- The meeting summary
- The customer's stated use case (from `customer_insights`)
- The latest category_data

And drafts an HTML/React artifact via Claude, then inserts into the `Artifacts` tab.

**Files**:
- `src/app/api/meetings/[id]/prototype/route.ts` — POST generates an artifact
- Modify `src/components/MeetingDetail.tsx` — add the button

**Prompt**:
```
You are a rapid prototyping engineer. Based on this meeting with a customer, generate a single self-contained HTML file that demonstrates a solution to their stated use case. Use Tailwind CSS via CDN, vanilla React via CDN, and ensure it works as a single file. Include realistic mock data.
```

**Effort**: S. **Impact**: 4 (Gabriel's "new demo every week" goal).

---

## 14. Knowledge Graph — meetings as first-class nodes

**Problem**: The knowledge graph `/knowledge` currently only shows `notes` and their wikilinks. Meetings aren't nodes in the graph.

**Solution**: When meetings are ingested (ticket #4), their notes become graph nodes automatically. But also:
- Add a "Meetings" filter to the graph view
- Color-code: notes (blue) vs meetings (purple) vs people (green) vs projects (orange)
- Click a meeting node → opens the meeting detail
- Backlinks: a note about `[[SuiteAgents]]` shows every meeting where SuiteAgents was discussed

**Files**:
- Modify `src/components/KnowledgeBase.tsx` — graph rendering logic
- Modify `src/app/api/notes/graph/route.ts` — include meeting nodes

**Effort**: M. **Impact**: 3.

---

## 15. Agent Runner — background agents via Vercel Workflow or cron

**Problem**: So far everything runs on-demand. For the vision to work (autonomous research, drafting, reminders), agents need to run in the background on schedules.

**Solution**: Define agents as cron-triggered functions:
- `research_agent` — every day at 09:00, research the user's declared focus areas, save findings to Knowledge Base
- `librarian_agent` — every night at 02:00, rebuild the metadata index, regenerate wikilinks, clean up orphan notes
- `writer_agent` — every Sunday at 18:00, draft next week's newsletter from the past week's meetings + newsletters
- `coach_agent` — every morning at 08:00, generate the daily brief
- `scheduler_agent` — every day at 07:00, look at upcoming calendar and pre-populate meeting prep

**Implementation options**:
- **Vercel Cron** (simple): define `vercel.json` or `vercel.ts` with cron schedules, each pointing to `/api/agents/<name>`. Good for short jobs.
- **Vercel Workflow** (durable): for long-running agents with retries, persistence, multi-step. Needed for research agent that may take minutes.

**Files**:
- `src/app/api/agents/research/route.ts`
- `src/app/api/agents/librarian/route.ts`
- `src/app/api/agents/writer/route.ts`
- `src/app/api/agents/coach/route.ts`
- `src/app/api/agents/scheduler/route.ts`
- `vercel.ts` at repo root — define cron schedules

**Observability**: each agent run logs to `app_logs` with metadata: what it did, how long it took, what it wrote.

**Effort**: L. **Impact**: 5 (this is where the magic happens).

---

## Build order recommendation

**Week 1** (foundation):
- Ticket #1 — Idea Inbox
- Ticket #4 — Auto-ingest meetings into Knowledge Base
- Ticket #2 — Daily Brief (morning popup + voice via `say`)

**Week 2** (views):
- Ticket #3 — Meeting Prep page
- Ticket #6 — Project Tracker (basic)
- Ticket #7 — People CRM (basic)

**Week 3** (output):
- Ticket #9 — Content Production Pipeline
- Ticket #8 — Talk Track / Argument Library
- Ticket #13 — Meeting → Artifact bridge

**Week 4** (rituals + agents):
- Ticket #11 — Weekly Review
- Ticket #15 — Agent Runner (first 2 agents)
- Ticket #10 — Reading Queue

**Week 5+** (polish + vision):
- Ticket #5 — Obsidian vault sync
- Ticket #12 — Voice/Face assistant
- Ticket #14 — Knowledge Graph expansion

This sequences by dependency. Idea Inbox first (everything else depends on capture). Auto-ingest next (everything else depends on the graph). Daily Brief next (ritual drives usage). Then views. Then output. Then agents. Then polish.

---

## What NOT to build

Avoid these traps:
- **Custom mobile app** — use the Mac + browser for now. Don't split effort.
- **Custom backend infra** — stay on Vercel + Neon. The platform gives you deploy + DB + cron for free.
- **Multi-user / team features** — this is Gabriel's personal OS. Single-user forever.
- **Real-time collaboration** — no.
- **Fancy state management (Redux/Zustand)** — `useState` + server components is fine for this scale.
- **Microservices** — monolith. Everything in `cunhas-brain`.
- **A custom knowledge graph engine** — the Postgres + `knowledge_edges` + GIN index is sufficient for years.
