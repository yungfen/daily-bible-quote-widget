// Proxies the Unsplash API for wallpaper backgrounds, keeping the access key
// server-side. Mirrors get-bible-verse.js. Follows Unsplash's API guidelines:
// hotlinked images, photographer attribution, and triggering the download
// endpoint when a photo is actually used.
// https://help.unsplash.com/en/articles/2511256-guideline-high-quality-authentic-experiences

const UTM = 'utm_source=daily_bible_quote&utm_medium=referral';

// Only browsers on this site (any deploy of it) — or origins listed in the
// optional ALLOWED_ORIGINS env var — may call this proxy. Requests without an
// Origin/Referer (e.g. the Scriptable widget) are allowed; the gate exists to
// stop other websites from burning this site's API quota.
function isAllowedOrigin(event, value) {
  const m = /^https?:\/\/([^/]+)/.exec(value || '');
  if (!m) return false;
  const oHost = m[1].toLowerCase();
  if (oHost === (event.headers.host || '').toLowerCase()) return true;
  return (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, ''))
    .filter(Boolean)
    .includes(oHost);
}

function originGate(event) {
  const origin = event.headers.origin;
  const referer = event.headers.referer;
  const checked = origin || referer;
  if (checked && !isAllowedOrigin(event, checked)) return null; // foreign site → block
  return origin && isAllowedOrigin(event, origin) ? origin : '';
}

exports.handler = async function (event) {
  const ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;

  const allowedOrigin = originGate(event);
  if (allowedOrigin === null) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden' }) };
  }

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
  if (allowedOrigin) headers['Access-Control-Allow-Origin'] = allowedOrigin;

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
    // Optional theme query from the client (per-verse theme or user mood).
    // Sanitized to plain keywords; anything else falls back to the default.
    let query = 'landscape,nature,minimal,sky';
    if (params.query && /^[a-zA-Z][a-zA-Z ,-]{0,79}$/.test(params.query)) {
      query = params.query;
    }
    const url = 'https://api.unsplash.com/photos/random'
      + `?orientation=${orientation}`
      + `&query=${encodeURIComponent(query)}`
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
