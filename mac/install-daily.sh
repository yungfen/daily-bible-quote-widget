#!/bin/bash
# 安裝／移除「每天自動換桌布」的 launchd 排程（LaunchAgent）。
#
#   bash mac/install-daily.sh              # 每天 07:00 + 每次登入時各換一次
#   HOUR=8 MINUTE=30 bash mac/install-daily.sh   # 改成每天 08:30
#   bash mac/install-daily.sh --uninstall  # 移除排程
#
# 預設執行 /Applications 裡用 Platypus 包好的 App；還沒包 App 的話，
# 設 SCRIPT=/path/to/daily-bible-wallpaper.swift 就直接用 swift 跑腳本。
set -euo pipefail

LABEL="com.yungfen.daily-bible-wallpaper"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
APP="${APP:-/Applications/Daily Bible Wallpaper.app}"
SCRIPT="${SCRIPT:-}"
HOUR="${HOUR:-7}"
MINUTE="${MINUTE:-0}"
LOG="$HOME/Library/Logs/DailyBibleWallpaper.log"
UID_NUM="$(id -u)"

if [[ "${1:-}" == "--uninstall" ]]; then
  launchctl bootout "gui/$UID_NUM" "$PLIST" 2>/dev/null || true
  rm -f "$PLIST"
  echo "已移除排程：$LABEL"
  exit 0
fi

if [[ -n "$SCRIPT" ]]; then
  [[ -f "$SCRIPT" ]] || { echo "找不到腳本：$SCRIPT" >&2; exit 1; }
  PROGRAM_ARGS="<string>/usr/bin/swift</string><string>$SCRIPT</string>"
  TARGET="$SCRIPT"
else
  [[ -d "$APP" ]] || { echo "找不到 App：$APP（先用 Platypus 建好，或設 SCRIPT= 直接跑腳本）" >&2; exit 1; }
  PROGRAM_ARGS="<string>/usr/bin/open</string><string>-g</string><string>-a</string><string>$APP</string>"
  TARGET="$APP"
fi

mkdir -p "$HOME/Library/LaunchAgents"
cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>Label</key><string>$LABEL</string>
	<key>ProgramArguments</key><array>$PROGRAM_ARGS</array>
	<key>RunAtLoad</key><true/>
	<key>StartCalendarInterval</key>
	<dict><key>Hour</key><integer>$HOUR</integer><key>Minute</key><integer>$MINUTE</integer></dict>
	<key>StandardOutPath</key><string>$LOG</string>
	<key>StandardErrorPath</key><string>$LOG</string>
</dict>
</plist>
PLIST

launchctl bootout "gui/$UID_NUM" "$PLIST" 2>/dev/null || true
launchctl bootstrap "gui/$UID_NUM" "$PLIST"
printf '已安裝排程：每天 %02d:%02d 與每次登入時執行\n  %s\n記錄檔：%s\n' "$HOUR" "$MINUTE" "$TARGET" "$LOG"
echo "（RunAtLoad 為 true，安裝完成的當下就會先換一次桌布）"
