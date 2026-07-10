// ─────────────────────────────────────────────────────────────
// Daily Bible Quote — iOS home-screen widget for the Scriptable app
//
// This is NOT a native app. It runs inside the free "Scriptable" app
// (https://scriptable.app) and reuses the SAME Netlify endpoint the
// website uses, so the widget shows the exact same verse of the day.
//
// Setup:
//   1. Install "Scriptable" from the App Store.
//   2. Create a new script, paste this file in, name it e.g. "Daily Bible".
//   3. Set SITE_BASE_URL below to your deployed Netlify site.
//   4. Add a Scriptable widget to your home screen (small / medium / large),
//      long-press it → Edit Widget → Script: "Daily Bible".
//
// See scriptable/README.md for the full walkthrough.
// ─────────────────────────────────────────────────────────────

// ⚠️ REQUIRED: your deployed site, no trailing slash.
// e.g. "https://daily-bible-quote.netlify.app"
const SITE_BASE_URL = "https://YOUR-SITE.netlify.app";

// ─── Verse list (kept in sync with index.html) ───────────────
const verseList = [
  "JER.29.11", "PSA.23.1", "PRO.3.5-6", "PHP.4.13", "ISA.40.31",
  "MAT.11.28", "JHN.3.16", "ROM.8.28", "1CO.13.13", "PSA.46.1",
  "JOS.1.9", "HEB.11.1", "ROM.12.2", "2CO.5.7", "GAL.5.22-23",
  "EPH.2.8-9", "PHP.4.6-7", "COL.3.23", "1JN.4.19", "PSA.119.105",
  "PSA.91.1-2", "MAT.6.33", "ISA.41.10", "ROM.15.13", "PSA.37.4",
  "PRO.16.3", "MAT.5.16", "2TI.1.7", "PSA.27.1", "HEB.13.8"
];

// Same day-of-year rotation the website uses, so widget == site.
function getVerseForDate(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((date - start) / (1000 * 60 * 60 * 24));
  return verseList[dayOfYear % verseList.length];
}

const FALLBACK_VERSE = {
  english: {
    quote: "For I know the plans I have for you, declares the Lord, plans for welfare and not for evil, to give you a future and a hope.",
    reference: "Jeremiah 29:11"
  },
  chinese: {
    quote: "耶和華說：我知道我向你們所懷的意念是賜平安的意念，不是降災禍的意念，要叫你們末後有指望。",
    reference: "耶利米書 29:11"
  }
};

// ─── Colors (mirrors the site's light/dark CSS variables) ────
const C = {
  bg:        Color.dynamic(new Color("#FDFBF7"), new Color("#2A2622")),
  text:      Color.dynamic(new Color("#4A4036"), new Color("#E5DFD6")),
  quote:     Color.dynamic(new Color("#695D4F"), new Color("#D4C5B1")),
  reference: Color.dynamic(new Color("#8B7355"), new Color("#B8A99A")),
  date:      Color.dynamic(new Color("#A69B8D"), new Color("#8B7355")),
  divider:   Color.dynamic(new Color("#D4C5B1"), new Color("#4A4036"))
};

// ─── Fetch + on-disk cache ───────────────────────────────────
// Verse content is immutable per id, so once cached it never needs
// refreshing — this keeps API calls near zero as the widget reloads.
const fm = FileManager.local();
const cacheDir = fm.joinPath(fm.cacheDirectory(), "daily-bible-widget");
if (!fm.fileExists(cacheDir)) fm.createDirectory(cacheDir, true);

function cachePath(verseId) {
  return fm.joinPath(cacheDir, verseId.replace(/[^A-Z0-9]/gi, "_") + ".json");
}

function cleanText(text) {
  if (!text) return "";
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchVerse(verseId) {
  const path = cachePath(verseId);
  if (fm.fileExists(path)) {
    try { return JSON.parse(fm.readString(path)); } catch (e) { /* refetch */ }
  }
  try {
    const req = new Request(
      `${SITE_BASE_URL}/.netlify/functions/get-bible-verse?verseId=${encodeURIComponent(verseId)}`
    );
    req.timeoutInterval = 10;
    const data = await req.loadJSON();
    if (data && data.english && data.chinese && !data.error) {
      const result = {
        english: { quote: cleanText(data.english.quote), reference: data.english.reference },
        chinese: { quote: cleanText(data.chinese.quote), reference: data.chinese.reference }
      };
      // Don't cache the server's fallback — we want the real verse next time.
      if (!data.isFallback) fm.writeString(path, JSON.stringify(result));
      return result;
    }
  } catch (e) { /* fall through to offline fallback */ }
  return FALLBACK_VERSE;
}

// ─── Fonts ───────────────────────────────────────────────────
// Georgia echoes the site's serif English; Songti TC gives Chinese a
// matching serif feel (both ship with iOS; Scriptable falls back if not).
function enFont(size) { return new Font("Georgia", size); }
function zhFont(size) { return new Font("Songti TC", size); }

// ─── Rendering helpers ───────────────────────────────────────
function addLabel(container, text) {
  const t = container.addText(text);
  t.font = Font.mediumSystemFont(9);
  t.textColor = C.date;
  return t;
}

function addQuote(container, text, isChinese, size, limit) {
  const t = container.addText(isChinese ? "「" + text + "」" : "“" + text + "”");
  t.font = isChinese ? zhFont(size) : enFont(size);
  t.textColor = C.quote;
  t.lineLimit = limit;
  t.minimumScaleFactor = 0.6;
  return t;
}

function addReference(container, text, isChinese) {
  const t = container.addText("— " + text);
  t.font = isChinese ? zhFont(11) : enFont(11);
  t.textColor = C.reference;
  t.lineLimit = 1;
  t.minimumScaleFactor = 0.7;
  return t;
}

function addCenteredDivider(widget, width) {
  const row = widget.addStack();
  row.addSpacer();
  const line = row.addStack();
  line.size = new Size(width, 1);
  line.backgroundColor = C.divider;
  row.addSpacer();
}

function dateString() {
  const df = new DateFormatter();
  df.locale = "zh-Hant";
  df.dateFormat = "M月d日 EEEE";
  return df.string(new Date());
}

// ─── Build the widget ────────────────────────────────────────
function buildLanguageBlock(container, verse, lang, quoteSize, quoteLimit) {
  const isChinese = lang === "chinese";
  addLabel(container, isChinese ? "中文 · 當代譯本" : "English · KJV");
  container.addSpacer(4);
  addQuote(container, verse[lang].quote, isChinese, quoteSize, quoteLimit);
  container.addSpacer(4);
  addReference(container, verse[lang].reference, isChinese);
}

async function createWidget(family) {
  const verseId = getVerseForDate(new Date());
  const verse = await fetchVerse(verseId);

  const widget = new ListWidget();
  widget.backgroundColor = C.bg;
  widget.setPadding(14, 16, 14, 16);
  widget.url = SITE_BASE_URL; // tap opens the full site

  if (family === "small") {
    // Compact: date + Chinese verse + reference.
    const d = addLabel(widget, dateString());
    d.font = Font.mediumSystemFont(10);
    widget.addSpacer(8);
    addQuote(widget, verse.chinese.quote, true, 13, 6);
    widget.addSpacer(6);
    addReference(widget, verse.chinese.reference, true);

  } else if (family === "large") {
    // Full bilingual card, echoing the share image.
    const d = widget.addText(dateString());
    d.font = Font.mediumSystemFont(12);
    d.textColor = C.date;
    d.centerAlignText();
    widget.addSpacer(14);

    const en = widget.addStack();
    en.layoutVertically();
    buildLanguageBlock(en, verse, "english", 15, 6);

    widget.addSpacer(14);
    addCenteredDivider(widget, 50);
    widget.addSpacer(14);

    const zh = widget.addStack();
    zh.layoutVertically();
    buildLanguageBlock(zh, verse, "chinese", 15, 6);

    widget.addSpacer();
    const wm = widget.addText("每日聖經金句 ✦ Daily Bible Quote");
    wm.font = Font.mediumSystemFont(9);
    wm.textColor = C.date;
    wm.centerAlignText();

  } else {
    // medium: two side-by-side columns, like the desktop layout.
    const d = widget.addText(dateString());
    d.font = Font.mediumSystemFont(10);
    d.textColor = C.date;
    widget.addSpacer(8);

    const row = widget.addStack();
    row.layoutHorizontally();
    row.topAlignContent();

    const enCol = row.addStack();
    enCol.layoutVertically();
    buildLanguageBlock(enCol, verse, "english", 11, 5);

    row.addSpacer(14);

    const zhCol = row.addStack();
    zhCol.layoutVertically();
    buildLanguageBlock(zhCol, verse, "chinese", 11, 5);
  }

  // Nudge iOS to refresh shortly after midnight for the next day's verse.
  const now = new Date();
  widget.refreshAfterDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 5, 0);
  return widget;
}

// ─── Entry point ─────────────────────────────────────────────
const family = config.widgetFamily || "medium";
const widget = await createWidget(family);

if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  if (family === "small") await widget.presentSmall();
  else if (family === "large") await widget.presentLarge();
  else await widget.presentMedium();
}
Script.complete();
