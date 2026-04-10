# Cunha's Brain — Activity Log

### 2026-04-07
- **Project**: cunhas-brain
- **Change**: Built UI for meeting categorization. Added `src/lib/categoryMeta.ts` (CATEGORIES constant + `CategoryId` type + `getCategoryMeta` helper), `src/components/CategoryBadge.tsx` (reusable clickable pill with confidence tooltip), `src/components/TodaysMeetings.tsx` (fetches `/api/meetings/today` on mount + every 60s, skeleton loading, empty state, per-meeting card with category pill dropdown to manually override, confidence badge, `Summarize` button when no summary, `Re-classify` otherwise), and `src/components/PromptsEditor.tsx` (tabbed editor for all 7 prompt keys with monospace textarea, placeholder legend, JSON schema preview, data-flow pipeline visualization, Save to `/api/settings`, Reset to Default from `/api/prompts/defaults`). Added `src/app/api/prompts/defaults/route.ts` that dynamically reads constants from `@/lib/categoryPrompts` with safe fallbacks for missing student first/subsequent exports. Wired TodaysMeetings above the todos list in `src/components/Dashboard.tsx` and PromptsEditor above App Info in `src/app/settings/page.tsx`. No existing behavior changed.
- **Outcome**: `npm run build` succeeds with no TS errors. Dashboard shows a Today's Meetings section with inline category dropdown + Summarize/Re-classify actions. Settings has a Prompts & Pipelines section with 7 tabs (Classifier, NetSuite KT, Manager 1:1, Customer, Student First, Student Subsequent, Others), each showing editable prompt, available placeholders, expected JSON schema, and where each field lands in the DB.

### 2026-04-07
- **Project**: cunhas-brain
- **Change**: Built meeting classification + category pipeline system. Added `src/lib/categoryPrompts.ts` (default prompts for classifier + 5 categories: netsuite_kt, manager_1on1, customer_engagement, student_lesson, others — plus `getPrompt` app_settings loader and `fillPrompt` placeholder filler). Added `src/lib/meetingClassifier.ts` with `classifyMeeting`, `runCategoryPipeline`, `processMeetingCategory` — loads meeting + summary context, calls `claude-haiku-4-5-20251001`, uses balanced-brace JSON extraction, inserts into `netsuite_kt_reminders`, `manager_followups`, `customer_insights`, and mirrors parsed data into `meeting_summaries.category_data`. Added POST/GET route `src/app/api/meetings/[id]/categorize/route.ts` supporting auto-classify, manual override, and category hint flows. Added GET route `src/app/api/meetings/today/route.ts` returning today's meetings joined with category info. Updated `src/app/api/meetings/[id]/summarize/route.ts` to auto-run `processMeetingCategory` after summary generation inside a try/catch so classification failures cannot break summary generation.
- **Outcome**: `npm run build` succeeds with no TS errors. Summaries now auto-classify and fan out to per-category extractors; users can override via POST `/api/meetings/:id/categorize` with `{category, manual: true}`. Category data is stored in structured tables + mirrored in `meeting_summaries.category_data`.

### 2026-03-29
- **Project**: cunhas-brain
- **Change**: Added PDF and Markdown download buttons to StudentDetail page. Added `generateMarkdown()` function that builds a complete markdown document from all student data (profile, learning plan, session history with all insights). "Download MD" triggers a Blob download as `{name}_profile.md`. "Download PDF" opens a print-friendly HTML window with auto `window.print()`. Also added rendering for new session insight fields: `keyLearnings` (checkmark list), `bestPractices` (star list), and `buildProjects` (styled cards with instruction, learning, and reasoning). Added `strengths` and `gaps` fields to profile section.
- **Outcome**: Students page now supports full data export and displays richer session insights.

### 2026-03-29
- **Project**: cunhas-brain
- **Change**: Redesigned Artifacts and Knowledge Base pages from sidebar-list + detail panel layout to a Claude-inspired card gallery + detail flow. Gallery view shows a responsive card grid (3/2/1 columns) with iframe thumbnail previews for artifacts and rendered markdown previews for notes, plus search bar and tag filter pills. Clicking a card transitions to a detail view with back-to-gallery button, 60/40 split (content left, AI analysis right), and mobile-responsive stacking. All existing functionality preserved (upload modals, bulk upload, delete, fullscreen, graph tab, chat tab).
- **Outcome**: Both pages now use a modern gallery-first layout matching the Claude artifact gallery style, with hover effects, gradient fades on card previews, and tag filtering.

### 2026-03-29
- **Project**: cunhas-brain
- **Change**: Fixed KnowledgeBase component -- two critical issues. (1) Markdown rendering: replaced inline wikilink badge injection (which broke ReactMarkdown into fragments) with pre-processing that converts `[[keyword]]` to bold text and shows wikilinks as a separate clickable badges section below content; wrapped rendered markdown in a styled document container with proper prose typography (headings, paragraphs, lists, code blocks, blockquotes). (2) Knowledge graph: fixed "No notes yet" overlay showing despite nodes existing (was checking ref which doesn't trigger re-render, switched to state); fixed invisible nodes/labels by replacing CSS `var()` usage in canvas context with actual color values; added node coloring by connection count, white node borders, dark pill backgrounds behind labels, glow effect on hover, and subtle dot grid background.
- **Outcome**: Note preview renders clean formatted markdown with wikilinks as a separate section. Knowledge graph shows colorful visible nodes with readable labels and no false "empty" overlay.

### 2026-03-29
- **Project**: cunhas-brain
- **Change**: Added bulk file upload to KnowledgeBase and ArtifactsView upload modals. Both now have a "Paste" / "Upload Files" toggle. Upload Files mode supports selecting multiple files or an entire folder (webkitdirectory). Selected files are listed with checkboxes, file sizes, and client-side duplicate detection against existing titles. Duplicates are flagged with a warning badge and unchecked by default. Sequential upload with progress bar. Errors on individual files are caught and displayed without stopping the batch.
- **Outcome**: Both Knowledge Base and Artifacts support bulk file upload with duplicate detection, progress tracking, and error handling.

### 2026-03-29
- **Project**: cunhas-brain
- **Change**: Built Knowledge Base / Notes feature. Created 4 API routes: `src/app/api/notes/route.ts` (GET list, POST with AI analysis via Claude -- generates summary, key topics, auto-inserts wikilinks, builds knowledge_edges), `src/app/api/notes/[id]/route.ts` (GET with connected notes, PUT with AI re-processing and edge rebuild, DELETE with edge cleanup), `src/app/api/notes/graph/route.ts` (full knowledge graph nodes + edges), `src/app/api/notes/chat/route.ts` (streaming chat with all notes as context). Created `KnowledgeBase.tsx` component with 3 tabs: Notes List (two-panel with search, note cards, markdown rendering with clickable wikilink badges, upload modal with .md file support), Knowledge Graph (force-directed canvas graph with zoom/pan/hover/click, no external dependencies), Chat (streaming AI chat against the knowledge base). Added `/knowledge` page and Knowledge nav link.
- **Outcome**: Fully functional Obsidian-style knowledge base with AI-powered note analysis, automatic wikilink detection and cross-linking, visual knowledge graph, and conversational AI interface over the note corpus.

### 2026-03-29
- **Project**: cunhas-brain
- **Change**: Built Artifacts feature. Created API routes (`src/app/api/artifacts/route.ts` for GET list/POST upload, `src/app/api/artifacts/[id]/route.ts` for GET/PUT/DELETE single artifact). POST and PUT auto-generate AI explanations via Claude (whatItIs, keyInsights, relatedConcepts, technologiesUsed). Created `ArtifactsView` component with two-panel layout: left panel has upload button, search bar, and artifact cards list; right panel has sandboxed iframe live preview (60%) and AI explanation display (40%). Upload modal supports both file upload and code paste with auto file-type detection. React/JSX files are wrapped in HTML template with React CDN for rendering. Added fullscreen preview mode. Created artifacts page at `/artifacts`. Added Artifacts link to Nav between GitHub and Students. Responsive layout stacks vertically on mobile.
- **Outcome**: Fully functional artifact upload, preview, and AI analysis system with live rendering and structured explanations.

### 2026-03-29
- **Project**: cunhas-brain
- **Change**: Enhanced Student Management feature. (1) Upgraded meeting attachment API to generate rich session insights (sessionSummary, todos, recommendations, topicsDiscussed, progressNotes, nextSessionPlan) stored as JSON in session_notes column -- first meeting also generates profile + learning plan, subsequent meetings generate per-session insights without changing the plan. (2) Redesigned StudentDetail with collapsible Profile/Learning Plan sections, session timeline with numbered expandable cards, "First Session" badge, topics as tag badges, todos as checklists, AI processing indicator, and clickable meeting links. (3) Improved StudentList cards to show session count, total hours, last session date, progress bar based on learning plan topics, and platform badge. (4) Enhanced students list API to return last_session_date and total_duration.
- **Outcome**: Richer AI-powered session analysis with structured insights per meeting, and a complete visual redesign of student detail and list views.

### 2026-03-29
- **Project**: cunhas-brain
- **Change**: Built Inoreader Newsletters feature. Created API route (`src/app/api/newsletters/route.ts`) with GET (fetch from Inoreader API with date range, cache in DB) and POST (generate AI summary with Claude Haiku). Created `NewslettersView` component with quick date range buttons, custom date pickers, daily feed view grouped by date, and AI summary view. Created newsletters page at `/newsletters`. Added Newsletters link to Nav between Chat and GitHub. Added Inoreader token input and integration card to Settings page. Updated settings API to mask tokens.
- **Outcome**: Full newsletter aggregation system at /newsletters with Inoreader RSS feed integration, local caching, and AI-powered summaries.

### 2026-03-29
- **Project**: cunhas-brain
- **Change**: Built Student Management feature. Created 3 API routes (students CRUD, student detail with meetings, attach meeting with AI processing), 2 components (StudentList grid with search/add form, StudentDetail with profile/learning plan/meeting history/attach meeting), 2 pages (students list, student detail), and added Students link to Nav. AI auto-generates student profile and learning plan on first meeting attachment using Claude Haiku, and generates session notes/homework/next session plan on subsequent meetings.
- **Outcome**: Full student management system with AI-powered learning plan generation integrated into the app at /students.

### 2026-03-29
- **Project**: cunhas-brain
- **Change**: Built desktop notification system for new meetings. Created API endpoint (`src/app/api/notifications/route.ts`) with GET (polls for new meetings since timestamp, auto-generates summaries) and POST (tracks notification actions). Created local Mac notifier script (`scripts/notifier.js`) that polls the API and shows native macOS notifications with dialog action buttons. Created LaunchAgent installer (`scripts/install-notifier.sh`). Added `/api/notifications` to PUBLIC_PATHS in middleware.
- **Outcome**: After a Krisp meeting ends, the notifier polls every 5 minutes, auto-generates summaries if missing, and shows a macOS notification with summary and todos. Meetings with action items get a dialog with "Open in Browser" button.

### 2026-03-29
- **Project**: cunhas-brain
- **Change**: Enhanced Claude Code integration. Added "Project Folders" section to Settings page (add/remove folder paths stored as JSON in app_settings). Replaced simple "Copy Claude cmd" / "Open in VS Code" buttons in Dashboard with a "Run in Claude Code" inline expansion panel featuring folder picker, notes textarea, command preview, and Copy Command / Open VS Code action buttons.
- **Outcome**: Users can configure project folders in Settings, then from any Dashboard todo, expand the Claude Code panel to pick a folder, add context notes, preview the full `claude -p` command, and copy or open in VS Code with one click.

### 2026-03-29
- **Project**: cunhas-brain
- **Change**: Built GitHub feature. Created 3 new files: GitHub API route (`src/app/api/github/route.ts`) with repos and activity endpoints using GitHub API, GitHubView component (`src/components/GitHubView.tsx`) with tabbed repos grid and activity feed, and GitHub page (`src/app/github/page.tsx`). Modified `src/components/Nav.tsx` to add GitHub link and `src/app/settings/page.tsx` to add GitHub token input and integration card.
- **Outcome**: GitHub page shows user repositories (2-col grid with language badges, stars, issues) and activity feed (color-coded event types) with auto-refresh. Token management integrated into Settings page with masked display and username resolution.

### 2026-03-29
- **Project**: cunhas-brain
- **Change**: Built Dashboard feature. Created 3 new files: todos API route (`src/app/api/todos/route.ts`) with GET/PATCH for action items from meeting summaries, Dashboard component (`src/components/Dashboard.tsx`) with stats bar, filter tabs, search, and todo toggling, and dashboard page (`src/app/dashboard/page.tsx`). Modified `src/app/page.tsx` to redirect to `/dashboard` and `src/components/Nav.tsx` to add Dashboard and Logs links.
- **Outcome**: Dashboard is the new landing page showing aggregated action items from all meetings with status tracking, filtering, and search.

### 2026-03-29
- **Project**: cunhas-brain
- **Change**: Created foundation files for the Next.js 14 app. Added 15 files: Supabase client (`src/lib/supabase.ts`), TypeScript interfaces (`src/lib/types.ts`), cookie-based auth system (`src/lib/auth.ts`, `src/middleware.ts`, `src/app/api/auth/route.ts`), Krisp transcript parser (`src/lib/transcript.ts`), Anthropic client (`src/lib/anthropic.ts`), system prompts (`src/lib/prompts.ts`), utility functions (`src/lib/utils.ts`), dark-themed `globals.css`, root layout with Inter font and Nav component (`src/app/layout.tsx`, `src/components/Nav.tsx`), login page (`src/app/login/page.tsx`), home redirect (`src/app/page.tsx`), and debounce hook (`src/hooks/useDebounce.ts`).
- **Outcome**: App skeleton is complete with dark theme (indigo accent), auth flow, and all core library modules ready for feature development.

### 2026-03-29
- **Project**: cunhas-brain
- **Change**: Built chat and settings features. Created 8 files: streaming chat API route (`src/app/api/chat/route.ts`) with Claude Haiku, chat history GET endpoint, settings API route (`src/app/api/settings/route.ts`) with masked key display, MeetingSelector component (searchable checkbox list), ChatMessage component (markdown rendering for assistant, bubbles), ChatInterface component (streaming reader, auto-scroll, session management), chat page with two-panel layout and mobile responsive sidebar, settings page with API key management and toast notifications, and useChatSession hook (localStorage UUID persistence).
- **Outcome**: Chat feature is fully wired: meeting selection -> transcript loading -> Claude streaming -> real-time display. Settings page allows API key management via app_settings table.

### 2026-03-29
- **Project**: cunhas-brain
- **Change**: Built the meetings feature. Created 11 files: meetings list API route (`src/app/api/meetings/route.ts`) with search, pagination, and date filtering; meeting detail API route (`src/app/api/meetings/[id]/route.ts`) with full transcript parsing; summarize API route (`src/app/api/meetings/[id]/summarize/route.ts`) with Claude Haiku generation and caching in meeting_summaries table; MeetingCard component (clickable card with metadata badges); SearchBar component (debounced input); MeetingList component (fetch, search, pagination, auto-refresh, loading skeletons); TranscriptView component (color-coded speaker segments, scrollable); SummaryPanel component (fetch/generate/display AI summary with takeaways and action items); MeetingDetail component (two-panel layout with transcript and summary sidebar); meetings list page (`src/app/meetings/page.tsx`); meeting detail page (`src/app/meetings/[id]/page.tsx`).
- **Outcome**: Meetings feature is complete with browsing, search, detail view, transcript display, and AI-powered summarization. All components use dark theme CSS variables.

### 2026-03-29
- **Project**: cunhas-brain
- **Change**: Built the Logs feature. Created 4 new files: `src/lib/logger.ts` (logging utility), `src/app/api/logs/route.ts` (GET endpoint with type filter and pagination), `src/components/LogsView.tsx` (client component with filter tabs, expandable metadata, auto-refresh, pagination), `src/app/logs/page.tsx` (page wrapper). Added logging calls to 4 existing API routes: webhook/krisp (webhook type), auth (auth type with success/fail), chat (chat type), and meetings summarize (summary type).
- **Outcome**: Activity logging is fully wired. All key app events are recorded to `app_logs` table and viewable at `/logs` with colored type badges, relative timestamps, and expandable JSON metadata.

### 2026-03-29
- **Project**: cunhas-brain
- **Change**: Redesigned Settings page with 4 sections (API Configuration, Integrations, Architecture, App Info). Created `/api/health` endpoint for integration status checks. Updated `/api/settings` to include model preference. Settings page now shows live integration status cards (Krisp, Anthropic, Neon), model selector, test connection button, architecture flow diagram, and database stats.
- **Outcome**: Settings page is a full dashboard for configuration and system health monitoring. All integrations show real-time status with color-coded indicators.
