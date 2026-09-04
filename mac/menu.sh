#!/bin/bash
# Status-menu wrapper for Platypus ("Status Menu" interface).
#
# Platypus runs this script with NO arguments to build the menu: every line
# printed becomes a menu item. When the user picks one, Platypus runs it again
# with the item's text as $1. We map that to a mood and run the Swift script,
# which lives next to this file inside the .app (Contents/Resources).
DIR="$(cd "$(dirname "$0")" && pwd)"
SWIFT_SCRIPT="$DIR/daily-bible-wallpaper.swift"

if [ $# -eq 0 ]; then
  echo "換一張桌布（依經文）"
  echo "----"
  echo "寧靜"
  echo "自然"
  echo "天空"
  echo "光"
  echo "山岳"
  echo "隨機心情"
  exit 0
fi

case "$1" in
  寧靜) MOOD="calm" ;;
  自然) MOOD="nature" ;;
  天空) MOOD="sky" ;;
  光) MOOD="light" ;;
  山岳) MOOD="mountains" ;;
  隨機心情) MOOD="random" ;;
  *) MOOD="verse" ;;
esac
exec /usr/bin/swift "$SWIFT_SCRIPT" "$MOOD"
