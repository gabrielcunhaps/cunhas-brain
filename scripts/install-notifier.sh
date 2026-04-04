#!/bin/bash
# Install the Cunha's Brain meeting notifier as a macOS LaunchAgent
# Usage: bash scripts/install-notifier.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLIST_NAME="com.cunhasbrain.notifier"
PLIST_PATH="$HOME/Library/LaunchAgents/${PLIST_NAME}.plist"
NODE_PATH="$(which node)"

if [ -z "$NODE_PATH" ]; then
  echo "Error: node not found in PATH"
  exit 1
fi

echo "Installing Cunha's Brain Notifier..."

# Unload existing agent if present
launchctl unload "$PLIST_PATH" 2>/dev/null

# Create LaunchAgent plist
cat > "$PLIST_PATH" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${PLIST_NAME}</string>
    <key>ProgramArguments</key>
    <array>
        <string>${NODE_PATH}</string>
        <string>${SCRIPT_DIR}/notifier.js</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${HOME}/.cunhas-brain-notifier.log</string>
    <key>StandardErrorPath</key>
    <string>${HOME}/.cunhas-brain-notifier.log</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>CUNHAS_BRAIN_URL</key>
        <string>https://cunhas-brain.vercel.app</string>
        <key>CUNHAS_BRAIN_PASSWORD</key>
        <string>cunhasbrain2026</string>
    </dict>
</dict>
</plist>
EOF

# Load the agent
launchctl load "$PLIST_PATH"

echo "Notifier installed and running"
echo "  Logs: ~/.cunhas-brain-notifier.log"
echo "  Stop: launchctl unload $PLIST_PATH"
echo "  Start: launchctl load $PLIST_PATH"
