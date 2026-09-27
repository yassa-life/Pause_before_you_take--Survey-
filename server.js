const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const dataDir = path.join(root, 'data');
const dataFile = path.join(dataDir, 'responses.json');
const port = Number(process.env.PORT || 3000);

function loadResponses() {
  try {
    const parsed = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    console.error('Could not read response data:', error.message);
    return [];
  }
}

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': type,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
  });
  res.end(type.startsWith('application/json') ? JSON.stringify(body) : body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.setEncoding('utf8');
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 4096) reject(new Error('too_large'));
    });
    req.on('end', () => {
      try { resolve(JSON.parse(raw)); } catch { reject(new Error('invalid_json')); }
    });
    req.on('error', reject);
  });
}

const allowed = {
  reason: ['Headache', 'Toothache', 'Body pain', 'Period pain', 'Other'],
  lastDose: ['Not today', 'Earlier today', 'Not sure'],
  doseChecked: ['Yes', 'No'],
  otherMedicine: ['Yes', 'No', 'Not sure'],
  unsure: ['Yes', 'No'],
};

function summarize(responses) {
  const counts = Object.fromEntries(Object.keys(allowed).map(key => [key, {}]));
  const results = { 'CHECKED': 0, 'CHECK FIRST': 0, 'SEEK ADVICE': 0 };
  const days = {};
  for (const row of responses) {
    for (const [key, options] of Object.entries(allowed)) {
      for (const option of options) counts[key][option] = (counts[key][option] || 0) + (row.answers?.[key] === option ? 1 : 0);
    }
    if (Object.hasOwn(results, row.result)) results[row.result] += 1;
    if (typeof row.date === 'string') days[row.date] = (days[row.date] || 0) + 1;
  }
  return { total: responses.length, results, counts, days };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'POST' && url.pathname === '/api/responses') {
    try {
      const payload = await readBody(req);
      if (!payload || Object.entries(allowed).some(([key, values]) => !values.includes(payload[key])) || Object.keys(payload).some(key => !Object.hasOwn(allowed, key))) {
        return send(res, 400, { error: 'Please answer all questions using the provided choices.' });
      }
      const answers = Object.fromEntries(Object.keys(allowed).map(key => [key, payload[key]]));
      const result = answers.unsure === 'Yes' || answers.lastDose === 'Not sure' || answers.otherMedicine === 'Not sure'
        ? 'SEEK ADVICE'
        : answers.doseChecked === 'No' || answers.otherMedicine === 'Yes' || answers.lastDose === 'Earlier today'
          ? 'CHECK FIRST'
          : 'CHECKED';
      const row = { date: new Date().toISOString().slice(0, 10), answers, result };
      fs.mkdirSync(dataDir, { recursive: true });
      const rows = loadResponses();
      rows.push(row);
      fs.writeFileSync(dataFile, `${JSON.stringify(rows, null, 2)}\n`, { mode: 0o600 });
      return send(res, 201, { saved: true, result });
    } catch (error) {
      if (error.message === 'too_large') return send(res, 413, { error: 'Request too large.' });
      if (error.message === 'invalid_json') return send(res, 400, { error: 'Invalid request.' });
      console.error('Could not save response:', error.message);
      return send(res, 500, { error: 'Could not save response.' });
    }
  }

  if (url.pathname === '/api/admin/stats') {
    return send(res, 200, summarize(loadResponses()));
  }

  if (req.method === 'GET' && url.pathname === '/admin') {
    return send(res, 200, fs.readFileSync(path.join(root, 'admin.html'), 'utf8'), 'text/html; charset=utf-8');
  }

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    return send(res, 200, fs.readFileSync(path.join(root, 'index.html'), 'utf8'), 'text/html; charset=utf-8');
  }
  if (req.method === 'GET' && url.pathname === '/favicon.ico') return send(res, 204, '', 'text/plain');
  send(res, 404, { error: 'Not found.' });
});

server.listen(port, () => console.log(`Safety check running at http://localhost:${port}`));
