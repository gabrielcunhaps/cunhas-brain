# Cunha's Brain — Activity Log

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
