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

exports.handler = async function (event, context) {
  const API_KEY = process.env.BIBLE_API_KEY;
  const BIBLE_ID_EN = 'de4e12af7f28f599-01'; // KJV (King James Version)
  const BIBLE_ID_ZH = 'a6e06d2c5b90ad89-01'; // Chinese Contemporary Bible Traditional (當代譯本)

  const allowedOrigin = originGate(event);
  if (allowedOrigin === null) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden' }) };
  }

  // ─── CORS headers (shared across all responses) ─────
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
  if (allowedOrigin) headers['Access-Control-Allow-Origin'] = allowedOrigin;

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  // ─── Input validation ───────────────────────────────
  const verseId = (event.queryStringParameters || {}).verseId;

  if (!verseId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Missing required parameter: verseId' }),
    };
  }

  // Basic format validation (e.g., "JER.29.11", "PHP.4.6-7", "PSA.91.1-PSA.91.2")
  if (!/^[A-Z0-9]{2,4}\.\d+\.\d+(-([A-Z0-9]{2,4}\.\d+\.)?\d+)?$/.test(verseId)) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid verseId format' }),
    };
  }

  // Convert short range format to full format for the new API
  // e.g., "PSA.91.1-2" → "PSA.91.1-PSA.91.2"
  let apiVerseId = verseId;
  const rangeMatch = verseId.match(/^([A-Z0-9]{2,4}\.\d+\.)(\d+)-(\d+)$/);
  if (rangeMatch) {
    apiVerseId = `${rangeMatch[1]}${rangeMatch[2]}-${rangeMatch[1]}${rangeMatch[3]}`;
  }

  if (!API_KEY) {
    console.error('BIBLE_API_KEY is missing from environment variables.');
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Server configuration error' }),
    };
  }

  // ─── Fallback verse ─────────────────────────────────
  const fallback = {
    english: {
      quote: 'For I know the plans I have for you, declares the Lord, plans for welfare and not for evil, to give you a future and a hope.',
      reference: 'Jeremiah 29:11',
    },
    chinese: {
      quote: '耶和華說：我知道我向你們所懷的意念是賜平安的意念，不是降災禍的意念，要叫你們末後有指望。',
      reference: '耶利米書 29:11',
    },
  };

  // ─── Fetch from API ─────────────────────────────────
  try {
    const fetchOptions = {
      headers: { 'api-key': API_KEY },
    };

    const [englishRes, chineseRes] = await Promise.all([
      fetch(`https://rest.api.bible/v1/bibles/${BIBLE_ID_EN}/verses/${apiVerseId}?content-type=text&include-titles=false&include-chapter-numbers=false&include-verse-numbers=false`, fetchOptions),
      fetch(`https://rest.api.bible/v1/bibles/${BIBLE_ID_ZH}/verses/${apiVerseId}?content-type=text&include-titles=false&include-chapter-numbers=false&include-verse-numbers=false`, fetchOptions),
    ]);

    // If either request fails, try to return whatever we can
    if (!englishRes.ok && !chineseRes.ok) {
      console.error(`Both requests failed: EN=${englishRes.status}, ZH=${chineseRes.status}`);
      return {
        statusCode: 200,
        headers: { ...headers, 'Cache-Control': 'no-cache' },
        body: JSON.stringify({ ...fallback, isFallback: true }),
      };
    }

    const [englishData, chineseData] = await Promise.all([
      englishRes.ok ? englishRes.json() : null,
      chineseRes.ok ? chineseRes.json() : null,
    ]);

    // Clean HTML tags and excess whitespace from content
    function cleanContent(text) {
      if (!text) return '';
      return text
        .replace(/<[^>]*>/g, '')        // strip HTML tags
        .replace(/&[a-z]+;/gi, ' ')     // strip HTML entities
        .replace(/\s+/g, ' ')           // collapse whitespace
        .trim();
    }

    const result = {
      english: englishData
        ? { quote: cleanContent(englishData.data.content), reference: englishData.data.reference }
        : fallback.english,
      chinese: chineseData
        ? { quote: cleanContent(chineseData.data.content), reference: chineseData.data.reference }
        : fallback.chinese,
    };

    return {
      statusCode: 200,
      headers: {
        ...headers,
        // Cache for 1 hour — verses don't change, saves API quota
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
      body: JSON.stringify(result),
    };
  } catch (error) {
    console.error('Error fetching Bible verse:', error.message || error);
    return {
      statusCode: 200,
      headers: { ...headers, 'Cache-Control': 'no-cache' },
      body: JSON.stringify({ ...fallback, isFallback: true }),
    };
  }
};
