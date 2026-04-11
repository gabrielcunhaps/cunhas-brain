# Personal ERP for Life Management — Architecture Research

> A first-principles architecture proposal for a personal ERP that integrates with LLMs and AI agents. This document is deliberately opinionated. It is not a status report on what exists; it is a design for what *should* exist.

**Scope**: ontology, data model, categorization, agent surface, lifecycles, sourcing strategy, phased migration, open questions.

**Audience**: Gabriel (founder, ADHD, Oracle AI communicator, one-person-AI-billionaire ambition), and whoever he hands this to — future him, Claude, or a collaborator.

**Style contract**: dense, direct, cites sources, ASCII diagrams, real data from Gabriel's workspace whenever possible, no fluff. Assumes the reader is fluent in SQL, graph databases, LLMs, and product strategy.

---

## Table of Contents

1. The problem, reframed
2. Research findings (prior art)
3. Core entities — the ontology
4. Categorization model — nested, faceted, both
5. The data model — schema, storage choices, scale
6. Agent access patterns — the MCP surface
7. Lifecycle and state machines
8. Event sourcing vs mutable records — the hybrid defense
9. Nested categories, concretely (the user's explicit ask)
10. People as first-class entities
11. Integration with existing cunhas-brain and idea-crm
12. Phased rollout — three phases, zero downtime
13. Risks, unknowns, failure modes
14. Concrete architectural decisions the user must make

---

## 1. The problem, reframed

### 1.1 The one-sentence version

> Gabriel wants a single personal database of his entire life — goals, work, ideas, commitments, people, artifacts, observations — such that (a) he never loses an idea, (b) he can navigate everything by its place in nested categories, (c) AI agents can read, write, and act on every node on his behalf, and (d) the system compounds year over year instead of collapsing into a graveyard like his current 30-project workspace.

That is a much bigger ambition than a note-taking app. "Personal ERP" is the right frame, because:

- **ERPs are systems of record, not systems of capture.** A note app lets you *write things down*. An ERP lets you *look things up with confidence*. Gabriel already captures (Krisp, brain dumps, Notion, WhatsApp). He does not have a trustworthy system of record.
- **ERPs model the business as a graph of master data and transactional data.** Master data = the durable objects (Customer, Vendor, Item, Account). Transactional data = the events that happen to them (Sales Order, Invoice, Receipt, Journal Entry). A personal ERP needs the same split: the durable objects of a life (People, Projects, Goals, Places, Commitments) and the events that happen to them (Meetings, Ideas, Observations, Messages, Decisions).
- **ERPs enforce lifecycle discipline.** A sales order moves from draft → approved → fulfilled → invoiced → paid. Trying to skip a step fails. Personal systems that don't enforce lifecycles rot. Gabriel's failure mode is exactly this: capture works, but nothing ever moves to "done" or "killed," so everything hangs in purgatory.
- **ERPs have roles, workflows, approvals, audit trails, and reporting rollups.** A personal ERP needs agent-roles, agent-workflows, agent-approvals, immutable history, and pillar-level rollups. Sound familiar? It is a one-person ERP where the "users" are mostly agents.

### 1.2 Jobs to be done

Phrased as concrete user outcomes, ordered by importance:

| # | Job | Success looks like |
|---|---|---|
| JTBD-01 | Capture any thought/commitment/observation in <10s from any surface. | Voice, keyboard, browser, terminal, chat all write to the same inbox. Nothing is lost. |
| JTBD-02 | Find any prior piece of information by any dimension — topic, person, project, time, mood. | Faceted search returns the right result in ≤2 clicks. No "where did I put that?" |
| JTBD-03 | Know *right now* the state of every pillar, project, and obligation — what's moving, what's stuck, what's orphaned. | A single dashboard that answers "what's alive?" in 30 seconds. |
| JTBD-04 | Never let a commitment to a person silently rot. | The system reminds me about Arthur's visa conversation before it goes cold. |
| JTBD-05 | Move an idea through stages from raw → refined → committed → shipped without manual ceremony. | A raw note becomes a draft article with one click; a draft becomes a prototype with one click. |
| JTBD-06 | Let AI agents act on my behalf: research, draft, nudge, propose, prototype. | Agents read the graph, write back, and their writes are attributable and reversible. |
| JTBD-07 | Trace how thinking evolved over time — why I believed X in January and Y in April. | Every important record has a replayable history. |
| JTBD-08 | Compound. Every year of data makes the next year smarter. | Today's research note feeds next month's article feeds next year's talk feeds the decade's book. |
| JTBD-09 | Survive migrations, tool changes, SaaS shutdowns. I own my data forever. | Exportable, open formats, sane schema, no vendor lock-in. |
| JTBD-10 | Be ADHD-proof. Low-ceremony capture, aggressive surfacing, decisions forced. | Ambient reminders, single-question review loops, no "empty inbox anxiety". |

A system that solves 1, 2, 6, and 8 and fails at 3, 4, 5, 7, 9, 10 is useless. All ten are load-bearing.

### 1.3 What makes this hard

- **Object-relational impedance between "note" and "record".** A meeting transcript is a document. But the commitments *inside* that meeting are records. So is the person mentioned. So is the project discussed. One piece of input produces many objects.
- **Agents need structure; humans need freedom.** Structure makes it hard to dump raw thoughts; freedom makes it hard to query or act. The system must support both.
- **Categories change.** Gabriel's 2026 pillars are not his 2027 pillars. Today's "product idea" is next year's "shipped product". The taxonomy must be a living object, not concrete.
- **People are both subjects and relationships.** Karl is a person (subject) and Karl is also the relationship "Gabriel → manager → Karl" (edge). You need both.
- **ADHD.** Any system that requires daily upkeep to stay useful will fail. The system must degrade gracefully and nag the user into health.

---

## 2. Research findings (prior art)

Short, concrete readings of each source I consulted. Citations at the end of each subsection. Full URLs are collected in the **Sources** block at the end of this document.

### 2.1 Actual ERPs — NetSuite, ERPNext, Odoo, SAP

**NetSuite record model.** NetSuite classifies every object into one of four buckets: *Entities* (Customer, Vendor, Employee, Partner), *Items* (Inventory, Service, Kit, Bundle), *Transactions* (Sales Order, Invoice, Bill, Journal), and *Supporting* (Subsidiary, Department, Location, Class). Every record type has a fixed set of core fields plus customizable "custom fields" and "custom record types" (CRM). Master data is mutable but versioned via an audit log. Transactional data is append-only (you reverse an invoice with a credit memo, you don't edit the invoice). The power comes from the unified join model — every record can reference every other record through a small set of typed link fields.

*Takeaway for personal ERP*: the **Master data / Transactional data split** is the single most important ERP idea to steal. People, Projects, Goals, Places are *master data* — they persist, they mutate slowly, they have a canonical identity. Meetings, Ideas, Observations, Decisions, Messages are *transactional data* — they are events in time, they attach to master data, they are immutable once closed.

**ERPNext DocTypes.** Frappe/ERPNext exposes a meta-model called DocType: every entity in the system (Customer, Item, Invoice, even custom ones you create) is defined as a DocType, which is a metadata record describing the fields, child tables, permissions, validations, and UI of the entity. Creating a new DocType auto-generates the database table, REST API, and form UI.

*Takeaway*: the **meta-schema** pattern is exactly what a personal ERP needs. Gabriel's taxonomy will evolve. If the schema itself is data, then "add a new entity type" is a user-facing operation, not a migration.

**Odoo.** Similar idea — every entity is a Python class inheriting from `models.Model`, with ORM-defined fields and relationships. More rigid than Frappe (you write code, not metadata) but still follows the "everything is an entity type" pattern.

*Takeaway*: pick Frappe-style meta-schema over Odoo-style codegen. The personal ERP must be definable by the user, in the user's UI, in seconds.

**SAP.** SAP's R/3 model is the ancestor of all of this. The three-tier distinction — **master data**, **transactional data**, **configuration data** — maps almost perfectly onto the personal ERP's needs. SAP also pioneered the idea of "organizational units" (Company Code, Plant, Storage Location) as scoping contexts. Gabriel's equivalent: **work vs personal**, then sub-contexts like Oracle, NetSuite, Personal Product, Writing, Relationships, Health.

*Sources*: NetSuite docs on record types and item master data; Frappe ERPNext DocType documentation; Frappe DocType development guide.

### 2.2 Notion, Tana, Obsidian, Roam, Capacities, Anytype, Reflect, Mem.ai

**Notion** — block-based. Everything is a block with a parent pointer. Databases are collections of blocks with a schema. The elegance is that the same block model renders as pages, databases, wikis, or nested structures. The weakness is that Notion databases are *flat relative to each other* — relations are bidirectional pointers but there is no native hierarchy of types, and no inheritance. You cannot say "every Person is also a Contact and also a Node in my graph". You rebuild that yourself.

*Takeaway*: the block model is too low-level for an ERP. You need typed entities with inheritance, not generic blocks.

**Tana** — supertags. A supertag is a named class: `#person`, `#project`, `#meeting`. You apply a supertag to any node, and the node inherits a template (default fields, default children, default views). This is object-oriented note-taking: classes, instances, and (limited) composition. You can query across all instances of a supertag as a table or a graph.

*Takeaway*: **supertags = classes**. This is the right mental model. A personal ERP should have typed entities where the type itself is a first-class record (DocType in ERPNext vocabulary, supertag in Tana vocabulary, class in OOP vocabulary). Tana's limitation is nested field auto-initialization and query generalization, plus it's a SaaS.

**Obsidian + Dataview.** Obsidian is markdown files with wikilinks. Dataview is a plugin that indexes YAML frontmatter and inline fields, then lets you run SQL-like queries over the vault. It scales to hundreds of thousands of notes. The killer feature is **the source of truth is the filesystem**: you own the markdown, tools come and go, the notes remain.

*Takeaway*: **files as truth, DB as index**. This is the right durability story. The ERP's system of record should be plain markdown files with YAML frontmatter, plus a derived SQL/graph/vector index that is always re-buildable from the files. If the app dies, the files survive.

**Roam Research.** The OG of outliner-based graphs. Every bullet is a block. `[[Links]]` create edges. Backlinks are automatic. Innovation was unbundling paragraphs into atomic blocks. Downside: no typed entities, no schemas. Everything is a bullet.

*Takeaway*: atomic blocks are a UX pattern, not an architecture. Steal the backlink idea, reject the "everything is a bullet" idea.

**Capacities.** Object-oriented note-taking: books, people, conversations, tools, articles are each first-class object types with their own schemas and views. Very similar spirit to Tana but with a more traditional page-per-object UX. Object-first beats file-first for most users.

*Takeaway*: **object-first UX over file-first UX**. Users don't think "open the file for Karl", they think "open Karl". The ERP's primary navigation should be by entity, not by file path.

**Anytype.** Local-first, encrypted, object-based, with a type inheritance model. Closest thing to "owning your own Tana". Its data model is essentially RDF-like: every object has a type, types form a hierarchy, objects have relations (not plain backlinks). Fully P2P-sync capable.

*Takeaway*: Anytype's type-inheritance model is closest to what we want. The ERP should support **type inheritance** so that `Employee` inherits from `Person`, which inherits from `Agent` (in the philosophical sense), which inherits from `Entity`.

**Reflect.** AI-native, daily-notes first. The interesting bit is that Reflect treats the daily note as the universal inbox, and backlinks grow the graph. But no typed entities, no first-class lifecycle.

**Mem.ai.** "AI-native" meant embed everything and retrieve semantically. No strong schema. When you ask a question, you get a vector-search answer. For dense knowledge work this is insufficient — you want structured queries, not probabilistic recall.

*Takeaway*: **semantic search is not a replacement for structured queries.** An ERP needs both. Semantic search finds unknown-unknowns; SQL/graph queries answer known-structured questions.

**PARA (Tiago Forte)** — Projects, Areas, Resources, Archive. Temporal triage: Projects = active, Areas = ongoing responsibilities with no end date, Resources = reference material, Archive = done/dead. PARA is a verbing of your knowledge base: things move between folders as their state changes.

*Takeaway*: PARA's insight is that **categorization is temporal, not topical.** A project becomes an archive when it's done. This is consistent with the ERP lifecycle-stage pattern. We steal it.

**Johnny Decimal** — strict numeric hierarchy (10-19 Work, 20-29 Personal, 11.01 is one folder, 11.02 is another). Great for findability, terrible for evolution — the numbering is a lie-detector for sloppy thinking but it ossifies quickly.

*Takeaway*: strict numeric hierarchy is the wrong primary organization for a personal ERP. Keep a numeric index as a *view*, not as the *primary key*.

*Sources*: Notion data model blog; Tana supertags docs; Capacities object-type reference; Obsidian Dataview docs; Johnny Decimal/PARA comparison articles.

### 2.3 Agent-friendly data shapes — MCP, Claude Agent SDK, Agent Skills, Managed Agents

**Model Context Protocol (MCP).** Launched November 2024, MCP is the REST-equivalent for agents. An MCP Server exposes *tools* (callable functions), *resources* (readable data objects), and *prompts* (reusable prompt templates) to an MCP Client (Claude, Cursor, etc.). The key architectural insight: MCP treats the knowledge base as a set of **typed tools and typed resources**, not as a blob the LLM has to parse.

*Takeaway*: the personal ERP should ship its own MCP server that exposes every entity type as a resource and every mutation as a tool. Then *any* MCP-speaking agent (Claude, Cursor, a custom agent) can read and write it. The MCP server is the API contract for agents, and it's the forcing function for a clean schema.

**Claude Agent Skills.** Filesystem-based. A Skill is a directory with a `SKILL.md` that has YAML frontmatter (`name`, `description`), plus optional bundled files (markdown references, scripts). Claude loads metadata at startup (~100 tokens/skill), then reads the full `SKILL.md` on demand, then reads bundled files on demand. This is **progressive disclosure**: only the context the task needs is loaded.

*Takeaway*: this is an enormous architectural hint. **Agents prefer files over opaque APIs**, because files are inspectable, navigable, and loadable in slices. A personal ERP should expose its data *to agents* as a filesystem (or filesystem-like structure), not only as SQL rows. A markdown vault with YAML frontmatter gives you this for free.

**Claude Managed Agents.** The managed-agents API provides *agents*, *environments*, *sessions*, and *events*. Each session has its own sandboxed container with a filesystem and tool access. Memory across sessions is a separate preview feature.

*Takeaway*: if the ERP's data is markdown files + a Postgres index, it can be mounted into a Managed Agent session as a workspace. The agent has full read/write, the files are the source of truth, and when the session ends, the Postgres index is rebuilt. Zero impedance between "my personal knowledge" and "the agent's workspace."

**MCP Knowledge Graph Memory server.** Anthropic ships a reference MCP server that persists entities, observations, and relationships as a JSON knowledge graph. Other implementations (Graphiti/FalkorDB, Neo4j, mem0) build on this pattern.

*Takeaway*: this is the "minimum viable memory layer" for agents. The personal ERP's MCP server is a richer version of this — not just entities and observations, but typed entities with full lifecycle, categorization, and access control.

**Mem0, Letta/MemGPT.** Mem0 uses an extract-update-retrieve loop with vector similarity and LLM-driven merges (ADD/UPDATE/DELETE/NOOP). Letta (ex-MemGPT) uses a tiered memory hierarchy — core (in-context), recall (conversation history), archival (vector-searchable) — inspired by operating-system virtual memory paging. Both emphasize that *structured memory beats pure RAG*.

*Takeaway*: the ERP's memory model should be tiered — hot (in-context for the current agent session), warm (recently used records surfaced quickly), cold (everything, searchable via vector + SQL). Mem0's merge operations (ADD/UPDATE/DELETE/NOOP) are good primitives for the ingestion pipeline.

*Sources*: Anthropic Managed Agents overview; Agent Skills docs; MCP guide; Knowledge Graph Memory MCP server; Mem0 paper; MemGPT paper.

### 2.4 Graph databases vs document stores vs SQL

The specific question: at 10K–100K nodes, with typed relationships, full-text search, semantic search, time-series data, and frequent AI writes, what's the best storage?

**Postgres + pgvector + recursive CTEs.** The boring-good answer for < 100K nodes. Postgres gives you ACID, JSON columns, typed tables, native full-text search (`tsvector`/`tsquery`), pgvector for HNSW semantic search, and recursive CTEs for graph traversal. At Gabriel's scale, graph traversal over SQL is fast enough — a 3-hop query over 100K nodes is milliseconds on a modern Neon instance. The ecosystem is enormous (every ORM, every tool, every hosted provider).

**Neo4j.** Native graph DB. Optimized for multi-hop traversals, complex relationship queries, path-finding. Excellent for "find every meeting in which Gabriel mentioned an Oracle customer who also knows a Brazilian journalist within two hops" kinds of queries. Overkill for < 100K nodes, and operationally heavier (JVM, native format, a whole second system to back up). Neo4j 2025 added strong vector search and hybrid queries.

**SurrealDB.** Multi-model (document + graph + relational + vector) in one engine. As of 2026 benchmarks, claims 22x faster graph queries and 8x faster vector search than pgvector. Young, ecosystem still thin, but the "one engine" story is attractive.

**SQLite + sqlite-vec.** Excellent for local-first, single-writer scenarios. Pairs well with an Obsidian-style vault. Not ideal for multi-agent writes (SQLite locks the whole DB on write), but great as an edge cache.

**DuckDB.** Analytical, columnar, fast for aggregation and time-series. Not a transactional system. Good for reporting/rollup side of the ERP, bad for the write path.

**Chroma / Weaviate / Qdrant.** Vector-only. Solves one problem well, but you'd still need a second system for relational data. For personal ERP, collapsing two systems is better than optimizing one.

**Verdict for Gabriel's scale (10K–100K nodes):** **Postgres + pgvector + full-text search + a graph extension or recursive CTE patterns**, with the markdown vault as the human-readable backup. Reasons:

1. Already in production in `cunhas-brain` via Neon.
2. Unified transactional store for the hot path (writes, reads, agent queries).
3. FTS + vector search in one engine — no impedance.
4. Supports typed entities via JSONB + normalized tables.
5. Can add Apache AGE or `pg_graph` if graph queries get hairy later; at 100K nodes recursive CTEs are fine.
6. Every ORM (Drizzle, Prisma) supports it.
7. Neon supports branches — agent experiments can branch the DB.

Neo4j/SurrealDB are **not better** for this use case; they're better at scales where Postgres starts to hurt (1M+ nodes, deeply connected, real-time multi-hop).

*Sources*: pgvector vs Neo4j blog; SurrealDB benchmarks; personal knowledge graph in Postgres.

### 2.5 Taxonomy and ontology design

**Dublin Core.** 15 core metadata elements (`title`, `creator`, `subject`, `description`, `publisher`, `contributor`, `date`, `type`, `format`, `identifier`, `source`, `language`, `relation`, `coverage`, `rights`). Oldest and most boring metadata standard, still works. Every entity in the ERP should have Dublin Core as a baseline.

**Schema.org.** 823 types, 1529 properties, rooted at `Thing`, with deep hierarchies (`Thing > CreativeWork > Article`, `Thing > Person`, `Thing > Place > LocalBusiness > Restaurant`). Designed for web structured data, but the type hierarchy is an excellent **starting ontology** for a personal ERP. `Person`, `Event`, `Place`, `Organization`, `CreativeWork`, `Action` all map directly to what Gabriel wants.

**FOAF (Friend of a Friend).** The canonical ontology for people and their relationships. `foaf:Person`, `foaf:knows`, `foaf:mbox_sha1sum` (privacy-preserving email), `foaf:topic_interest`, `foaf:publications`. FOAF pioneered the idea that people are nodes in a distributed semantic web. A personal ERP's People table is essentially a private FOAF graph.

**GS1 / APQC.** Industry-specific classification schemes for products and business processes. Not directly relevant, but they teach one thing: when you need classification, you need a **shared vocabulary**. Gabriel's private taxonomy will be bespoke, but borrowing Schema.org/FOAF for the common parts means agents trained on public data already understand him.

**Wikipedia / DBpedia categories.** Massive hierarchy, crowd-maintained, multi-parent (an article can be in many categories). The DBpedia ontology is OWL-based and polyhierarchical. Main takeaway: *real taxonomies are polyhierarchical*. A category has multiple parents. A personal ERP must allow this.

**Colon Classification (Ranganathan)** and **faceted classification.** Rather than one rigid hierarchy, facets allow *multiple orthogonal dimensions* of classification. Ranganathan's five fundamentals — Personality (who/what), Matter (of what), Energy (doing what), Space (where), Time (when) — are absurdly applicable to personal knowledge. A meeting with Karl about the AI Readiness demo on Tuesday at the office is: {Personality: Karl, Matter: AI Readiness, Energy: Demo, Space: Office, Time: 2026-04-08}. Five facets, no rigid taxonomy required.

*Takeaway*: **Use faceted classification instead of trees.** Facets are orthogonal dimensions; you can filter on any combination. Hierarchy exists *within* a facet (e.g., Space: Office > SF Building > 3rd Floor) but facets are independent of each other. This is the single biggest taxonomy decision we'll make.

*Sources*: Schema.org vocabulary; FOAF Wikipedia; faceted classification Wikipedia; Ranganathan colon classification.

### 2.6 Personal agent systems — academic + industry

**Generative Agents (Park et al., Stanford/Google, 2023).** 25 simulated townspeople in "Smallville", each with a **memory stream**, a **reflection module**, and a **planning module**. Memory stream = append-only log of observations. Reflection = periodic LLM-driven generation of higher-level insights from observations. Planning = long-horizon daily plans seeded from reflections. Ablation showed all three were necessary. Key insight: **agents need both episodic memory (what happened) and reflective memory (what I think about what happened)**.

*Takeaway*: the personal ERP's memory layer must have both. The observation log is transactional data. The reflection layer is its own entity type: `Reflection`, an LLM-generated insight that references observations and gets its own lifecycle.

**MemGPT / Letta.** Memory hierarchy analogous to OS virtual memory: main context (hot, in-window), external context (cold, on disk, paged in via function calls). Agent decides what to page in/out. Interrupt-driven control flow. Showed this works for multi-session conversational agents that "remember" users across weeks.

*Takeaway*: agents should decide what to load from the ERP, not receive a giant context dump. The ERP's agent-facing API should expose fine-grained read tools so Claude can page in exactly what it needs.

**Voyager (NVIDIA/Minecraft).** Three parts: **automatic curriculum** (agent proposes its own next goal), **skill library** (procedural memory of executable code for learned behaviors), **iterative prompting** with self-verification. The skill library is the killer: every time the agent figures out how to do something, it saves the code as a reusable skill. Future tasks compose skills. Minecraft performance skyrocketed.

*Takeaway*: the personal ERP should have a **Skills** entity type — procedural knowledge stored as reusable, composable files (Claude Agent Skill format is perfect for this). Agents create new skills, the user approves them, and from that point on the system gets better at doing Gabriel's specific work.

**A-Mem (2025).** Agentic memory with a self-organizing structure. The agent itself links memories as it creates them, building an implicit graph.

*Takeaway*: write-time linking is cheaper than read-time search. When the agent writes a new observation, it should also emit the edges.

**AutoGen / CrewAI / LangGraph.** Three flavors of multi-agent orchestration: conversational (AutoGen), role-based (CrewAI), graph-based (LangGraph). LangGraph is explicit-graph, scales to large workflows, has built-in checkpointing and time-travel. CrewAI is the most approachable but scales poorly. AutoGen's conversational pattern scales poorly in N. For a personal ERP, **LangGraph-style stateful graphs** are the right orchestration model because we want durable, inspectable agent runs.

*Takeaway*: agent orchestration should be **stateful, graph-based, and checkpointed**. Every agent run is a DAG of steps; each step's output is persisted; the run can be paused, inspected, resumed, or forked.

**Sakana AI.** Work on evolutionary agent ensembles. Not directly applicable yet but interesting long-term (an ERP that lets agents evolve their own prompts and skills over time).

**Karpathy LLM OS.** The framing that an LLM is a kernel process and everything else (files, tools, the web, embeddings DB, video I/O) is a peripheral. For a personal ERP, this maps directly: the ERP is the **filesystem peripheral** for Gabriel's personal LLM OS. The ERP doesn't call the LLM; the LLM calls the ERP via MCP.

*Takeaway*: **the ERP is a peripheral to the LLM, not the other way around.** Design the MCP surface as if every caller is Claude. Everything else (web UI, CLI, iOS app) is a secondary client that uses the same MCP surface.

*Sources*: Generative Agents paper; MemGPT paper; Voyager paper; Karpathy LLM OS tweet/talk; AutoGen/CrewAI/LangGraph comparison articles.

### 2.7 Category theory and faceted classification

The theoretical backstop for "categories within categories without the tangled mess":

- **Strict trees** (single inheritance): nice for navigation, terrible for the real world because most things belong to multiple categories.
- **Multi-inheritance DAGs**: model a category as a node with multiple parents. Wikipedia uses this. Powerful but easy to cycle.
- **Faceted classification**: categories are orthogonal dimensions. No hierarchy *between* facets, only *within* each facet.
- **Topic maps**: W3C-style. Topics, associations, occurrences. Academic, rarely used in practice.
- **RDF / OWL**: full triple store, formal reasoning. Enormous learning curve.

**Decision**: use **faceted classification as the primary model**, with **optional intra-facet hierarchy** for facets that need it (e.g., place), and **polyhierarchical tags** for the "topic" facet as a controlled escape hatch. This gives you:

- Fast navigation (pick a facet, filter).
- No category wars (facets are orthogonal, not competing).
- Intra-facet hierarchy when useful (Place: Office > Floor > Desk), without forcing hierarchy where it isn't.
- Agents can learn and propose new tags within a facet without breaking the schema.

This is the same conclusion Tana reaches with its supertag-plus-field model, and the same conclusion Capacities reaches with its object-type system. But we'll enforce it more strictly than either.

*Sources*: Faceted classification Wikipedia; Hedden faceted taxonomies article.

---

## 3. Core entities — the ontology

### 3.1 Principles before types

Before proposing types, the design rules:

1. **Types are records too.** A `Type` is itself an entity whose instances describe other entities. This is the Frappe DocType pattern, and it's what lets Gabriel add a new entity type ("BandMember") at runtime without a migration.
2. **Single abstract root.** Every entity inherits from `Entity`. Every `Entity` has: `id`, `type`, `created_at`, `updated_at`, `created_by` (user or agent), `acl` (who can read/write), `origin` (where did this come from), `revision_id`.
3. **Master vs transactional.** We keep the SAP/NetSuite split. `MasterEntity` is persistent; `TransactionalEntity` is event-shaped. One field on `Entity` distinguishes them.
4. **Typed edges, not just bidirectional backlinks.** Every relationship has a named role (`authored_by`, `mentioned_in`, `part_of`, `caused_by`, `supersedes`, `contradicts`, `responsible_for`). Untyped backlinks are a smell.
5. **Content and metadata are separable.** A Note has a `content` field (markdown body) and a `metadata` field (structured JSONB). Both are first-class.
6. **Lifecycle is on every master entity.** No raw/refined/committed/active/shipped/archived? That's a bug in your type definition.
7. **Provenance is mandatory.** You must always be able to answer "how did this record get here?" The answer is an edge to a `Source` entity (a meeting, an import, a user action, an agent run).
8. **Small closed vocabulary for relationships.** Use a ~20-item list of edge types, not free text. This is how Schema.org stays coherent despite having 1529 properties.

### 3.2 The proposed type hierarchy

```
Entity (abstract root)
├── MasterEntity (persistent, mutable, has lifecycle)
│   ├── Agent                         (any actor — includes the user and LLM agents)
│   │   ├── Person                    (real humans; Gabriel, Karl, Tom, Arthur...)
│   │   └── AIAgent                   (Librarian, Researcher, Writer, Coach...)
│   ├── Organization                  (Oracle, NetSuite, MyCafeFilosofia LLC)
│   ├── Place                         (Office, Home, SF, Brazil, specific venues)
│   ├── Goal                          (2026 pillars, sub-goals, quarterly OKRs)
│   ├── Project                       (brazil-tax, bbb-research, cunhas-brain)
│   ├── Commitment                    ("I'll talk to Arthur about visa by Friday")
│   ├── Question                      ("Does this actually help AI Data Readiness?")
│   ├── Belief                        ("Context engineering > prompt engineering")
│   ├── Skill                         (procedural knowledge, Claude Agent Skill format)
│   ├── Artifact                      (concrete outputs: demos, decks, articles)
│   ├── Tool                          (software, physical tools, services)
│   ├── Resource                      (books, newsletters, papers, videos)
│   ├── Content                       (drafts-in-progress and published pieces)
│   ├── Topic                         (themes: "AI communication", "autonomous ERP")
│   └── Tag                           (controlled vocabulary within a facet)
└── TransactionalEntity (event-shaped, mostly immutable)
    ├── Observation                   ("Gabriel noted that Tom is interested in X")
    ├── Event                         (Meeting, Call, Conference, Ritual)
    │   ├── Meeting
    │   ├── Ritual                    (DailyBrief, WeeklyReview)
    │   └── Session                   (agent run)
    ├── Message                       (WhatsApp, iMessage, Slack, email)
    ├── Decision                      ("decided to deprioritize BBB this quarter")
    ├── Reflection                    (higher-level insight from observations)
    ├── Change                        (revision record for any master entity)
    └── Action                        (something an agent did on the user's behalf)
```

Thirty entity types looks intimidating. Three notes:

1. **Gabriel doesn't see all 30.** The UI surfaces the 6-10 he uses daily (Person, Project, Goal, Meeting, Content, Artifact, Commitment). The rest are engine-internal or rare.
2. **New types are user-definable.** If Gabriel wants to add `BandMember` or `RecipeIngredient`, he defines a new DocType-style record and it becomes a real type instantly. The 30 here are the seeds.
3. **Inheritance means fewer fields, not more.** Every MasterEntity gets lifecycle, provenance, ACL, revision for free from the abstract root. You only define the delta fields per type.

### 3.3 Core entity definitions

Each entity listed with: **purpose**, **core attributes**, **required edges**, **lifecycle (if master)**, and **an example from Gabriel's real data.**

#### 3.3.1 `Person`

- **Purpose**: durable record of a real human relevant to Gabriel's life. Private FOAF graph.
- **Attributes**: `display_name`, `aliases[]`, `contact_info` (JSONB with emails, phones, handles), `bio_summary`, `tags[]`, `relationship_type` (manager, report, peer, mentor, friend, family, external), `first_met_at`, `last_contacted_at`, `contact_cadence_days` (target), `importance` (1-5), `notes` (markdown).
- **Required edges**: `member_of` → Organization (Karl is member of Oracle), `collaborates_on` → Project, `mentioned_in` ← Meeting/Note/Message.
- **Lifecycle**: `active` → `dormant` (no contact in N days) → `archived` (deliberate decision). No "deleted" — people don't disappear, but you can mark them `archived` with a reason.
- **Example**: Karl (manager, Oracle, last contacted 2 days ago, cadence 7 days, importance 5, tagged `[internal, ai-voice-pillar]`).

#### 3.3.2 `Organization`

- **Purpose**: companies, teams, groups, informal collectives.
- **Attributes**: `display_name`, `aliases[]`, `website`, `org_type` (company, team, community, family), `parent_org` (Oracle is parent of NetSuite), `my_role_in` (my role inside this org if any), `notes`.
- **Edges**: `parent_of` → Organization, `member_of` ← Person, `works_on` ← Project.
- **Example**: Oracle → NetSuite → AI Club (three-level parent hierarchy).

#### 3.3.3 `Place`

- **Purpose**: physical or virtual locations that matter. Rarely the primary axis of thought, but useful as a facet.
- **Attributes**: `display_name`, `kind` (office, home, city, country, venue, virtual), `parent_place` (recursive), `lat_lng`, `notes`.
- **Example**: Office > SF > 4th Floor > Desk 12. Or Brazil > Rio > Café Lamas.

#### 3.3.4 `Goal` / `Pillar`

- **Purpose**: strategic objectives. In Gabriel's taxonomy these are the 9 yearly pillars, plus their sub-goals.
- **Attributes**: `title`, `description`, `year`, `priority`, `target_metric` (free text), `target_value`, `current_value`, `parent_goal` (for sub-goals), `health` (green/yellow/red), `horizon` (yearly/quarterly/monthly).
- **Lifecycle**: `draft` → `committed` → `active` → `achieved` | `missed` | `deprioritized` | `archived`.
- **Edges**: `child_of` → Goal; `serves_pillar` ← Project; `advances` ← Content | Artifact.
- **Example**: Pillar #1 "Become the #1 internal AI voice at Oracle/NetSuite", target metric "# published pieces / quarter", target "10", current "3", health yellow.

#### 3.3.5 `Project`

- **Purpose**: any multi-step, multi-day effort with a distinct identity. Gabriel has ~30 of these right now.
- **Attributes**: `slug`, `name`, `folder_path` (if code), `category` (netsuite|personal|meta|experimental), `status`, `runnable`, `last_touched_at`, `next_action` (the one sentence), `continuation_notes` (where I left off), `repo_url`, `deployed_url`, `owner` → Person.
- **Lifecycle**: `idea` → `scoped` → `active` → `paused` → `complete` → `archived`. Fork: `dead` (explicitly killed with reason).
- **Edges**: `serves_pillar` → Goal, `collaborates` ← Person, `produces` → Artifact | Content, `discussed_in` ← Meeting.
- **Example**: `brazil-tax` (active, netsuite, pillar #2, next_action "Fix the `_marshal` error in client script", last_touched 3 days ago).

#### 3.3.6 `Commitment`

- **Purpose**: promises to act. Promises to self, to people, to future-self. *The* failure mode without this entity is quiet social/professional drift.
- **Attributes**: `title`, `description`, `committed_to` → Person | self, `committed_by` → Person (usually Gabriel), `committed_at`, `deadline`, `reminder_at`, `priority`.
- **Lifecycle**: `open` → `active` → `done` | `broken` | `renegotiated` | `obsolete`. *A broken commitment is a first-class event* — it triggers a reflection, not just a delete.
- **Edges**: `from` → Person (Gabriel), `to` → Person (the counterparty), `about` → Project | Topic.
- **Example**: "Talk to Arthur about the visa / Oracle / Luzid situation" (open, to Arthur, committed 14 days ago, no deadline → should have one, reminder fires Monday).

#### 3.3.7 `Question`

- **Purpose**: open questions Gabriel wants answered. These are different from commitments (they may have no one to ask) and from goals (they are inquiry, not output).
- **Attributes**: `title`, `context`, `priority`, `status` (open|researching|answered|abandoned), `answer`.
- **Edges**: `prompted_by` → Observation | Meeting | Belief; `about` → Topic | Project.
- **Example**: "Should Idea CRM write back to Notion or fully replace it?" → answered.

#### 3.3.8 `Belief`

- **Purpose**: Gabriel's held opinions. Explicit beliefs are rare in personal systems but invaluable — they make contradictions with new evidence visible.
- **Attributes**: `title`, `statement`, `confidence` (0-1), `held_since`, `last_reaffirmed_at`.
- **Lifecycle**: `tentative` → `held` → `revised` | `abandoned`.
- **Edges**: `supported_by` → Observation | Resource; `contradicted_by` → Observation.
- **Example**: "Context engineering > prompt engineering" (confidence 0.85, held_since 2026-02, last_reaffirmed 2026-03).

#### 3.3.9 `Skill` (procedural)

- **Purpose**: reusable "how to do X" artifacts. These map 1:1 to Claude Agent Skill format (`SKILL.md` + bundled files). The personal ERP's Skills library is what lets agents get better at Gabriel-specific tasks over time.
- **Attributes**: `name` (kebab-case), `description`, `body` (the SKILL.md content), `triggers[]` (when should this skill fire), `author` → Agent (Gabriel or an AIAgent), `version`.
- **Lifecycle**: `draft` → `tested` → `published` → `deprecated`.
- **Edges**: `depends_on` → Skill (skills can compose), `used_by` ← AIAgent.
- **Example**: `netsuite-kt-meeting-summary` (published, used by Analyst agent, triggers when category=netsuite_kt).

#### 3.3.10 `Artifact`

- **Purpose**: concrete outputs — HTML demos, slide decks, diagrams, prototypes, code sketches.
- **Attributes**: `title`, `kind` (html|pdf|slide_deck|image|code|video), `storage_url`, `body` (inline small files), `generated_by` → Agent, `derived_from` → Note | Idea | Content.
- **Lifecycle**: `wip` → `review` → `published` → `archived`.
- **Example**: the `Data Quality for AI` HTML demo deck (published, derived from Idea #42, generated by Producer agent).

#### 3.3.11 `Content`

- **Purpose**: writing-in-progress and published pieces. Newsletters, articles, talks, posts.
- **Attributes**: `title`, `kind` (newsletter|article|talk|post|email|slide), `body` (markdown), `outline`, `status`, `target_audience`, `target_publish_at`, `published_at`, `published_url`, `word_count`.
- **Lifecycle**: `seed` → `outline` → `draft` → `review` → `published` → `archived`.
- **Example**: "AI Recap April 2026 newsletter" (draft, target audience = NetSuite leadership, target publish 2026-04-15).

#### 3.3.12 `Resource`

- **Purpose**: external reference material Gabriel consumes. Books, papers, newsletters, videos, tweets.
- **Attributes**: `title`, `kind` (book|paper|newsletter|video|tweet|podcast|article), `url`, `author`, `summary`, `key_quotes`, `priority`, `status` (backlog|reading|read|referenced|abandoned), `my_rating`, `my_notes`.
- **Edges**: `about` → Topic, `authored_by` → Person.
- **Example**: Karpathy's LLM Wiki talk (video, backlog, priority high, about Topic [llm-os, agent-memory]).

#### 3.3.13 `Tool`

- **Purpose**: software and services Gabriel uses. Tracked so that the system knows what's in the workflow.
- **Attributes**: `name`, `url`, `kind` (saas|cli|library|hardware), `role_in_workflow`, `cost_per_month`.
- **Example**: Claude Code, Neon, Vercel, Krisp, ElevenLabs, Raycast.

#### 3.3.14 `Topic`

- **Purpose**: theme tags with structure. Unlike raw tags, topics are first-class entities with their own descriptions and parent/child relationships.
- **Attributes**: `name`, `description`, `parent_topic`, `aliases`.
- **Example**: `ai-communication` > `thought-leadership` > `newsletter-writing`. Or `personal-ai-os` > `memory-architecture`.

#### 3.3.15 `Tag` (distinct from Topic)

- **Purpose**: controlled-vocabulary flat labels used *within* specific facets. Tags are not entities in their own right, they are strings constrained by a vocabulary.
- **Example**: facet `urgency` has tags `[urgent, soon, someday]`. Facet `mood` has `[excited, ambivalent, draining]`. Facet `energy_required` has `[high, medium, low]`.

#### 3.3.16 `Meeting` (transactional)

- **Purpose**: record of a conversation. Already exists in cunhas-brain but needs to be rehomed under the Entity hierarchy.
- **Attributes**: `title`, `started_at`, `ended_at`, `location` → Place, `kind` (1:1|group|demo|interview|presentation), `transcript`, `summary_short`, `summary_long`, `source` (krisp|manual|calendar).
- **Edges**: `attended_by` → Person (multi), `about` → Project | Topic, `produced` → Commitment | Observation | Decision.
- **Immutable after**: `closed_at`. You don't edit a transcript; you annotate it.

#### 3.3.17 `Observation` (transactional)

- **Purpose**: a single atomic thing that was noticed or learned. This is the transactional memory-stream atom from Generative Agents.
- **Attributes**: `content` (one sentence), `timestamp`, `source_type` (meeting|note|message|reflection|direct_capture), `source_id`, `confidence`.
- **Edges**: `about` → any entity (Person, Project, Topic, etc.).
- **Immutable**.
- **Example**: "Tom Kelly said the AI Data Readiness project needs a customer success story by Q3" (from Meeting #123, confidence 1.0).

#### 3.3.18 `Decision` (transactional)

- **Purpose**: an explicit moment where an option was chosen. The trace of *why* a project went this way and not that way.
- **Attributes**: `title`, `context`, `options_considered[]`, `chosen_option`, `rationale`, `decided_by` → Person, `decided_at`, `reversible` (bool).
- **Immutable** (but can be `superseded_by` another Decision).
- **Example**: "Decided to split idea-crm into its own app rather than absorb it into cunhas-brain. Rationale: different lifecycle, different data model, safer iteration."

#### 3.3.19 `Reflection` (transactional)

- **Purpose**: higher-level insight generated from observations. This is the Generative Agents reflection tier.
- **Attributes**: `content`, `depth` (1=first-order, 2=reflection on reflections, etc.), `generated_at`, `generated_by` → Agent (can be Gabriel or an AIAgent like Coach).
- **Edges**: `derived_from` → Observation | Reflection (lower depth).
- **Example**: "I commit to too many things on Monday mornings and burn out by Thursday" (depth=2, derived from 5 observations across 3 weeks).

#### 3.3.20 `Action` (transactional)

- **Purpose**: an atomic thing an agent did on behalf of Gabriel. Critical for agent-era auditability.
- **Attributes**: `agent` → AIAgent, `action_kind` (create|update|delete|send|generate), `target` → any entity, `input`, `output`, `tokens_used`, `cost_usd`, `wall_time_ms`, `success`, `error`, `started_at`, `completed_at`.
- **Immutable** (this is the agent's audit log).
- **Example**: "Librarian agent created Person:Maria from Meeting #445 transcript mention, confidence 0.8, 2400 tokens, $0.003" (can be rolled back; see Section 8).

### 3.4 What's not a first-class entity (on purpose)

- **Todo**. A Todo is a view over `Commitment` + `Action`, not its own type. A commitment has a next step; that next step shows up in your "Todos" view. The list is derived, not stored as separate records. This avoids the classic PKM trap of having todos in three places.
- **Category / Folder**. Categories are facets on entities, not entities themselves. Creating a folder is a lie about the shape of your thinking.
- **Daily note**. A daily note is a view rendered from all transactional entities with `timestamp in [today]`. It's not a stored object.
- **Backlink**. A backlink is a derived query on the edge table, not its own row.
- **Highlight**. A highlight from a book is an Observation with edge `source` → Resource.

Keeping these out of the entity list is an active architectural decision. Every concept you add to the ontology is future maintenance cost. Derived views are free.

---

## 4. Categorization model — nested, faceted, both

### 4.1 The explicit user ask

Gabriel said:
- "Personal goals / Todos / Work things / Personal-life things / within personal-life: fun things + serious things"
- "Nested categories — categories within categories"
- "People as first-class entities"

A naive reading is "folders in folders". That's the wrong answer. Here's why and what to do instead.

### 4.2 Why strict hierarchy fails

Consider Gabriel's real data: the BBB Infinito personal project. Where does it live?

- **Work or personal?** Personal — it's a passion project.
- **Fun or serious?** Both — it's fun to build, serious about shipping a real product.
- **Which pillar?** Primarily Pillar #5 (ship personal product), but it also serves Pillar #1 (AI communication — it's a demo of agent personality).
- **Which topic?** `llm-agents`, `entertainment`, `avatars`, `reality-tv`, `viral-growth`.
- **Which collaborators?** None yet, but potentially ElevenLabs, potentially Brazilian TV.

Any strict tree forces you to pick one parent. Every choice is wrong. You end up duplicating the record, or losing the alternative context, or giving up on categorization entirely. This is exactly why Gabriel's current workspace is a graveyard.

### 4.3 The facets

Instead, classify every entity along **six orthogonal facets**. Every facet is independent; an entity can have any combination.

```
┌────────────────┬────────────────────────────────────────────────────┐
│ Facet          │ Values / structure                                 │
├────────────────┼────────────────────────────────────────────────────┤
│ F1 Domain      │ work | personal                                    │
│                │ (plus sub-domain, controlled list)                 │
│                │   work → oracle | netsuite | ai-club | external    │
│                │   personal → family | fun | serious | health       │
├────────────────┼────────────────────────────────────────────────────┤
│ F2 Pillar      │ FK → Goal (one of the 9 2026 pillars)              │
│                │ Multi-value: a record can serve multiple pillars   │
├────────────────┼────────────────────────────────────────────────────┤
│ F3 Topic       │ FK → Topic (hierarchical, polyhierarchical)        │
│                │ Multi-value. Topics can themselves have parents.   │
├────────────────┼────────────────────────────────────────────────────┤
│ F4 Lifecycle   │ from the entity type's own state machine           │
│                │ (raw/refined/active/shipped/archived)              │
├────────────────┼────────────────────────────────────────────────────┤
│ F5 Temporal    │ when it happened / is due (ISO datetime ranges)    │
│                │ + salience age (how fresh is it)                   │
├────────────────┼────────────────────────────────────────────────────┤
│ F6 Quality     │ controlled vocab on: priority, confidence, energy, │
│                │ urgency, mood. Multi-field, each a small enum.     │
└────────────────┴────────────────────────────────────────────────────┘
```

Three comments:

1. **F1 Domain is an enumerated structure, not a free tree.** `work` has sub-values (`oracle`, `netsuite`, `ai-club`, `external`), `personal` has sub-values (`family`, `fun`, `serious`, `health`). If Gabriel wants to add `personal/side-business`, he adds it — but the structure is explicit, controlled, and max-2-levels deep. This is the answer to "nested categories" that doesn't collapse: strict depth limit, controlled vocabulary, user-editable.

2. **F3 Topic is where true polyhierarchical categorization lives.** Topics are entities. They can nest arbitrarily. A Topic can have multiple parents. BBB Infinito is tagged with topics `[llm-agents, entertainment, reality-tv, viral-growth]`, each of which lives in its own part of the topic DAG.

3. **F2 Pillar is the scoring function.** Pillars are the strategic buckets Gabriel uses to decide where to spend time. Every master entity should link to at least one pillar or be flagged orphan. Orphans become candidates for archive.

### 4.4 Nested categories, the way they actually work

Gabriel said "categories within categories". Here's how that maps to the model:

- **If he means topical nesting** (a topic inside a topic, e.g., `personal-ai-os > memory-architecture > hot-cold-tiering`): that's **F3 Topic with polyhierarchical parent links.** Infinitely deep, multiple parents allowed.
- **If he means contextual nesting** (a project lives inside a pillar which lives inside a domain): that's the **join** of F1 Domain + F2 Pillar + the entity's own type. `work > oracle > pillar-1 > Project:ai-readiness`. Not a stored tree, a *rendered* navigation view.
- **If he means strict folder nesting** (folder inside folder inside folder): *don't*. Replace with the facet model. Render strict nav views only as a UI affordance (there is a `/work/oracle/ai-club/` view), but the storage is faceted.

### 4.5 Example: classifying Gabriel's actual projects

| Entity | F1 Domain | F2 Pillar | F3 Topic (sample) | F4 Lifecycle |
|---|---|---|---|---|
| `brazil-tax` | work/oracle/netsuite | #2 Data Quality SuiteApp, #1 AI voice | `netsuite-suiteapps`, `brazilian-localization`, `ml-tax` | active |
| `BBB Infinito` | personal/fun | #5 Ship personal product, #1 AI voice | `llm-agents`, `entertainment`, `reality-tv`, `viral-growth` | scoped |
| `ai-readiness` | work/oracle/netsuite | #1 AI voice, #2 Data Quality | `customer-facing-ai`, `demo-readiness`, `data-quality` | active |
| `digital-studiolo` | personal/fun | #5 Ship personal product | `music-creation`, `ai-music`, `daw-integration` | paused |
| `cafe-com-filosofia` | personal/serious | #9 Health/social, #6 Publish as thinker | `philosophy`, `brazilian-literature`, `community-building` | idea |
| Meeting with Karl | work/oracle | #1 AI voice, #2 Data Quality | `manager-1on1`, `oracle-strategy` | closed |
| Paulo Freire book | personal/serious | #7 Foundational knowledge, #6 Publish as thinker | `brazilian-literature`, `pedagogy`, `philosophy` | reading |
| Autonomous Finance SuiteApp | work/oracle/netsuite | #4 Autonomous Finance | `autonomous-agents`, `finance-automation`, `suiteapp` | scoped |

Every row is a record. Every column is a facet. Any two entities can be compared on any facet. No duplication, no orphaning.

### 4.6 Controlled vocabularies vs free text

Every facet has a **controlled vocabulary** that is itself stored as data (in a `vocabulary` table). Adding a new value to a facet is a user-facing action with guardrails: "you're about to add `personal/side-business` as a new sub-domain, this will affect 0 existing records, OK?" Agents can *propose* new values but can't commit them without a user approval (or auto-approval rule — see Section 6).

Free text lives in `notes`, `content`, `description`. Classification lives in the facets. Never blur them.

---

## 5. The data model — schema, storage, scale

### 5.1 Storage decision

**Postgres + pgvector + full-text search**, running on Neon, with Gabriel's markdown vault as the human-readable export/backup. Section 2.4 laid out why. Concretely:

```
┌──────────────────────────────────────────────────────────┐
│                   System of Record                       │
│                                                          │
│   Postgres (Neon)                    Markdown vault      │
│   ┌──────────────────┐              ┌──────────────────┐ │
│   │ entities         │◄──[export]──►│ vault/people/    │ │
│   │ edges            │              │ vault/projects/  │ │
│   │ revisions        │              │ vault/meetings/  │ │
│   │ actions          │              │ vault/content/   │ │
│   │ vocabularies     │              │ vault/skills/    │ │
│   │ embeddings       │              │ ...              │ │
│   │ fulltext_idx     │              └──────────────────┘ │
│   └──────────────────┘                                   │
│           ▲                                              │
│           │ write-through                                │
│           │                                              │
│   Inbox / Capture                                        │
└──────────────────────────────────────────────────────────┘
                       │
                       │ MCP Server (Section 6)
                       ▼
          ┌────────────────────────┐
          │  Claude / Cursor / any │
          │     MCP-speaking       │
          │        agent           │
          └────────────────────────┘
```

Writes go to Postgres first (source of truth). A background job re-renders the markdown vault on changes. File-system changes detected by a watcher get upserted back to Postgres. Conflict resolution: last-write-wins by timestamp, losing edits recorded as change events.

### 5.2 The core schema (pseudocode, illustrative)

```sql
-- ============================================================
-- META-SCHEMA: types and facets are themselves records
-- ============================================================

CREATE TABLE entity_types (
  id             SERIAL PRIMARY KEY,
  slug           TEXT UNIQUE NOT NULL,         -- 'person', 'project', 'goal'
  display_name   TEXT NOT NULL,
  parent_type    INT REFERENCES entity_types(id),  -- inheritance
  is_master      BOOLEAN NOT NULL,             -- master vs transactional
  is_abstract    BOOLEAN DEFAULT false,
  schema         JSONB NOT NULL,               -- field definitions, validators
  lifecycle      JSONB,                        -- state machine if applicable
  icon           TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE facets (
  id             SERIAL PRIMARY KEY,
  slug           TEXT UNIQUE NOT NULL,         -- 'domain', 'pillar', 'topic', ...
  display_name   TEXT NOT NULL,
  kind           TEXT NOT NULL,                -- enum|hierarchy|fk|free
  config         JSONB NOT NULL                -- values, parents, constraints
);

CREATE TABLE vocabulary (
  id             SERIAL PRIMARY KEY,
  facet_id       INT REFERENCES facets(id) ON DELETE CASCADE,
  slug           TEXT NOT NULL,                -- 'work/oracle/netsuite'
  display_name   TEXT NOT NULL,
  parent_id      INT REFERENCES vocabulary(id),
  metadata       JSONB DEFAULT '{}',
  created_by     TEXT DEFAULT 'system',
  approved       BOOLEAN DEFAULT true,
  UNIQUE(facet_id, slug)
);

-- ============================================================
-- ENTITIES: the universal record table
-- ============================================================

CREATE TABLE entities (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type_id        INT NOT NULL REFERENCES entity_types(id),
  display_name   TEXT NOT NULL,
  slug           TEXT,                         -- url-friendly
  content        TEXT,                         -- markdown body (optional)
  summary        TEXT,                         -- short summary for quick surfacing
  metadata       JSONB NOT NULL DEFAULT '{}',  -- type-specific fields
  facets         JSONB NOT NULL DEFAULT '{}',  -- {domain: ['work/oracle'], pillar: [1,2], ...}
  lifecycle      TEXT,                         -- current stage per type's state machine
  lifecycle_since TIMESTAMPTZ DEFAULT NOW(),
  importance     SMALLINT DEFAULT 3,           -- 1-5
  confidence     REAL DEFAULT 1.0,             -- 0-1, AI-assigned
  acl            JSONB DEFAULT '{"read":"self","write":"self"}',
  origin         JSONB,                        -- {source:'krisp', ref:'meeting:123'}
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  created_by     UUID,                         -- agent or user id
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_by     UUID,
  archived_at    TIMESTAMPTZ,                  -- soft delete
  revision_id    UUID                          -- pointer to latest revision
);

CREATE INDEX ON entities (type_id);
CREATE INDEX ON entities (lifecycle);
CREATE INDEX ON entities USING GIN (facets jsonb_path_ops);
CREATE INDEX ON entities USING GIN (metadata jsonb_path_ops);
CREATE INDEX ON entities USING GIN (to_tsvector('english',
                                   coalesce(display_name,'') || ' ' ||
                                   coalesce(content,'') || ' ' ||
                                   coalesce(summary,'')));

-- ============================================================
-- EDGES: typed, directional relationships
-- ============================================================

CREATE TABLE edge_types (
  id             SERIAL PRIMARY KEY,
  slug           TEXT UNIQUE NOT NULL,         -- 'authored_by','mentioned_in','serves_pillar'
  display_name   TEXT NOT NULL,
  inverse_slug   TEXT,                         -- reverse lookup name
  domain_types   INT[],                        -- which types can be source
  range_types    INT[]                         -- which types can be target
);

CREATE TABLE edges (
  id             BIGSERIAL PRIMARY KEY,
  source_id      UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  target_id      UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  edge_type_id   INT NOT NULL REFERENCES edge_types(id),
  metadata       JSONB DEFAULT '{}',           -- weight, role, confidence, evidence
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  created_by     UUID,
  valid_from     TIMESTAMPTZ,                  -- bi-temporal support
  valid_to       TIMESTAMPTZ,                  -- null = currently valid
  UNIQUE(source_id, target_id, edge_type_id, valid_from)
);

CREATE INDEX ON edges (source_id);
CREATE INDEX ON edges (target_id);
CREATE INDEX ON edges (edge_type_id);

-- ============================================================
-- REVISIONS: every mutation to a master entity is logged
-- ============================================================

CREATE TABLE revisions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id      UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  previous_id    UUID REFERENCES revisions(id),  -- linked list
  patch          JSONB NOT NULL,                 -- JSON Patch RFC 6902
  reason         TEXT,                            -- human/agent explanation
  actor_id       UUID NOT NULL,
  actor_kind     TEXT NOT NULL,                  -- 'user'|'agent'|'auto'
  tool_call_id   UUID REFERENCES actions(id),    -- which agent action caused this
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON revisions (entity_id, created_at DESC);

-- ============================================================
-- ACTIONS: the agent audit log, bidirectional reversible actions
-- ============================================================

CREATE TABLE actions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id       UUID NOT NULL,                  -- which AIAgent or human
  kind           TEXT NOT NULL,                  -- 'create'|'update'|'delete'|'link'|'send'
  target_id      UUID REFERENCES entities(id),
  input          JSONB NOT NULL,
  output         JSONB,
  tool_calls     JSONB,                          -- MCP tool calls made during this action
  tokens_in      INT,
  tokens_out     INT,
  cost_usd       NUMERIC(10,4),
  wall_time_ms   INT,
  success        BOOLEAN,
  error          TEXT,
  reversible     BOOLEAN DEFAULT true,
  reversed_by    UUID REFERENCES actions(id),
  started_at     TIMESTAMPTZ DEFAULT NOW(),
  completed_at   TIMESTAMPTZ
);

CREATE INDEX ON actions (agent_id, started_at DESC);
CREATE INDEX ON actions (target_id);

-- ============================================================
-- EMBEDDINGS: vector index for semantic search
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE embeddings (
  id             BIGSERIAL PRIMARY KEY,
  entity_id      UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  chunk_index    INT DEFAULT 0,
  chunk_text     TEXT NOT NULL,
  embedding      vector(1536),
  model          TEXT NOT NULL,                  -- 'text-embedding-3-small'
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON embeddings USING hnsw (embedding vector_cosine_ops);

-- ============================================================
-- TRANSACTIONAL SIDE: observations, events, messages
-- ============================================================

-- These are all rows in `entities` with is_master=false on their type_id.
-- Kept in the same table so queries can traverse master-transactional
-- edges in a single SQL join. The type_id + lifecycle pair tells you
-- which it is.

-- ============================================================
-- INBOX: raw captures pending ingestion
-- ============================================================

CREATE TABLE inbox (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source         TEXT NOT NULL,                  -- 'raycast'|'krisp'|'voice'|'browser'
  raw_content    TEXT NOT NULL,
  metadata       JSONB DEFAULT '{}',
  status         TEXT DEFAULT 'pending',         -- pending|processing|processed|failed
  received_at    TIMESTAMPTZ DEFAULT NOW(),
  processed_at   TIMESTAMPTZ,
  produced_entities UUID[]                      -- which entities the ingest created
);

-- ============================================================
-- SKILLS: procedural memory (SKILL.md-style)
-- ============================================================

-- Stored as entities where type=Skill, content=SKILL.md body,
-- metadata.bundled_files[] points to bundled resources.
-- The MCP server can project these into a filesystem for agents on demand.
```

### 5.3 Why one `entities` table for everything

You could normalize: one table per type (`people`, `projects`, `meetings`...). That's the conventional wisdom. Here's why we consolidate instead.

**Pros of consolidation:**
- Universal queries: "show me every entity mentioning Karl across any type" is a single SQL statement.
- One edge table joins everything.
- Cross-type search (FTS + vector) works on one index.
- The MCP server has a simple uniform `entity` resource.
- New types via the meta-schema are zero-migration.
- Revisions table applies uniformly.

**Cons (and mitigations):**
- You lose some compile-time schema safety. *Mitigation*: `entity_types.schema` defines type-specific field constraints; validated at write time by a Postgres trigger + application-layer Zod schema.
- JSONB queries are slower than column queries. *Mitigation*: at 100K rows this is imperceptible; GIN indexes on JSONB are very fast.
- Foreign keys to specific types are harder. *Mitigation*: `edges` table with `edge_types` that constrain domain/range provides this at the relationship level, where it matters most.

The decision is borrowed from Frappe's DocType pattern (ERPNext) and from Notion's block model. Both serve workloads much bigger than a personal ERP. For 10K–100K entities with heavy schema evolution, consolidation wins.

### 5.4 Scale

Back-of-envelope at the 100K-entity ceiling:

| Table | Rows | Size estimate |
|---|---|---|
| `entities` | 100K | ~400 MB (avg 4KB/row incl metadata + content) |
| `edges` | 500K | ~150 MB |
| `revisions` | 1M (10 per entity) | ~500 MB |
| `actions` | 500K | ~200 MB |
| `embeddings` | 500K (chunks) | ~3 GB (1536 * 4 bytes + text) |
| `inbox` | <1K active | negligible |
| **Total** | | **~4.5 GB** |

Neon handles this comfortably on any tier. Reads are milliseconds; writes scale linearly. If Gabriel ever crosses 1M entities, we revisit (switch to partitioned tables, move embeddings to a dedicated vector store, etc.). That's a 10-year problem.

### 5.5 Full-text and semantic search

- **FTS**: Postgres `tsvector`/`tsquery` via GIN index. Indexes `display_name || content || summary`. For BM25-quality ranking we use `ts_rank_cd` with custom weights. This handles all "find me the note with this exact phrase" queries.
- **Semantic**: `embeddings` table, HNSW index, `text-embedding-3-small` at write time. Handles "find notes similar to this idea."
- **Hybrid**: query planner (Section 6.4) runs both and merges, or either, based on the query type. This is RAG++.
- **Graph queries**: recursive CTEs over `edges`. At 500K edges, 3-hop traversal is tens of milliseconds. If this ever becomes a bottleneck, install Apache AGE or switch to `pg_graph`.

### 5.6 What about the markdown vault?

The vault is a **derived projection** of the database, re-rendered on writes. Structure:

```
~/brain/
├── people/
│   ├── karl.md
│   ├── tom-kelly.md
│   └── arthur.md
├── projects/
│   ├── brazil-tax.md
│   ├── bbb-infinito.md
│   └── ai-readiness.md
├── goals/
│   ├── 2026-p1-ai-voice.md
│   └── 2026-p5-ship-product.md
├── meetings/
│   └── 2026/04/08/karl-1on1.md
├── content/
│   ├── drafts/ai-recap-april-newsletter.md
│   └── published/context-engineering-article.md
├── skills/
│   ├── netsuite-kt-meeting-summary/
│   │   └── SKILL.md
│   └── draft-newsletter-from-recaps/
│       ├── SKILL.md
│       └── style-guide.md
├── observations/
│   └── 2026/04/08.md        (daily log)
└── _index.db                 (sqlite mirror for local search)
```

Every file has YAML frontmatter with the entity's `id`, `type`, `facets`, `lifecycle`, plus a hash to detect edits. The Postgres source of truth and the vault are kept in sync by:

- **Write to DB** → re-render the affected markdown files.
- **Write to file** (user edits in Obsidian) → watcher detects the hash change, upserts to DB, bumps revision.

Conflicts: last-write-wins, losing edit stored as a revision with `source='conflict'`. A weekly agent pass reconciles any drift.

**Why both?** Postgres for the agent-facing queries and the MCP surface. Markdown for human editing, durability, and the "if this app dies I still have my data" guarantee. Also: the vault is what gets mounted into Managed Agent sessions.

---

## 6. Agent access patterns — the MCP surface

### 6.1 The core principle

> **The ERP is a peripheral to an LLM-first stack.** Every capability Gabriel uses the ERP for must be reachable from Claude via MCP. The web UI, the CLI, the voice assistant are all secondary clients of the same MCP surface.

This is the inversion most PKM tools get wrong. They expose a human UI and bolt on an API as an afterthought. We design the API first and render the human UI on top of it. Concretely: if it's hard to do via MCP, it shouldn't exist.

### 6.2 The MCP server — tools, resources, prompts

The personal ERP ships **one MCP server** — call it `mcp-erp` — that exposes the full surface. MCP has three concept slots:

- **Tools** = callable actions (mutations + side-effecting reads).
- **Resources** = readable URIs for data.
- **Prompts** = reusable prompt templates (for humans to invoke specific workflows).

#### Tools (mutation surface)

A minimal but complete set. Every tool has typed arguments, validated with JSON Schema.

```
# Entity lifecycle
erp.entity.create       {type, display_name, metadata, facets, content?}
erp.entity.update       {id, patch, reason}
erp.entity.transition   {id, new_lifecycle, reason}
erp.entity.archive      {id, reason}
erp.entity.restore      {id, reason}

# Edges
erp.edge.create         {source_id, target_id, edge_type, metadata?, evidence?}
erp.edge.delete         {id, reason}

# Queries
erp.query.search        {query, facets?, types?, limit?, mode?: 'fts'|'semantic'|'hybrid'}
erp.query.by_facet      {facet, value, types?, lifecycle?, limit?}
erp.query.neighbors     {entity_id, edge_types?, depth?, direction?}
erp.query.dormant       {types?, threshold_days}
erp.query.structured    {sql}  # sandboxed read-only SQL; power tool

# Inbox / ingest
erp.inbox.capture       {source, content, metadata?}
erp.inbox.process       {id}  # run the classifier on a raw capture

# Reflection / meta
erp.reflection.generate {scope, window}  # run the reflection pass over observations
erp.action.log          {agent_id, kind, input, output, ...}  # write audit entry

# Agent-specific helpers
erp.person.resolve      {name_fragment_or_alias}   # entity resolution
erp.project.resume      {project_id}               # "where did I leave off" card
erp.commitment.due      {window_days}              # upcoming commitments
erp.daily_brief.render  {date}                     # the daily brief payload
erp.weekly_review.render{week}

# Skills
erp.skill.list          {trigger?}
erp.skill.load          {skill_id}                 # returns SKILL.md content
erp.skill.install       {name, description, body, bundled_files?}

# Reversal (see Section 8)
erp.action.reverse      {action_id, reason}
```

Every tool returns the affected entity IDs and a revision pointer. Agents can chain them.

#### Resources (read surface as URIs)

Resources give Claude a filesystem-like view. The MCP server mounts the vault into each agent session.

```
erp://entity/{id}                          → JSON payload + markdown content
erp://entity/{id}/revisions                → revision history
erp://entity/by-slug/{type}/{slug}         → human-readable path
erp://facet/{facet}/{value}                → list of entities in that facet value
erp://type/{type_slug}                     → all entities of that type (paged)
erp://graph/{entity_id}?depth=N            → neighborhood subgraph
erp://skill/{name}                         → SKILL.md + bundled files
erp://vault/                               → full vault directory, read-only
erp://vault/{path}                         → individual vault file
erp://daily/{date}                         → the derived daily note
erp://inbox/pending                        → pending captures
erp://pillar/{slug}                        → pillar rollup (active projects, health, velocity)
```

These are **read-only**. Mutations go through tools. This separation matters for safety (tools log actions; reads don't).

#### Prompts (templates)

MCP prompts are reusable workflows the user (or another agent) can trigger by name.

```
erp.prompt.daily_brief          → generates morning brief
erp.prompt.weekly_review        → runs the Friday review interview
erp.prompt.dormancy_sweep       → finds orphans, asks user to decide
erp.prompt.newsletter_draft     → draft next newsletter from recent recaps
erp.prompt.meeting_prep         → pre-meeting briefing for an upcoming calendar event
erp.prompt.kill_or_keep         → for a stalled project: kill, pause, or recommit?
erp.prompt.onboarding_interview → the terminal interview from idea-crm
```

### 6.3 Progressive disclosure and the agent's filesystem

Per the Agent Skills model, agents read files in stages. Here's how a Claude session against the ERP works:

**Session start.** Agent is given a system prompt listing the MCP tools + a single index resource:

```
erp://index
```

This is small (~1K tokens): lists entity types, facets, current pillars, counts, and 5-10 "hot" entities (recently updated, high-importance). Zero risk of context bloat.

**When agent needs detail.** It calls `erp.query.search` or `erp.query.neighbors` to find relevant entities. Search returns entity IDs + headlines (~100 tokens each).

**When agent wants to read one.** It loads `erp://entity/{id}`. That brings ~1-5K tokens of metadata + content into context. If the entity has bundled files (for a Skill) or a long transcript, those are separate URIs the agent loads on demand.

**When agent wants to write.** It calls `erp.entity.create` or `erp.entity.update`. Returns the new state + revision pointer. Writes are always logged to `actions`.

**Throughout.** The agent has access to `erp://vault/` as a mounted directory — via Managed Agents' filesystem API, it can `ls`, `read`, `grep` as if the vault is a local folder. This is the Agent Skills progressive disclosure pattern applied to the entire knowledge graph.

The net effect: **one session can fluidly traverse 100K entities without blowing context.** The agent pages in what it needs and drops it when done. MemGPT's OS-analogy memory, implemented in the transport layer.

### 6.4 Query planner — the "LLM Wiki" layer

The doc Gabriel already wrote (`03-personal-ai-os-deep-research.md`) introduces a "Query Planner" pattern where natural-language questions are decomposed into SQL + vector + compose steps by Claude Haiku, then executed. We keep this and upgrade it to run over the MCP surface.

The planner is itself an MCP tool:

```
erp.query.plan_and_run  {question, context?}
  → {steps: [...], result, citations: [entity_ids...]}
```

Inside: Haiku plans (SQL + vector + neighbor walk), sandboxed executor runs each step, Sonnet composes the final answer. Every step is logged in `actions`. The user sees answer + citations + optional trace.

**Why this is the right abstraction.** Gabriel should never write SQL against the ERP. He should ask questions. The planner converts questions into structured queries, runs them, cites the evidence. The same tool is called by agents internally (Writer agent asks "what did Tom say about the demo last week?" → planner returns the meeting snippet and the observation).

### 6.5 Permissions, safety, reversibility

Agents writing to personal data is nontrivially scary. Three layers of defense:

**Layer 1: ACL on every entity.** Each entity has `acl` JSONB with `read` and `write` rules. Options:
- `self` — only the user directly.
- `agent:AgentName` — specific named agents only.
- `role:reader` — any agent with read scope.
- `none` — locked (e.g., published content, historical decisions).

**Layer 2: Action budgets per agent per day.** Every AIAgent has a config with `max_writes_per_day`, `max_cost_usd_per_day`, `allowed_tool_calls[]`, `requires_user_approval_for[]`. If an action exceeds budget or requires approval, it's queued in a `/approvals` inbox instead of executing.

**Layer 3: Reversibility.** Every action is logged with `reversible=true` by default. The `erp.action.reverse` tool rolls back one action, producing a compensating revision. Ideally every action (except truly external side-effects like sending an email) can be undone within 24 hours.

The combined invariant: **nothing an agent does can silently corrupt Gabriel's system of record.** Everything is logged, most things are undoable, bigger-impact actions require approval.

### 6.6 The agent roster (rehomed from `03`)

The 8 agents described in `03-personal-ai-os-deep-research.md` — Librarian, Researcher, Analyst, Writer, Coach, Producer, Scheduler, Social — all fit this architecture naturally. Each is an `AIAgent` entity with:

- `config` (schedule, model, prompt, memory tier, write budget)
- `tool_surface` (subset of the MCP tools it's allowed to call)
- `skills[]` (which Skills it has access to)
- `state` (current run status, last_run_at)

Runtime: LangGraph-style stateful graphs, checkpointed, logged to `actions`. Initial implementation via Vercel Cron + API routes; upgrade to Managed Agents or durable Vercel Workflow when longer-running agents need it.

---

## 7. Lifecycle and state machines

Each master entity type has its own state machine. Three worked examples.

### 7.1 Goal lifecycle

```
    ┌────────┐  commit   ┌────────────┐  start   ┌────────┐
    │ DRAFT  ├──────────▶│ COMMITTED  ├─────────▶│ ACTIVE │
    └───┬────┘           └─────┬──────┘          └───┬────┘
        │                      │                    │
        │  abandon              │ deprioritize        │
        │                      ▼                    ▼
        │                ┌──────────┐       ┌─────────────┐
        └───────────────▶│ ARCHIVED │       │  ACHIEVED   │
                         └──────────┘       └─────┬───────┘
                                                  │
                                                  │  review
                                                  ▼
                                           ┌─────────────┐
                                           │  ARCHIVED   │
                                           └─────────────┘
```

- `DRAFT`: idea, not yet committed to as a pillar.
- `COMMITTED`: declared for the year/quarter.
- `ACTIVE`: actively advancing.
- `ACHIEVED`: measurable target hit.
- `ARCHIVED`: done, reviewed, put away.
- Auto-transition from `DRAFT` to `ARCHIVED` if untouched 30 days and not promoted (a dormancy rule).

### 7.2 Project lifecycle

```
    ┌───────┐     scope     ┌────────┐    start    ┌─────────┐
    │ IDEA  ├──────────────▶│SCOPED  ├────────────▶│ ACTIVE  │
    └───┬───┘               └───┬────┘             └────┬────┘
        │                       │                      │
        │                       │                      ├─── complete ──▶ COMPLETE
        │                       │                      │                     │
        │                       │                      ├─── pause ─────▶ PAUSED
        │                       │                      │                     │
        │                       │                      └─── kill ──────▶ DEAD ─┐
        │                       │                                               │
        │                       │                                               │
        │                       │                                               │
        └───────────────────────┴───────────────────────────────────────────────▶ ARCHIVED
```

- `PAUSED` can re-enter `ACTIVE`.
- `COMPLETE` and `DEAD` both flow to `ARCHIVED` eventually, but `DEAD` requires a `reason` before transition ("no time", "superseded by X", "wrong problem").
- `DEAD` projects can be resurrected — they move back to `IDEA` with a revision note. This is important for ADHD: you often kill something in despair and want it back 3 months later. The system preserves the thread.

### 7.3 Idea → Content → Artifact lifecycle (cross-entity pipeline)

This is the core productivity loop for the "ideas into content" use case. It's a cross-entity state machine where one entity transitions create new entities.

```
 ┌─────────────┐   refine   ┌──────────────┐   outline  ┌─────────────┐
 │ Idea (raw)  ├───────────▶│ Idea(refined)├───────────▶│ Content     │
 └─────────────┘            └──────────────┘            │ (outline)   │
                                                         └─────┬───────┘
                                                               │ draft
                                                               ▼
                                                         ┌─────────────┐
                                                         │ Content     │
                                                         │ (draft)     │
                                                         └─────┬───────┘
                                                               │
                                                               ├ review ──▶ Content(reviewed)
                                                               │
                                                               ├ prototype ▶ Artifact(wip)
                                                               │
                                                               └ publish ──▶ Content(published)
```

Every transition is an atomic action with a corresponding agent that can execute it:

- `refine`: Librarian agent runs classifier + structure extraction.
- `outline`: Writer agent produces a structured outline.
- `draft`: Writer agent drafts in Gabriel's voice.
- `review`: user-driven; Coach surfaces for review.
- `prototype`: Producer agent spins up HTML/code demo.
- `publish`: explicit user action; fires webhook to external service.

### 7.4 Commitment lifecycle (the ADHD safety net)

```
 ┌─────────┐  activate  ┌─────────┐   done    ┌─────────┐
 │  OPEN   ├───────────▶│ ACTIVE  ├──────────▶│  DONE   │
 └────┬────┘            └────┬────┘           └─────────┘
      │                      │
      │                      ├── deadline passed ──▶ OVERDUE
      │                      │                         │
      │                      │                         │ renegotiate / reschedule
      │                      │                         ▼
      │                      │                    ┌──────────┐
      │                      │                    │  ACTIVE  │
      │                      │                    └──────────┘
      │                      │
      │                      └── not done ──▶ BROKEN (triggers reflection)
      │
      └── never_mind ──▶ OBSOLETE
```

**Key behavior**: when a commitment goes `BROKEN`, the system generates a Reflection entity linking the broken commitment to the context. Over time these reflections accumulate into self-knowledge ("you systematically overcommit on demo prep on Wednesdays"). This is the feedback loop that turns ADHD from a constant leak into a compounding learning.

### 7.5 Meeting / Observation (transactional, minimal lifecycle)

Transactional entities have trivial lifecycles — essentially `new → closed → archived`. They're immutable after closure. Edits become `annotations` (child entities of kind `Observation` linked via `annotates`).

---

## 8. Event sourcing vs mutable records

### 8.1 The tension

Two patterns, each with virtues:

**Pure event sourcing**: nothing is mutable. Every state change is an immutable event. Current state is derived by folding events. Perfect auditability, replayable history, time-travel for free. Cost: complexity, read amplification, you can never "just edit" anything.

**CRUD with mutable records**: entities have current state. Easy to read, easy to edit, database does the heavy lifting. Cost: history is lost unless you explicitly audit log; corrections are destructive.

**Hybrid (temporal tables)**: mutable records *plus* an automatic history table. Compromise, and it's what most systems actually do.

### 8.2 The recommendation

**Hybrid, leaning event-sourced for the agent action surface, mutable-with-revisions for master entities.**

Specifically:

| Concept | Pattern | Rationale |
|---|---|---|
| `entities` (master, e.g., Person, Project) | mutable, with `revisions` table capturing every change as JSON Patch | current state is queried thousands of times a day; full history rarely needed, but always available |
| `entities` (transactional, e.g., Observation, Meeting, Decision) | append-only; immutable after `closed_at` | these are events by nature; editing them would be a lie |
| `edges` | bi-temporal: `valid_from` / `valid_to` | a fact's truth has a time range. Karl was Gabriel's manager from 2024 to 2026, not forever |
| `actions` (agent audit log) | pure append-only | never mutate, never delete; the accountability trace |
| `inbox` | CRUD until processed, then produces immutable transactional entities | short-lived staging area |

### 8.3 Why this is better than pure event sourcing

Pure ES is right for banking. For a personal ERP:

- Gabriel will directly edit Karl's bio or a project's `next_action` 20 times a day. Forcing every tiny edit through an event pipeline is ceremony.
- The revision log gives us history-on-demand without the replay cost.
- Queries against current state remain simple SQL.
- We still get the time-travel benefit by reconstructing from revisions when we need to (rare).

### 8.4 Why this is better than CRUD alone

- Reversibility: `erp.action.reverse(action_id)` works because every mutation is a revision with a predecessor pointer. Roll back = apply the inverse patch + mark the previous revision as current.
- Agent auditability: every tool call an agent makes is a logged action; revisions point to the action that caused them; you can trace "why is Karl tagged with #visa-issue?" back to "because the Librarian agent made this inference on 2026-04-05 from Meeting #412 at confidence 0.7."
- Time-travel debugging: "what did my project list look like last Friday?" is answerable by filtering revisions up to that timestamp.

### 8.5 A concrete flow

Librarian agent processes a meeting transcript and infers a new commitment:

1. Agent calls `erp.entity.create(type=Commitment, ...)`.
2. MCP server creates the entity, writes a revision with `previous_id=null`.
3. MCP server also writes an `actions` row with `kind='create'`, `target_id={new commitment id}`, `success=true`, `input={source meeting}`, `tool_calls={...}`.
4. Agent calls `erp.edge.create(source=commitment, target=person:arthur, edge='to')`.
5. MCP server creates the edge, writes to `actions` again.
6. A week later Gabriel realizes the inference was wrong.
7. He calls `erp.action.reverse(action_id={1})`.
8. MCP server walks the action, finds the affected entity, writes a new revision that archives it, links revision.reason = "reversed agent inference".

All state changes are traceable, everything can be undone, normal queries are still just `SELECT * FROM entities WHERE lifecycle='active'`.

---

## 9. Nested categories, concretely

This section answers Gabriel's explicit ask, using his real data.

### 9.1 The navigation vs storage distinction

First, a critical distinction:

- **Storage**: how data is represented in the database.
- **Navigation**: how Gabriel (or an agent) finds data.

Storage should be **flat + faceted**. Navigation can be **deeply nested**, rendered on demand from facet combinations.

### 9.2 Domain facet: the "work/personal" axis

The user's phrasing — "work things / personal-life things / within personal-life: fun things + serious things" — is a 2-level controlled hierarchy on the `domain` facet. Stored as:

```json
// vocabulary rows for facet=domain
{ slug: 'work', parent: null }
{ slug: 'work/oracle', parent: 'work' }
{ slug: 'work/oracle/netsuite', parent: 'work/oracle' }
{ slug: 'work/oracle/ai-club', parent: 'work/oracle' }
{ slug: 'work/external', parent: 'work' }
{ slug: 'personal', parent: null }
{ slug: 'personal/fun', parent: 'personal' }
{ slug: 'personal/serious', parent: 'personal' }
{ slug: 'personal/family', parent: 'personal' }
{ slug: 'personal/health', parent: 'personal' }
{ slug: 'personal/side-business', parent: 'personal' }
```

- Strict max depth of 3. This is a hard rule. If Gabriel wants more depth, he uses Topics (facet F3) instead.
- User can add/edit slugs at the vocabulary level; rarely changed.
- Every entity has `facets.domain = ['work/oracle/netsuite']` (or multi: `['work/oracle', 'personal/fun']` for things that cross).

**Navigation UI** renders this as a tree:
```
work/
  oracle/
    netsuite/
    ai-club/
  external/
personal/
  fun/
  serious/
  family/
  health/
  side-business/
```
Clicking a node filters to entities whose `facets.domain` contains that slug or any descendant.

### 9.3 Topic facet: the real polyhierarchy

The Domain facet is shallow and strict. The *real* nesting lives in `Topic`, which is a first-class MasterEntity with:

- `parent_topic` (multi-valued — topics can have multiple parents)
- `aliases[]`
- `description`

Example of Gabriel's topic hierarchy as a DAG:

```
ai-communication
  ├── thought-leadership
  │     ├── newsletter-writing
  │     ├── article-publishing
  │     └── talk-giving
  ├── demo-craft
  │     ├── live-demos
  │     └── customer-demos
  └── argument-library
        ├── openings
        ├── concessions
        └── call-to-action

personal-ai-os
  ├── capture
  ├── memory-architecture
  │     ├── hot-cold-tiering     (also child of: agent-engineering)
  │     ├── embeddings
  │     └── reflection
  ├── agent-society
  │     ├── librarian
  │     ├── researcher
  │     └── writer
  └── daily-rituals

netsuite-engineering
  ├── suiteapps
  │     ├── brazilian-localization
  │     ├── data-quality
  │     └── autonomous-finance
  ├── suitescript
  └── ml-models

brazilian-culture
  ├── literature
  │     └── pedagogy     (also child of: philosophy)
  ├── philosophy
  │     ├── pedagogy
  │     └── phenomenology
  └── music
```

Observations:
- `pedagogy` has two parents (`literature` and `philosophy`). It's a DAG, not a tree. Stored as `parent_topic = ['literature', 'philosophy']`.
- `hot-cold-tiering` appears under `memory-architecture` and `agent-engineering`. Same pattern.
- Topics have aliases (`"LLM wiki"` is an alias of `llm-os`).

Queries on topic walk the DAG with recursive CTEs: "show me every entity tagged with `ai-communication` or any descendant topic". This is the query that makes Gabriel's fragmented work legible again.

### 9.4 Walking the ask with a real example

"Show me every idea related to personal fun music that might ship this year."

Decomposed:
- Facet `domain`: `personal/fun` (or any descendant).
- Facet `topic`: `music-creation` + descendants.
- Facet `type`: `Idea` OR `Project` (idea promoted to project).
- Facet `lifecycle`: `refined | committed | active`.
- Facet `pillar`: `#5 Ship personal product`.
- Facet `temporal`: `target_ship_at <= 2026-12-31`.

Rendered as SQL:

```sql
SELECT e.*
FROM entities e
WHERE (e.facets->'domain' ?| ARRAY['personal/fun']
       OR e.facets->'domain' ?| (SELECT vocab_descendants('domain', 'personal/fun')))
  AND (e.facets->'topic' ?| (SELECT topic_descendants('music-creation')))
  AND e.type_id IN (SELECT id FROM entity_types WHERE slug IN ('idea','project'))
  AND e.lifecycle IN ('refined','committed','active')
  AND (e.facets->'pillar' ? '5')
  AND (e.metadata->>'target_ship_at')::date <= '2026-12-31';
```

At 100K entities this completes in under 50ms with proper indices. And a natural-language query against the query planner produces this SQL automatically.

### 9.5 Why this beats folder trees

- **No duplication.** `digital-studiolo` doesn't live in a folder; it has facets `[domain=personal/fun, topic=music-creation+ai-music, pillar=#5]`. The same record is reachable from any of those facets.
- **No orphans.** A project without a pillar is visible instantly (`facets.pillar = []`). Archive or assign — decide, don't drift.
- **Evolution is free.** If `music-creation` becomes part of a bigger `creative-expression` topic next year, you add `creative-expression` as a parent to `music-creation`. Every tagged entity inherits the new path automatically.
- **Agents can propose categories.** When the Librarian ingests a new entity, it proposes facet values with confidence scores. High-confidence proposals auto-apply; low-confidence ones go to Gabriel's approval queue. The system gets smarter with every ingest.

---

## 10. People as first-class entities

People deserve their own section because (a) Gabriel explicitly asked for it, and (b) the People layer is where most personal systems fail — contacts get stale, open topics are forgotten, nudges never happen.

### 10.1 Minimum viable Person schema

```
Person (inherits Entity + Agent + MasterEntity)
  display_name:         "Karl"
  full_name:            "Karl Surname"         (optional)
  aliases:              ["Karl S.", "manager"]
  contact_info:         {                       # JSONB
    emails: ["karl@oracle.com"],
    phones: [],
    handles: {linkedin: "...", twitter: "...", signal: "..."}
  }
  relationship:         "manager"               # enum: manager|report|peer|mentor|friend|family|external|aspiration
  importance:           5                       # 1-5
  first_met_at:         "2024-06-01"
  last_contacted_at:    "2026-04-06"
  contact_cadence_days: 7                       # target interval
  bio_summary:          "Oracle manager, ..."
  status:               "active"                # active|dormant|archived
  notes:                "... markdown ..."
  facets:               { domain: ['work/oracle'], topic: ['ai-strategy','hiring'] }
```

### 10.2 Relationships are edges, not fields

Every interaction Gabriel has with Karl produces edges:

- Meeting #445 `attended_by` Karl
- Commitment #88 `to` Karl
- Observation #1234 `about` Karl
- Project `brazil-tax` `discussed_with` Karl (meta: in meeting #445)
- Decision #77 `influenced_by` Karl (meta: rationale)

The `people` UI shows Karl's profile as:
- Header: name, role, last_contacted_at, next_action.
- Timeline: all edges, chronologically, most recent first.
- Open commitments: all Commitments with `to=Karl` where lifecycle=open|active|overdue.
- Open topics: Topics mentioned together with Karl in the last 30 days.
- Next step: either auto-suggested (Coach agent) or manually set.

### 10.3 Person resolution across captures

When a meeting transcript mentions "Karl", the system needs to know *which* Karl (if there are multiple) and create an `attended_by` edge. This is the classic entity resolution problem. Approach:

1. Librarian agent receives a new meeting.
2. Runs NER → extracts mentioned name strings.
3. For each string, calls `erp.person.resolve(name_fragment)` which uses FTS on `display_name || aliases` + vector similarity on `bio_summary`.
4. Returns ranked candidates with confidence.
5. If top candidate >0.9 confidence → auto-create edge.
6. If 0.5-0.9 → create edge with `metadata.needs_verification=true`, surface in approval queue.
7. If <0.5 → surface to Gabriel: "New person 'Karl'? Merge with existing, or create new?"

Low-confidence cases must never silently merge. Wrong merges are catastrophic.

### 10.4 Nudge loop

The Coach agent runs a weekly dormancy sweep:

```sql
SELECT p.*,
       EXTRACT(DAY FROM NOW() - p.last_contacted_at) as days_since,
       p.contact_cadence_days
FROM entities p
WHERE p.type_id = (SELECT id FROM entity_types WHERE slug='person')
  AND p.lifecycle = 'active'
  AND p.importance >= 3
  AND EXTRACT(DAY FROM NOW() - p.last_contacted_at) > p.contact_cadence_days;
```

For each row: generate a draft outreach message using the person's recent context (open topics, shared projects, last conversation) and surface in the weekly review. Gabriel approves (sends it), edits, or archives. The one-click outreach is what makes the loop actually work.

### 10.5 Privacy and sensitivity

Personal data about others is sensitive. Three safeguards:

- **Private by default.** Every Person has `acl.read = self`. Nothing leaks.
- **Redaction on export.** When exporting for sharing (not the personal vault), Person names can be hashed like FOAF's `mbox_sha1sum`.
- **No retention of unwanted data.** Archival-level entities still exist but are excluded from default queries and from agent contexts.

---

## 11. Integration with existing cunhas-brain and idea-crm

Brief because the user said "don't get bogged down here". Just enough to show it's possible.

### 11.1 Mapping the existing data

| Existing concept (cunhas-brain / idea-crm) | New model |
|---|---|
| `meetings` (cunhas-brain) | `entities` with type=Meeting |
| `meeting_summaries`, `meeting_metadata` | `entities.metadata` + `observations` as child entities |
| `notes` (cunhas-brain KB) | `entities` with type=Note (a new type, or a flavor of Observation) |
| `knowledge_edges` | `edges` with `edge_type=wikilink` |
| `customer_insights` | `observations` with `facets.topic=[customer-feedback]` |
| `netsuite_kt_reminders` | `commitments` with `facets.topic=[netsuite-kt]` |
| `students` | `entities` with type=Person + `relationship=student` |
| `artifacts` | `entities` with type=Artifact |
| `newsletters` | `entities` with type=Content + metadata.kind=newsletter |
| `app_settings.prompts_*` | `entities` with type=Skill |
| idea-crm `records` | `entities` — a pure subset |
| idea-crm `record_history` | `revisions` table |
| idea-crm `record_links` | `edges` |
| idea-crm `raw_sources` | `inbox` |
| idea-crm `interview_sessions` | `entities` with type=Session + linked actions |
| Cross-app `pillars` | `entities` with type=Goal |
| Workspace `projects` | `entities` with type=Project |

The two existing apps are essentially subsets of the unified model. Their migration is mostly mechanical: load each existing row, map columns to entity fields, mint a UUID, populate facets by mapping existing categorization.

### 11.2 The minimum viable migration path

1. Create the unified schema in a **new Neon database** (don't disturb production).
2. Write one-shot ETL scripts per source (cunhas-brain meetings, idea-crm records, workspace projects, vault notes).
3. Run the ETL, populate the new DB.
4. Stand up the new MCP server against the new DB.
5. Run both systems in parallel for 2-4 weeks. Writes go to both; reads go to whichever surface Gabriel is using.
6. Once the new system has all Gabriel's daily workflows, cut over reads. cunhas-brain + idea-crm become read-only historical mirrors, eventually archived.

Details are in Section 12.

---

## 12. Phased rollout

Three phases, each roughly 2-4 weeks of part-time work. Designed to preserve everything in the current system while migrating to the new one, with **zero** data loss.

### Phase 1 — Parallel schema, seed data (weeks 1-2)

**Goal**: stand up the unified schema in a new DB without touching cunhas-brain or idea-crm.

1. New Neon database `personal-erp`. Run the `entity_types`, `facets`, `entities`, `edges`, `revisions`, `actions`, `inbox`, `embeddings` migrations.
2. Seed `entity_types` with the 30 types from Section 3.
3. Seed `facets` with the 6 facets from Section 4; seed `vocabulary` with Gabriel's domain slugs and 9 pillars.
4. Write ETL scripts (Node.js or TypeScript):
    - `etl/from-cunhas-brain.ts`: pull meetings, notes, meeting_metadata, knowledge_edges, customer_insights, netsuite_kt_reminders, newsletters, artifacts, students → convert to entities + edges.
    - `etl/from-idea-crm.ts`: pull records, record_history, record_links, raw_sources → convert.
    - `etl/from-vault.ts`: walk the Obsidian vault, load markdown with frontmatter, convert to entities.
    - `etl/from-workspace.ts`: walk `~/Desktop/workspace/` + `projects.json`, convert projects.
5. Run ETLs, verify counts, eyeball 10 records from each source.
6. Build the revision entry for every migrated entity with `actor_kind='etl'` and `reason='migration:phase1'`.
7. Stand up the FTS + pgvector indices, embed everything.
8. **Deliverable**: new DB is populated with a full snapshot. No app uses it yet.

**Dual-running during this phase**: writes to cunhas-brain + idea-crm continue as normal. Every hour, an incremental ETL job re-applies deltas to the new DB. The new DB stays <= 1h stale.

### Phase 2 — MCP server, agent surface, read-only dashboard (weeks 3-4)

**Goal**: expose the new DB via the MCP surface. Build a minimal read-only dashboard on top. Use the new system to *read* while the old system keeps doing *writes*.

1. Build `mcp-erp` server — Node.js, uses the `@modelcontextprotocol/sdk`. Implement the tools and resources from Section 6.2 as an in-process server talking to Neon. Initial scope: read tools + `erp.inbox.capture`.
2. Plug the MCP server into Claude Code (local dev), claude.ai (remote), Cursor (editor), and the Managed Agents infra (agents).
3. Point existing cunhas-brain and idea-crm apps at the new DB for *reads* via a feature flag (they can fetch entities through the MCP HTTP gateway). Writes still go to the original tables.
4. Build a minimal new Next.js app `personal-erp-ui` with:
    - Dashboard (counts, pillars, dormant list)
    - Entity browser (by type, by facet)
    - Search (NL → planner → results)
    - Daily brief (derived view)
    - Person detail page
5. Drop Claude Code directly onto the ERP — use it as the primary capture/review surface during this phase.
6. **Deliverable**: Gabriel can use Claude against the ERP to read his entire workspace. The dashboard shows the correct state. Writes still happen in old apps, but deltas flow in.

### Phase 3 — Cut over writes, decommission old (weeks 5-8)

**Goal**: the new ERP becomes the source of truth. Old apps are archived.

1. Enable writes in `mcp-erp`: entity.create/update/transition, edge.create, inbox.process.
2. Build the Librarian, Analyst, Coach, Scheduler agents on top of the new tool surface. (Writer, Researcher, Producer come later.)
3. Migrate capture surfaces:
    - Krisp webhook: write meetings directly into new DB via MCP.
    - Raycast hotkey: `erp.inbox.capture`.
    - Voice: same.
    - Browser extension: same.
4. Freeze writes on cunhas-brain + idea-crm. Add a banner "This app is now read-only. Use `personal-erp-ui` for all writes."
5. Run a final ETL pass to catch any deltas, verify conservation (count of entities, count of edges, sample 20 rows round-trip).
6. After 2 weeks of clean operation, archive the old apps. Tag `v1-final` in git. Export old DBs to `.sql.gz` files in `/archive/`.
7. **Deliverable**: one unified system. Old apps preserved as historical snapshots.

### Dual-run safety rules

- **Never delete during migration.** Old DBs remain until Phase 3 is stable for 2 weeks.
- **Always include `origin`** on every migrated entity so we can trace back to which app it came from.
- **Keep ETL replayable**: it reads from old DB snapshots, writes to new DB, must be idempotent. If migration has a bug, fix the script, drop new DB tables, re-run.
- **Backups before every migration pass.** `pg_dump` of both the old and new DBs before every ETL run.

---

## 13. Risks, unknowns, failure modes

### 13.1 Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Schema meta-schema is over-abstracted, becomes slow to evolve because every type change is a config change with no compile checks | Medium | Ship Zod/Drizzle schemas as the compile-time truth layer; meta-schema is derived from them |
| Agents silently corrupt data through wrong inferences | High | ACL + action log + reversibility + low-confidence approval queue |
| Postgres hot spots when agents write simultaneously | Low (at scale) | Single-writer app layer serializes; Neon branching for experiments |
| Markdown vault and Postgres drift apart | Medium | Weekly reconciliation agent; write-through + watcher with hash-based change detection |
| The 30-entity ontology is wrong; 10 types are enough or 50 are needed | Medium | Start with 8-10 types in Phase 1, add rest as needed; meta-schema makes this cheap |
| Taxonomies sprawl over time (topic DAG becomes a mess) | Medium | Quarterly topic-gardening review with an agent proposing consolidations; upper limit on topic count |
| User won't actually migrate; keeps using old system out of habit | High | Phase 2 forces read through new UI; Phase 3 freezes writes on old |
| Cost of LLM calls for ingest/reflection explodes | Medium | Haiku for 90% of calls; daily cost budget per agent; cache aggressively |
| The system is so powerful it paralyzes the user | Low but fatal | Always-visible "next 3 things" view; single ritual per day (morning brief); no setting choices in daily flow |
| Vendor lock-in on Claude Managed Agents | Low | MCP is open; the DB is Postgres; the vault is plain markdown; the agents are just loops — portable to any runtime |

### 13.2 Unknowns that need more research

- **Best embedding model in 2026**: `text-embedding-3-small` is the current default but competitors (Voyage, Cohere, Nomic) have moved. Benchmark before committing.
- **Graph query performance at 500K edges**: untested for Gabriel's specific query shapes. If recursive CTEs start hurting, evaluate `pg_graph` vs Apache AGE vs Neo4j sidecar.
- **Temporal consistency for bi-temporal edges**: the `valid_from`/`valid_to` model works for simple facts. For complex facts ("Karl was my manager from X to Y but also my friend throughout"), edge metadata may need its own time range.
- **Skills authoring by agents**: Voyager-style "agent writes new skills" is the dream but in practice agents write poor skills. Need a review-and-merge flow.
- **Conflict resolution between Postgres and vault** when Gabriel edits simultaneously on two machines: current last-write-wins is naive. CRDTs? OT? Probably fine at one-user scale.
- **Mobile capture**: the whole plan assumes desktop-first. Gabriel also carries a phone. Needs design.
- **iOS/macOS native UI** for voice capture and daily brief playback.
- **Offline behavior**: what happens during travel? Local SQLite cache + sync on reconnect is probably necessary.

### 13.3 Failure modes

**Silent drift**: the system gradually degrades because bad data accumulates. Mitigated by weekly review ritual (the Coach agent forces it), dormancy surfacing, and mandatory lifecycle transitions.

**Agent runaway**: an agent enters a feedback loop, writes thousands of entities, blows budget. Mitigated by daily budgets, write rate limits, and runtime kill-switch.

**Data loss from ETL bug**: a migration script drops or mangles rows. Mitigated by backups before every ETL, round-trip counts, and never deleting from old systems until new is stable.

**ADHD burnout**: user stops using the system for 3 weeks. Returns to chaos. Mitigated by the system running autonomously while the user is away — agents keep ingesting, surfacing, nudging. When the user returns, the daily brief tells them exactly where they left off.

---

## 14. Concrete architectural decisions the user must make

Before a line of code is written for the new system, Gabriel must make the following decisions. Each is listed with the options and my recommendation. **These are architectural, not implementation.**

### D-01. Single DB or multi-DB?

- **Option A**: one unified Postgres database (`personal-erp`) holding everything.
- **Option B**: separate databases per concern (knowledge, people, projects, actions).

**Recommendation: A.** At 100K entities, a single DB is simpler, enables cross-type joins trivially, and branches atomically. Section 5.3.

### D-02. Postgres vs SurrealDB vs Neo4j as the core store?

- **Option A**: Postgres + pgvector + FTS (the boring-good choice).
- **Option B**: SurrealDB (bet on the unified multi-model vision).
- **Option C**: Neo4j + external vector index (bet on graph queries being central).

**Recommendation: A.** Section 2.4. Reconsider at 1M entities.

### D-03. Markdown vault as source of truth, or as derived export?

- **Option A**: Postgres is source; vault is regenerated output.
- **Option B**: Vault is source; Postgres is derived index (rebuilt from vault).
- **Option C**: Bidirectional, conflict-resolved.

**Recommendation: C, biased toward Postgres-first.** Writes from apps/agents hit Postgres; writes from Gabriel's Obsidian hit files and are watched back. Section 5.6.

### D-04. Strict tree categories, polyhierarchical DAG topics, or faceted?

- **Option A**: Strict folder tree (Johnny Decimal style).
- **Option B**: Polyhierarchical topic DAG only.
- **Option C**: Faceted classification with a shallow controlled `domain` facet + polyhierarchical `topic` facet (the proposed model).

**Recommendation: C.** Section 4, Section 9. This is one of the most consequential decisions — get it wrong and you rebuild in 6 months.

### D-05. One universal `entities` table or a table per type?

- **Option A**: One `entities` table with `type_id`, `metadata` JSONB, `facets` JSONB (Frappe/Notion-style).
- **Option B**: One SQL table per entity type, with a view table unifying them.

**Recommendation: A.** Section 5.3. The flexibility is worth the slight query cost at personal scale.

### D-06. Append-only, mutable-with-revisions, or full event sourcing?

- **Option A**: Pure append-only event log, current state derived by fold.
- **Option B**: Mutable entities + revisions (JSON patches) + append-only action log.
- **Option C**: CRUD only, no history.

**Recommendation: B.** Section 8.2. Hybrid: transactional entities are immutable, master entities are mutable-with-revisions, actions are pure append-only.

### D-07. MCP as the primary agent interface, or a custom REST/GraphQL?

- **Option A**: MCP server is the only write path; web UI is just a wrapper.
- **Option B**: Custom REST API is primary; MCP adapter is secondary.
- **Option C**: Both in parallel.

**Recommendation: A.** Section 6.1. LLM-first forces clean thinking; human UIs come free afterward.

### D-08. Run agents in Vercel Cron/Functions, Vercel Workflow, or Claude Managed Agents?

- **Option A**: Start with Vercel Cron + Functions. Simple. Ship in a week.
- **Option B**: Use Vercel Workflow for durable multi-step agents.
- **Option C**: Move to Claude Managed Agents for long-running sessions.

**Recommendation: A for Phase 1-2, mix A+B+C from Phase 3.** Librarian and Coach are short, simple — Cron. Writer and Researcher may need hours of context — Managed Agents session. Producer needs durable workflow with retries — Vercel Workflow.

### D-09. How many of the 30 entity types to implement in Phase 1?

- **Option A**: All 30 (comprehensive but slow).
- **Option B**: 8-10 core types, grow via meta-schema (Person, Project, Goal, Meeting, Observation, Note, Commitment, Content, Artifact, Skill).
- **Option C**: Just 4 (Person, Project, Goal, Note) — radical MVP.

**Recommendation: B.** Ships in weeks, covers 90% of real queries, room to grow. Section 12.

### D-10. Pillars: hard-coded as structured enums, or full entities you can edit?

- **Option A**: 9 pillars hard-coded in schema (fastest).
- **Option B**: Pillars are Goal entities, stored in the `entities` table, editable at runtime.

**Recommendation: B.** Gabriel will renumber and rewrite pillars between years. Hard-coding means a migration every December.

---

## 15. The five most important decisions, in order

Out of the 10 in Section 14, these are the five that change the shape of everything downstream. Get these right and the rest fall out naturally.

1. **D-04 — Faceted classification with controlled shallow `domain` + polyhierarchical `topic`.** This is the structural foundation of every query, every view, every agent filter. Wrong choice here = eternal folder churn.

2. **D-05 — One universal `entities` table with `type_id`, `facets` JSONB, and a meta-schema describing types.** This is what makes the system evolve without migrations and what makes the MCP surface uniform.

3. **D-06 — Hybrid: mutable master entities with revision logs, immutable transactional entities, pure append-only agent action log.** This is what makes agents auditable, reversible, and trustable.

4. **D-07 — MCP server is the primary write interface; UIs are downstream clients.** This forces clean API thinking and makes the whole ERP available to any current or future agent.

5. **D-01/D-02 — One Postgres + pgvector + FTS instance, Neon-hosted.** Avoid premature multi-DB complexity; pick the boring tool that scales to 10x Gabriel's needs.

Everything else (state machines, agent roster, phase plan, UI surfaces) is downstream of these five.

---

## 16. Closing note

This architecture is designed so that **Gabriel's thinking compounds instead of rotting**. Three principles make that happen:

1. **Everything has a home.** Every thought, every commitment, every decision lives in the system. No capture gap.
2. **Everything has a lifecycle.** Nothing hangs in purgatory. Decisions are forced.
3. **Everything is agent-accessible.** The whole knowledge graph is reachable from Claude via MCP. Agents can read, propose, act, and be audited.

The ERP is the substrate. The agents are the workforce. Gabriel's judgment is the compass. Built right, in 12 months, Gabriel has a system where the average day looks like the fictional morning brief from `03-personal-ai-os-deep-research.md`, Section 6 — and where every year of data makes the next year's output easier.

Architecture is a forcing function for the right conversations. The decisions in Section 14 are where those conversations start. Once those are decided, shipping is straightforward.

The hardest part has never been building. The hardest part is making sure the thing you build rewards daily use. This model does, because facets, lifecycles, and agents conspire to pull Gabriel into a weekly rhythm he can't cheat. And when he's on a plane or at the café filosofia, the system keeps running without him.

---

## Sources

**ERPs and meta-models**
- [NetSuite Record Types](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_N3428928.html)
- [NetSuite Item Master Data](https://www.netsuite.com/portal/resource/articles/inventory-management/item-master-data.shtml)
- [NetSuite Applications Suite — Static Data Model](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/article_164485063706.html)
- [Frappe ERPNext DocType documentation](https://docs.frappe.io/erpnext/user/manual/en/doctype)
- [Frappe DocType development guide](https://www.mintlify.com/frappe/erpnext/developers/doctype)
- [Understanding DocTypes — Frappe Framework](https://docs.frappe.io/framework/user/en/basics/doctypes)

**Knowledge management prior art**
- [Exploring Notion's Data Model: A Block-Based Architecture](https://www.notion.com/blog/data-model-behind-notion)
- [Tana Supertags documentation](https://tana.inc/docs/supertags)
- [Tana Fields documentation](https://tana.inc/docs/fields)
- [Capacities object types reference](https://docs.capacities.io/reference/content-types)
- [Obsidian Dataview docs](https://blacksmithgu.github.io/obsidian-dataview/)
- [Obsidian Dataview metadata guide](https://blacksmithgu.github.io/obsidian-dataview/annotation/add-metadata/)
- [Notion databases docs](https://developers.notion.com/reference/database)
- [PARA method and Johnny Decimal comparison](https://crystaljjlee.com/blog/two-approaches-to-pkm/)
- [Mixing Johnny Decimal and Second Brain (Luca Franceschini)](https://lucaf.eu/2023/02/23/luca-decimal.html)

**Agent-facing data shapes**
- [Claude Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview)
- [Claude Agent Skills overview](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)
- [Anthropic engineering — Equipping agents for the real world with Agent Skills](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)
- [Anthropic engineering — Scaling Managed Agents](https://www.anthropic.com/engineering/managed-agents)
- [Knowledge Graph Memory MCP Server](https://www.pulsemcp.com/servers/modelcontextprotocol-knowledge-graph-memory)
- [Neo4j — What Is Model Context Protocol (MCP)?](https://neo4j.com/blog/genai/what-is-model-context-protocol-mcp/)
- [MCP Knowledge Graph (shaneholloman fork)](https://github.com/shaneholloman/mcp-knowledge-graph)

**Agent architectures and memory**
- [Generative Agents paper (arXiv 2304.03442)](https://arxiv.org/abs/2304.03442)
- [Stanford HAI — Computational Agents Exhibit Believable Humanlike Behavior](https://hai.stanford.edu/news/computational-agents-exhibit-believable-humanlike-behavior)
- [MemGPT paper (arXiv 2310.08560)](https://arxiv.org/abs/2310.08560)
- [Letta MemGPT documentation](https://docs.letta.com/concepts/memgpt/)
- [Mem0 paper (arXiv 2504.19413)](https://arxiv.org/abs/2504.19413)
- [Voyager paper (arXiv 2305.16291)](https://arxiv.org/abs/2305.16291)
- [Voyager project page (MineDojo)](https://voyager.minedojo.org/)
- [NVIDIA blog — Voyager](https://blogs.nvidia.com/blog/ai-jim-fan/)
- [A-Mem paper (arXiv 2502.12110)](https://arxiv.org/pdf/2502.12110)
- [CrewAI vs LangGraph vs AutoGen comparison (DataCamp)](https://www.datacamp.com/tutorial/crewai-vs-langgraph-vs-autogen)
- [Multi-Agent Frameworks Explained (adopt.ai, 2026)](https://www.adopt.ai/blog/multi-agent-frameworks)
- [Illustrated LLM OS](https://huggingface.co/blog/shivance/illustrated-llm-os)
- [Karpathy — LLM OS tweet/overview](https://x.com/karpathy/status/1707437820045062561)

**Databases at personal-graph scale**
- [pgvector vs Neo4j comparison (Zilliz)](https://zilliz.com/blog/pgvector-vs-neo4j-a-comprehensive-vector-database-comparison)
- [SurrealDB 3.0 benchmarks](https://surrealdb.com/benchmarks)
- [SurrealDB in 2025 analysis](https://caperaven.co.za/2025/04/01/surrealdb-in-2025-a-comparative-analysis-across-database-categories-briefing-document/)
- [Graph Database vs Vector Database full comparison (2026)](https://www.ismatsamadov.com/blog/graph-database-vs-vector-database)
- [Building a personal knowledge graph with just PostgreSQL](https://dev.to/micelclaw/4o-building-a-personal-knowledge-graph-with-just-postgresql-no-neo4j-needed-22b2)

**Taxonomy, ontology, classification theory**
- [Schema.org vocabulary and data model](https://schema.org/docs/datamodel.html)
- [Schema.org full hierarchy](https://schema.org/docs/full.html)
- [FOAF (Friend of a Friend) — Wikipedia](https://en.wikipedia.org/wiki/FOAF)
- [Introduction to FOAF (xml.com)](https://www.xml.com/pub/a/2004/02/04/foaf.html)
- [Faceted classification — Wikipedia](https://en.wikipedia.org/wiki/Faceted_classification)
- [Ranganathan and faceted classification theory](https://www.redalyc.org/journal/3843/384357586006/html/)
- [Faceted Classification and Faceted Taxonomies — Hedden](https://www.hedden-information.com/faceted-classification-and-faceted-taxonomies/)
- [Faceted Classification — The Discipline of Organizing](https://berkeley.pressbooks.pub/tdo4p/chapter/faceted-classification/)

**Event sourcing vs CRUD and temporal data**
- [Event Sourcing vs CRUD (DEV Community)](https://dev.to/alex_aslam/event-sourcing-vs-crud-when-1000-database-writes-dont-matter-5bpj)
- [Event Sourcing vs CRUD (RisingStack)](https://blog.risingstack.com/event-sourcing-vs-crud/)
- [Event Sourcing Explained — Practical Guide (2026)](https://dev.to/young_gao/event-sourcing-explained-when-crud-is-not-enough-4od5)
- [Temporal tables vs event sourcing](https://event-driven.io/en/temporal_tables_and_event_sourcing/)
- [Event Sourcing Pattern — Azure Architecture Center](https://learn.microsoft.com/en-us/azure/architecture/patterns/event-sourcing)
