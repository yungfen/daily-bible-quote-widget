exports.handler = async function(event, context) {
  const API_KEY = process.env.BIBLE_API_KEY;
  const BIBLE_ID_EN = '9879dbb7cfe39e4d-01'; // KJV version
  const BIBLE_ID_ZH = 'c0bd4f0457c6-02'; // Chinese Union Version
  
  // Get verse ID from query string
  const { verseId } = event.queryStringParameters || {};
  
  if (!verseId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Verse ID is required' })
    };
  }

  try {
    // Fetch both English and Chinese versions
    const [englishResponse, chineseResponse] = await Promise.all([
      fetch(
        `https://api.scripture.api.bible/v1/bibles/${BIBLE_ID_EN}/verses/${verseId}`,
        {
          headers: {
            'api-key': API_KEY
          }
        }
      ),
      fetch(
        `https://api.scripture.api.bible/v1/bibles/${BIBLE_ID_ZH}/verses/${verseId}`,
        {
          headers: {
            'api-key': API_KEY
          }
        }
      )
    ]);

    if (!englishResponse.ok || !chineseResponse.ok) {
      throw new Error('Failed to fetch verse');
    }

    const [englishData, chineseData] = await Promise.all([
      englishResponse.json(),
      chineseResponse.json()
    ]);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        english: {
          quote: englishData.data.content.replace(/<[^>]*>/g, ''),
          reference: englishData.data.reference
        },
        chinese: {
          quote: chineseData.data.content.replace(/<[^>]*>/g, ''),
          reference: chineseData.data.reference
        }
      })
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Failed to fetch verse',
        english: {
          quote: "For I know the plans I have for you, declares the Lord, plans for welfare and not for evil, to give you a future and a hope.",
          reference: "Jeremiah 29:11"
        },
        chinese: {
          quote: "耶和華說：我知道我向你們所懷的意念是賜平安的意念，不是降災禍的意念，要叫你們末後有指望。",
          reference: "耶利米書 29:11"
        }
      })
    };
  }
};
