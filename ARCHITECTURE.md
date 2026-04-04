# Cunha's Brain — Architecture & Lessons Learned

## Project Overview

A personal meeting intelligence hub deployed on Vercel that connects Krisp meeting transcripts, Inoreader newsletters, GitHub activity, and student management into one dashboard with AI-powered summaries and a chat interface.

**Live URL**: https://cunhas-brain.vercel.app
**Repo**: https://github.com/gabrielcunhaps/cunhas-brain
**Stack**: Next.js 14, Neon Postgres, Anthropic Claude Haiku, Vercel

---

## Architecture Diagram

```
┌──────────────┐     ┌──────────────────────┐     ┌──────────────────┐
│   Krisp      │────>│  Webhook POST        │────>│  Neon Postgres   │
│   Meetings   │     │  /api/webhook/krisp  │     │  (meetings)      │
└──────────────┘     └──────────────────────┘     └────────┬─────────┘
                                                           │
┌──────────────┐     ┌──────────────────────┐              │
│  Inoreader   │────>│  OAuth + API         │──────────────┤
│  Newsletters │     │  /api/newsletters    │              │
└──────────────┘     └──────────────────────┘              │
                                                           │
┌──────────────┐     ┌──────────────────────┐              │
│   GitHub     │────>│  Token + API         │──────────────┤
│   Activity   │     │  /api/github         │              │
└──────────────┘     └──────────────────────┘              │
                                                           ▼
                                                  ┌──────────────────┐
                                                  │  Claude API      │
                                                  │  (Haiku 4.5)     │
                                                  └────────┬─────────┘
                                                           │
                                                           ▼
                                              ┌────────────────────────┐
                                              │  App Features          │
                                              │  - Meeting summaries   │
                                              │  - Todo extraction     │
                                              │  - Chat with meetings  │
                                              │  - Newsletter summaries│
                                              │  - Student plans       │
                                              └────────────────────────┘

┌──────────────┐
│  macOS       │     Polls /api/notifications every 2 min
│  Notifier    │────>Shows native popup with summary + actions
│  (LaunchAgent)│    Buttons: Dismiss | Open Meeting | VS Code | Claude.ai
└──────────────┘
```

---

## Database (Neon Postgres)

| Table | Purpose |
|-------|---------|
| `meetings` | Krisp meeting data (title, transcript, speakers, etc.) |
| `meeting_summaries` | Cached AI summaries (summary, takeaways, action_items) |
| `app_settings` | Key/value store for API keys, preferences |
| `chat_messages` | Chat history with meetings |
| `todo_status` | Dashboard todo done/undone tracking |
| `app_logs` | Activity logs (webhook, summary, chat, auth events) |
| `students` | Student profiles + learning plans |
| `student_meetings` | Links meetings to students with session notes |
| `newsletter_cache` | Cached Inoreader articles |

---

## Pages

| Route | Purpose |
|-------|---------|
| `/dashboard` | Todos from meetings, assignee filter, Claude Code integration |
| `/meetings` | All meetings with date/duration filters |
| `/meetings/[id]` | Transcript + AI summary + Send to Claude.ai |
| `/chat` | Chat with AI about selected meetings |
| `/newsletters` | Daily newsletter summaries from Inoreader |
| `/github` | Repos + activity feed |
| `/students` | Student management + learning plans |
| `/students/[id]` | Student detail + attached meetings |
| `/logs` | Activity logs |
| `/settings` | API keys, integrations, architecture |
| `/login` | Password gate |

---

## Integrations

| Service | Auth Method | Status |
|---------|------------|--------|
| **Krisp** | Webhook (POST to /api/webhook/krisp) | Working |
| **Anthropic Claude** | API key in app_settings | Working |
| **GitHub** | Personal access token in app_settings | Working |
| **Inoreader** | OAuth 2.0 (token in app_settings) | Working |
| **Neon Postgres** | Connection string via DATABASE_URL env var | Working |

---

## Key Files

```
src/
  middleware.ts          — Auth gate (cookie-based password)
  lib/
    db.ts               — Neon Postgres Pool wrapper
    anthropic.ts        — Claude client (reads API key from DB)
    auth.ts             — Password verification + cookie helpers
    transcript.ts       — Parse Krisp transcript formats
    prompts.ts          — AI system prompts
    logger.ts           — Logging to app_logs table
    utils.ts            — Date formatting, helpers
  app/
    api/
      webhook/krisp/    — Krisp webhook receiver
      meetings/         — CRUD + summarize
      chat/             — Streaming chat with Claude
      newsletters/      — Inoreader fetch + AI summary
      github/           — GitHub repos + activity
      students/         — Student CRUD + AI plans
      todos/            — Dashboard todos
      health/           — Integration health checks
      notifications/    — Notifier polling endpoint
      inoreader/callback/ — OAuth callback
      auth/             — Password login
      settings/         — API key management
      logs/             — Activity logs
scripts/
    notifier.js         — macOS popup notifier
    install-notifier.sh — LaunchAgent installer
sql/
    schema.sql          — Database schema
```

---

## Lessons Learned & Gotchas

### 1. Vercel Static vs Dynamic Routes
**Problem**: API routes like `/api/dashboard` were pre-rendered as static at build time, serving stale data forever.
**Fix**: Add `export const dynamic = 'force-dynamic'` to EVERY API route that reads from the database.
**Rule**: Always add this to any new API route.

### 2. Next.js Params Type
**Problem**: `{ params }: { params: Promise<{ id: string }> }` (Next.js 15 style) vs `{ params }: { params: { id: string } }` (Next.js 14 style) caused silent failures.
**Fix**: Use Next.js 14 style since we're on Next.js 14. Or use `useParams()` in client components.

### 3. Krisp Webhook Payload Structure
**Problem**: Krisp sends data nested at `payload.data.meeting.title`, NOT at `payload.title`. All top-level fields are null.
**Fix**: Always access via `payload.data.meeting.*` and `payload.data.raw_content`.
**Also**: Speakers have `first_name`/`last_name` not `name`. Participants are objects not strings.

### 4. React "Objects are not valid as a child"
**Problem**: Claude AI returns `action_items` as objects `{task, assignee}` not strings. React crashes when rendering objects as children.
**Fix**: Always check `typeof item === 'string' ? item : item.task || JSON.stringify(item)` before rendering.

### 5. Inoreader OAuth
**Problem**: Multiple issues:
- The Settings button was double-encoding the redirect URI (adding spaces: `ht%20tps`)
- The `scope=read` parameter caused `invalid_request` errors
- The token exchange used a dynamic origin that didn't match the registered redirect URI
**Fix**:
- Hardcode the OAuth URL in the button (don't use template literals with encodeURIComponent)
- Remove the `scope` parameter from the auth URL (use the scope set in Inoreader app settings)
- Hardcode the origin in the callback to `https://cunhas-brain.vercel.app`
**Rule**: For OAuth, always hardcode redirect URIs. Never rely on `request.url` or `x-forwarded-host` on Vercel.

### 6. Inoreader API Auth
**Problem**: AppId/AppKey headers alone don't work — they still need an OAuth Bearer token.
**Fix**: Must complete OAuth flow to get access_token. AppId/AppKey are supplementary headers.
**Also**: Inoreader has separate "feed" (all RSS) vs "newsletter" folder. Must filter by folder tag.

### 7. Neon Postgres on Vercel
**Problem**: Vercel's Neon integration creates env vars with `STORAGE_` prefix, not `DATABASE_`.
**Fix**: Check for both: `process.env.DATABASE_URL || process.env.STORAGE_URL`.

### 8. Neon Pool vs neon() function
**Problem**: The `neon()` tagged template function doesn't support parameterized queries with `$1` placeholders.
**Fix**: Use `Pool` from `@neondatabase/serverless` instead, which supports standard `pool.query(sql, params)`.

### 9. Vercel Hobby Plan + Private Repos
**Problem**: Git pushes from a committer not linked to the Vercel team get blocked on private repos.
**Fix**: Make the repo public, or link the GitHub account in Vercel Authentication Settings.

### 10. macOS Notifications vs Dialogs
**Problem**: `display notification` shows a banner that disappears. User wanted interactive popups.
**Fix**: Use `display dialog` instead — creates a modal window with buttons that stays until clicked.
**Also**: Emojis and special characters break osascript shell escaping. Strip non-ASCII with `.replace(/[^\x20-\x7E\n]/g, '')` and write to temp file instead of inline.

### 11. Meeting Summary Caching
**Problem**: Summaries were generated once but the cached data had objects in `action_items`/`takeaways` that crashed React on subsequent loads.
**Fix**: Always handle `unknown[]` types in summary data. Use `typeof item === 'string' ? item : item.task` pattern.

### 12. Claude JSON Response Parsing
**Problem**: Claude sometimes wraps JSON in markdown code blocks (```json ... ```).
**Fix**: Use regex extraction: `const jsonMatch = text.match(/\{[\s\S]*\}/); JSON.parse(jsonMatch[0])`.

---

## Environment Variables (Vercel)

```
DATABASE_URL          — Neon Postgres connection string (auto-set by Vercel Storage)
APP_PASSWORD          — Password to access the app
```

All other credentials (Anthropic, GitHub, Inoreader) are stored in the `app_settings` database table, configurable via Settings page at runtime.

---

## Local Development

```bash
cd cunhas-brain
vercel env pull .env.local   # Pull env vars from Vercel
npm run dev -- -p 3456       # Run locally on port 3456
```

## Notifier (macOS)

```bash
bash scripts/install-notifier.sh   # Install as LaunchAgent
tail -f ~/.cunhas-brain-notifier.log  # Watch logs
launchctl unload ~/Library/LaunchAgents/com.cunhasbrain.notifier.plist  # Stop
```
