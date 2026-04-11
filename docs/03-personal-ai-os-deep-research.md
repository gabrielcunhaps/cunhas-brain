# The Augmented Self — A Personal AI Operating System

> Deep research plan for building a personal AI OS that takes Gabriel from **capture → understand → build → communicate** with minimal friction and maximum compounding. Inspired by Karpathy's LLM Wiki, Obsidian's philosophy, Anthropic's Managed Agents, and the harness patterns behind Claude Code itself.

**Author's note**: This document is the ambitious one. `01-notes-summary-and-recommendations.md` tells you what to do this week. `02-dashboard-improvements.md` tells you what to build this month. **This file** tells you what to build over the next 6-12 months if you want to be the one-person AI billionaire you said you wanted to be. It's a research plan, a system design, and a phased roadmap.

---

## Section 1 — The thesis

### The problem

You are a high-output knowledge worker with ADHD, working on multiple fronts:
- A day job at Oracle/NetSuite selling + building AI
- A thought-leadership ambition (newsletters, articles, talks, demos)
- Multiple SaaS product ideas you want to prototype
- A personal intellectual project (Brazilian literature, philosophy, communication)
- A social life you keep postponing

The constraints:
- Time is the bottleneck, not ideas
- Context-switching kills your output (ADHD cost)
- You have hundreds of hours of meeting transcripts, notes, articles — **all uncompiled**
- You need daily enforcement or you drift
- You want a single system, not 10 tools

### The thesis

> **An AI system that continuously captures everything you think/say/read, structures it into a durable knowledge graph, and dispatches a team of specialized agents to research, draft, and practice on your behalf — so that you can spend 2 hours a day on high-signal input and still ship 10× more output than a typical knowledge worker.**

The bet: with the right substrate, **one person + Claude = a small team**. You already have the substrate (Cunha's Brain). You're 20% of the way there. This doc is the plan for the other 80%.

### What's different about this plan

Most "second brain" tools are PKM (personal knowledge management) — Notion, Obsidian, Roam, Tana. They let you write, link, search. They don't **act on your behalf**.

This plan is PKM + agent harness. The agents read your graph, research topics, draft content, practice talking points, remind you, nudge you, and produce artifacts. The graph is the shared memory; the agents are the workforce.

Closest public analogs:
- **Karpathy's LLM OS / LLM Wiki concept** — LLMs as the new OS, with the wiki being a programmable knowledge layer
- **Obsidian + Dataview + plugins** — graph + querying, no agents
- **Anthropic Managed Agents** — agents with memory and tools, no personal graph
- **Linear + Motion + Reflect** — each does one slice

What we're building: **all of these together, wired by a single graph, owned by one user**.

---

## Section 2 — Architectural vision

### The 7 layers

```
┌─────────────────────────────────────────────────────────────┐
│  7. Surfaces           Dashboard · Voice agent · Obsidian  │
│                        · Email drafts · Slide gen · Chat  │
├─────────────────────────────────────────────────────────────┤
│  6. Agent Society      Librarian · Researcher · Analyst    │
│                        · Writer · Coach · Producer         │
│                        · Scheduler · Social                │
├─────────────────────────────────────────────────────────────┤
│  5. LLM Wiki           Natural-language queries over       │
│                        the graph + memory layers           │
├─────────────────────────────────────────────────────────────┤
│  4. Memory System      Scratchpad · Episodic · Semantic    │
│                        · Procedural · Reflective           │
├─────────────────────────────────────────────────────────────┤
│  3. Knowledge Graph    Markdown vault (Obsidian-compat) +  │
│                        Postgres metadata + pgvector + FTS  │
├─────────────────────────────────────────────────────────────┤
│  2. Ingest Pipeline    Classify · Extract · Link · Index   │
├─────────────────────────────────────────────────────────────┤
│  1. Capture Surface    Krisp · Voice · Browser · Hotkey    │
│                        · Screenshot · Chat dump · Notion   │
└─────────────────────────────────────────────────────────────┘
```

Let's walk through each layer.

### Layer 1 — Capture

**Principle**: every thought, every meeting, every article Gabriel touches must reach the system with <10s friction. If it's harder than that, he won't use it.

Capture sources, ranked by priority:
1. **Krisp meetings** (already wired — `/api/webhook/krisp`)
2. **Dashboard Idea Inbox** (build this — ticket #1 in improvements doc)
3. **Raycast / Alfred hotkey** — ⌘⇧I from anywhere in macOS → quick capture modal
4. **Browser extension** — one-click "save to Brain" on any webpage
5. **Voice capture** — "Hey Claude, remind me to…" via local Whisper
6. **Screenshot capture** — ⌘⇧S → OCR + LLM tagging → note
7. **Notion + Obsidian sync** — two-way import (ticket #5)
8. **Slack / email digest** — nightly batch ingest of important threads

The capture layer writes to a single **inbox** table. Nothing is processed inline — all parsing happens in Layer 2 asynchronously.

**Inbox schema**:
```sql
CREATE TABLE inbox (
  id SERIAL PRIMARY KEY,
  source TEXT NOT NULL,  -- krisp | dashboard | raycast | browser | voice | ...
  raw_content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',  -- url, timestamp, location, etc.
  status TEXT DEFAULT 'pending',  -- pending | processed | failed
  received_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);
```

### Layer 2 — Ingest pipeline

**Principle**: every piece of raw input gets the same treatment — classify, extract, link, index. The output is always structured: notes, metadata facts, graph edges.

**Pipeline stages**:

1. **Classify** — what is this? (meeting / idea / article / todo / person mention / project update / question)
2. **Extract** — structured facts using category-specific prompts (already exists — `src/lib/meetingClassifier.ts`)
3. **Link** — detect entities (people, projects, topics), match to existing nodes, create wikilinks
4. **Index** — write to:
   - `notes` table (canonical markdown)
   - `meeting_metadata` table (searchable facts, already exists)
   - Vector embeddings (new: `pgvector`)
   - Full-text index (already exists on `value`)
   - Graph edges (`knowledge_edges`, already exists)

**Idempotency**: every pipeline stage is safe to re-run. If you change a prompt, you can reindex. If you change categories, you can reclassify.

**Key new table** — `embeddings`:
```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE embeddings (
  id SERIAL PRIMARY KEY,
  source_type TEXT NOT NULL,  -- note | meeting | fact | idea
  source_id INTEGER NOT NULL,
  chunk_index INTEGER DEFAULT 0,
  content TEXT NOT NULL,
  embedding vector(1536),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX ON embeddings USING hnsw (embedding vector_cosine_ops);
```

Use OpenAI `text-embedding-3-small` for embeddings (cheap, good). Swap to Voyage or Cohere later if quality matters.

### Layer 3 — Knowledge Graph

**Principle**: the graph is the source of truth. Everything else is a projection.

The graph has three physical representations that must stay in sync:

1. **Markdown vault** (Obsidian-compatible) — `~/brain/` directory with `.md` files, wikilinks `[[Name]]`, YAML frontmatter
2. **Postgres** — `notes`, `meeting_summaries`, `meeting_metadata`, `knowledge_edges` (existing)
3. **Vector index** — `embeddings` table (new)

Sync model: **Postgres is the write-through store**. The markdown vault is generated on demand from Postgres (read-heavy). Edits in Obsidian are detected via filesystem watcher and upserted back to Postgres. Conflicts resolved last-write-wins with an audit log.

**Graph schema** (existing, extended):
- `notes(id, title, content, summary, wikilinks, tags, ai_metadata, created_at, updated_at)` — existing
- `knowledge_edges(source_note_id, target_note_id, keyword)` — existing
- `entities(id, type, name, aliases, metadata)` — **new**: people, projects, topics, tools
- `entity_mentions(id, entity_id, source_type, source_id, context)` — **new**: which meeting/note mentioned this entity

Why the new `entities` table: wikilinks are strings today. Turning them into typed entities unlocks typed queries like "show me every meeting where Tom Kelly was mentioned" or "list all projects with status=active".

### Layer 4 — Memory system

**Principle**: not all memory is the same. Different tiers, different retention, different retrieval.

Inspired by cognitive science + agent memory literature (e.g. MemGPT, Sparrow, Voyager):

| Tier | Contents | Retention | Access |
|---|---|---|---|
| **Scratchpad** | Current conversation / task | Seconds-minutes | In-context |
| **Episodic** | "What happened" — meetings, events, conversations | Forever | Semantic + temporal search |
| **Semantic** | "What is true" — facts, beliefs, learned info | Forever | Key-value + semantic search |
| **Procedural** | "How to do X" — workflows, prompt templates, style guides | Forever | Exact match + category |
| **Reflective** | "What I learned about myself" — preferences, failure modes | Forever | Surfaced on request + periodic review |

**Implementation**:
- Scratchpad → Claude's context window, ephemeral
- Episodic → `meetings`, `meeting_metadata`, `notes` (all existing)
- Semantic → `entities` (new) + `app_settings` for facts
- Procedural → `app_settings` (existing — prompts live here)
- Reflective → new table `self_notes (id, content, tags, surfaced_count, last_surfaced_at, created_at)` — auto-generated weekly after weekly-review, includes things like "I tend to over-commit on Mondays" or "Long meetings drain me — schedule max 3 per day"

**Retrieval rules**:
- Agents ALWAYS pull scratchpad + relevant procedural context
- Episodic and semantic queried via the **LLM Wiki** layer (next section)
- Reflective surfaced proactively in daily brief

### Layer 5 — LLM Wiki (Karpathy-inspired)

**The core insight**: Karpathy's "LLM OS" / "LLM Wiki" framing treats the LLM as a programmable computer. Instead of "I wrote a SQL query", you say "Claude, give me every customer use case related to automation from the last month, grouped by customer". Claude translates this into a plan that queries the graph, runs retrievals, and composes the answer.

This is RAG++, with the LLM acting as both the query planner and the composer.

**How it works in our system**:

1. User asks a natural-language question (via chat, voice, or an agent delegating work)
2. A **Query Planner** (Claude Haiku) decomposes the question into structured sub-queries:
   - SQL queries against `meeting_metadata` / `notes`
   - Vector similarity search against `embeddings`
   - Full-text search against content
   - Entity resolution against `entities`
3. Results are assembled as a structured "context packet"
4. A **Composer** (Claude Sonnet or Opus for hard queries) answers the question using only the context packet + user's procedural memory (style guide, preferences)

**Example prompt structure** (query planner):
```
You are a query planner for a personal knowledge graph. The user asked: "{question}"

Available data sources:
- meeting_metadata (category, variable, value, meeting_id)
- notes (id, title, content, wikilinks, tags)
- entities (type, name)
- embeddings (source_type, source_id, similarity search)

Return a JSON plan:
{
  "steps": [
    { "type": "sql", "table": "meeting_metadata", "where": { "category": "customer_engagement", "variable": "use_case" } },
    { "type": "vector", "query": "automation use cases", "top_k": 20 },
    { "type": "compose", "instruction": "Group by customer, return top 5" }
  ]
}
```

Each step runs in a sandboxed executor. Results flow to the composer. The user only sees the final answer, but every step is logged for debugging.

**Why this is powerful**:
- The user never writes SQL — Claude writes it
- Every query becomes a reusable "procedure" that can be promoted to a saved view
- Agents (Layer 6) use the same LLM Wiki internally, so they all share one query substrate

**New file**: `src/lib/llmWiki.ts` — implements the planner + executor + composer.

### Layer 6 — Agent Society

**Principle**: don't build one "smart" agent. Build many specialized ones, each with a narrow role, tight memory, and strict evals.

This is inspired by MetaGPT, AutoGen, CrewAI, and Claude Agent SDK patterns.

**The roster** (8 agents):

#### 1. Librarian
- **Role**: maintains the knowledge graph. Ingests inbox items, classifies, extracts facts, creates entities, links wikilinks, regenerates embeddings.
- **Schedule**: continuous (every 5 min, processes pending inbox items). Nightly deep-index at 02:00.
- **Tools**: `query`, `queryOne`, `getAnthropicClient`, `embeddings.create`
- **Memory**: procedural (the classification rules)
- **Input**: pending inbox items
- **Output**: new/updated notes, metadata, entities, embeddings

#### 2. Researcher
- **Role**: continuously researches topics Gabriel cares about. Watches newsletters, scans Hacker News, Twitter, arxiv. Writes findings as notes in Knowledge Base.
- **Schedule**: every morning at 06:00. Runs for ~15 minutes max.
- **Tools**: web search, fetch, summarize, create_note
- **Memory**: semantic (Gabriel's declared focus areas in `app_settings.research_topics`)
- **Input**: focus areas, yesterday's news feeds
- **Output**: 3-5 research notes tagged with the topic, surfaced in daily brief

#### 3. Analyst
- **Role**: processes meetings end-to-end. Runs the classifier, extracts facts, generates category-specific summaries, updates the metadata index. This is the existing `processMeetingCategory` promoted to an agent.
- **Schedule**: triggered by Krisp webhook ingest.
- **Tools**: `classifyMeeting`, `runCategoryPipeline`, `indexMeetingMetadata`
- **Memory**: procedural (the category prompts)
- **Input**: new meeting from Krisp
- **Output**: classified + summarized meeting, metadata rows

#### 4. Writer
- **Role**: drafts content in Gabriel's voice. Newsletters, articles, emails, slide decks, LinkedIn posts. Every draft is a first pass that Gabriel edits.
- **Schedule**: event-driven (user clicks "draft this") and scheduled (Sunday 18:00 drafts next week's newsletter from last week's data).
- **Tools**: LLM Wiki queries, Knowledge Base lookups, `create_content_piece`
- **Memory**: procedural (Gabriel's style guide in `app_settings.style_guide`), semantic (talking points from `arguments` table)
- **Input**: a brief + source materials (optionally auto-selected via LLM Wiki)
- **Output**: draft in the `content_pieces` table, stage=draft

#### 5. Coach
- **Role**: daily/weekly rituals. Generates the morning brief, nudges Gabriel on stalled items, runs spaced repetition over his own notes, fires accountability check-ins.
- **Schedule**: 08:00 daily (morning brief). 12:00 daily (mid-day check). 17:00 Friday (weekly review).
- **Tools**: LLM Wiki queries, `send_notification`, `create_reading_suggestion`
- **Memory**: reflective (Gabriel's patterns), procedural (ritual templates)
- **Input**: user state, recent activity, pending items
- **Output**: notifications, daily_briefs rows, nudges to specific agents

#### 6. Producer
- **Role**: turns ideas into artifacts. When the user captures an idea, this agent spins up a prototype: HTML demo, slide deck, simple code sketch. Uses Claude Agent SDK for tool-use (filesystem, code execution).
- **Schedule**: triggered when an idea is captured + tagged `#prototype`
- **Tools**: Claude Agent SDK, filesystem write, `create_artifact`
- **Memory**: procedural (prototyping patterns)
- **Input**: idea text + optional constraints
- **Output**: an artifact in the `artifacts` table

#### 7. Scheduler
- **Role**: pre-meeting prep. Looks at upcoming calendar, pulls relevant past context, drafts a briefing. Surfaces pending KT reminders before each KT meeting.
- **Schedule**: 07:00 daily (prep for today's meetings). Event-driven on calendar updates.
- **Tools**: LLM Wiki queries, calendar API, `create_briefing`
- **Memory**: episodic (past meetings)
- **Input**: calendar events
- **Output**: briefings attached to `/prep` page

#### 8. Social
- **Role**: relationship management. Tracks who Gabriel hasn't talked to in a while, suggests nudges, drafts outbound messages.
- **Schedule**: Monday 09:00 weekly
- **Tools**: People CRM queries, draft_message
- **Memory**: episodic (past interactions), semantic (relationship type, open topics)
- **Input**: People CRM state
- **Output**: 3 "people to reach out to" suggestions in weekly review

**Agent implementation pattern**:

```typescript
// src/lib/agents/base.ts
export interface Agent {
  name: string;
  description: string;
  schedule?: string;  // cron expression or 'triggered'
  tools: Tool[];
  memory: { procedural?: string; episodic?: (input: any) => Promise<string> };
  run(input: AgentInput): Promise<AgentOutput>;
}

// src/lib/agents/researcher.ts
export const researcherAgent: Agent = {
  name: 'researcher',
  description: 'Research declared focus areas and surface findings',
  schedule: '0 6 * * *',
  tools: [webSearchTool, fetchPageTool, createNoteTool],
  memory: {
    procedural: 'You are a research agent. Focus on {topics}. Write concise notes.',
    episodic: async () => 'Yesterday you researched...'
  },
  async run(input) { /* ... */ },
};
```

**Runtime**: two options:
- **Vercel Cron** (simple) — each agent is an API route; cron triggers it. Works for jobs <5 min.
- **Vercel Workflow** (durable) — for agents that need retries, multi-step persistence, recovery from crashes. Use for Researcher and Producer.
- **Anthropic Managed Agents** (once GA for this use case) — outsource the runtime entirely. Best for long-lived agents with memory.

**Observability**: every agent run writes to `app_logs` with:
- agent name
- input summary
- output summary
- tokens used
- wall time
- cost

Plus a new table `agent_runs (id, agent_name, status, started_at, completed_at, input, output, error, tokens, cost)` for first-class agent monitoring.

### Layer 7 — Surfaces

Where the system interacts with Gabriel:

1. **Web dashboard** (`cunhas-brain.vercel.app`) — the hub. All pages we've discussed.
2. **macOS notifier popups** — ad-hoc + scheduled notifications (exists).
3. **Voice agent** — morning brief read aloud, voice input accepted. New Mac app.
4. **Obsidian vault** — markdown files Gabriel can open in his existing PKM tool.
5. **Email drafts** — Coach + Writer send email drafts to a Gmail folder `To Review` via Gmail API.
6. **Slide decks** — Producer generates HTML decks (in `artifacts`) or Google Slides via API.
7. **Chat interfaces** — in-dashboard Chat (exists), iMessage via a Mac automation bridge (later).
8. **Raycast/Alfred** — hotkey access for capture, search, quick chat.

---

## Section 3 — Cross-cutting concerns

### Prompt management

Every prompt is:
- **Versioned** — stored in `app_settings` with a version suffix (`prompt_classifier_v3`)
- **Evaluated** — each version has a test suite (see Evals below)
- **A/B tested** — run two versions in parallel for 10 meetings, compare outputs
- **Auditable** — every LLM call logs which prompt version was used

The existing `PromptsEditor` is the right place — extend it to show version history and eval results.

### Evals

Without evals, you can't improve. Build a simple eval framework:

- `src/lib/evals/` folder with test suites per agent
- Each eval: a set of inputs + expected properties (not exact outputs — LLMs are stochastic)
- Example: "classifier eval" — 30 labeled meetings, run classifier, assert category matches or confidence < 0.5
- Run evals on every prompt change before saving
- Surface eval scores in the PromptsEditor

Tools: start with custom JS. Migrate to `promptfoo` or OpenAI `evals` framework if scale demands.

### Cost management

Per-agent cost budgets. Daily cap. Log every call. Use Haiku for filtering + classification, Sonnet for composition, Opus only when quality matters. Cache aggressively via Vercel Runtime Cache for deterministic lookups.

**Rule of thumb**:
- Haiku: classifiers, extractors, retrieval planners (~90% of calls)
- Sonnet: summaries, drafts, analysis (~9%)
- Opus: hard research, strategic planning, weekly review (~1%)

### Memory compression

Long meetings and long chats hit context limits. Implement **recursive summarization**:
- Each meeting summary is stored in 3 lengths: 50 words, 200 words, full
- When loading context, the planner chooses the right length per meeting
- For agents that need "all of my recent work", use the short summaries + vector search

### Privacy + data ownership

- All data stays in your Neon DB (you control it)
- All markdown lives in your Obsidian vault (you control it)
- No third-party PKM tool required
- Easy export: `pg_dump` + sync the vault folder

### Reliability

- Idempotent pipelines
- Retry with exponential backoff for LLM calls
- Durable workflows for long agents (Vercel Workflow)
- Dead-letter queue for failed ingest items (`inbox.status = 'failed'` + surfaced in Logs page)

---

## Section 4 — Phased roadmap

### Phase 0 (DONE) — Foundation
- Next.js + Neon + Vercel deployed
- Meetings, categories, metadata index
- Knowledge Base + wikilinks + graph
- Students, Newsletters, Artifacts
- macOS notifier popups

### Phase 1 (2 weeks) — Capture expansion
- **Inbox table + Idea Inbox UI** (improvements #1)
- **Raycast extension** for ⌘⇧I quick capture
- **Browser extension** (stretch) — save any webpage
- **Auto-ingest meetings → notes** (improvements #4)
- **Obsidian vault sync** (improvements #5)

Deliverable: everything you think/see/say reaches the graph in <10s.

### Phase 2 (2 weeks) — Rituals & views
- **Daily Brief + morning popup** (improvements #2)
- **Meeting Prep page** (improvements #3)
- **Weekly Review** (improvements #11)
- **People CRM** (improvements #7)
- **Project Tracker** (improvements #6)

Deliverable: Gabriel has morning ritual + weekly review + 3 views (projects/people/prep) running daily.

### Phase 3 (2 weeks) — Output automation
- **Content Production Pipeline** (improvements #9)
- **Talk Track / Argument Library** (improvements #8)
- **Meeting → Artifact bridge** (improvements #13)
- **Reading Queue** (improvements #10)

Deliverable: Gabriel can go from idea to draft newsletter/article/slide in <10 minutes.

### Phase 4 (3 weeks) — Memory + LLM Wiki
- **pgvector + embeddings pipeline**
- **LLM Wiki query planner + executor** (new `src/lib/llmWiki.ts`)
- **Entities table + entity resolution**
- **Memory tier implementation** (scratchpad/episodic/semantic/procedural/reflective)

Deliverable: Gabriel can ask "list all customer use cases from the last 3 months mentioning automation, grouped by industry" and get an answer in 10s.

### Phase 5 (3 weeks) — Agent society
- **Agent runner framework** (improvements #15)
- **Librarian + Analyst** (extend existing classifier + ingest)
- **Coach** (daily brief)
- **Scheduler** (meeting prep agent)
- **Observability: agent_runs table + /agents dashboard page**

Deliverable: 4 agents running on schedule, logging every run, no human trigger required.

### Phase 6 (3 weeks) — Voice + Face
- **Voice assistant Mac app** (improvements #12)
- **TTS + STT integration** (ElevenLabs + Whisper)
- **Always-visible avatar** on menu bar
- **Voice input to Idea Inbox**
- **Spoken daily brief**

Deliverable: Gabriel has the "face" he asked for. Morning brief is read aloud. Ideas captured by voice.

### Phase 7 (4 weeks) — Advanced agents
- **Researcher agent** — continuous topic research
- **Writer agent** — Sunday newsletter draft
- **Producer agent** — idea → artifact
- **Social agent** — weekly relationship nudges
- **Evals framework** — promptfoo-style test suites
- **Prompt versioning + A/B testing**

Deliverable: 8 agents autonomously doing research, drafting content, nudging Gabriel, building prototypes.

### Phase 8 (ongoing) — The thesis
- Gabriel's outbound (newsletters, articles, talks, posts) is 80%+ automated
- He spends his time on: meetings, curation, high-leverage thinking
- The system has proven itself on 6+ months of data
- He can plausibly tell the story: "A one-person team shipping 10× more than a 5-person team, powered by a custom AI OS"

---

## Section 5 — Research rabbit holes worth going down

These are things Gabriel specifically mentioned + related reading. Blocking time to actually study these pays off more than any feature:

### Karpathy's recent work
- **LLM Wiki / LLM OS talks** — the framing that LLMs are the new computer, and a "wiki" is a programmable knowledge store that LLMs read/write against
- **nanochat** — his full-stack LLM training + inference from scratch. Read the code to understand attention, KV caching, context management at the lowest level
- **Software 2.0 / 3.0** essays
- Study how `llm.c` and `nanoGPT` handle long context

**Why it matters**: understanding LLMs from first principles changes how you design the harness. You stop treating the model as a black box.

### Anthropic Managed Agents
- Read the managed agents docs (when public)
- Study the Claude Agent SDK patterns
- Look at how Claude Code implements the harness: tool loop, context compression, todo tracking, skill injection, task delegation
- **Key insight**: Claude Code's architecture IS a template for your agent society

**Why it matters**: if you run your agents on managed infrastructure, you skip huge categories of ops work.

### Obsidian ecosystem
- **Dataview plugin** — treats the vault as a database, SQL-like queries in markdown
- **Templater + QuickAdd** — procedural templates that Gabriel can write in
- **Excalidraw plugin** — visual thinking inside the vault
- **Smart Connections plugin** — embeddings-based retrieval inside Obsidian
- **Copilot plugin** — LLM chat against the vault

**Why it matters**: Obsidian's plugin ecosystem has already solved many problems. Either plug into it or use it as UX inspiration.

### Agent memory research (academic + industry)
- **MemGPT** — long-term memory with paging
- **Voyager** — procedural memory (skill library) built from experience
- **Sparrow, ReAct, Reflexion** — reasoning + reflection patterns
- **Generative Agents** (Stanford/Google paper) — the agent society simulation paper

**Why it matters**: these papers give you concrete patterns for the memory layer.

### PKM philosophy
- **Tiago Forte's Second Brain** (CODE: Capture, Organize, Distill, Express) — matches your capture→ingest→graph→output model
- **Niklas Luhmann's Zettelkasten** — the OG knowledge graph
- **Andy Matuschak's evergreen notes** — why atomic, dense, and linked notes compound
- **Maggie Appleton's "Tools for Thought"** essays

**Why it matters**: don't reinvent PKM. Copy what works.

### Voice / face AI
- **Sesame / ElevenLabs** — high-quality TTS
- **Whisper / Deepgram / AssemblyAI** — STT
- **D-ID / HeyGen** — talking head avatars
- **Open Interpreter** — voice-driven desktop agent

**Why it matters**: the voice layer is 50% of the ADHD enforcement. Get it right.

### Evals + prompt management
- **promptfoo** — eval framework
- **Braintrust** — prompt management + evals
- **LangSmith** — observability
- Anthropic's own **prompt engineering course**

**Why it matters**: without evals you'll regress every time you change a prompt. Non-negotiable.

---

## Section 6 — The one-year check-in

If you build this well, here's what your life looks like in April 2027:

**Morning (08:00)**: Voice brief plays. "Good morning, Gabriel. You have 3 meetings today. Karl at 10am — here's the prep. Customer demo at 1pm — I've updated the prototype in Artifacts. Tom at 4pm. Your AI Recap newsletter draft is ready for review in Content Pipeline. Research agent found 2 new papers on agent memory you'll want to read — both in Reading Queue. Weekly thesis check: you've published 4 articles this month, up from 1 last month. Focus for today: ship the Data Quality SuiteApp demo."

**Mid-morning**: You give your Karl 1:1 prep a 2-minute skim. All the open priorities are surfaced. You walk in prepared.

**Lunch**: You open `/content`, review the newsletter draft, edit 3 paragraphs, hit publish. Gmail draft sent. Done in 15 minutes.

**Afternoon**: Customer demo. The prototype is live. After the demo, Krisp uploads the transcript. The Analyst agent extracts 4 new use cases, updates the customer insights browser, and triggers the Producer agent to draft a v2 prototype overnight.

**Evening**: You spend 30 minutes on Brazilian literature (your reading queue surfaces Paulo Freire's next chapter). You chat with Coach about the day. Coach notes in your reflective memory: "Felt drained after back-to-back customer calls. Suggest spacing them next week."

**Friday 17:00**: Weekly review popup. You go through it in 10 minutes. 8 items shipped, 2 stalled (Coach nudges you on both). Next week's priorities auto-suggested. Weekly review note written to Knowledge Base.

**Saturday**: You're at café filosofia with friends. The system is silent. You're offline.

**Sunday 18:00**: Writer agent drafts next week's newsletter while you're asleep. By Monday morning it's ready to review.

**You**: you're publishing 4x more, your knowledge graph has 10K+ connected nodes, you're having the right conversations at the right time, your thesis as "the best AI communicator at Oracle" is in motion because **the system is doing the work and you're providing the judgment**.

---

## Section 7 — What to start this weekend

Don't try to build all of this. Start with these three things this weekend:

1. **Block 90 minutes to watch Karpathy's latest LLM talk** and Anthropic Managed Agents docs. Take notes directly in `/knowledge`. Tag them `#study #llm-os`.

2. **Build the Idea Inbox** (ticket #1 in improvements doc). It's 2-3 hours of work and it's the foundation for everything else.

3. **Write down your thesis in `app_settings`** as a prompt:
   ```
   key: personal_thesis
   value: "I am becoming the world's best AI communicator at Oracle. Every piece of content I ship, every meeting I take, every conversation I have — should compound toward this goal. The system exists to automate the 80% of work that doesn't require my unique judgment, so I can spend 100% of my time on the 20% that does."
   ```
   Then inject this thesis into every agent's procedural memory. The whole system orients around it.

That's it. Start Monday with the Inbox live, Karpathy watched, thesis written. Everything else is in the roadmap above and will unfold over the next 6-12 months.

---

## Appendix — Key files to create (concrete list)

```
cunhas-brain/
├── src/
│   ├── app/
│   │   ├── agents/page.tsx              (agent dashboard)
│   │   ├── prep/page.tsx                (meeting prep — ticket #3)
│   │   ├── projects/page.tsx            (project tracker — ticket #6)
│   │   ├── people/page.tsx              (people CRM — ticket #7)
│   │   ├── talks/page.tsx               (talk tracks — ticket #8)
│   │   ├── content/page.tsx             (content pipeline — ticket #9)
│   │   ├── reading/page.tsx             (reading queue — ticket #10)
│   │   ├── review/page.tsx              (weekly review — ticket #11)
│   │   └── api/
│   │       ├── ideas/route.ts
│   │       ├── daily-brief/route.ts
│   │       ├── weekly-review/route.ts
│   │       ├── prep/upcoming/route.ts
│   │       ├── prep/[id]/briefing/route.ts
│   │       ├── projects/route.ts
│   │       ├── projects/[id]/route.ts
│   │       ├── people/route.ts
│   │       ├── people/resolve/route.ts
│   │       ├── talks/route.ts
│   │       ├── arguments/route.ts
│   │       ├── content/route.ts
│   │       ├── content/[id]/generate/route.ts
│   │       ├── reading/route.ts
│   │       ├── notes/sync/route.ts
│   │       ├── llm-wiki/route.ts
│   │       ├── embeddings/route.ts
│   │       └── agents/
│   │           ├── librarian/route.ts
│   │           ├── researcher/route.ts
│   │           ├── writer/route.ts
│   │           ├── coach/route.ts
│   │           ├── scheduler/route.ts
│   │           ├── producer/route.ts
│   │           └── social/route.ts
│   ├── components/
│   │   ├── IdeaInbox.tsx
│   │   ├── DailyBrief.tsx
│   │   ├── MeetingPrep.tsx
│   │   ├── ProjectBoard.tsx
│   │   ├── PeopleList.tsx
│   │   ├── TalkEditor.tsx
│   │   ├── ArgumentLibrary.tsx
│   │   ├── ContentPipeline.tsx
│   │   └── ReadingQueue.tsx
│   └── lib/
│       ├── llmWiki.ts                   (query planner + executor)
│       ├── embeddings.ts
│       ├── memory.ts                    (tiers)
│       ├── agents/
│       │   ├── base.ts
│       │   ├── librarian.ts
│       │   ├── researcher.ts
│       │   ├── analyst.ts
│       │   ├── writer.ts
│       │   ├── coach.ts
│       │   ├── producer.ts
│       │   ├── scheduler.ts
│       │   └── social.ts
│       ├── ideaPrompts.ts
│       ├── meetingNoteIngest.ts
│       └── tts.ts
├── scripts/
│   ├── avatar-app/                      (new: voice + face)
│   ├── obsidian-sync.js
│   └── notifier.js                      (existing, extend)
├── vercel.ts                            (cron schedules for agents)
└── docs/                                (this folder)
```

Plus new DB tables: `inbox`, `ideas`, `products_ideas`, `projects`, `project_links`, `people`, `person_mentions`, `talks`, `arguments`, `content_pieces`, `reading_items`, `daily_briefs`, `self_notes`, `entities`, `entity_mentions`, `embeddings`, `agent_runs`.

---

## Closing

You asked for a more original, deeply researched idea. Here it is.

The short version: **build a Personal AI Operating System** where the knowledge graph is the source of truth, a society of specialized agents acts on your behalf, voice + face enforces daily rituals, and the whole thing is obsessively oriented toward one thesis (*"world's best AI communicator"*). Cunha's Brain is the substrate. The agents are the workforce. The thesis is the compass.

Start with the Idea Inbox this weekend. Build the rest over 6 months. Ship content every week while you build. By this time next year, your output will speak for itself.

Now stop reading and go watch the Karpathy talk.
