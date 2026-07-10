// Proxies the Unsplash API for wallpaper backgrounds, keeping the access key
// server-side. Mirrors get-bible-verse.js. Follows Unsplash's API guidelines:
// hotlinked images, photographer attribution, and triggering the download
// endpoint when a photo is actually used.
// https://help.unsplash.com/en/articles/2511256-guideline-high-quality-authentic-experiences

const UTM = 'utm_source=daily_bible_quote&utm_medium=referral';

exports.handler = async function (event) {
  const ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  const params = event.queryStringParameters || {};
  const action = params.action || 'random';

  // No key configured → tell the client so it can fall back to a gradient.
  if (!ACCESS_KEY) {
    return {
      statusCode: 200,
      headers: { ...headers, 'Cache-Control': 'no-cache' },
      body: JSON.stringify({ noKey: true }),
    };
  }

  try {
    // ─── Trigger Unsplash's download endpoint (required on real use) ───
    if (action === 'download') {
      const id = params.id;
      if (!id || !/^[A-Za-z0-9_-]{5,20}$/.test(id)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid id' }) };
      }
      const res = await fetch(
        `https://api.unsplash.com/photos/${id}/download`,
        { headers: { Authorization: `Client-ID ${ACCESS_KEY}` } }
      );
      return {
        statusCode: 200,
        headers: { ...headers, 'Cache-Control': 'no-cache' },
        body: JSON.stringify({ ok: res.ok }),
      };
    }

    // ─── Fetch a random photo for the requested orientation ───
    const orientation = params.orientation === 'landscape' ? 'landscape' : 'portrait';
    const url = 'https://api.unsplash.com/photos/random'
      + `?orientation=${orientation}`
      + '&query=landscape,nature,minimal,sky'
      + '&content_filter=high';

    const res = await fetch(url, { headers: { Authorization: `Client-ID ${ACCESS_KEY}` } });
    if (!res.ok) {
      console.error(`Unsplash request failed: ${res.status}`);
      return {
        statusCode: 200,
        headers: { ...headers, 'Cache-Control': 'no-cache' },
        body: JSON.stringify({ error: 'unsplash_failed', status: res.status }),
      };
    }

    const p = await res.json();
    const result = {
      id: p.id,
      // urls.raw supports Imgix params, so the client requests exact device size.
      imageBaseUrl: p.urls && p.urls.raw,
      color: p.color || '#4A4036',
      photographer: {
        name: (p.user && p.user.name) || 'Unsplash',
        link: `${(p.user && p.user.links && p.user.links.html) || 'https://unsplash.com'}?${UTM}`,
      },
      photoLink: `${(p.links && p.links.html) || 'https://unsplash.com'}?${UTM}`,
    };

    return {
      statusCode: 200,
      // Don't cache — each call should return a fresh photo.
      headers: { ...headers, 'Cache-Control': 'no-cache' },
      body: JSON.stringify(result),
    };
  } catch (error) {
    console.error('Error fetching Unsplash photo:', error.message || error);
    return {
      statusCode: 200,
      headers: { ...headers, 'Cache-Control': 'no-cache' },
      body: JSON.stringify({ error: 'exception' }),
    };
  }
};
