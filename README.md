# Daily Bible Quote Widget for Notion

A beautiful, responsive widget that displays daily Bible verses in both English (KJV) and Traditional Chinese (CUV).

## Features

- 🌟 Daily rotating Bible verses
- 🌏 Bilingual support (English KJV and Traditional Chinese CUV)
- 🎨 Beautiful, minimalist design
- 📱 Fully responsive layout
- ⚡ Fast loading and lightweight
- 🔄 Auto-updates every hour
- 🔒 Secure API key handling

## How to Embed in Notion

1. Open your Notion page
2. Type `/embed` and select "Embed"
3. Paste this URL: `https://daily-bible-quote-widget.windsurf.build`
4. Click "Embed link"

The widget will automatically fit your Notion page width and display both English and Chinese translations side by side (or stacked on mobile devices).

## Technical Details

- Uses the Bible API (api.bible) with generous free tier limits (5000 calls/day)
- Updates once per hour to conserve API calls
- Hosted on Netlify's free tier
- Secure server-side API key handling
- No tracking or analytics

## Customization

If you'd like to customize this widget or host your own version:

1. Fork the repository
2. Get your own API key from [api.bible](https://scripture.api.bible/)
3. Deploy to Netlify or your preferred hosting service
4. Set your API key in the environment variables

## Credits

- Bible translations provided by [api.bible](https://scripture.api.bible/)
- KJV (King James Version)
- CUV (Chinese Union Version)

## Support

For issues or feature requests, please contact the maintainer.
