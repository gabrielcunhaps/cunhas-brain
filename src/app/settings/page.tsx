'use client';

import { useState, useEffect, useCallback } from 'react';

interface HealthData {
  database: { ok: boolean; count?: string; error?: string };
  anthropic: { ok: boolean; configured: boolean; model: string };
  krisp: { lastMeeting: { title: string; created_at: string } | null };
  stats: { meetings: string; summaries: string; chats: string };
}

function StatusDot({ color }: { color: 'green' | 'yellow' | 'red' }) {
  const colors = {
    green: 'var(--success)',
    red: 'var(--danger)',
    yellow: '#f59e0b',
  };
  return (
    <span
      style={{
        display: 'inline-block',
        width: 10,
        height: 10,
        borderRadius: '50%',
        backgroundColor: colors[color],
        flexShrink: 0,
      }}
    />
  );
}

function relativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function getKrispStatus(lastMeeting: HealthData['krisp']['lastMeeting']): 'green' | 'yellow' | 'red' {
  if (!lastMeeting) return 'red';
  const now = new Date();
  const date = new Date(lastMeeting.created_at);
  const diffMs = now.getTime() - date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  if (diffHours < 24) return 'green';
  if (diffHours < 168) return 'yellow'; // 7 days
  return 'red';
}

const MODELS = [
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
  { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
];

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState('');
  const [currentMasked, setCurrentMasked] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [githubMasked, setGithubMasked] = useState('');
  const [githubUsername, setGithubUsername] = useState('');
  const [savingGithub, setSavingGithub] = useState(false);
  const [model, setModel] = useState('claude-haiku-4-5-20251001');
  const [saving, setSaving] = useState(false);
  const [savingModel, setSavingModel] = useState(false);
  const [testing, setTesting] = useState(false);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchHealth = useCallback(async () => {
    try {
      setHealthLoading(true);
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        setHealth(data);
      }
    } catch (err) {
      console.error('Health fetch failed:', err);
    } finally {
      setHealthLoading(false);
    }
  }, []);

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch('/api/settings');
        if (res.ok) {
          const data = await res.json();
          if (data.anthropic_api_key) setCurrentMasked(data.anthropic_api_key);
          if (data.anthropic_model) setModel(data.anthropic_model);
          if (data.github_token) setGithubMasked(data.github_token);
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      }
    }
    loadSettings();
    fetchHealth();
    // Fetch GitHub username if token is configured
    fetch('/api/github?type=activity')
      .then((res) => res.json())
      .then((data) => {
        if (data.username) setGithubUsername(data.username);
      })
      .catch(() => {});
  }, [fetchHealth]);

  const handleSaveKey = async () => {
    if (!apiKey.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'anthropic_api_key', value: apiKey }),
      });
      if (res.ok) {
        showToast('success', 'API key updated successfully');
        setCurrentMasked('****' + apiKey.slice(-4));
        setApiKey('');
        fetchHealth();
      } else {
        const data = await res.json();
        showToast('error', data.error || 'Failed to update');
      }
    } catch {
      showToast('error', 'Failed to save API key');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveGithubToken = async () => {
    if (!githubToken.trim()) return;
    setSavingGithub(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'github_token', value: githubToken }),
      });
      if (res.ok) {
        showToast('success', 'GitHub token updated successfully');
        setGithubMasked('****' + githubToken.slice(-4));
        setGithubToken('');
        // Fetch username with new token
        fetch('/api/github?type=activity')
          .then((r) => r.json())
          .then((data) => {
            if (data.username) setGithubUsername(data.username);
          })
          .catch(() => {});
      } else {
        const data = await res.json();
        showToast('error', data.error || 'Failed to update');
      }
    } catch {
      showToast('error', 'Failed to save GitHub token');
    } finally {
      setSavingGithub(false);
    }
  };

  const handleSaveModel = async (newModel: string) => {
    setModel(newModel);
    setSavingModel(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'anthropic_model', value: newModel }),
      });
      if (res.ok) {
        showToast('success', 'Model preference saved');
        fetchHealth();
      } else {
        showToast('error', 'Failed to save model');
      }
    } catch {
      showToast('error', 'Failed to save model');
    } finally {
      setSavingModel(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        if (data.database?.ok && data.anthropic?.configured) {
          showToast('success', 'All systems operational');
        } else if (data.database?.ok) {
          showToast('error', 'Database OK but Anthropic API key not configured');
        } else {
          showToast('error', 'Connection test failed');
        }
        setHealth(data);
      } else {
        showToast('error', 'Health endpoint unreachable');
      }
    } catch {
      showToast('error', 'Connection test failed');
    } finally {
      setTesting(false);
    }
  };

  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/webhook/krisp`
    : '/api/webhook/krisp';

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    showToast('success', 'Webhook URL copied to clipboard');
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] px-4 py-8">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-sm font-medium shadow-lg ${
            toast.type === 'success'
              ? 'bg-[var(--success)] text-white'
              : 'bg-[var(--danger)] text-white'
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Settings</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Manage API keys, integrations, and app configuration
          </p>
        </div>

        {/* Section 1: API Configuration */}
        <section className="bg-[var(--surface-1)] border border-[var(--border)] rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-5">
            API Configuration
          </h2>
          <div className="space-y-5">
            {/* API Key */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                Anthropic API Key
              </label>
              {currentMasked && (
                <p className="text-xs text-[var(--text-muted)] mb-2">
                  Current: <span className="font-mono">{currentMasked}</span>
                </p>
              )}
              <div className="flex gap-2">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-ant-..."
                  className="flex-1 px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] text-sm focus:outline-none focus:border-[var(--accent)]"
                />
                <button
                  onClick={handleSaveKey}
                  disabled={saving || !apiKey.trim()}
                  className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? 'Saving...' : 'Update'}
                </button>
              </div>
            </div>

            {/* GitHub Token */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                GitHub Personal Access Token
              </label>
              {githubMasked && (
                <p className="text-xs text-[var(--text-muted)] mb-2">
                  Current: <span className="font-mono">{githubMasked}</span>
                </p>
              )}
              <div className="flex gap-2">
                <input
                  type="password"
                  value={githubToken}
                  onChange={(e) => setGithubToken(e.target.value)}
                  placeholder="ghp_..."
                  className="flex-1 px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] text-sm focus:outline-none focus:border-[var(--accent)]"
                />
                <button
                  onClick={handleSaveGithubToken}
                  disabled={savingGithub || !githubToken.trim()}
                  className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {savingGithub ? 'Saving...' : 'Update'}
                </button>
              </div>
            </div>

            {/* Model Selector */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                Model
              </label>
              <select
                value={model}
                onChange={(e) => handleSaveModel(e.target.value)}
                disabled={savingModel}
                className="w-full max-w-xs px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent)] disabled:opacity-50"
              >
                {MODELS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              {savingModel && (
                <p className="text-xs text-[var(--text-muted)] mt-1">Saving...</p>
              )}
            </div>

            {/* Test Connection */}
            <div>
              <button
                onClick={handleTestConnection}
                disabled={testing}
                className="px-4 py-2 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] text-sm font-medium hover:bg-[var(--surface-2)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {testing ? 'Testing...' : 'Test Connection'}
              </button>
            </div>
          </div>
        </section>

        {/* Section 2: Integrations */}
        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
            Integrations
          </h2>
          {healthLoading && !health ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="bg-[var(--surface-1)] border border-[var(--border)] rounded-2xl p-5 animate-pulse h-44"
                />
              ))}
            </div>
          ) : health ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Krisp Webhook */}
              <div className="bg-[var(--surface-1)] border border-[var(--border)] rounded-2xl p-5 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <StatusDot color={getKrispStatus(health.krisp.lastMeeting)} />
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                    Krisp Webhook
                  </h3>
                </div>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  Receives meeting transcripts automatically after every Krisp call
                </p>
                <div className="mt-auto space-y-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1">
                      Webhook URL
                    </p>
                    <div className="flex items-center gap-1.5">
                      <code className="text-xs text-[var(--text-secondary)] bg-[var(--surface-2)] px-2 py-1 rounded truncate flex-1">
                        {webhookUrl}
                      </code>
                      <button
                        onClick={copyWebhook}
                        className="text-xs text-[var(--accent)] hover:text-[var(--accent-hover)] shrink-0"
                        title="Copy"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                      Last received
                    </p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {health.krisp.lastMeeting
                        ? `${health.krisp.lastMeeting.title} - ${relativeTime(health.krisp.lastMeeting.created_at)}`
                        : 'No meetings received yet'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Anthropic Claude */}
              <div className="bg-[var(--surface-1)] border border-[var(--border)] rounded-2xl p-5 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <StatusDot color={health.anthropic.configured ? 'green' : 'red'} />
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                    Anthropic Claude
                  </h3>
                </div>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  Powers AI summaries and chat conversations about your meetings
                </p>
                <div className="mt-auto space-y-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                      Model
                    </p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {MODELS.find((m) => m.value === health.anthropic.model)?.label ||
                        health.anthropic.model}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                      Status
                    </p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {health.anthropic.configured ? 'API key configured' : 'Not configured'}
                    </p>
                  </div>
                </div>
              </div>

              {/* GitHub */}
              <div className="bg-[var(--surface-1)] border border-[var(--border)] rounded-2xl p-5 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <StatusDot color={githubMasked ? 'green' : 'red'} />
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                    GitHub
                  </h3>
                </div>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  View repositories, commits, and pull requests
                </p>
                <div className="mt-auto space-y-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                      Status
                    </p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {githubMasked ? 'Token configured' : 'Not configured'}
                    </p>
                  </div>
                  {githubUsername && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                        Username
                      </p>
                      <p className="text-xs text-[var(--text-secondary)]">
                        {githubUsername}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Neon Postgres */}
              <div className="bg-[var(--surface-1)] border border-[var(--border)] rounded-2xl p-5 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <StatusDot color={health.database.ok ? 'green' : 'red'} />
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                    Neon Postgres
                  </h3>
                </div>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  Stores all meeting data, transcripts, summaries, and chat history
                </p>
                <div className="mt-auto space-y-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                      Status
                    </p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {health.database.ok ? 'Connected' : 'Disconnected'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                      Stats
                    </p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {health.stats.meetings} meetings, {health.stats.summaries} summaries,{' '}
                      {health.stats.chats} chats
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">Failed to load integration status.</p>
          )}
        </section>

        {/* Section 3: Architecture */}
        <section className="bg-[var(--surface-1)] border border-[var(--border)] rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-5">
            Architecture
          </h2>
          <div className="flex flex-col items-center gap-3 py-4">
            {/* Row 1: Krisp -> Webhook -> Neon DB */}
            <div className="flex items-center gap-3 flex-wrap justify-center">
              <div className="px-4 py-3 rounded-xl bg-[#f59e0b]/10 border border-[#f59e0b]/30 text-center min-w-[120px]">
                <p className="text-xs font-bold text-[#f59e0b]">Krisp</p>
                <p className="text-[10px] text-[var(--text-muted)]">Meeting</p>
              </div>
              <svg width="32" height="16" viewBox="0 0 32 16" className="shrink-0">
                <line x1="0" y1="8" x2="24" y2="8" stroke="var(--text-muted)" strokeWidth="2" />
                <polygon points="24,3 32,8 24,13" fill="var(--text-muted)" />
              </svg>
              <div className="px-4 py-3 rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-center min-w-[120px]">
                <p className="text-xs font-bold text-[var(--accent)]">Webhook API</p>
                <p className="text-[10px] text-[var(--text-muted)]">/api/webhook</p>
              </div>
              <svg width="32" height="16" viewBox="0 0 32 16" className="shrink-0">
                <line x1="0" y1="8" x2="24" y2="8" stroke="var(--text-muted)" strokeWidth="2" />
                <polygon points="24,3 32,8 24,13" fill="var(--text-muted)" />
              </svg>
              <div className="px-4 py-3 rounded-xl bg-[var(--success)]/10 border border-[var(--success)]/30 text-center min-w-[120px]">
                <p className="text-xs font-bold text-[var(--success)]">Neon DB</p>
                <p className="text-[10px] text-[var(--text-muted)]">meetings</p>
              </div>
            </div>

            {/* Down arrow */}
            <svg width="16" height="32" viewBox="0 0 16 32" className="shrink-0">
              <line x1="8" y1="0" x2="8" y2="24" stroke="var(--text-muted)" strokeWidth="2" />
              <polygon points="3,24 8,32 13,24" fill="var(--text-muted)" />
            </svg>

            {/* Row 2: Claude API */}
            <div className="px-4 py-3 rounded-xl bg-[var(--danger)]/10 border border-[var(--danger)]/30 text-center min-w-[140px]">
              <p className="text-xs font-bold text-[var(--danger)]">Claude API</p>
              <p className="text-[10px] text-[var(--text-muted)]">Anthropic</p>
            </div>

            {/* Down arrow */}
            <svg width="16" height="32" viewBox="0 0 16 32" className="shrink-0">
              <line x1="8" y1="0" x2="8" y2="24" stroke="var(--text-muted)" strokeWidth="2" />
              <polygon points="3,24 8,32 13,24" fill="var(--text-muted)" />
            </svg>

            {/* Row 3: Outputs */}
            <div className="px-4 py-3 rounded-xl bg-[var(--surface-3)] border border-[var(--border)] text-center min-w-[160px]">
              <p className="text-xs font-bold text-[var(--text-primary)]">Summaries + Chat + Todos</p>
              <p className="text-[10px] text-[var(--text-muted)]">Stored in Neon DB</p>
            </div>
          </div>
        </section>

        {/* Section 4: App Info */}
        <section className="bg-[var(--surface-1)] border border-[var(--border)] rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
            App Info
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--text-muted)]">App name</span>
              <span className="text-sm text-[var(--text-primary)] font-medium">
                Cunha&apos;s Brain
              </span>
            </div>
            <div className="border-t border-[var(--border)]" />
            {health && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--text-muted)]">Meetings</span>
                  <span className="text-sm text-[var(--text-primary)]">{health.stats.meetings}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--text-muted)]">Summaries</span>
                  <span className="text-sm text-[var(--text-primary)]">{health.stats.summaries}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--text-muted)]">Chat messages</span>
                  <span className="text-sm text-[var(--text-primary)]">{health.stats.chats}</span>
                </div>
                <div className="border-t border-[var(--border)]" />
              </>
            )}
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-[var(--text-muted)] shrink-0">Webhook URL</span>
              <div className="flex items-center gap-2 min-w-0">
                <code className="text-xs text-[var(--text-secondary)] bg-[var(--surface-2)] px-2 py-1 rounded truncate">
                  {webhookUrl}
                </code>
                <button
                  onClick={copyWebhook}
                  className="text-xs text-[var(--accent)] hover:text-[var(--accent-hover)] shrink-0"
                >
                  Copy
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
