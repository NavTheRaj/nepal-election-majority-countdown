// ec-proxy.js — Nepal Election Commission CORS Proxy
// Usage: node ec-proxy.js
// Then open nepal-election-2082.html in your browser

const http = require('http');
const https = require('https');

const PORT = 3001;
const EC_URL = 'https://result.election.gov.np/Handlers/SecureJson.ashx?file=JSONFiles/Election2082/Common/PRHoRPartyTop5.txt';

const server = http.createServer((req, res) => {
  // CORS headers — allow any origin (your local HTML file)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (req.url !== '/pr-votes') { res.writeHead(404); res.end('{}'); return; }

  https.get(EC_URL, {
    headers: {
      'Referer': 'https://result.election.gov.np/PRVoteChartResult2082.aspx',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json, text/plain, */*',
    }
  }, (ecRes) => {
    let body = '';
    ecRes.on('data', chunk => body += chunk);
    ecRes.on('end', () => {
      console.log(`[${new Date().toLocaleTimeString()}] EC data fetched — ${body.length} bytes`);
      res.writeHead(200);
      res.end(body);
    });
  }).on('error', (err) => {
    console.error('Fetch error:', err.message);
    res.writeHead(502);
    res.end(JSON.stringify({ error: err.message }));
  });
});

server.listen(PORT, () => {
  console.log(`\n✅ EC Proxy running at http://localhost:${PORT}/pr-votes`);
  console.log(`   Open nepal-election-2082.html in your browser\n`);
});