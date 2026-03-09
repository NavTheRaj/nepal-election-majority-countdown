const https = require('https');

const EC_URL = 'https://result.election.gov.np/Handlers/SecureJson.ashx?file=JSONFiles/Election2082/Common/PRHoRPartyTop5.txt';

exports.handler = async function(event, context) {
  return new Promise((resolve) => {
    https.get(EC_URL, {
      headers: {
        'Referer': 'https://result.election.gov.np/PRVoteChartResult2082.aspx',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*',
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: body,
        });
      });
    }).on('error', (err) => {
      resolve({
        statusCode: 502,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: err.message }),
      });
    });
  });
};
