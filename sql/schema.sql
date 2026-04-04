-- Cunha's Brain Database Schema
-- Run this against your Neon database to set up all tables

-- Meetings from Krisp webhooks
CREATE TABLE IF NOT EXISTS meetings (
  id SERIAL PRIMARY KEY,
  krisp_id TEXT UNIQUE,
  title TEXT NOT NULL DEFAULT 'Untitled Meeting',
  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration INTEGER DEFAULT 0,  -- seconds
  participants JSONB DEFAULT '[]',
  speakers JSONB DEFAULT '[]',
  raw_content TEXT DEFAULT '',
  content JSONB DEFAULT '[]',
  payload JSONB DEFAULT '{}',  -- full original webhook payload
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meetings_date ON meetings(date DESC);
CREATE INDEX IF NOT EXISTS idx_meetings_title ON meetings(title);

-- App settings (API keys, preferences)
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cached AI summaries
CREATE TABLE IF NOT EXISTS meeting_summaries (
  meeting_id INTEGER REFERENCES meetings(id) PRIMARY KEY,
  summary TEXT,
  takeaways JSONB DEFAULT '[]',
  action_items JSONB DEFAULT '[]',
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat history
CREATE TABLE IF NOT EXISTS chat_messages (
  id SERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  meeting_ids INTEGER[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_session ON chat_messages(session_id, created_at);
