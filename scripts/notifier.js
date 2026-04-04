#!/usr/bin/env node

/**
 * Cunha's Brain - Meeting Notifier
 * Polls for new meetings and shows macOS notifications
 *
 * No npm dependencies needed - uses built-in fetch and child_process.
 *
 * Run:   node scripts/notifier.js
 * Or install as LaunchAgent: bash scripts/install-notifier.sh
 */

const APP_URL = process.env.CUNHAS_BRAIN_URL || 'https://cunhas-brain.vercel.app';
const APP_PASSWORD = process.env.CUNHAS_BRAIN_PASSWORD || 'cunhasbrain2026';
const POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes

let lastCheck = new Date().toISOString();
let authCookie = '';

async function login() {
  const res = await fetch(`${APP_URL}/api/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: APP_PASSWORD }),
  });

  const cookies = res.headers.get('set-cookie');
  if (cookies) {
    authCookie = cookies.split(';')[0];
  }

  if (!res.ok) {
    throw new Error(`Login failed with status ${res.status}`);
  }
}

async function checkNewMeetings() {
  try {
    const res = await fetch(
      `${APP_URL}/api/notifications?since=${encodeURIComponent(lastCheck)}`,
      { headers: { Cookie: authCookie } }
    );

    if (res.status === 401) {
      await login();
      return checkNewMeetings();
    }

    if (!res.ok) {
      console.error(`[${new Date().toISOString()}] Poll returned status ${res.status}`);
      return;
    }

    const data = await res.json();
    const meetings = data.meetings || [];

    for (const meeting of meetings) {
      showNotification(meeting);
    }

    lastCheck = new Date().toISOString();
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Poll error:`, err.message);
  }
}

function escapeAppleScript(str) {
  if (!str) return '';
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

function showNotification(meeting) {
  const { execSync } = require('child_process');

  const title = meeting.title || 'New Meeting';
  const summary = meeting.summary
    ? meeting.summary.slice(0, 200)
    : 'Meeting transcript available';
  const todos = (meeting.actionItems || [])
    .slice(0, 3)
    .map((a) => (typeof a === 'string' ? a : a.task || JSON.stringify(a)))
    .join('\\n\u2022 ');

  const body = todos ? `${summary}\\n\\nTodos:\\n\u2022 ${todos}` : summary;

  // Show macOS notification
  try {
    execSync(
      `osascript -e 'display notification "${escapeAppleScript(body).slice(0, 500)}" with title "Cunha\\'s Brain" subtitle "${escapeAppleScript(title)}"'`
    );
  } catch {
    console.log(`[${new Date().toISOString()}] Notification fallback: ${title}`);
  }

  // Show a dialog with action buttons if there are action items
  if (meeting.actionItems && meeting.actionItems.length > 0) {
    try {
      const dialogSummary = escapeAppleScript(summary).slice(0, 300);
      const dialogTitle = escapeAppleScript(title);
      const itemCount = meeting.actionItems.length;

      const result = execSync(
        `osascript -e 'set theResult to display dialog "Meeting: ${dialogTitle}\\n\\n${dialogSummary}\\n\\nAction Items: ${itemCount}" buttons {"Dismiss", "Open in Browser"} default button "Open in Browser" with title "Cunha\\'s Brain" giving up after 30
return button returned of theResult'`,
        { encoding: 'utf-8' }
      ).trim();

      if (result === 'Open in Browser') {
        execSync(`open "${APP_URL}/meetings/${meeting.id}"`);
        reportAction('open', meeting.id);
      } else {
        reportAction('dismiss', meeting.id);
      }
    } catch {
      // Dialog was dismissed or timed out
    }
  }

  console.log(`[${new Date().toISOString()}] Notified: ${title}`);
}

async function reportAction(action, meetingId) {
  try {
    await fetch(`${APP_URL}/api/notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({ action, meetingId }),
    });
  } catch {
    // Best-effort reporting
  }
}

async function main() {
  console.log(`Cunha's Brain Notifier started`);
  console.log(`Polling ${APP_URL} every ${POLL_INTERVAL / 1000}s`);

  await login();
  console.log('Authenticated');

  // Initial check
  await checkNewMeetings();

  // Poll loop
  setInterval(checkNewMeetings, POLL_INTERVAL);
}

main().catch(console.error);
