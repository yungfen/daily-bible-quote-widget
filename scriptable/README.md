# iPhone Home-Screen Widget (via Scriptable)

iOS home-screen widgets can only be built with Apple's **WidgetKit**, which
requires a native app (Xcode + Swift + an Apple Developer account). For a
personal daily-verse widget that's overkill — so this folder provides the
same thing with **zero native code** using the free
[**Scriptable**](https://scriptable.app) app.

The widget calls the **same Netlify endpoint** the website uses, so it shows
the **exact same verse of the day**, in English (KJV) and Traditional Chinese
(當代譯本), with matching light/dark styling.

> **Not a widget:** adding the website to your home screen ("加入主畫面" / PWA)
> only creates an icon that opens the page — it does **not** put the verse on
> your home screen. Scriptable does.

## Setup

1. **Install Scriptable** from the App Store (free).
2. **Deploy the site** first (see the main [README](../README.md)) and note
   your Netlify URL, e.g. `https://daily-bible-quote.netlify.app`.
3. In Scriptable, tap **＋** to create a new script and paste in the contents
   of [`daily-bible-widget.js`](./daily-bible-widget.js). Name it e.g.
   **Daily Bible**.
4. Near the top of the script, set your site URL:
   ```js
   const SITE_BASE_URL = "https://YOUR-SITE.netlify.app";
   ```
   (No trailing slash.)
5. Tap ▶ inside Scriptable to preview — you should see the verse card.
6. Add the widget: long-press your home screen → **＋** → search
   **Scriptable** → pick a size → **Add Widget** → long-press the new widget →
   **Edit Widget** → set **Script** to **Daily Bible**.

## Sizes

| Size   | Shows                                             |
|--------|---------------------------------------------------|
| Small  | Date + Chinese verse + reference                  |
| Medium | Date + English and Chinese side-by-side           |
| Large  | Full bilingual card (English · divider · Chinese) |

Tapping the widget opens the full website.

## How it works

- **Same verse as the site.** `getVerseForDate()` uses the identical
  day-of-year rotation over the same 30-verse list as `index.html`, so the
  widget and the website always agree.
- **Minimal API usage.** Each verse is fetched once from
  `/.netlify/functions/get-bible-verse` and cached on-device forever (verse
  text never changes), so widget reloads don't burn API calls.
- **Offline-safe.** If the network or API is unavailable, it shows a built-in
  fallback verse instead of an error.
- **Daily refresh.** The widget asks iOS to reload just after midnight for the
  next day's verse. (iOS controls exact refresh timing.)

## Keeping it in sync

If you change the verse list in `index.html`, update the `verseList` array in
`daily-bible-widget.js` to match so the widget keeps showing the same verse as
the site.
