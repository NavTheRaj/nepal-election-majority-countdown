const https = require('https');

const MAIN_URL = 'https://result.election.gov.np/PRVoteChartResult2082.aspx';
const EC_URL   = 'https://result.election.gov.np/Handlers/SecureJson.ashx?file=JSONFiles/Election2082/Common/PRHoRPartyTop5.txt';

function get(url, headers) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return get(res.headers.location, headers).then(resolve).catch(reject);
      }
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

exports.handler = async function() {
  try {
    // Step 1: load main page to get ASP.NET_SessionId + CsrfToken cookies
    const mainRes = await get(MAIN_URL, {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    });

    // Parse all cookies
    const rawCookies = mainRes.headers['set-cookie'] || [];
    const cookieMap = {};
    rawCookies.forEach(c => {
      const [pair] = c.split(';');
      const [k, v] = pair.split('=');
      if (k && v) cookieMap[k.trim()] = v.trim();
    });

    const sessionId = cookieMap['ASP.NET_SessionId'] || '';
    const csrfToken = cookieMap['CsrfToken'] || '';
    const cookieStr = `ASP.NET_SessionId=${sessionId}; CsrfToken=${csrfToken}`;

    console.log('SessionId:', sessionId ? 'found' : 'MISSING');
    console.log('CsrfToken:', csrfToken ? 'found' : 'MISSING');

    // Step 2: fetch JSON with session + CSRF
    const dataRes = await get(EC_URL, {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0',
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': MAIN_URL,
      'Cookie': cookieStr,
      'X-CSRF-Token': csrfToken,
      'X-Requested-With': 'XMLHttpRequest',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
    });

    console.log('EC status:', dataRes.statusCode);
    console.log('EC preview:', dataRes.body.substring(0, 150));

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