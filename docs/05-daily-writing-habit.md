# The Daily Writing Habit — Micro-Articles as the Daily Ritual

> You said: *"I need to write every day. I need to be writing about an idea, and I need to develop this thing of writing. I actually have a list of multiple micro article ideas that I just need to start writing those micro articles every day, adding new micro articles to be added."*

This is the single most important habit you can install right now. It aligns with your **#1 pillar** (become the #1 internal AI voice at Oracle) AND your **#6 pillar** (publish regularly as a thinker). And it's the one thing you can start tomorrow with zero infrastructure.

This doc is the micro-article system: the data model, the UI, the ritual, and the first-week starter pack. Short and actionable on purpose — unlike `03` which is the 12-month vision, **this one you can build in one evening**.

---

## Section 1 — The concept

A **micro-article** is a piece of writing that fits these rules:
- **200-500 words** (you can read it in 60-90 seconds)
- **One idea** — a single insight, argument, observation, or question
- **One opinion** — not neutral reporting. You have a take.
- **Publishable in isolation** — it stands alone
- **Written in ~20 minutes** — no perfectionism

Formats: LinkedIn post, short essay, thread (X), newsletter blurb, blog post, talk track one-liner. They cross-post beautifully because they're short enough.

**Why micro-articles (and not full essays)**:
1. ADHD-friendly — 20-min time box is achievable
2. Compounds fast — 1/day = 365/year = a book's worth of ideas
3. Low stakes — shipping a micro-article is low-stress vs shipping a 2000-word essay
4. Sharpens thinking — forcing one idea per piece forces clarity
5. Builds the audience — consistent output beats sporadic brilliance

**Why now**: your existing content pipeline (ticket #9 in `02-dashboard-improvements.md`) is about big pieces. This is the lightweight lane. You need both.

---

## Section 2 — The ritual

### Daily micro-article ritual (20 minutes, non-negotiable)

**Time**: first 20 minutes after your morning brief, or 9-9:20 PM before bed. Pick ONE and stick to it.

**Steps**:
1. Morning brief shows you your top 3 queued micro-article ideas (prioritized by AI)
2. You pick one (or AI picks for you if you're decision-paralyzed)
3. Claude generates a scaffold: hook, argument, 1 supporting point, conclusion
4. You type your version over the scaffold — 200-500 words
5. One-click "Ship" → writes to Content Pipeline as status=draft OR status=published, depending on your choice
6. System logs: idea → written → shipped
7. Your streak counter goes up (gamified enforcement)

**Non-ritual rule**: you can add new micro-article ideas to the queue anytime. The Idea Inbox auto-detects `#micro` or a slash command `/ma`. Or voice: *"Add micro article idea: why most SuiteAgents demos miss the point"*.

### Weekend batch (optional, 60 min)

Every Saturday morning:
- Review the week's 5-7 published micro-articles
- Star the ones that resonated (based on your own feeling + any external signals)
- Cluster related micro-articles — if 3 are about "context engineering", that's an essay waiting to happen
- Promote 1-2 to the main Content Pipeline (ticket #9) for expansion into a full article

This is how you avoid losing the ones that matter.

---

## Section 3 — Feature spec for cunhas-brain

### 3.1 Database

New table:

```sql
CREATE TABLE micro_articles (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,              -- the idea in one line
  hook TEXT,                         -- optional first-line hook
  draft TEXT,                        -- the actual 200-500 word body
  word_count INT,
  tags TEXT[] DEFAULT '{}',
  source TEXT,                       -- 'brain-dump' | 'meeting' | 'voice' | 'manual'
  source_id INT,                     -- optional link back to meeting/idea/note
  status TEXT DEFAULT 'queued',      -- queued | writing | drafted | published | archived
  priority INT DEFAULT 0,            -- AI-suggested, user-overridable
  pillar_slugs TEXT[] DEFAULT '{}',  -- which yearly pillars this serves
  published_url TEXT,                -- if published
  published_to TEXT[],               -- ['linkedin', 'newsletter', 'x']
  created_at TIMESTAMPTZ DEFAULT NOW(),
  written_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ
);
CREATE INDEX idx_micro_articles_status ON micro_articles(status);
CREATE INDEX idx_micro_articles_priority ON micro_articles(priority DESC, created_at DESC);
```

New table for the streak:

```sql
CREATE TABLE writing_streak (
  id SERIAL PRIMARY KEY,
  date DATE UNIQUE NOT NULL,
  wrote BOOLEAN DEFAULT false,
  micro_article_id INT REFERENCES micro_articles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.2 API routes

```
GET  /api/micro-articles                    List, filter by status
POST /api/micro-articles                    Create (queue a new idea)
GET  /api/micro-articles/[id]               Full content
PUT  /api/micro-articles/[id]               Update (save draft, ship, etc.)
DELETE /api/micro-articles/[id]             Delete

POST /api/micro-articles/[id]/scaffold      Generate hook + outline via Claude
POST /api/micro-articles/[id]/ship          Mark as published, set status
POST /api/micro-articles/bulk-import        Paste a list of idea titles, creates multiple rows

GET  /api/writing-streak                    Current streak + history
POST /api/writing-streak/mark                Mark today as "wrote"

GET  /api/micro-articles/today              Top 3 suggestions for today's ritual
```

### 3.3 UI — the `/write` page

New page `src/app/write/page.tsx`. Single-purpose: the writing ritual.

**Layout**:
- **Top bar**: streak counter ("🔥 12 days"), total published count, this week's count
- **Left column** (~30%): queue of 10-20 idea titles, clickable, drag to reorder, "+" to add new
- **Center column** (~50%): the writing canvas
  - Big title input
  - Scaffold section (collapsible, shows AI-generated hook/outline)
  - Main textarea for the 200-500 word draft, live word count, soft warnings at >600 words
  - "Ship" button at the bottom
- **Right column** (~20%): source context — if this idea came from a meeting, show the meeting transcript snippet. If from a note, show the note. Helps avoid re-researching.

**Ritual triggers**:
- If you haven't written today, a red dot appears on the nav item
- The daily brief (ticket #2) includes "📝 Write today's micro-article" as action #1 if the streak is active
- If you miss 2 days in a row, an evening popup with a gentle nudge

**Shipping flow**:
1. Click "Ship"
2. Dialog: "Where to publish?" — checkboxes for LinkedIn, Newsletter, X, Blog, Internal Slack
3. For each selected platform, copy a platform-adapted version to clipboard (LinkedIn = plain text, X = thread, etc.)
4. After clicking "Confirm", writes to `micro_articles` with status=published, updates `writing_streak`

**AI scaffolding prompt** (stored in `app_settings.prompt_micro_scaffold`):

```
You are a writing coach helping Gabriel write a 200-500 word micro-article on this idea: "{title}"

Context (optional): {source_context}
Tags: {tags}
Pillar: {pillar_description}

Generate a scaffold he can type over:
1. A HOOK — one sharp opening line (not a throat-clear)
2. The CORE ARGUMENT — 1 sentence: what's the one thing this piece is saying?
3. ONE SUPPORTING POINT — what evidence/story/observation supports the argument?
4. A CLOSING LINE — either a reframe, a call to action, or a question

Return as JSON:
{
  "hook": "...",
  "coreArgument": "...",
  "supportingPoint": "...",
  "closingLine": "..."
}

Be direct. No filler. Gabriel's tone is confident, specific, slightly irreverent.
```

**Style guide** (stored in `app_settings.writing_style_guide`):
- Short sentences mixed with longer ones
- Specific nouns over abstractions
- First-person OK
- Examples > theories
- End with a reframe or a question, not a summary
- Never start with "In today's world..." or similar throat-clears

### 3.4 Integration with existing features

- **Idea Inbox** (ticket #1) — when you dump a brain dump, items classified as `content` get an additional subclassification: is this a **micro-article idea** or a **big-piece idea**? Micro ideas flow to `micro_articles` queue. Big ideas flow to `content_pieces`.
- **Meetings** — after classification, if a meeting contains a strong one-liner or insight, the Analyst agent can auto-suggest a micro-article and queue it with `source=meeting`, `source_id=<meeting.id>`.
- **Knowledge Base** — each published micro-article also becomes a note in `/knowledge` tagged `#published #micro`. Wikilinks naturally connect related pieces.
- **Daily Brief** — if today's ritual isn't done, the brief surfaces the top 3 queued ideas and a "Start writing" button.
- **Weekly Review** — shows this week's shipped micro-articles, prompts you to cluster them, offers to promote one to a full essay.

---

## Section 4 — The starter pack (your first 20 ideas)

Based on your brain dump and workspace, here are **20 micro-article ideas you can queue tonight**. Some are direct from your notes, some are implied. Pick the ones that click.

**About AI at NetSuite/Oracle**
1. *"Why most SuiteAgents demos miss the point"* — what customers actually ask vs what vendors show
2. *"The AI Data Readiness checklist nobody talks about"* — 6 dimensions from your `ai-readiness` project
3. *"Why your ERP data isn't ready for AI (and what to do in 90 days)"*
4. *"The 149 agents vs 10 skilled agents debate"* — from your `autonomous-department` work
5. *"Context is all you need" — a NetSuite builder's answer to prompt engineering*
6. *"What Brazilian tax rules taught me about AI classification"* — from `brazil-tax`

**About personal AI OS**
7. *"I'm building my own second brain and here's what I got wrong"* — failure mode from cunhas-brain
8. *"Why voice-first is the only enforcement layer that works for ADHD"*
9. *"Three kinds of memory your AI agents need (and why most get it wrong)"*
10. *"Obsidian is great but it's missing the agents"*
11. *"The meeting → knowledge graph pipeline, end to end"*

**About communication & thought leadership**
12. *"The argument library: how I'm replacing my memory with a database"*
13. *"Stop writing think-pieces. Write 300-word takes."* — meta about this whole system
14. *"Why I send one email to leadership every month"*
15. *"The demo you build is the product you sell"*

**About research & ideas**
16. *"Karpathy was right: LLMs are the new OS"*
17. *"What Paulo Freire teaches us about AI-era pedagogy"* (personal — Brazilian lit angle)
18. *"The one-person billion-dollar company meme is actually tractable"*
19. *"BBB Infinito as an experiment in AI narrative"* (personal product angle)

**About process & workflow**
20. *"How I went from 4 parallel dashboards to 1 — a consolidation story"*

Copy-paste these into the `/write` page → Bulk Import once it exists. Until then, save to a note in `/knowledge` tagged `#micro-queue`.

---

## Section 5 — The first week

### Monday — Build the minimum
- 2 hours: create `micro_articles` table, basic `/write` page with list + textarea + "Ship" button
- Seed the 20 ideas above
- Write your first micro-article. Doesn't matter which one. Ship it.

### Tuesday — Streak kicks in
- Morning brief shows "📝 Write today's micro-article — streak: 1 day"
- 20-minute ritual
- Ship

### Wednesday — Add scaffolding
- 1 hour: add `/api/micro-articles/[id]/scaffold` that calls Claude with the scaffold prompt
- "Generate scaffold" button in the UI
- Now you're typing *over* a scaffold, not from scratch. Speed doubles.

### Thursday-Friday — Keep shipping
- Ritual
- Add ideas as you think of them

### Saturday — Weekend batch
- 30 min review
- Cluster the week's pieces
- Promote 1 to the main Content Pipeline for expansion
- Add 3-5 new ideas to the queue

### Sunday — Rest
- Optional: read your own week's articles
- Notice patterns

### Goal for week 1: **5 shipped micro-articles**. Not 7 — that's unrealistic and breaks ADHD-friendly loose consistency. 5 is great.

---

## Section 6 — Publishing destinations

You don't need to build native integrations. Manual copy-paste is fine.

**Tier 1 — Always publish to** (platform-adapted):
- **LinkedIn** — your biggest internal audience
- **Internal Slack #ai-champions or similar** — your inner circle, highest signal feedback

**Tier 2 — Based on content type**:
- **X/Twitter** — hot takes, threads
- **Your Oracle AI Newsletter** — direct reader, scheduled
- **Blog / Personal site** — stretch goal, can wait until you have 30+ pieces

**Tier 3 — Later**:
- Medium / Substack
- Hacker News (for the spiciest takes only)
- Podcast notes → turn into episodes (pillar #5)

**Rule**: publish to at least ONE destination every day. Don't sit on drafts.

---

## Section 7 — Why this works (for you specifically)

Gabriel-specific analysis:

1. **ADHD loves micro-commitments**. "Write 20 minutes, one idea" is infinitely more achievable than "write an essay this week". You can always find 20 minutes.

2. **Streaks are dopamine hits**. The 🔥 counter + the daily brief mentioning it creates a gentle gamification loop that ADHD brains respond to well.

3. **Your pillars need output**. Pillar #1 (AI voice at Oracle) and Pillar #6 (publish as thinker) require **shipped pieces**, not drafts. Micro-articles are the ship-volume engine.

4. **You already have the ideas**. Your brain dump + workspace is **overflowing** with takes. The bottleneck isn't ideas. It's the capture-to-ship loop. This system IS that loop.

5. **Meeting transcripts become articles**. The Analyst agent can auto-suggest micro-article ideas from your meetings. Every KT, every customer meeting, every manager 1:1 is a potential insight waiting to be extracted.

6. **It compounds**. 5/week × 50 weeks = 250 shipped pieces in a year. By December 2026 you have a body of work. That's how you become the #1 AI voice: volume + consistency + density of insight.

7. **It rehearses arguments**. Many of these micro-articles become talking points in real meetings. You're training your own communication while shipping external output.

---

## Section 8 — Implementation TL;DR (for the build queue)

Add this as a new ticket to `02-dashboard-improvements.md`:

> **Ticket #16 — Daily Writing System (micro-articles)**
>
> **New page**: `/write` — 3-column layout (queue | canvas | context)
> **New tables**: `micro_articles`, `writing_streak`
> **New API routes**: `/api/micro-articles/*`, `/api/writing-streak/*`
> **New component**: `src/components/WriteCanvas.tsx`
> **New agent task**: Analyst auto-suggests micro-articles from meetings
> **Integrations**: Idea Inbox routes `#micro` ideas here; Daily Brief surfaces top 3 queued; Weekly Review shows shipped + promotes one
>
> **Effort**: M (core) + S (scaffolding) + S (weekly review integration)
> **Impact**: 5 — direct lever for your #1 and #6 pillars

Put this at Week 1 of the build order in `04-workspace-integration-and-yearly-goals.md`. It's high-impact AND low-effort AND it starts producing value on day 1.

---

## Closing

You don't have a writing problem. You have a **shipping loop** problem. The words are in your head, in your meetings, in your notes. What's missing is the 20-minute daily container and the one-click publish.

Build the container. Install the ritual. Ship 5 this week. Ship 250 this year. Watch your communication skill compound while the system handles capture, scaffolding, and distribution.

The thesis: *"world's best AI communicator"*. The mechanism: **one micro-article every day, non-negotiable**. The platform: cunhas-brain + `/write`. The starter pack: 20 ideas above.

Start Monday.
