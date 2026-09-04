#!/bin/bash
# Status-menu wrapper for Platypus ("Status Menu" interface).
#
# Platypus runs this script with NO arguments every time the menu is opened:
# every line printed becomes a menu item ("text" = greyed-out line,
# "----" = separator). When the user picks an item, Platypus runs the script
# again with the item's text as $1. The Swift script lives next to this file
# inside the .app (Contents/Resources).
#
# Today's verse is shown at the top of the menu. It is fetched with curl once
# per day and cached, so opening the menu never waits on the network.
#
# Notifications: printing a line that starts with NOTIFICATION: makes the
# Platypus app itself post it (app name + app icon). osascript notifications
# would show up as "Script Editor" with a scroll icon. If your Platypus build
# ignores the prefix (no notification appears), set USE_PLATYPUS_NOTIFY=0 to
# fall back to osascript.
USE_PLATYPUS_NOTIFY=1
SITE_BASE_URL="https://daily-bible-quote-widget.netlify.app"

DIR="$(cd "$(dirname "$0")" && pwd)"
SWIFT_SCRIPT="$DIR/daily-bible-wallpaper.swift"
CACHE_DIR="$HOME/Library/Application Support/DailyBibleWallpaper"
ARCHIVE_DIR="$HOME/Pictures/Daily Bible Wallpaper"

# Same rotation as the site: day of year (Jan 1 = 1) modulo 30.
VERSES=(JER.29.11 PSA.23.1 PRO.3.5-6 PHP.4.13 ISA.40.31 MAT.11.28 JHN.3.16 ROM.8.28
  1CO.13.13 PSA.46.1 JOS.1.9 HEB.11.1 ROM.12.2 2CO.5.7 GAL.5.22-23 EPH.2.8-9 PHP.4.6-7
  COL.3.23 1JN.4.19 PSA.119.105 PSA.91.1-2 MAT.6.33 ISA.41.10 ROM.15.13 PSA.37.4
  PRO.16.3 MAT.5.16 2TI.1.7 PSA.27.1 HEB.13.8)

print_verse_lines() {
  local day id cache
  day=$((10#$(date +%j)))
  id="${VERSES[$((day % ${#VERSES[@]}))]}"
  mkdir -p "$CACHE_DIR"
  cache="$CACHE_DIR/verse-$(date +%Y%m%d).json"
  if [ ! -s "$cache" ]; then
    if curl -sS --max-time 4 "$SITE_BASE_URL/.netlify/functions/get-bible-verse?verseId=$id" -o "$cache.tmp"; then
      mv "$cache.tmp" "$cache"
    else
      rm -f "$cache.tmp"
    fi
  fi
  if [ ! -s "$cache" ]; then
    echo "（離線，經文稍後再試）"
    return
  fi
  # Parse + wrap with the built-in JavaScript runtime (no Swift compile here).
  VERSE_CACHE="$cache" VERSE_ID="$id" REFLECTIONS_FILE="$DIR/reflections.json" /usr/bin/osascript -l JavaScript <<'JS' 2>/dev/null
function buildVerseLines() {
  ObjC.import("Foundation");
  var path = ObjC.unwrap($.NSProcessInfo.processInfo.environment.objectForKey("VERSE_CACHE"));
  var raw = $.NSString.stringWithContentsOfFileEncodingError(path, 4, null);
  var d; try { d = JSON.parse(ObjC.unwrap(raw)); } catch (e) { return "（經文格式錯誤）"; }
  if (!d || !d.english || !d.chinese) return "（經文暫時無法取得）";
  var clean = function (t) { return String(t || "").replace(/<[^>]*>/g, "").replace(/&[a-z]+;/gi, " ").replace(/\s+/g, " ").trim(); };
  var wrapCjk = function (t, n) { var out = []; for (var i = 0; i < t.length; i += n) out.push(t.slice(i, i + n)); return out; };
  var wrapEn = function (t, n) { var out = [], line = ""; t.split(" ").forEach(function (w) { if (line && (line + " " + w).length > n) { out.push(line); line = w; } else line = line ? line + " " + w : w; }); if (line) out.push(line); return out; };
  var lines = [];
  lines.push(d.chinese.reference + " · " + d.english.reference);
  wrapCjk("「" + clean(d.chinese.quote) + "」", 18).forEach(function (l) { lines.push(l); });
  wrapEn("“" + clean(d.english.quote) + "”", 44).forEach(function (l) { lines.push(l); });
  // 反思問題（reflections.json 與本腳本同一個資料夾）
  try {
    var rp = ObjC.unwrap($.NSProcessInfo.processInfo.environment.objectForKey("REFLECTIONS_FILE"));
    var rraw = $.NSString.stringWithContentsOfFileEncodingError(rp, 4, null);
    var vid = ObjC.unwrap($.NSProcessInfo.processInfo.environment.objectForKey("VERSE_ID"));
    var qs = JSON.parse(ObjC.unwrap(rraw))[vid] || [];
    if (qs.length) { lines.push("----"); lines.push("今日反思"); qs.forEach(function (q) { wrapCjk(q, 22).forEach(function (l) { lines.push("　" + l); }); }); }
  } catch (e) {}
  return lines.join("\n");
}
buildVerseLines();
JS
}

if [ $# -eq 0 ]; then
  print_verse_lines
  echo "----"
  echo "換一張桌布（依經文）"
  echo "----"
  echo "寧靜"
  echo "自然"
  echo "天空"
  echo "光"
  echo "山岳"
  echo "隨機心情"
  echo "----"
  # 回到之前的桌布：最近 15 張的子選單（檔名就是「日期 時間 經文出處」）。
  if [ -d "$ARCHIVE_DIR" ]; then
    RECENT=""
    while IFS= read -r f; do
      [ -n "$f" ] || continue
      RECENT="$RECENT|$(basename "$f" .jpg)"
    done < <(ls -1 "$ARCHIVE_DIR"/*.jpg 2>/dev/null | sort -r | head -15)
    [ -n "$RECENT" ] && echo "SUBMENU|回到之前的桌布$RECENT"
  fi
  echo "每日讀經紀錄"
  echo "打開桌布資料夾"
  exit 0
fi

# notify_start TITLE TEXT — Platypus format is "NOTIFICATION:title|text".
if [ "$USE_PLATYPUS_NOTIFY" = "1" ]; then
  export DBW_NOTIFY=platypus
  notify_start() { echo "NOTIFICATION:$1|$2"; }
else
  notify_start() { /usr/bin/osascript -e "display notification \"$2\" with title \"$1\"" >/dev/null 2>&1; }
fi

# 子選單「回到之前的桌布」：項目文字就是檔名（不含 .jpg），直接設回去。
if [ -f "$ARCHIVE_DIR/$1.jpg" ]; then
  f="$ARCHIVE_DIR/$1.jpg"
  if /usr/bin/osascript -e "tell application \"System Events\" to tell every desktop to set picture to POSIX file \"$f\"" >/dev/null 2>&1; then
    notify_start "桌布已換回" "$1"
  else
    notify_start "桌布沒有更動" "系統不讓設定：$1"
  fi
  exit 0
fi

case "$1" in
  每日讀經紀錄)
    if [ -f "$ARCHIVE_DIR/index.html" ]; then open "$ARCHIVE_DIR/index.html"
    else echo "ALERT:還沒有紀錄|換過一次桌布之後，這裡會打開每日讀經紀錄。"; fi
    exit 0 ;;
  打開桌布資料夾) mkdir -p "$ARCHIVE_DIR"; open "$ARCHIVE_DIR"; exit 0 ;;
  "換一張桌布（依經文）") MOOD="verse"; LABEL="依經文挑照片" ;;
  寧靜) MOOD="calm"; LABEL="寧靜" ;;
  自然) MOOD="nature"; LABEL="自然" ;;
  天空) MOOD="sky"; LABEL="天空" ;;
  光) MOOD="light"; LABEL="光" ;;
  山岳) MOOD="mountains"; LABEL="山岳" ;;
  隨機心情) MOOD="random"; LABEL="隨機心情" ;;
  *) exit 0 ;;   # verse lines and anything unknown: do nothing
esac

# Immediate feedback: Platypus shows nothing while a menu item's script runs,
# and the Swift script takes several seconds (compile + network). Say what is
# happening at once, so a click never looks like it did nothing.
notify_start "換桌布中" "${LABEL}，約 10 秒…"

exec /usr/bin/swift "$SWIFT_SCRIPT" "$MOOD"
