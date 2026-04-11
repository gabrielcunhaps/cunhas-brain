# Workspace Integration, Ownership Loops, and Yearly Goals

> You asked me to look at your entire workspace, not just `cunhas-brain/`. I did. This is the honest picture and the plan to turn a fragmented experiment graveyard into a single compounding engine tied to your yearly goals.

**The problem you named**:
> *"I build something, I forget about it, and then I move on to another idea. If I can have AI build it all and be my assistant in doing those things, everything's going to change."*

This file is specifically about **that**. The other three docs (`01`, `02`, `03`) are about features inside cunhas-brain. This one is about your whole workspace.

---

## Section 1 — What you actually have

Let's inventory. I walked through `~/Desktop/workspace/` and counted.

### By the numbers
- **23 registered projects** in `projects.json` (16 NetSuite + 7 personal)
- **6 additional projects** not yet in `projects.json` but present in folders:
  - `cunhas-brain/` — this app (you're in it)
  - `dashboard/` — Next.js orchestration dashboard at `localhost:3333` (different from cunhas-brain!)
  - `openclaw/` — self-hosted AI gateway (WhatsApp/Telegram/Discord)
  - `industry-recap/` — Inoreader → Claude → recap pipeline
  - `krisp/` — raw meeting transcript dumps
  - `personal/obsidian/` — an already-started "Second Brain Builder" vault project (!!)
- **~30 total projects** in the workspace, most `active` or `prototype`, several `complete`

### NetSuite work (16 projects, your day job)
All orbit one thesis: **"AI agents need structured ERP context to be effective."**

- **Infrastructure**: `mcp-tools` (production SuiteApp), `netsuite-mcp-server`, `suiteagents`, `grand-master-tool`
- **Applications**: `ai-readiness` (production dashboard), `netsuite-intelligence`, `audit`, `context` (toolkit umbrella)
- **Autonomous ops**: `finance-department` (11-agent network), `autonomous-department` (merger), `co-work`
- **Research**: `erp-bench`, `business-classification`, `pd-augmentation` v1/v2/v3
- **Localization**: `brazil-tax` (ML-based Brazilian tax rule engine)

You have a **production-scale portfolio**. Most knowledge workers don't have this many shipped pieces.

### Personal projects (7+ in `personal/` folder)
- `automaton` — self-improving sovereign agent with blockchain
- `bbb-research` (BBB Infinito) — streaming AI Big Brother using Claude + ElevenLabs + Unity
- `knowledge` — knowledge taxonomy visualization
- `mobile-agent` — multi-platform personal AI with React Native + Supabase + pgvector
- `music` / `digital-studiolo` — AI-assisted music creation research
- `obsidian/` — Second Brain Builder (PLAN.md already drafted, vault-builder/ subfolder)
- `preply/` — your tutoring materials
- `thoughts/` — `brasilidade/`, `intent-gap-one-pager.md`, "Hi, I want to start communicating more about AI" PDF
- `visual/` — Knowledge Graph Simulator (Next.js + D3)
- `career/`, `brazil-interface/`, `good-great/`, `tech-history/`

### Meta tools
- `cunhas-brain/` — your personal meeting hub (this repo)
- `dashboard/` — workspace orchestration dashboard (Next.js, port 3333, activity feed + project runner)
- `openclaw/` — self-hosted personal AI gateway with 220K GitHub stars (upstream fork/integration)
- `industry-recap/` — the prompt pattern you already built for AI newsletter generation (and whose prompt I copied into cunhas-brain earlier)

---

## Section 2 — The real problem (which is not what you think)

You said you build things and forget them. That's the symptom. Here's the diagnosis:

### Diagnosis 1 — **You have four "dashboards" and they don't talk**
1. **`cunhas-brain/`** — your personal OS (meetings, notes, artifacts, students, categories)
2. **`dashboard/`** — workspace orchestration hub (projects.json, activity feed, run scripts)
3. **`openclaw/`** — AI gateway (WhatsApp/Telegram/Discord chat interface to an agent)
4. **`personal/obsidian/`** — planned Second Brain (not built yet)

Each was started to solve a real need. None of them knows about the others. You have **fragmentation at the orchestration layer**, which is exactly where you need unity.

### Diagnosis 2 — **No yearly goal → project graph**
None of your 30 projects are explicitly tied to a declared yearly goal. When you work on `brazil-tax`, there's no record of which 2026 goal this advances. Same for `bbb-research`, `mobile-agent`, `digital-studiolo`, etc. So you can't answer "is this project worth more hours this quarter?" because you have no scoring function.

### Diagnosis 3 — **No project continuation state**
Each project has a `LOG.md` which is great, but there's no "where did I leave off and what's the next action?" field surfaced anywhere. You open a folder, read 500 lines of LOG, and have to mentally reconstruct context every single time. ADHD kills this loop.

### Diagnosis 4 — **No inter-project connection graph**
`personal/mobile-agent`, `cunhas-brain/`, `personal/obsidian/`, and `openclaw/` are **all solving variants of the same problem** (personal AI assistant). But there's no link between them. You rebuild the same primitives three times.

Similarly, `industry-recap/` and `cunhas-brain/newsletters/` both do newsletter summarization — we know because I copied the prompt. But they're disconnected codebases.

### Diagnosis 5 — **Personal ≠ work bleeds both ways**
Your `personal/thoughts/` folder has a PDF titled *"Hi, I want to start communicating more about AI"*. This is the same ambition as your Oracle thought-leadership goal. But personal thoughts live in PDFs, work thoughts live in netsuite/ READMEs, nothing cross-links.

---

## Section 3 — Yearly goals framework

Before we fix the architecture, **define the goals**. Without this, every feature we build is aimless.

Based on your brain dump + the workspace inventory, here's my inferred read of your 2026 yearly goals. **Edit these and save them as the canonical list** (I'll add a table in cunhas-brain for you to store these).

### Proposed 2026 yearly goals (edit as needed)

1. **Become the #1 internal AI voice at Oracle/NetSuite** — articles, talks, demos, leadership newsletters, expanded AI Champions group. Measurable: # of published pieces, # of people following your output, leadership recognition.

2. **Ship the AI Data Readiness / Data Quality for AI SuiteApp** — turn your research (`ai-readiness`, `business-classification`, `context`, `pd-augmentation`) into a shipped product with customers. Measurable: functional solution deployed, N customers using it.

3. **Build the personal AI Operating System (Cunha's Brain + extensions)** — the meta-project of this doc. Measurable: daily active usage, % of output generated or assisted by the system.

4. **Autonomous Finance SuiteApp** — productize your `finance-department` work into something saleable. Measurable: first paying customer or internal pilot.

5. **Ship one personal product** — choose ONE of: BBB Infinito, Digital Studiolo, Automaton, Mobile Agent. Ship it publicly, even at v0.1. Measurable: live URL + real users.

6. **Publish regularly as a thinker** — newsletter cadence (monthly), article cadence (1-2/month), podcast cadence (experimental). Measurable: # pieces, audience growth.

7. **Build foundational knowledge** — Karpathy LLM Wiki, Managed Agents, Brazilian literature, Paulo Freire, philosophy. Measurable: notes in Knowledge Base, book completions.

8. **Cultivate relationships deliberately** — Karl, Tom Kelly, Joe, Arthur, Oracle Education, Larry Ellison, Brazilian journalists, Duval. Measurable: # of intentional conversations/month.

9. **Health, social, presence** — go to the office, social life, book club, café filosofia. Measurable: days/week in office, # social events/month.

These are your **pillars**. Every project in your workspace should map to one or more of them. Projects that map to zero pillars are candidates to archive.

### Pillar → project mapping (my first pass)

| Pillar | Projects that advance it |
|---|---|
| #1 AI voice at Oracle | `industry-recap`, `cunhas-brain/newsletters`, `suiteagents`, `ai-readiness`, all talks/slides |
| #2 Data Quality SuiteApp | `ai-readiness`, `business-classification`, `context`, `pd-augmentation` v1-v3 |
| #3 Personal AI OS | `cunhas-brain`, `dashboard`, `openclaw`, `personal/obsidian`, `personal/mobile-agent` |
| #4 Autonomous Finance SuiteApp | `finance-department`, `autonomous-department`, `co-work`, `audit` |
| #5 Ship personal product | `personal/bbb-research`, `personal/music`, `personal/automaton` |
| #6 Publish as thinker | `personal/thoughts`, outputs from `industry-recap` + `cunhas-brain/content` |
| #7 Foundational knowledge | `personal/knowledge`, `personal/obsidian/all-notes`, Reading Queue |
| #8 Relationships | People CRM (to build) |
| #9 Health/social | Lifestyle widget (to build) |

**Notice**: some projects serve multiple pillars (`cunhas-brain` serves #3 *and* enables #1/#6 via newsletter automation). Some pillars have no project yet (#8, #9). This matrix is the planning surface.

---

## Section 4 — Architecture: the Workspace Graph

Here's the new architecture. Instead of 4 disconnected dashboards, we treat **the entire workspace as a single graph** with cunhas-brain as the UI layer over it.

### The graph

```
                    ┌──────────────────────┐
                    │   YEARLY GOALS       │   (9 pillars)
                    └──────────┬───────────┘
                               │
            ┌──────────────────┼──────────────────┐
            │                  │                  │
            ▼                  ▼                  ▼
      ┌─────────┐        ┌─────────┐        ┌─────────┐
      │ PILLAR  │        │ PILLAR  │        │ PILLAR  │
      │    1    │        │    2    │        │    3    │
      └────┬────┘        └────┬────┘        └────┬────┘
           │                  │                  │
           ▼                  ▼                  ▼
    ┌────────────┐    ┌────────────┐      ┌────────────┐
    │  PROJECTS  │    │  PROJECTS  │      │  PROJECTS  │
    │ (multiple) │    │ (multiple) │      │ (multiple) │
    └─────┬──────┘    └─────┬──────┘      └─────┬──────┘
          │                 │                   │
          ▼                 ▼                   ▼
    ┌──────────┐      ┌──────────┐        ┌──────────┐
    │ MEETINGS │      │ MEETINGS │        │ MEETINGS │
    │  NOTES   │      │  NOTES   │        │  NOTES   │
    │  IDEAS   │      │  IDEAS   │        │  IDEAS   │
    │ ARTIFACTS│      │ ARTIFACTS│        │ ARTIFACTS│
    │ CONTENT  │      │ CONTENT  │        │ CONTENT  │
    └──────────┘      └──────────┘        └──────────┘
```

Every atomic item (a meeting, a note, an idea, an artifact, a content piece) links up to a **project**. Every project links up to one or more **pillars**. Every pillar ladders up to your **thesis**.

This gives you a scoring function for every decision:
- "Should I spend 2 hours on brazil-tax tonight?" → check which pillar it serves (#2 Data Quality SuiteApp) → check if that pillar is behind schedule → yes → do it.
- "Should I prototype BBB Infinito?" → pillar #5 → is that pillar getting effort this month? → if no, schedule.
- "Should I write the Paulo Freire notes?" → pillar #7 → do I have time this week? → yes → 30 min block.

### New tables in cunhas-brain

```sql
CREATE TABLE pillars (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,     -- 'ai-voice-at-oracle'
  title TEXT NOT NULL,
  description TEXT,
  year INT NOT NULL,             -- 2026
  priority INT DEFAULT 0,
  target_metric TEXT,
  target_value TEXT,
  current_value TEXT,
  status TEXT DEFAULT 'active',  -- active | paused | done
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE workspace_projects (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,     -- matches folder or projects.json slug
  name TEXT NOT NULL,
  folder_path TEXT NOT NULL,     -- '/Users/.../workspace/netsuite/brazil-tax'
  category TEXT,                 -- 'netsuite' | 'personal' | 'meta' | 'experimental'
  description TEXT,
  status TEXT DEFAULT 'active',  -- active | paused | complete | archived
  runnable BOOLEAN DEFAULT false,
  last_touched_at TIMESTAMPTZ,
  next_action TEXT,              -- the ONE sentence: what to do next
  continuation_notes TEXT,       -- "where I left off" — auto-summarized from LOG
  linked_meetings INT DEFAULT 0,
  linked_notes INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE pillar_projects (
  id SERIAL PRIMARY KEY,
  pillar_id INT REFERENCES pillars(id) ON DELETE CASCADE,
  project_id INT REFERENCES workspace_projects(id) ON DELETE CASCADE,
  weight INT DEFAULT 1,          -- how much this project serves this pillar (1-5)
  UNIQUE(pillar_id, project_id)
);
```

### Ingestion from the workspace

A new agent — call it the **Workspace Scanner** — runs nightly and:
1. Walks `~/Desktop/workspace/` for all subfolders with a `PROJECT.md`, `LOG.md`, or `package.json`
2. Parses `projects.json` as the source of truth for known projects
3. For each project:
   - Reads `LOG.md` → extracts last entry date + summary
   - Reads `PROJECT.md` → extracts status
   - Runs `git log --oneline -5` → extracts recent commits
   - Computes `last_touched_at`
4. Upserts into `workspace_projects`
5. Runs a Claude pass to propose `continuation_notes` and `next_action` (1 sentence each) from the recent activity
6. Detects orphans (projects untouched >30 days) and flags them

This turns `cunhas-brain` into a **workspace-level orchestration layer** — not just a meeting+notes app.

### Auto-linking meetings/notes/ideas to projects

When a meeting is processed:
- Claude extracts potential project mentions ("brazil-tax", "Tom Kelly's Data Quality project")
- Matches against `workspace_projects.name`/`slug`/`aliases`
- Creates a link in a new `project_links` table

Same for notes, ideas, content pieces. Every atom knows its project.

---

## Section 5 — Ownership loops: "Where did I leave off?"

The #1 thing that breaks your flow: opening a folder you haven't touched in 3 weeks and having to reconstruct context.

### Solution: per-project "resumption cards"

Every project in the workspace gets a **resumption card** on cunhas-brain at `/projects/[slug]`. It shows:

1. **Last activity** — date + 1-sentence summary (auto-generated from LOG.md)
2. **Where you left off** — 2-3 sentences, auto-regenerated each time LOG.md changes
3. **Next action** — ONE sentence. Clicking it schedules it or marks it complete.
4. **Open questions** — unresolved items from the last session
5. **Linked meetings** — recent meetings that mention this project
6. **Linked notes** — recent knowledge base notes tagged to this project
7. **Recent commits** — git log tail
8. **Current branch** — so you know you left mid-feature
9. **TODO comments** in code — grep-extracted and displayed

At the top of the card: a **big "Resume" button** that copies a ready-to-paste prompt to your clipboard:

> *"I'm resuming work on `brazil-tax`. Last session I was working on {continuation_notes}. My next action is {next_action}. The open questions are {open_questions}. Please read PROJECT.md and LOG.md, then help me execute the next action."*

Paste into Claude Code and go.

### Weekly "orphan sweep"

Every Sunday evening, the Workspace Scanner agent runs an orphan sweep:
- Projects untouched >14 days get surfaced in a weekly report
- Each orphan gets a Claude-generated "archive or resume" recommendation
- You click "Archive" or "Resume this week" — each updates `workspace_projects.status` and sets a reminder

This forces you to consciously decide what lives and what dies. ADHD-friendly because it's one decision per orphan, not a vague "go through your projects" directive.

---

## Section 6 — Consolidation strategy for the 4 dashboards

You have 4 different orchestration surfaces. Consolidating is delicate — each one has unique value. Here's the plan.

### The roles

| Surface | Current role | Future role |
|---|---|---|
| **`cunhas-brain/`** | Meetings, notes, categories, students, artifacts | **The hub** — personal OS. Absorbs project/pillar/people views. |
| **`dashboard/`** | Workspace activity feed + project runner at `:3333` | **Local-only dev runner** — keep as-is for running projects locally. Expose its data to cunhas-brain via a read-only API. |
| **`openclaw/`** | Self-hosted AI gateway (WhatsApp/Telegram) | **Input bridge** — send captures from messaging apps to cunhas-brain's Idea Inbox. |
| **`personal/obsidian/`** | Second Brain Builder (planned) | **Obsidian vault generator** — not a separate app, a script that exports cunhas-brain Knowledge Base to Obsidian. |
| **`industry-recap/`** | Inoreader → recap pipeline | **Absorbed** — the prompt pattern is already in cunhas-brain. Keep the project as a CLI tool for one-off runs, but the canonical newsletter pipeline lives in cunhas-brain. |

### Integration plan

**Week 1**: Wire `dashboard/` → cunhas-brain
- `dashboard/` reads `projects.json` and writes project metadata to a local SQLite
- Add `dashboard/api/projects/sync` that pushes project state to `cunhas-brain/api/workspace-projects/sync`
- cunhas-brain stores this in `workspace_projects` table
- `cunhas-brain/projects` page is now the consolidated view

**Week 2**: Wire `openclaw/` → cunhas-brain Idea Inbox
- Add a cunhas-brain API endpoint `POST /api/inbox` (auth'd)
- Configure openclaw's WhatsApp/Telegram bot to forward captures to that endpoint
- Now you can Telegram yourself an idea while walking your dog, and it lands in the inbox

**Week 3**: Wire `personal/obsidian/vault-builder` → cunhas-brain Knowledge Base
- The vault-builder script becomes a renderer: reads `notes` table, writes Obsidian-format markdown to `~/brain/`
- Runs as a cron inside `scripts/notifier.js` or standalone
- Two-way sync (Postgres ← file watcher) later

**Week 4**: Deprecate `industry-recap/` as a standalone tool
- Run it one last time, confirm cunhas-brain's newsletter generation matches quality
- Move `industry-recap/` to `archive/` or leave as a CLI alternative
- Update the project manifest

After this, you have **one dashboard** (cunhas-brain) reading from the **entire workspace**.

---

## Section 7 — The Ownership Ritual (the thing that makes this stick)

Architecture means nothing if you don't have a ritual. Here's the daily + weekly + monthly ritual that binds everything.

### Daily (5 min morning, 5 min evening)

**Morning (08:00, voice brief + popup)**:
- Top 3 actions for today across all pillars
- Today's meetings (already in Today's Meetings section)
- 1 orphan to decide about (optional)
- 1 person to reach out to (optional)
- 1 reading suggestion

**Evening (21:00, optional popup)**:
- "What did you touch today?" — auto-detected from git commits + meeting ingestion + note edits
- "What's unfinished?" — surfaces pending todos + open sessions
- "Tomorrow's focus" — 1 sentence you type

### Weekly (Sunday 18:00, 30 min)

- Weekly review (ticket #11 in `02-dashboard-improvements.md`)
- Orphan sweep (this doc, section 5)
- Pillar progress check — which pillars advanced this week? Which didn't?
- Next week's calendar pre-briefing
- Content pipeline: review Writer agent drafts, queue for publishing

### Monthly (First Saturday, 60 min)

- Yearly goals re-check — are your 9 pillars still the right ones?
- Project portfolio review — archive, pause, promote
- Key relationships review — who needs a nudge
- Reading retrospective — what did I read, what stuck
- Strategic writing — one reflective piece goes to a private note, one public piece to the content pipeline

### Quarterly (First Saturday of Jan/Apr/Jul/Oct)

- Re-declare yearly goals if needed
- Major archive decisions
- Thesis check — is *"world's best AI communicator, one-person AI-leveraged team"* still the thesis?
- Big pruning — say no to 3 things

**Each ritual fires automatically** via the macOS notifier (`scripts/notifier.js`) with voice + popup. You can dismiss, but you can't forget.

---

## Section 8 — The new build order

Now that we have workspace-level awareness, re-order the build plan from `02-dashboard-improvements.md`:

### Week 1 — Foundation: Goals + Workspace Graph
- **NEW** — Pillars/goals table + `/goals` page (define your 9 pillars, edit them)
- **NEW** — `workspace_projects` table + Workspace Scanner agent (reads projects.json + folders + LOG.md)
- **NEW** — `/projects` page with resumption cards
- **Idea Inbox** (ticket #1) — captures go into the graph tagged with suggested pillar/project

### Week 2 — Integration: Consolidate the dashboards
- Wire `dashboard/` → cunhas-brain sync
- Wire `openclaw/` → cunhas-brain Idea Inbox
- Auto-link meetings/notes/ideas → projects (via Claude-based matching)

### Week 3 — Rituals: Daily + Weekly loops
- Daily Brief (ticket #2) — includes pillar progress + orphan mention
- Weekly Review (ticket #11) — includes orphan sweep
- Meeting Prep (ticket #3)

### Week 4 — Views: Projects, People, Content
- Project Tracker (ticket #6) — now upgraded with workspace integration
- People CRM (ticket #7)
- Content Production Pipeline (ticket #9)

### Week 5+ — Output, Agents, Voice
(Same as `02-dashboard-improvements.md` from this point)

---

## Section 9 — What to do with the 4 "parallel" projects

The four projects building similar primitives (`cunhas-brain`, `personal/mobile-agent`, `personal/obsidian`, `openclaw`) share 80% of the functionality. You're building them in parallel. **Consolidate or declare different roles.**

**Recommendation**:

- **`cunhas-brain/`** — keep as the canonical personal OS. Everything flows here. Web-first, Next.js on Vercel.
- **`personal/mobile-agent/`** — **archive or repurpose**. If you want mobile, make it a thin React Native shell that talks to cunhas-brain's API. Don't rebuild the brain layer.
- **`personal/obsidian/`** — **narrow the scope**. This becomes the "export to Obsidian vault" script that syncs cunhas-brain's Knowledge Base. Not a full app.
- **`openclaw/`** — **keep as the messaging bridge**. Its unique value is the 220K-star-upstream codebase connecting to WhatsApp/Telegram/Discord. Don't try to build a second brain in openclaw. Treat it as an input/output bridge: receives messages → forwards to cunhas-brain API; listens for cunhas-brain events → sends messages.

This gives you a clean responsibility split:
- **cunhas-brain** = brain (data, logic, UI)
- **openclaw** = messaging I/O
- **obsidian vault** = portable markdown export
- **mobile-agent** = archive (or light mobile shell later)

And saves you from maintaining 4 parallel implementations.

---

## Section 10 — Starting point for your yearly goals table

Here's a SQL seed you can run right now to bootstrap the pillars table (you can edit these in the `/goals` page once it exists — improvements doc week 1):

```sql
INSERT INTO pillars (slug, title, description, year, priority, target_metric, target_value) VALUES
('ai-voice-at-oracle', 'Become #1 internal AI voice at Oracle/NetSuite',
 'Articles, talks, demos, leadership newsletters, expanded AI Champions group.',
 2026, 1, 'published pieces / quarter', '8'),

('data-quality-ai-suiteapp', 'Ship Data Quality for AI SuiteApp',
 'Productize ai-readiness + business-classification + context into a shipped customer-facing SuiteApp.',
 2026, 1, 'paying or pilot customers', '3'),

('personal-ai-os', 'Build and live inside the Personal AI Operating System',
 'Cunha''s Brain + extensions as daily driver for capture, review, output.',
 2026, 1, 'daily active days', '300'),

('autonomous-finance', 'Autonomous Finance SuiteApp',
 'Turn finance-department into a saleable product.',
 2026, 2, 'internal pilot or first sale', '1'),

('ship-personal-product', 'Ship one personal product publicly',
 'Pick ONE of BBB Infinito / Digital Studiolo / Automaton / Mobile Agent and ship it publicly.',
 2026, 2, 'live URL with real users', '1'),

('thought-leadership-output', 'Publish regularly as a thinker',
 'Monthly newsletter, 1-2 articles/month, experimental podcast.',
 2026, 1, 'pieces published / month', '3'),

('foundational-knowledge', 'Build foundational knowledge',
 'Karpathy LLM Wiki, Anthropic Managed Agents, Brazilian literature, Paulo Freire, philosophy.',
 2026, 2, 'completed books + courses', '6'),

('relationships-cultivation', 'Cultivate relationships deliberately',
 'Karl, Tom, Joe, Arthur, Oracle Education, Larry, Brazilian journalists, Duval.',
 2026, 2, 'intentional conversations / month', '10'),

('health-social-presence', 'Health, social life, presence',
 'Office, social life, book club, café filosofia.',
 2026, 2, 'social events / month', '4');
```

---

## Section 11 — What changes for you this weekend

You don't need to build all of this this weekend. You need to:

1. **Read this file, then edit the 9 pillars** in Section 3 to reflect what's actually in your head. The pillars are the organizing principle — get them right.

2. **Block 90 min to inventory the workspace together with me** — I'll walk through each folder with you, you say "active / pause / archive / merge" on each, we update `projects.json` with the decisions. This is ownership.

3. **Declare the 4 dashboards' roles** per Section 9. Commit to consolidation or explicit specialization. No more parallel half-finished implementations.

4. **Build the pillars table + workspace_projects table** in cunhas-brain — 1 hour of DB work + a basic `/goals` page. This unlocks everything else.

5. **Run the Workspace Scanner agent once** (even as a one-shot script) to populate `workspace_projects` — you'll immediately see the full state of your portfolio.

That's it. 3-4 hours of work, and you have the foundation for the whole rest of the plan in `02-` and `03-`.

---

## Closing

Your workspace isn't a graveyard. It's a **world-class portfolio that has no organizing layer**. You have more shipped software than most engineers. You have a daily job at a massive company. You have personal research projects. You have a thesis. What you're missing is the **index** — the thing that tells you where you are, what's next, and why it matters.

Cunha's Brain is that index. But it needs to know about the whole workspace, not just your meetings.

The plan:
- **`01-notes-summary-and-recommendations.md`** — what to do with your brain dump → actions
- **`02-dashboard-improvements.md`** — tickets to build the missing views
- **`03-personal-ai-os-deep-research.md`** — the full agent society vision
- **`04-workspace-integration-and-yearly-goals.md`** (this file) — make the whole workspace part of the system, with pillars driving priority

Start with **this file** on Saturday morning. Edit the pillars. Inventory the projects. Then the other three docs become executable.
