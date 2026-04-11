# Idea CRM — Architecture Plan

> A concise plan for a new standalone application: a CRM-like system for managing goals, priorities, and ideas. **This file is the plan, not the code.** Once you approve, we build.

## The ask (your words, compressed)

- A **separate application**, hosted in the Claude Code workspace
- Takes **all** your notes (WhatsApp, Notion, documents, brain dumps, plans from this chat)
- **Categorizes** them, lets you **review** them, **visualize** them, see their **evolution**
- **AI-driven onboarding** — the app asks you clarifying questions in the app AND in the terminal while we migrate
- Ongoing management layer after onboarding — not just a one-shot migration
- Think *CRM for ideas and knowledge*, not contacts
- Must handle **onboarding** (migration from legacy sources) AND **ongoing** (new captures + review)

---

## The core concept

**Idea CRM**: every atom of thought — an idea, a goal, a commitment, an observation, a question — becomes a **Record** with a lifecycle. Like a sales CRM tracks deals through stages, this tracks ideas through stages.

### Record = the fundamental unit

A Record has:
- **Title** (one line, imperative or declarative)
- **Content** (the actual idea, 1-3 paragraphs)
- **Stage**: `raw` → `refined` → `committed` → `active` → `shipped` → `archived`
- **Type**: `goal` · `idea` · `commitment` · `question` · `observation` · `project` · `person` · `content_seed`
- **Categories** (multi): `work` · `personal` · `product` · `content` · `learning` · `relationships` · `health` · `meta`
- **Pillar link** — which yearly pillar does this serve (from `04-workspace-integration-and-yearly-goals.md`)
- **Origin** — where it came from (WhatsApp note dated X / Notion page Y / Claude chat on Z)
- **Confidence** — 0-1 AI confidence that this is a standalone idea vs a fragment
- **Related records** — graph edges (this idea relates to idea X, is a variation of Y, was replaced by Z)
- **History** — timestamped log of every change: created, refined, stage moved, merged, archived, resurrected
- **Next action** — one sentence
- **Dormancy** — days since last touched (surfaces orphans)
- **Attachments** — original raw sources saved as-is (never lose context)

The CRM treats these records like a sales team treats leads: **every record is either moving forward through stages or it's decided dead**. No purgatory.

---

## What makes this different from Notion/Tana/Obsidian/Linear

| Tool | What it does | What it misses |
|---|---|---|
| Notion | Flexible pages + DBs | No AI-driven migration. No "this idea is dying, decide its fate." No evolution tracking. Expects you to do the work. |
| Tana / Roam | Atomic + graph | Great for linking, weak on stages + lifecycles. No AI interview flow. |
| Obsidian | Local markdown + graph | No server-side AI agents doing work on your behalf. No CRM semantics. |
| Linear / Motion | Tasks & priorities | Task-focused, not idea-focused. No "raw capture to refined idea" lane. |
| Second-brain tools (Mem, Reflect) | Capture + retrieval | No structured lifecycle. No explicit orphan decisions. No interview onboarding. |

**What Idea CRM adds**:
1. **Onboarding IS the product** — the AI does the painful work of ingesting a pile of mixed-format notes, extracting atoms, clarifying, filing, and linking. Competitors expect you to do this yourself.
2. **Explicit lifecycles** — every record has a stage. Stages force decisions. No hoarding.
3. **Interview loop** — during onboarding AND during weekly review, the AI asks short questions ("Is this still relevant?", "Is this the same as idea X?", "Should this become a project?") and updates state from your answers.
4. **Evolution tracking** — see how an idea changed over time. An idea that started as "build something for music" in January might become "Digital Studiolo AI beat generator" by April. The full trace is preserved.
5. **Terminal + App hybrid** — Claude Code in the terminal does the heavy-lift conversation during onboarding. The app is the ongoing review/capture/visualize surface.
6. **Pillar-grounded** — every record links to a yearly pillar or gets flagged "orphan, decide".

---

## The two experiences

### Experience A — Onboarding / Migration

**Goal**: take everything you've written down across WhatsApp, Notion, docs, PDFs, brain dumps, and the chat plans, and land it all cleanly in the CRM within one focused session.

Flow:
1. **Intake** — you upload or paste raw content. Multiple formats supported (markdown, txt, Notion export, WhatsApp .txt, PDF OCR).
2. **Triage (AI)** — parse into atomic candidate records. One candidate per idea. Preserve origin reference.
3. **Dedupe (AI)** — match candidates against each other and existing records. Fuzzy match on title + semantic embedding.
4. **Clarify (terminal interview)** — for each ambiguous candidate, Claude Code asks you a short question. You answer in the terminal. The answer updates the record.
   - "These 3 candidates all look like 'write a newsletter'. Same idea or three different ones?"
   - "This one says 'talk to Arthur'. Which Arthur? What's the open topic?"
   - "This is tagged both #product and #learning. Which is primary?"
5. **Categorize (AI)** — infer pillars, stages, and types. Confidence score attached.
6. **Review (app)** — after the interview, you open the web app and see a "Migration Review" page: every record, grouped by pillar and stage. You click through and approve / edit / reject.
7. **Commit** — approved records are persisted. Rejected ones archived with a reason.

Onboarding result: ~20 min of terminal interview + ~15 min of web review = a fully populated CRM with hundreds of records, all linked to pillars, all in the right stage.

### Experience B — Ongoing management

After onboarding, the app becomes your **daily review and capture surface**.

Surfaces:
- **Inbox** — quick-add new ideas anytime (text, voice, paste). AI auto-stages them as `raw` and suggests categories.
- **Review mode** — ADHD-friendly. One record at a time, full-screen. "Still relevant? Next action? Promote stage?" Keyboard shortcuts for yes/no/snooze/archive/promote.
- **Board** — Kanban-style, one column per stage. Drag to progress.
- **Graph** — clustering visualization. Nodes are records, edges are relationships. Color by pillar, size by priority, group by category.
- **Timeline** — evolution of a single idea: when created, when refined, when merged, when shipped.
- **Dormancy report** — orphans surfaced weekly. Each needs a decision.
- **Pillar rollup** — one card per yearly pillar showing: active records, shipped records, % effort, progress against target metric.
- **Promote** — one-click push from Idea CRM to `cunhas-brain` (a record becomes a project, content piece, meeting prep, or micro-article).

Rituals baked in:
- Daily: review 3 random `raw` records; capture anything new
- Weekly: dormancy sweep; promote 1-2 records per pillar
- Monthly: pillar-level retrospective

---

## Data model (concrete)

```sql
CREATE TABLE records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  stage TEXT NOT NULL DEFAULT 'raw',       -- raw|refined|committed|active|shipped|archived
  type TEXT NOT NULL,                        -- goal|idea|commitment|question|observation|project|person|content_seed
  categories TEXT[] DEFAULT '{}',
  pillar_slug TEXT,                          -- links to pillars table
  origin_source TEXT,                        -- whatsapp|notion|brain_dump|chat|manual|voice|...
  origin_ref JSONB,                          -- {file: 'export.json', page: 'x', date: '...'}
  confidence REAL DEFAULT 0.5,
  next_action TEXT,
  dormant_days INT GENERATED ALWAYS AS (EXTRACT(DAY FROM NOW() - updated_at)) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_reviewed_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  archive_reason TEXT
);

CREATE TABLE record_history (
  id SERIAL PRIMARY KEY,
  record_id UUID REFERENCES records(id) ON DELETE CASCADE,
  event TEXT NOT NULL,                       -- created|refined|stage_changed|merged|linked|archived|resurrected
  before JSONB,
  after JSONB,
  note TEXT,                                  -- AI or user explanation of the change
  actor TEXT NOT NULL,                       -- 'user' | 'ai' | 'ai-auto'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE record_links (
  id SERIAL PRIMARY KEY,
  source_id UUID REFERENCES records(id) ON DELETE CASCADE,
  target_id UUID REFERENCES records(id) ON DELETE CASCADE,
  relation TEXT NOT NULL,                    -- related|variant_of|replaced_by|supports|contradicts|part_of
  strength REAL DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_id, target_id, relation)
);

CREATE TABLE raw_sources (
  id SERIAL PRIMARY KEY,
  filename TEXT,
  source_type TEXT,                          -- whatsapp|notion|pdf|md|txt|chat
  content TEXT,                              -- raw unparsed content
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  records_extracted INT DEFAULT 0
);

CREATE TABLE interview_sessions (
  id SERIAL PRIMARY KEY,
  mode TEXT NOT NULL,                         -- onboarding|weekly_review|dormancy_sweep
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  questions_asked INT DEFAULT 0,
  records_touched INT DEFAULT 0,
  transcript JSONB
);

CREATE INDEX idx_records_stage ON records(stage);
CREATE INDEX idx_records_pillar ON records(pillar_slug);
CREATE INDEX idx_records_dormant ON records(dormant_days);
CREATE INDEX idx_records_type ON records(type);
```

---

## Architecture + stack

Keep it boring and fast:

- **Next.js 14 App Router** (same patterns as `cunhas-brain/`)
- **Neon Postgres** (separate schema or separate database — recommend **separate database** so onboarding churn doesn't touch cunhas-brain)
- **Claude Haiku** for classification, dedup, interview question generation
- **Claude Sonnet** for hard clarification queries and final categorization
- **pgvector** for semantic dedupe during onboarding
- **Vercel** deployment (`idea-crm.vercel.app` or as a subdomain)
- **Shared auth** with cunhas-brain — same password, same cookie
- **Shared `pillars` table** — the CRM reads from cunhas-brain's `pillars` so you don't maintain two pillar lists

### Where it lives on disk

```
~/Desktop/workspace/
├── cunhas-brain/              # existing — personal OS
├── idea-crm/                  # NEW — this app
│   ├── src/
│   │   ├── app/               # Next.js routes
│   │   │   ├── onboard/       # migration wizard
│   │   │   ├── review/        # review mode
│   │   │   ├── board/         # kanban
│   │   │   ├── graph/         # viz
│   │   │   ├── timeline/      # evolution
│   │   │   ├── record/[id]/   # record detail
│   │   │   └── api/
│   │   │       ├── records/
│   │   │       ├── onboard/
│   │   │       ├── interview/
│   │   │       ├── search/
│   │   │       └── ...
│   │   ├── components/
│   │   └── lib/
│   ├── scripts/
│   │   └── interview-cli.js   # the terminal-based onboarding interview
│   ├── sql/
│   │   └── schema.sql
│   ├── docs/
│   └── PROJECT.md
└── ...
```

Why a separate repo/folder and not a new tab inside cunhas-brain:
- Different lifecycle — the CRM is about thought management; cunhas-brain is about meeting/knowledge operations. Bleeding them together makes both worse.
- Different data model — Idea CRM's "record" is semantically distinct from cunhas-brain's "note" or "meeting".
- Separate deploy = safer iteration on onboarding (big AI-heavy operations) without risk to your daily driver.
- Later, we expose read-only cross-app APIs: CRM reads pillars from cunhas-brain, cunhas-brain reads "seeds" from CRM for daily brief suggestions.

---

## The terminal interview (the killer feature)

The unique thing about this app is the **terminal-based interview**. During onboarding, Claude Code in your terminal session drives a conversation like:

```
> idea-crm interview --source ~/Downloads/whatsapp-export.txt

Parsed 247 messages into 83 candidate records.

Deduplication: 19 clusters detected.

[1/19] These 4 look like the same idea:
  - "Write something about context engineering" (2026-02-12)
  - "Article: context engineering > prompt engineering" (2026-03-01)
  - "Need to write the context eng piece" (2026-03-18)
  - "Draft is still not started lol" (2026-04-02)

Keep as: (1) one record with all sources / (2) two records (idea + commitment)?
> 1

Title for merged record? [suggested: Context Engineering > Prompt Engineering article]
> yes, but add "micro-article or essay?"

Stage? (raw / refined / committed / active)
> committed

Which pillar? (1) AI voice at Oracle (2) Publish as thinker (3) Both
> 3

Next action in one sentence?
> write the 300-word version this week

✓ Created: Context Engineering > Prompt Engineering article — micro-article or essay?

[2/19] ...
```

The interview is where the messy pile becomes a structured system. Every question is designed to extract exactly the metadata the CRM needs. You answer with single words or short phrases. You're never typing long — the AI writes; you confirm or correct.

The same interview pattern is used for **weekly review**:

```
> idea-crm review

Good evening. You have 12 records due for review this week.

[1/12] "Digital Studiolo music app" (raw, 47 days dormant, pillar: ship personal product)
  Last touched: 47 days ago
  Still relevant? (y/n/snooze 7/snooze 30/archive)
> y
  Next action in one sentence?
> revisit the scene-graph design from the PLAN.md file
> ✓

[2/12] "Talk to Arthur about visa" (commitment, 14 days dormant, pillar: relationships)
  Still relevant?
> y
  Did it happen?
> no
  Snooze or schedule?
> schedule friday
  ✓

[3/12] "BBB Infinito prototype" (refined, 89 days dormant)
  This has been dormant 89 days. Archive, or commit to 2 hours this weekend?
> archive
  Reason?
> still excited about it but not this year
  ✓ archived with resurrection note
```

**This is the daily driver** for your goal-and-idea hygiene.

---

## Onboarding questions — what I need from you to start

When you're ready, here's what I need you to paste / upload / share:

**Sources** (in priority order):
1. **Your brain dump from last night** — already captured in `docs/01-notes-summary-and-recommendations.md`, I'll pull from there automatically
2. **WhatsApp "Notes to self"** — export the chat (`Chat > Export chat > Without media`), paste the .txt
3. **Notion notes** — export your Notion workspace as Markdown+CSV, share the zip path
4. **Document/PDF notes** — list of paths to any notes files you have
5. **Your yearly goals** — a sentence or two per pillar if you want to override my inferred 9 pillars in `04`
6. **Old brain dumps** — any older Claude Code sessions, Slack DMs to yourself, Apple Notes exports

**Scoping questions I'll ask you interactively** (so you don't need to answer now):
- What's off-limits? (personal diary, sensitive work topics, etc.)
- What's the format of each source?
- Single user only, right? (yes, I assume)
- Do you want the originals saved for audit, or fully absorbed?
- Which pillar numbers from `04` do you want to keep / edit / add?
- Any categories you want me to use that I haven't guessed?

**One decision I need now**:
- Should the Idea CRM write back to Notion / Obsidian so those stay in sync, or is it the new source of truth and legacy sources become read-only archives? My strong recommendation: **new source of truth, archives frozen**. Dual-writing is where discipline dies.

---

## Phased build plan

### Phase 0 — Decide (30 min, this week)
- You read this doc
- You tell me: go / adjust / kill
- You tell me yes/no on the one decision above
- You gather sources and have them ready

### Phase 1 — Scaffold (1 evening)
- `idea-crm/` repo bootstrapped with Next.js 14 + shared auth + new Neon DB + schema migration
- Basic record list page + create/edit UI
- Ingest endpoint accepts raw source uploads
- No interview yet

### Phase 2 — Onboarding v1 (1 weekend)
- AI parser: raw text → candidate records
- Semantic dedupe via pgvector
- Terminal interview script (`scripts/interview-cli.js`)
- Migration Review page in the app
- Commit flow

### Phase 3 — Review mode (1 evening)
- Review mode UI (ADHD-friendly one-at-a-time)
- Dormancy query + weekly sweep
- Integration with weekly review ritual in cunhas-brain

### Phase 4 — Visualize (1 weekend)
- Board / Kanban view
- Graph view (force-directed, same canvas pattern as cunhas-brain's `KnowledgeBase`)
- Timeline view (per-record evolution)
- Pillar rollup cards

### Phase 5 — Promote (1 evening)
- One-click promote: record → cunhas-brain project / content piece / meeting prep / micro-article
- Bi-directional sync for pillar state

### Phase 6 — Polish (ongoing)
- Voice capture
- Automatic nudges
- AI-suggested merges when duplicates appear
- Cross-app search (CRM + cunhas-brain + workspace)

Total: ~2-3 weeks of evenings and weekends to a fully working v1.

---

## Research notes (what I want to look into before building)

- **Notion export format** — API vs ZIP, preserving block types, relations, inline references
- **WhatsApp .txt export parsing** — timestamps, authors, multi-line messages, media refs
- **pgvector + semantic dedupe patterns** — chunking, embedding model, distance thresholds
- **Interview flow UX** — look at how typeform/tally/research tools do branching question flows in terminals and adapt
- **CRM lifecycle semantics** — what Salesforce / HubSpot / Pipedrive teach us about stages and dormancy
- **Karpathy's LLM OS framing** — the Idea CRM is arguably the purest expression of "LLMs as the OS for knowledge management" for a single user
- **Anthropic Contextual Retrieval** — for the semantic dedupe pipeline
- **Obsidian Dataview + Tasks plugins** — for the review-mode UX inspiration
- **Tana's supertags** — for the record-type system

---

## What this unlocks once built

- You dump raw brain into it weekly, the system absorbs it
- Every idea has a home, a stage, a pillar, a next action
- Orphans are visible and get resolved (archive or resurrect)
- You see exactly how your thinking has evolved over months
- Promoting ideas to execution (`cunhas-brain` projects / content / prep) is one click
- Your 30+ workspace projects stop being a graveyard and become a managed portfolio
- The CRM becomes the conversation partner you asked for — not just storage, but something that asks you the right questions at the right time

---

## What I need from you to start

**Right now**: read this file, approve / adjust / kill the direction.

**Then, when you have 30 minutes**: paste or share the first batch of notes (WhatsApp export is the easiest starting point — one file, clear structure). I'll start the terminal interview with a handful of clarifying questions so we can prove the flow on real data before building the full app.

**Once validated**: I build Phase 1 and 2 in one weekend. You onboard everything else. By next week you have your Idea CRM live.

One line if you want to say yes: *"Go, start Phase 0 — I'll send notes by Sunday."*
