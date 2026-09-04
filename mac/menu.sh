#!/bin/bash
# Status-menu wrapper for Platypus ("Status Menu" interface).
#
# Platypus runs this script with NO arguments to build the menu: every line
# printed becomes a menu item. When the user picks one, Platypus runs it again
# with the item's text as $1. We map that to a mood and run the Swift script,
# which lives next to this file inside the .app (Contents/Resources).
#
# Notifications: printing a line that starts with NOTIFICATION: makes the
# Platypus app itself post it (app name + app icon). osascript notifications
# would show up as "Script Editor" with a scroll icon. If your Platypus build
# ignores the prefix (no notification appears), set USE_PLATYPUS_NOTIFY=0 to
# fall back to osascript.
USE_PLATYPUS_NOTIFY=1

DIR="$(cd "$(dirname "$0")" && pwd)"
SWIFT_SCRIPT="$DIR/daily-bible-wallpaper.swift"

if [ $# -eq 0 ]; then
  echo "換一張桌布（依經文）"
  echo "今天的經文"
  echo "----"
  echo "寧靜"
  echo "自然"
  echo "天空"
  echo "光"
  echo "山岳"
  echo "隨機心情"
  exit 0
fi

if [ "$USE_PLATYPUS_NOTIFY" = "1" ]; then
  export DBW_NOTIFY=platypus
  notify_start() { echo "NOTIFICATION:$1"; }
else
  notify_start() { /usr/bin/osascript -e "display notification \"$1\" with title \"Daily Bible Wallpaper\"" >/dev/null 2>&1; }
fi

case "$1" in
  今天的經文) exec /usr/bin/swift "$SWIFT_SCRIPT" --verse ;;
  寧靜) MOOD="calm" ;;
  自然) MOOD="nature" ;;
  天空) MOOD="sky" ;;
  光) MOOD="light" ;;
  山岳) MOOD="mountains" ;;
  隨機心情) MOOD="random" ;;
  *) MOOD="verse" ;;
esac

# Immediate feedback: Platypus shows nothing while a menu item's script runs,
# and the Swift script takes several seconds (compile + network). Say so at
# once, so a click never looks like it did nothing.
notify_start "正在挑照片並合成桌布，約 10 秒…"

exec /usr/bin/swift "$SWIFT_SCRIPT" "$MOOD"
