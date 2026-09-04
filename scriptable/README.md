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

## 每天自動換桌布（iPhone / iPad）

iOS 不讓 App 直接更換桌布，但有一條 Apple 自己提供的路：**照片輪播（Photo
Shuffle）＋相簿**（iOS 17.1 以上）。`daily-bible-wallpaper.js` 每天產生一張
「當日經文＋主題照片」的圖，捷徑把它存進指定相簿，鎖定畫面設成輪播那個相簿，
桌布就每天自己換。

### 設定一次，之後不用管

1. **Scriptable**：新增腳本，貼上 [`daily-bible-wallpaper.js`](./daily-bible-wallpaper.js)，
   命名 **Daily Bible Wallpaper**，開頭的 `SITE_BASE_URL` 改成你的網站網址。
2. **先在 Scriptable 裡按 ▶ 跑一次**：會先預覽，再問要不要存到照片。看一下字型
   與位置。
3. **照片 App**：新增相簿，命名「每日聖經金句」。
4. **捷徑 App** → 新增捷徑：
   - 動作一：Scriptable「Run Script」→ 選 Daily Bible Wallpaper，**Run In App 關掉**
     （想指定心情可在「Parameter」填 `calm`、`nature`、`sky`、`light`、`mountains`
     或 `random`，不填就依經文）。
   - 動作二：照片「儲存到相簿」→ 相簿選「每日聖經金句」，輸入用上一步的 Script Result。
   - 命名「每日桌布」，跑一次確認相簿裡多了一張。
5. **捷徑 → 自動化** → 新增個人自動化 → 時間 → 每天 06:00 → 執行「每日桌布」
   → **立即執行**（不要「執行前先詢問」）。
6. **設定 → 桌布 → 加入新桌布 → 照片輪播** → 「使用相簿」選「每日聖經金句」
   → 輪播頻率「每天」。

之後每天早上六點多一張新圖進相簿，鎖定畫面當天就換成它。

### 幾個注意

- 相簿會越來越多張，輪播是在整個相簿裡挑，想「只看今天的」就定期清舊圖，
  或把輪播頻率設「每天」讓它照順序輪。
- 拿不到照片（沒網路、Unsplash 掛了）會用漸層底圖並發通知說明，桌布照樣換。
- 字型：iOS 內建的 Georgia 與宋體（Songti TC），與網站的氣質一致。
- 每天只呼叫 Unsplash 兩次（取照片、回報使用），不會碰到配額。
