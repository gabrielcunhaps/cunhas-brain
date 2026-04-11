# Brain Dump 2026-04-10 — Summary & Recommendations

This is an analysis of Gabriel's brain-dump notes from the evening of 2026-04-09, organized into themes and mapped against the current Cunha's Brain implementation (`cunhas-brain/`).

**The meta-observation**: You have an incredible amount of work-in-flight that spans NetSuite/Oracle work, personal SaaS product ideas, thought-leadership ambitions, personal projects (music, podcast, café filosofia), learning goals (Brazilian literature, Karpathy, Managed Agents), and a META-goal to become the world's best AI communicator. You explicitly named ADHD as a constraint and identified that **you need an enforcement/capture system** or none of this lands.

**The good news**: Cunha's Brain already has most of the primitives you need. You're not starting from zero — you need to wire the existing pieces into daily rituals and add 3-4 specific missing surfaces.

---

## Themes (what your notes actually contain)

### A. NetSuite/Oracle Work — the job
This is your biggest block. It's everything you do for Oracle:

**AI Recap & Knowledge Distribution**
- Expand the AI Club / expand the AI Recap group
- Optimize knowledge distribution across the organization
- Turn AI Recap into an Oracle AI Newsletter
- Create a monthly leadership newsletter based on AI Recap meetings
- Streamline slide generation + newsletter generation
- "Have great prompts" — you know the whole pipeline lives or dies on prompts

**Customer-facing projects**
- **AI Data Readiness project with Tom Kelly** — deploy functional solution
- **Data Quality for AI SuiteApp** — build this
- Weekly demo cadence ("I need an incredible new solution to demo every week")
- Practice for new demo

**Thought leadership & communication**
- SuiteAgents with Tom — talk track + slides
- Article to publish with Joe
- Email to leadership on AI strategy (based on AI Recap meetings)
- Refactor talk track
- Build an "argument library" — be the best AI communicator in history

**Internal / prep**
- Meeting with Karl this week
- NetSuite KT sessions — things to remember for next meeting
- Something for enablement
- Harness → send email to Recap group

**Career / strategic conversations**
- Talk to Oracle Education lead about experimental class
- Ask Arthur about visa + Oracle↔Luzid situation
- Talk to Larry Ellison
- Talk to journalists

### B. Personal SaaS & product ideas
- **Autonomous Finance SuiteApp**
- **Data Quality for AI SuiteApp** (also appears under work)
- **Consultoria de IA em escala SuiteApp**
- **Augmentation Product Development Framework**
- Process for autonomous product development
- **BBB Virtual game** — create AI personalities, watch them compete in a reality show format (this is a whole viral app idea)

### C. Personal projects (creative)
- Make your music
- Do a podcast (for training communication)
- **Café com Filosofia** in Brazil or the US
- **Book club, recorded**, talking about AI in a different format
- Content production machine (AI-driven)
- Review all your code projects in folders
- Experimental Preply class
- Do sales projects

### D. Learning & reading — you're falling behind
- Brazilian literature / Paulo Freire / Mendeley
- Read newsletters (backlog)
- **Watch Karpathy LLM Wiki**
- **Study Anthropic Managed Agents**
- Watch tiktok you bookmarked (maisumahistoriaz)
- Read your books / magazines

You said: *"Preciso da base de conhecimento FORTE primeiro. Construir base e knowledge graphs PRIMEIRO."* — You want the knowledge foundation before the output.

### E. People & relationships
- Karl (this week)
- Tom Kelly (AI Data Readiness)
- Tom (SuiteAgents)
- Joe (article)
- Arthur (visa/Luzid)
- Oracle Education lead
- Larry Ellison
- Journalists (multiple, BR and US)
- Duval + "cara no Brasil"
- Preply students

### F. Personal operating system (META)
This is what you're asking me to help build. Direct quotes:
- *"Colocar tudo isso no Claude para me organizar"*
- *"Comprar um monitor. Eu coloco Claude com voz me perguntando todo dia e tendo um rosto"*
- *"Preciso de enforcement para fazer as coisas"*
- *"DESENHAR A ARQUITETURA"*
- *"PRECISA PEGAR MINHAS IDEIAS E FAZER AS COISAS PRA MIM E FAZER EU REVISAR TODOS OS DIAS. TORNAR ENGAJANTE PRA ALGUEM COM TDH"*
- *"Fazer disso uma plataforma de organização pessoal: DE IDEIA PARA PRODUTO. Assistente pessoal mais otimizado"*
- *"Forma de capturar ideias e ir direto para criação com IA. Nova forma de trabalho"*
- *"Me tornar referência nisso e fazer comunicação"*

You want: capture → organize → review daily → build automatically → publish. An ADHD-friendly second brain that *does work for you*.

### G. Social & lifestyle
- Go out, have social life
- Go to the office, be present
- Be present in group chats with ideas
- Talk to people more

### H. Meta-vision
- *"Biliionario com IA de uma pessoa"* — one-person AI company
- Become the reference in AI communication
- Turn your product team into an AI research assistant for your posts

---

## How this maps to the current Cunha's Brain

The existing app already has the right bones. Here's where each theme lands:

| Theme / Need | Existing feature | Status |
|---|---|---|
| NetSuite KT reminders | `src/app/api/meetings/[id]/categorize` + `netsuite_kt_reminders` table | **Built** — need a view to surface them before next meeting |
| Meeting with Karl prep | `TodaysMeetings` + Manager 1:1 category | **Built** — need to classify historical meetings |
| Customer insights catalog | `customer_insights` table + metadata index | **Built** — need a browser view |
| Article drafting / thought leadership | `KnowledgeBase` wikilinks + `ChatInterface` metadata search | **Partial** — need a content pipeline |
| AI Recap / Newsletter generation | `Newsletters` tab + industry-recap prompt | **Partial** — need output to slides + email |
| Product ideas backlog | Dashboard `todos` + meeting action items | **Missing a dedicated backlog** |
| Personal projects tracker | — | **Missing** |
| Reading queue (books + newsletters) | `Newsletters` tab only covers Inoreader | **Partial** |
| People CRM (Karl, Tom, Joe, Arthur...) | — | **Missing** |
| Daily review ritual | `scripts/notifier.js` (popup on new meeting) | **Missing ritual** — notifier fires ad-hoc |
| Knowledge graph / Obsidian | `KnowledgeBase` with wikilinks + `knowledge_edges` | **Built** — needs meeting ingestion |
| Ideas → prototype pipeline | `Artifacts` tab | **Built** — needs a trigger from ideas |
| Talk track / argument library | — | **Missing** |
| Voice assistant with "face" | — | **Missing** |

Bold observation: you're **3-4 missing surfaces** away from your vision. Not 30.

---

## Top 12 concrete next actions (ranked)

These are things you can do in the next 1-2 weeks that will unlock the most leverage:

1. **Classify all your historical meetings** — run `POST /api/meetings/reindex-metadata` (exists) and go through the dashboard, clicking the right category pill on each untagged meeting. This lights up the Manager 1:1, Customer, NetSuite KT pipelines with real data.
2. **Save your NetSuite KT reminders somewhere visible** — build a `/prep` page that shows pending reminders from `netsuite_kt_reminders` before your next KT meeting. (See improvements doc item #3.)
3. **Put Karl's meeting on the calendar and pre-populate the Manager 1:1 prep** — manually add an upcoming entry and run the Manager prompt against your previous 1:1 transcripts so you walk in with a briefing.
4. **Build a People CRM page** — add a lightweight `people` table and a `/people` page where each row is Karl, Tom, Joe, Arthur, etc. with last contact date + next action + open topics. (See improvements doc item #7.)
5. **Ingest your Notion notes into the Knowledge Base** — the `/knowledge` tab already supports bulk markdown upload. Export your Notion workspace as markdown and dump it in.
6. **Ingest your meeting transcripts into the Knowledge Base** — build an auto-linker that turns every meeting into a note in `notes` with auto-wikilinks to people, topics, and projects. This gives you one unified graph across meetings + notes. (See improvements doc item #4.)
7. **Create the "Idea Inbox"** — a single text field on the dashboard where you dump any thought. AI auto-categorizes (work/product/personal/learning) and routes it. (See improvements doc item #1.)
8. **Set up a daily morning brief** — leverage the existing `scripts/notifier.js` + a new `/api/daily-brief` cron that generates a personalized prep for the day (today's meetings + pending todos + reading queue + top 3 priorities) and fires it at 08:00 local. (See improvements doc item #2.)
9. **Build the AI Recap → Newsletter pipeline** — take the existing industry-recap prompt (`src/lib/categoryPrompts.ts`) and add a "generate newsletter draft" button in the Newsletters tab that outputs publishable markdown + email format. (See improvements doc item #9.)
10. **Build a Talk Track / Argument Library** — new tab `/talks` where each talk is a markdown document with sections (hook, problem, agitation, solution, proof, ask). Link to Knowledge Base for supporting facts. (See improvements doc item #8.)
11. **Wire the voice assistant** — extend `scripts/notifier.js` to read the morning brief via macOS `say` or ElevenLabs, and accept a voice reply via Whisper. (See doc #3 — Personal AI OS, Phase 4.)
12. **Schedule the conversations you keep postponing** — Arthur (visa), Oracle Education lead, Larry Ellison, the Brazilian journalists. The app won't help you until you put them on the calendar. Block 30 minutes right now.

---

## Quick-win recommendations per theme

### A. NetSuite/Oracle Work
- **Re-use what exists**: every Oracle-facing meeting goes through the existing category system. NetSuite KT extracts reminders, Manager 1:1 extracts priorities/todos, Customer extracts use cases/questions/objections. You already have this — it's not running on historical data.
- **One-click demo**: when you run a weekly demo, upload your demo script as a `Knowledge Base` note with tag `#demo` and link to the `Artifacts` tab for live preview. Every demo becomes a reusable artifact.
- **AI Recap pipeline**: we build a single prompt template in Settings → Prompts → "AI Recap Newsletter" that takes the last N AI Recap meetings and outputs: (1) executive summary, (2) 3-5 key insights, (3) action items, (4) email-ready HTML. One click in the Newsletters tab.
- **Argument Library**: every time you articulate something well in a meeting, tag the transcript segment. A new `/talks` page aggregates these by topic.

### B. SaaS/Product ideas
- **Ideas Backlog table**: new `product_ideas` table + `/ideas` page. Each idea gets: title, problem, one-liner, target customer, status, next-step. You capture via the Idea Inbox; AI classifies and pushes to this page.
- **From idea to Artifact**: each idea has a "Prototype" button that pre-fills the `Artifacts` tab upload modal with an AI-generated HTML demo based on your one-liner. You can iterate in Claude Code from there.
- **Autonomous Finance SuiteApp** and **Data Quality for AI SuiteApp** are the two concrete ones that need a project page each. Create them now in the Project tracker (see doc #2 improvement #6).

### C. Personal creative projects
- **Music**: create a `#music` tag in Knowledge Base. Every song idea becomes a note with lyrics, references, status.
- **Podcast**: same pattern — `#podcast`. Each episode idea is a note. Link to relevant AI meetings for source material.
- **Café com Filosofia**: create a `project:cafe-filosofia` tag. Gather references, potential guests, topic ideas as notes.
- **Book club**: create a `project:book-club` tag. Store episode plans.
- **BBB Virtual**: this is a whole app idea. Create an `ideas/bbb-virtual.md` note with the concept, then spin up an `Artifacts` prototype to explore the interaction model.

### D. Learning & reading
- **Reading Queue page**: `/reading` — a single list with: books, newsletters, videos, articles. AI prioritizes based on your declared focus areas (AI strategy, communication, Brazilian lit).
- **Newsletter digest**: your Newsletters tab already pulls Inoreader. Add a "Mark as read" + "extract key learnings" action that saves to Knowledge Base.
- **Karpathy LLM Wiki / Managed Agents**: block 90 minutes on the calendar **this week**. Watch it. Take notes directly in the Knowledge Base (`/knowledge`). Tag `#study #llm #karpathy`.

### E. People & relationships
- **People CRM** (new): `/people`. For each person: role, last contact, open topics, next action, linked meetings. Auto-populated from meeting speakers when you click their name.
- **Nudge list**: every Monday morning, the daily brief suggests 3 people you haven't talked to in a while.
- **Follow-up emails**: draft email to leadership on AI strategy can be generated from the Manager 1:1 + AI Recap metadata directly. No need to write from scratch.

### F. Personal Operating System (META)
This is a whole doc — see `03-personal-ai-os-deep-research.md`. Short version: the missing primitives are **capture** (voice, browser, hotkey), **enforcement** (voice check-ins + nudges), **review** (daily/weekly rituals), and **output** (newsletter, slides, emails auto-drafted).

### G. Social & lifestyle
Cunha's Brain can't make you go to a party. But it can:
- Add a `/social` widget on dashboard showing "Days since last hangout"
- Nudge you in the morning brief: "You haven't been to the office in X days"
- Track group-chat engagement as a metric

### H. Meta-vision
*"Bilionário com IA de uma pessoa"*. Every decision: does this compound? The cunhas-brain platform is your compounding engine. Every meeting feeds it. Every note feeds it. Every newsletter output feeds the next one. Protect the ingestion loop above all else.

---

## What's missing from cunhas-brain that this brain dump makes obvious

In priority order:

1. **Idea Inbox** — single capture surface on dashboard
2. **Daily Brief / Morning Ritual** — scheduled, personalized, read aloud
3. **People CRM** — tracks your relationships
4. **Meeting Prep page** — pre-meeting briefings using KT reminders + past context
5. **Content Production Pipeline** — idea → outline → draft → publish workflow
6. **Project Tracker** — SaaS ideas, personal projects, work projects in one place
7. **Reading Queue** — books + newsletters + videos in one inbox
8. **Talk Track / Argument Library** — reusable communication building blocks
9. **Voice-in/Voice-out** — the "face" Gabriel asked for
10. **Obsidian vault sync** — two-way markdown sync so your laptop = the graph
11. **Auto-ingest meetings into Knowledge Base** — every meeting becomes a linked note
12. **Weekly review** — Friday evening summary: what shipped, what stalled, what's next

These are all concrete code tasks. See `02-dashboard-improvements.md` for the build plan.

---

## Final take

You don't need more tools. You need:
1. **Ruthless ingestion** — everything you think, say, read goes into one place. (Cunha's Brain is that place.)
2. **Non-negotiable rituals** — morning brief, weekly review. Enforced by voice + popup.
3. **Agent-driven output** — articles, newsletters, slides, emails drafted automatically from the ingestion.
4. **One declared thesis** — "The world's best AI communicator, from one person at Oracle, automating their own outbound." Protect this thesis. Every feature you add, ask: does it serve the thesis?

The rest of this `docs/` folder has:
- `02-dashboard-improvements.md` — concrete tickets to build the missing surfaces
- `03-personal-ai-os-deep-research.md` — the deeper architectural vision inspired by Karpathy, Obsidian, and Anthropic Managed Agents
