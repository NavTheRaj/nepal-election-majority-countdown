const https = require('https');

const MAIN_URL  = 'https://result.election.gov.np/PRVoteChartResult2082.aspx';
const PR_URL    = 'https://result.election.gov.np/Handlers/SecureJson.ashx?file=JSONFiles/Election2082/Common/PRHoRPartyTop5.txt';
const FPTP_URL  = 'https://result.election.gov.np/Handlers/SecureJson.ashx?file=JSONFiles/Election2082/Common/HoRPartyTop5.txt';

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

    const reqHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0',
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': MAIN_URL,
      'Cookie': cookieStr,
      'X-CSRF-Token': csrfToken,
      'X-Requested-With': 'XMLHttpRequest',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
    };

    // Step 2: fetch PR and FPTP in parallel
    const [prRes, fptpRes] = await Promise.all([
      get(PR_URL, reqHeaders),
      get(FPTP_URL, reqHeaders),
    ]);

    console.log('PR status:', prRes.statusCode, '| FPTP status:', fptpRes.statusCode);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        pr:   JSON.parse(prRes.body),
        fptp: JSON.parse(fptpRes.body),
      }),
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
