#!/usr/bin/env node

/**
 * Cunha's Brain - Meeting Notifier
 * Polls for new meetings and shows interactive macOS popup dialogs
 * with ability to send todos to VS Code / Claude Code
 *
 * Run:   node scripts/notifier.js
 * Install: bash scripts/install-notifier.sh
 */

const { execFileSync, execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const APP_URL = process.env.CUNHAS_BRAIN_URL || 'https://cunhas-brain.vercel.app';
const APP_PASSWORD = process.env.CUNHAS_BRAIN_PASSWORD || 'cunhasbrain2026';
const POLL_INTERVAL = 2 * 60 * 1000;

let lastCheck = new Date(Date.now() - 10 * 60 * 1000).toISOString();
let authCookie = '';
let workspacePrefix = '~/Desktop/workspace/';
let repoNames = [];

async function login() {
  const res = await fetch(`${APP_URL}/api/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: APP_PASSWORD }),
  });
  const cookies = res.headers.get('set-cookie');
  if (cookies) authCookie = cookies.split(';')[0];
  if (!res.ok) throw new Error(`Login failed: ${res.status}`);
}

async function loadSettings() {
  try {
    const res = await fetch(`${APP_URL}/api/settings`, {
      headers: { Cookie: authCookie },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.workspace_prefix) workspacePrefix = data.workspace_prefix;
    }
  } catch {}

  try {
    const res = await fetch(`${APP_URL}/api/github?type=repos`, {
      headers: { Cookie: authCookie },
    });
    if (res.ok) {
      const data = await res.json();
      repoNames = (data.repos || []).map((r) => r.name).slice(0, 15);
    }
  } catch {}
}

async function checkNewMeetings() {
  try {
    const res = await fetch(
      `${APP_URL}/api/notifications?since=${encodeURIComponent(lastCheck)}`,
      { headers: { Cookie: authCookie } }
    );
    if (res.status === 401) { await login(); return checkNewMeetings(); }
    if (!res.ok) return;

    const data = await res.json();
    for (const meeting of data.meetings || []) {
      await showPopup(meeting);
    }
    lastCheck = new Date().toISOString();
  } catch (err) {
    console.error(`[${ts()}] Poll error:`, err.message);
  }
}

function ts() { return new Date().toISOString(); }

function clean(str) {
  if (!str) return '';
  return str.replace(/[^\x20-\x7E\n]/g, '').replace(/"/g, "'").replace(/\\/g, '').trim();
}

function runScript(script) {
  const p = path.join(os.tmpdir(), 'cunhas-brain-popup.scpt');
  fs.writeFileSync(p, script);
  try {
    return execFileSync('osascript', [p], { encoding: 'utf-8', timeout: 180000 }).trim();
  } catch {
    return 'timeout';
  }
}

async function showPopup(meeting) {
  const title = clean(meeting.title || 'New Meeting');
  const summary = clean(meeting.summary || 'Meeting transcript available').slice(0, 300);

  const todos = (meeting.actionItems || []).slice(0, 5).map((a, i) => {
    const text = clean(typeof a === 'string' ? a : a.task || '');
    const assignee = typeof a === 'object' && a.assignee ? ` (${clean(a.assignee)})` : '';
    return `${i + 1}. ${text}${assignee}`;
  }).filter(Boolean);

  const dialogText = [
    `MEETING: ${title}`,
    '',
    'SUMMARY:',
    summary,
    '',
    todos.length > 0 ? `ACTION ITEMS:\n${todos.join('\n')}` : 'No action items.',
  ].join('\n');

  // First popup: Summary with 3 buttons
  const result = runScript(`
try
  set r to display dialog "${dialogText.replace(/\n/g, '\\n').replace(/"/g, "'")}" buttons {"Dismiss", "Take Action", "Open Meeting"} default button "Take Action" with title "Cunhas Brain - New Meeting" giving up after 120
  return button returned of r
on error
  return "timeout"
end try`);

  if (result === 'Open Meeting') {
    execSync(`open "${APP_URL}/meetings/${meeting.id}"`);
    console.log(`[${ts()}] Opened meeting: ${title}`);

  } else if (result === 'Take Action') {
    try {
      await showActionPopup(meeting, todos);
    } catch (err) {
      console.error(`[${ts()}] Action error:`, err.message);
    }

  } else {
    console.log(`[${ts()}] Dismissed: ${title}`);
  }
}

async function showActionPopup(meeting, todos) {
  const title = clean(meeting.title || 'New Meeting');

  if (todos.length === 0) {
    execSync(`open "${APP_URL}/dashboard"`);
    return;
  }

  // Build todo list for display
  const todoList = todos.join('\n');

  // Second popup: Choose action
  const result = runScript(`
try
  set r to display dialog "ACTION ITEMS from: ${title.replace(/"/g, "'")}\n\n${todoList.replace(/\n/g, '\\n').replace(/"/g, "'")}\n\nChoose an action:" buttons {"Send to Claude.ai", "Copy Claude Cmd", "Open VS Code"} default button "Copy Claude Cmd" with title "Cunhas Brain - Take Action" giving up after 120
  return button returned of r
on error
  return "timeout"
end try`);

  if (result === 'Send to Claude.ai') {
    // Fetch full transcript then copy with prompt
    let transcript = '';
    try {
      const mRes = await fetch(`${APP_URL}/api/meetings/${meeting.id}`, { headers: { Cookie: authCookie } });
      if (mRes.ok) {
        const mData = await mRes.json();
        transcript = clean(mData.rawContent || '').slice(0, 80000);
      }
    } catch {}
    const prompt = `Here is a transcript from my meeting "${title}".\n\nPlease review it and help me with any follow-ups, action items, or questions I should address.\n\n---\n\nTRANSCRIPT:\n\n${transcript}`;
    const pbcopy = require('child_process').spawn('pbcopy');
    pbcopy.stdin.write(prompt);
    pbcopy.stdin.end();
    execSync('open "https://claude.ai/new"');
    runScript(`display dialog "Transcript copied to clipboard!\n\nPaste it in Claude.ai to start chatting." buttons {"OK"} default button "OK" with title "Cunhas Brain" giving up after 10`);
    console.log(`[${ts()}] Sent to Claude.ai: ${title}`);

  } else if (result === 'Copy Claude Cmd' || result === 'Open VS Code') {
    // Pick a folder
    let folder = repoNames[0] || '';
    if (repoNames.length > 1) {
      const folderList = repoNames.map((r, i) => `${i + 1}. ${r}`).join('\n');
      const folderResult = runScript(`
try
  set r to display dialog "Select project folder:\n\n${folderList.replace(/\n/g, '\\n')}\n\nEnter number or folder name:" default answer "1" buttons {"Cancel", "OK"} default button "OK" with title "Cunhas Brain - Select Folder" giving up after 60
  return text returned of r
on error
  return ""
end try`);

      if (folderResult) {
        const num = parseInt(folderResult);
        if (!isNaN(num) && num >= 1 && num <= repoNames.length) {
          folder = repoNames[num - 1];
        } else if (folderResult.trim()) {
          folder = folderResult.trim();
        }
      }
    }

    // Ask for notes
    const notes = runScript(`
try
  set r to display dialog "Add notes/context for Claude Code (optional):" default answer "" buttons {"Skip", "Add"} default button "Add" with title "Cunhas Brain - Notes" giving up after 60
  if button returned of r is "Add" then
    return text returned of r
  else
    return ""
  end if
on error
  return ""
end try`);

    // Build the command
    const allTodos = todos.map(t => t.replace(/^\d+\.\s*/, '')).join('; ');
    let prompt = allTodos;
    if (notes) prompt += `\n\nAdditional context: ${notes}`;
    prompt = prompt.replace(/"/g, '\\"');

    const prefix = workspacePrefix.endsWith('/') ? workspacePrefix : workspacePrefix + '/';
    const fullPath = folder ? `${prefix}${folder}` : '';
    const cmd = fullPath
      ? `claude -p "${prompt}" --cwd ${fullPath}`
      : `claude -p "${prompt}"`;

    if (result === 'Copy Claude Cmd') {
      // Copy to clipboard
      const pbcopy = require('child_process').spawn('pbcopy');
      pbcopy.stdin.write(cmd);
      pbcopy.stdin.end();

      runScript(`display dialog "Command copied to clipboard!\n\n${cmd.slice(0, 200).replace(/"/g, "'").replace(/\n/g, '\\n')}..." buttons {"OK"} default button "OK" with title "Cunhas Brain" giving up after 10`);
      console.log(`[${ts()}] Copied Claude cmd for: ${folder}`);

    } else {
      // Open VS Code + copy command
      if (fullPath) {
        const expandedPath = fullPath.replace(/~/g, os.homedir());
        try {
          if (fs.existsSync(expandedPath)) {
            execSync(`open -a "Visual Studio Code" "${expandedPath}"`);
          } else {
            // Try just the prefix if folder doesn't exist
            const prefixExpanded = workspacePrefix.replace(/~/g, os.homedir()).replace(/\/$/, '');
            execSync(`open -a "Visual Studio Code" "${prefixExpanded}"`);
          }
        } catch {}
      }
      const pbcopy = require('child_process').spawn('pbcopy');
      pbcopy.stdin.write(cmd);
      pbcopy.stdin.end();

      runScript(`display dialog "VS Code opened. Claude command copied to clipboard!\n\nPaste in terminal to run." buttons {"OK"} default button "OK" with title "Cunhas Brain" giving up after 10`);
      console.log(`[${ts()}] Opened VS Code: ${fullPath}`);
    }
  }
}

async function main() {
  console.log(`Cunhas Brain Notifier started`);
  console.log(`Polling ${APP_URL} every ${POLL_INTERVAL / 1000}s`);

  await login();
  console.log('Authenticated');

  await loadSettings();
  console.log(`Workspace: ${workspacePrefix} | Repos: ${repoNames.length}`);

  await checkNewMeetings();
  setInterval(checkNewMeetings, POLL_INTERVAL);
}

main().catch(console.error);
