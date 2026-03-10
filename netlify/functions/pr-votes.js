const https = require('https');
const http  = require('http');

const EC_IP   = '202.166.220.247';
const PR_PATH  = '/Handlers/SecureJson.ashx?file=JSONFiles/Election2082/Common/PRHoRPartyTop5.txt';
const FPTP_PATH= '/Handlers/SecureJson.ashx?file=JSONFiles/Election2082/Common/HoRPartyTop5.txt';
const HOST    = 'result.election.gov.np';
const MAIN_URL = `https://${HOST}/PRVoteChartResult2082.aspx`;

function fetch(options, useHttp) {
  return new Promise((resolve, reject) => {
    const lib = useHttp ? http : https;
    const req = lib.request(options, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const loc = res.headers.location;
        const u = new URL(loc);
        return fetch({
          hostname: u.hostname, path: u.pathname + u.search,
          headers: options.headers, method: 'GET'
        }, u.protocol === 'http:').then(resolve).catch(reject);
      }
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.setTimeout(12000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

function parseCookies(rawCookies) {
  const map = {};
  (rawCookies || []).forEach(c => {
    const [pair] = c.split(';');
    const idx = pair.indexOf('=');
    if (idx > 0) map[pair.slice(0,idx).trim()] = pair.slice(idx+1).trim();
  });
  return map;
}

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9,ne;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Sec-Fetch-Site': 'same-origin',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Ch-Ua': '"Google Chrome";v="123", "Not:A-Brand";v="8"',
};

async function tryViaHostname() {
  // Step 1: get session cookies from main page
  const mainRes = await fetch({
    hostname: HOST,
    path: '/PRVoteChartResult2082.aspx',
    method: 'GET',
    headers: { ...BROWSER_HEADERS, 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8' },
  }, false);

  const cookies = parseCookies(mainRes.headers['set-cookie']);
  const sessionId = cookies['ASP.NET_SessionId'] || '';
  const csrfToken = cookies['CsrfToken'] || '';
  console.log('Session:', sessionId ? 'ok' : 'MISSING', '| CSRF:', csrfToken ? 'ok' : 'MISSING');
  console.log('Main page status:', mainRes.statusCode);

  const cookieStr = `ASP.NET_SessionId=${sessionId}; CsrfToken=${csrfToken}`;
  const dataHeaders = {
    ...BROWSER_HEADERS,
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'Referer': MAIN_URL,
    'Cookie': cookieStr,
    'X-CSRF-Token': csrfToken,
    'X-Requested-With': 'XMLHttpRequest',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Dest': 'empty',
  };

  const [prRes, fptpRes] = await Promise.all([
    fetch({ hostname: HOST, path: PR_PATH, method: 'GET', headers: dataHeaders }, false),
    fetch({ hostname: HOST, path: FPTP_PATH, method: 'GET', headers: dataHeaders }, false),
  ]);

  console.log('PR:', prRes.statusCode, '| FPTP:', fptpRes.statusCode);
  if (prRes.statusCode !== 200) throw new Error(`PR returned ${prRes.statusCode}: ${prRes.body.substring(0,100)}`);

  return { pr: JSON.parse(prRes.body), fptp: safeParseJson(fptpRes.body) };
}

async function tryViaDirectIP() {
  // Try hitting EC server directly by IP to bypass potential DNS-level blocking
  const cookieStr = '';
  const dataHeaders = {
    ...BROWSER_HEADERS,
    'Host': HOST,  // must send Host header when using IP
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'Referer': MAIN_URL,
    'X-Requested-With': 'XMLHttpRequest',
  };

  const [prRes, fptpRes] = await Promise.all([
    fetch({ hostname: EC_IP, path: PR_PATH, method: 'GET', headers: dataHeaders }, false),
    fetch({ hostname: EC_IP, path: FPTP_PATH, method: 'GET', headers: dataHeaders }, false),
  ]);

  console.log('Direct IP — PR:', prRes.statusCode, '| FPTP:', fptpRes.statusCode);
  if (prRes.statusCode !== 200) throw new Error(`Direct IP PR returned ${prRes.statusCode}`);
  return { pr: JSON.parse(prRes.body), fptp: safeParseJson(fptpRes.body) };
}

function safeParseJson(body) {
  try { return JSON.parse(body); } catch(e) { console.log('JSON parse fail:', body.substring(0,100)); return []; }
}

exports.handler = async function() {
  const errors = [];

  // Attempt 1: normal hostname with session handshake
  try {
    const data = await tryViaHostname();
    if (data.fptp[0]) console.log('FPTP fields:', Object.keys(data.fptp[0]).join(', '));
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(data),
    };
  } catch(e) {
    console.error('Attempt 1 failed:', e.message);
    errors.push('hostname: ' + e.message);
  }

  // Attempt 2: direct IP
  try {
    const data = await tryViaDirectIP();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(data),
    };
  } catch(e) {
    console.error('Attempt 2 failed:', e.message);
    errors.push('direct-ip: ' + e.message);
  }

  return {
    statusCode: 502,
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ error: 'All attempts failed', details: errors }),
  };
};
