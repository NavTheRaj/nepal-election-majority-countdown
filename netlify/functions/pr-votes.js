const https = require('https');

const MAIN_URL = 'https://result.election.gov.np/PRVoteChartResult2082.aspx';
const EC_URL   = 'https://result.election.gov.np/Handlers/SecureJson.ashx?file=JSONFiles/Election2082/Common/PRHoRPartyTop5.txt';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

function get(url, headers) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return get(res.headers.location, headers).then(resolve).catch(reject);
      }
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

exports.handler = async function() {
  try {
    // Step 1: hit the main page to get session cookies
    const mainRes = await get(MAIN_URL, HEADERS);
    const cookies = (mainRes.headers['set-cookie'] || [])
      .map(c => c.split(';')[0])
      .join('; ');

    console.log('Session cookies:', cookies || '(none)');

    // Step 2: fetch the JSON with those cookies
    const dataRes = await get(EC_URL, {
      ...HEADERS,
      'Accept': 'application/json, text/plain, */*',
      'Referer': MAIN_URL,
      'Cookie': cookies,
    });

    console.log('EC status:', dataRes.statusCode);
    console.log('EC preview:', dataRes.body.substring(0, 200));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: dataRes.body,
    };
  } catch (err) {
    console.error('Error:', err.message);
    return {
      statusCode: 502,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};