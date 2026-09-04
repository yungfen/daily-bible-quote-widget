// Daily Bible Wallpaper — iPhone / iPad (Scriptable)
//
// Composites today's verse (KJV + 當代譯本) over a themed Unsplash photo at
// the device's screen resolution and hands the image to Shortcuts, which saves
// it into a Photos album. Set the Lock Screen to Photo Shuffle → that album →
// Daily, and the wallpaper changes by itself every morning. iOS gives no API
// to set a wallpaper directly; this is the supported route (iOS 17.1+).
//
// Setup (details in README.md):
//   1. Paste this into Scriptable as "Daily Bible Wallpaper", set SITE_BASE_URL.
//   2. Run it once inside Scriptable — it previews the image and saves it to
//      Photos so you can check how it looks.
//   3. Make a Shortcut: Scriptable「Run Script」(this script, Run In App off)
//      → Photos「Save to Photo Album」(album: 每日聖經金句).
//   4. Add a Personal Automation: Time of Day → 06:00 → that Shortcut, with
//      "Run Immediately" so it needs no tap.
//   5. Settings → Wallpaper → Add → Photo Shuffle → Album → 每日聖經金句 → Daily.
//
// Optional argument from Shortcuts (Text input): a mood —
//   calm | nature | sky | light | mountains | random   (default: by verse)

const SITE_BASE_URL = "https://daily-bible-quote-widget.netlify.app";
const ALBUM_HINT = "每日聖經金句";

// Same verse rotation as the site: day-of-year modulo the list length.
const verseList = [
  "JER.29.11", "PSA.23.1", "PRO.3.5-6", "PHP.4.13", "ISA.40.31", "MAT.11.28",
  "JHN.3.16", "ROM.8.28", "1CO.13.13", "PSA.46.1", "JOS.1.9", "HEB.11.1",
  "ROM.12.2", "2CO.5.7", "GAL.5.22-23", "EPH.2.8-9", "PHP.4.6-7", "COL.3.23",
  "1JN.4.19", "PSA.119.105", "PSA.91.1-2", "MAT.6.33", "ISA.41.10", "ROM.15.13",
  "PSA.37.4", "PRO.16.3", "MAT.5.16", "2TI.1.7", "PSA.27.1", "HEB.13.8"
];
const THEMES = {
  "JER.29.11": "sunrise horizon hope", "PSA.23.1": "green pasture meadow sheep",
  "PRO.3.5-6": "forest path trail", "PHP.4.13": "mountain summit climber",
  "ISA.40.31": "eagle soaring sky", "MAT.11.28": "calm lake still water",
  "JHN.3.16": "starry night sky earth", "ROM.8.28": "golden field sunlight",
  "1CO.13.13": "warm sunset soft glow", "PSA.46.1": "mountain rock fortress",
  "JOS.1.9": "cliff sunrise courage", "HEB.11.1": "misty forest fog",
  "ROM.12.2": "spring blossom new growth", "2CO.5.7": "foggy road morning mist",
  "GAL.5.22-23": "orchard garden fruit", "EPH.2.8-9": "light rays through clouds",
  "PHP.4.6-7": "peaceful calm ocean", "COL.3.23": "wheat harvest golden field",
  "1JN.4.19": "warm sunrise glow", "PSA.119.105": "lantern path night light",
  "PSA.91.1-2": "starry mountain night shelter", "MAT.6.33": "sunbeam forest morning",
  "ISA.41.10": "lighthouse sea storm", "ROM.15.13": "blooming flowers spring",
  "PSA.37.4": "wildflower meadow sunshine", "PRO.16.3": "open road horizon",
  "MAT.5.16": "sunlight through trees", "2TI.1.7": "bold mountain peak dawn",
  "PSA.27.1": "dawn light valley", "HEB.13.8": "ancient rocks timeless desert"
};
const MOODS = {
  calm: "calm still water minimal", nature: "nature landscape forest",
  sky: "sky clouds stars", light: "golden hour sunlight rays",
  mountains: "mountains alpine peaks"
};
const DEFAULT_QUERY = "landscape,nature,minimal,sky";

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

function getVerseForDate(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((date - start) / 86400000);
  return verseList[dayOfYear % verseList.length];
}
function cleanText(text) {
  if (!text) return "";
  return text.replace(/<[^>]*>/g, "").replace(/&[a-z]+;/gi, " ").replace(/\s+/g, " ").trim();
}

async function fetchVerse(verseId) {
  try {
    const req = new Request(`${SITE_BASE_URL}/.netlify/functions/get-bible-verse?verseId=${encodeURIComponent(verseId)}`);
    req.timeoutInterval = 15;
    const data = await req.loadJSON();
    if (data && data.english && data.chinese) {
      return {
        english: { quote: cleanText(data.english.quote), reference: data.english.reference },
        chinese: { quote: cleanText(data.chinese.quote), reference: data.chinese.reference },
        isFallback: !!data.isFallback
      };
    }
  } catch (e) { /* offline → built-in verse */ }
  return Object.assign({ isFallback: true }, FALLBACK_VERSE);
}

// Returns { id, imageBaseUrl, photographer } or { reason } for a gradient.
async function fetchPhoto(query) {
  try {
    const req = new Request(`${SITE_BASE_URL}/.netlify/functions/get-unsplash-photo?action=random&orientation=portrait&query=${encodeURIComponent(query)}`);
    req.timeoutInterval = 15;
    const data = await req.loadJSON();
    if (data && data.noKey) return { reason: "網站未設定 Unsplash 金鑰" };
    if (data && data.id && data.imageBaseUrl) {
      return { id: data.id, imageBaseUrl: data.imageBaseUrl, photographer: (data.photographer && data.photographer.name) || "Unsplash" };
    }
  } catch (e) { /* fall through */ }
  return { reason: "Unsplash 暫時無法使用" };
}
async function loadPhoto(photo, pxH) {
  const sep = photo.imageBaseUrl.indexOf("?") >= 0 ? "&" : "?";
  const req = new Request(`${photo.imageBaseUrl}${sep}h=${pxH}&fit=max&q=85&fm=jpg`);
  req.timeoutInterval = 60;
  return await req.loadImage();
}
async function reportDownload(photo) {
  try {
    const req = new Request(`${SITE_BASE_URL}/.netlify/functions/get-unsplash-photo?action=download&id=${encodeURIComponent(photo.id)}`);
    req.timeoutInterval = 10;
    await req.load();
  } catch (e) { /* attribution ping only */ }
}

// ─── Layout ──────────────────────────────────────────────────
// DrawContext has no text measurement, so line counts are estimated from
// average glyph widths (CJK ≈ 1 em, Latin ≈ 0.5 em). Slightly generous so the
// block is never clipped; it may sit a little above true centre.
function estimateLines(text, fontSize, maxW, cjk) {
  const perLine = Math.max(1, Math.floor(maxW / (fontSize * (cjk ? 1.0 : 0.52))));
  if (cjk) return Math.ceil(text.length / perLine);
  let lines = 1, len = 0;
  for (const w of text.split(" ")) {
    if (len && len + 1 + w.length > perLine) { lines++; len = w.length; } else len += (len ? 1 : 0) + w.length;
  }
  return lines;
}

function compose(verse, img, credit, W, H) {
  const min = Math.min(W, H);
  const ctx = new DrawContext();
  ctx.size = new Size(W, H);
  ctx.respectScreenScale = false; // W×H are already pixels
  ctx.opaque = true;

  if (img) {
    // cover-fit
    const ir = img.size.width / img.size.height, cr = W / H;
    let dw, dh;
    if (ir > cr) { dh = H; dw = H * ir; } else { dw = W; dh = W / ir; }
    ctx.drawImageInRect(img, new Rect((W - dw) / 2, (H - dh) / 2, dw, dh));
    ctx.setFillColor(new Color("#000000", 0.42));
    ctx.fillRect(new Rect(0, 0, W, H));
  } else {
    ctx.setFillColor(new Color("#4a4036"));
    ctx.fillRect(new Rect(0, 0, W, H));
    ctx.setFillColor(new Color("#6f6250", 0.55));
    ctx.fillRect(new Rect(0, 0, W, H * 0.5));
  }

  const enSize = Math.round(min * 0.045), zhSize = Math.round(min * 0.043), refSize = Math.round(min * 0.026);
  const gap = Math.round(min * 0.02), maxW = Math.min(W * 0.82, min * 1.15), x = (W - maxW) / 2;
  const enText = "“" + verse.english.quote + "”", zhText = "「" + verse.chinese.quote + "」";
  const enH = estimateLines(enText, enSize, maxW, false) * enSize * 1.42;
  const zhH = estimateLines(zhText, zhSize, maxW, true) * zhSize * 1.62;
  const refH = refSize * 1.6;
  const blockH = enH + gap * 0.5 + refH + gap * 1.1 + zhH + gap * 0.5 + refH;
  let y = (H - blockH) / 2;

  ctx.setTextAlignedCenter();
  ctx.setTextColor(new Color("#ffffff"));
  ctx.setFont(new Font("Georgia-Bold", enSize));
  ctx.drawTextInRect(enText, new Rect(x, y, maxW, enH)); y += enH + gap * 0.5;
  ctx.setTextColor(new Color("#ffffff", 0.85));
  ctx.setFont(new Font("Georgia", refSize));
  ctx.drawTextInRect("— " + verse.english.reference, new Rect(x, y, maxW, refH)); y += refH + gap * 1.1;
  ctx.setFillColor(new Color("#ffffff", 0.5));
  ctx.fillRect(new Rect(W / 2 - min * 0.05, y - gap * 0.55, min * 0.1, Math.max(1, min * 0.0015)));
  ctx.setTextColor(new Color("#ffffff"));
  ctx.setFont(new Font("Songti TC", zhSize));
  ctx.drawTextInRect(zhText, new Rect(x, y, maxW, zhH)); y += zhH + gap * 0.5;
  ctx.setTextColor(new Color("#ffffff", 0.85));
  ctx.setFont(new Font("Georgia", refSize));
  ctx.drawTextInRect("— " + verse.chinese.reference, new Rect(x, y, maxW, refH));

  const smallSize = Math.round(min * 0.02);
  ctx.setFont(new Font("Georgia", smallSize));
  ctx.setTextColor(new Color("#ffffff", 0.82));
  ctx.drawTextInRect("每日聖經金句 ✦ Daily Bible Quote", new Rect(0, H - min * 0.07, W, smallSize * 1.4));
  if (credit) {
    ctx.setTextAlignedLeft();
    ctx.setFont(new Font("Georgia", Math.round(min * 0.016)));
    ctx.setTextColor(new Color("#ffffff", 0.68));
    ctx.drawTextInRect("Photo: " + credit + " / Unsplash", new Rect(min * 0.05, H - min * 0.038, W, smallSize * 1.4));
  }
  return ctx.getImage();
}

// ─── Main ────────────────────────────────────────────────────
const mood = (args.shortcutParameter || args.plainTexts[0] || "").toString().trim().toLowerCase();
const verseId = getVerseForDate(new Date());
let query = THEMES[verseId] || DEFAULT_QUERY;
if (mood === "random") { const k = Object.keys(MOODS); query = MOODS[k[Math.floor(Math.random() * k.length)]]; }
else if (MOODS[mood]) query = MOODS[mood];

const res = Device.screenResolution(); // pixels
const W = Math.round(res.width), H = Math.round(res.height);

const verse = await fetchVerse(verseId);
const photo = await fetchPhoto(query);
let img = null, note = photo.reason || "";
if (!photo.reason) {
  try { img = await loadPhoto(photo, H); } catch (e) { note = "照片下載失敗"; }
}
const out = compose(verse, img, img ? photo.photographer : null, W, H);
if (img) reportDownload(photo);

if (config.runsInApp) {
  // Manual run inside Scriptable: preview, then offer to save.
  await QuickLook.present(out, true);
  const a = new Alert();
  a.title = "存到照片？";
  a.message = `${verse.chinese.reference} · ${W}×${H}` + (note ? `\n${note}，已用漸層底圖` : "") +
    `\n之後請把它移到「${ALBUM_HINT}」相簿（用捷徑自動化會直接存進相簿）。`;
  a.addAction("儲存"); a.addCancelAction("取消");
  if ((await a.present()) === 0) { Photos.save(out); }
} else {
  // Run from Shortcuts: hand the image back so「Save to Photo Album」can file it.
  Script.setShortcutOutput(out);
}
if (note && !config.runsInApp) {
  const n = new Notification();
  n.title = "Daily Bible Wallpaper";
  n.body = note + "，今天用漸層底圖";
  await n.schedule();
}
Script.complete();
