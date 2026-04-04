'use client';

import { useState, useEffect } from 'react';

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState('');
  const [currentMasked, setCurrentMasked] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch('/api/settings');
        if (res.ok) {
          const data = await res.json();
          if (data.anthropic_api_key) {
            setCurrentMasked(data.anthropic_api_key);
          }
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      }
    }
    loadSettings();
  }, []);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSave = async () => {
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
      } else {
        const data = await res.json();
        showToast('error', data.error || 'Failed to update');
      }
    } catch (err) {
      console.error('Save error:', err);
      showToast('error', 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-start justify-center pt-20 px-4">
      {/* Toast notification */}
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

      <div className="w-full max-w-lg">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-8">
          Settings
        </h1>

        <div className="bg-[var(--surface-1)] border border-[var(--border)] rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
            API Configuration
          </h2>

          <div className="space-y-4">
            {/* Anthropic API Key */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                Anthropic API Key
              </label>
              {currentMasked && (
                <p className="text-xs text-[var(--text-muted)] mb-2">
                  Current: {currentMasked}
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
                  onClick={handleSave}
                  disabled={saving || !apiKey.trim()}
                  className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? 'Saving...' : 'Update'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
