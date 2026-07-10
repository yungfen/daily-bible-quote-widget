# Daily Bible Quote Widget for Notion

A bilingual widget that displays daily Bible verses in English (KJV) and Traditional Chinese (CUV), designed to embed in Notion pages.

## Features

- Daily rotating Bible verses (30 curated verses)
- Bilingual: English KJV + Traditional Chinese CUV (和合本)
- Light / Dark theme toggle
- 5 font style options
- Copy individual verses to clipboard
- Share as image sized for Instagram Stories (9:16) or feed posts (1:1)
- Responsive layout (side-by-side on desktop, stacked on mobile)
- Persistent caching (localStorage) to reduce API calls
- Auto-updates at midnight

## iPhone Home-Screen Widget

Want the daily verse on your iPhone home screen? See
[`scriptable/README.md`](scriptable/README.md) — it uses the free
[Scriptable](https://scriptable.app) app to show the same verse of the day, no
native app required.

## Embed in Notion

1. Open your Notion page
2. Type `/embed` and select **Embed**
3. Paste your deployed URL
4. Click **Embed link**

## Setup

### Prerequisites

- A free API key from [api.bible](https://scripture.api.bible/)
- A [Netlify](https://netlify.com) account (free tier works fine)

### Deploy

1. Fork this repository
2. Connect the repo to Netlify
3. In Netlify dashboard → **Site settings** → **Environment variables**, add:
   ```
   BIBLE_API_KEY=your_api_key_here
   ```
4. Deploy — that's it!

### Local Development

```bash
cp .env.example .env
# Edit .env and add your API key
npx netlify dev
```

## Tech Stack

- Vanilla HTML / CSS / JS (no build step)
- Netlify Functions (serverless, Node.js)
- [api.bible](https://scripture.api.bible/) for verse data
- [html2canvas](https://html2canvas.hertzen.com/) for image sharing

## API Usage

The Bible API free tier allows 5,000 calls/day. This widget uses ~2 calls per unique verse load (1 English + 1 Chinese), and caches responses in the browser session and via HTTP `Cache-Control` headers.

## License

MIT
