const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;

// Auto-load .env file if present (zero dependencies)
const envFile = path.join(root, '.env');
if (fs.existsSync(envFile)) {
  try {
    const lines = fs.readFileSync(envFile, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  } catch (err) {
    console.error('Could not parse .env file:', err.message);
  }
}

const dataDir = path.join(root, 'data');
const dataFile = path.join(dataDir, 'responses.json');
const port = Number(process.env.PORT || 3000);

// Supabase REST configuration - handles standard, Next.js, and Service Role variable names
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || 
                    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
                    process.env.SUPABASE_KEY || 
                    process.env.SUPABASE_SERVICE_ROLE_KEY;

// Fallback cloud storage: Upstash Redis / Vercel KV REST
const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

async function loadResponses() {
  // 1. Supabase
  if (supabaseUrl && supabaseKey) {
    try {
      const endpoint = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/responses?select=date,answers,result&order=created_at.asc`;
      const res = await fetch(endpoint, {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });
      if (!res.ok) {
        const errText = await res.text();
        console.error('Supabase fetch error:', res.status, errText);
        return [];
      }
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.error('Could not load responses from Supabase:', err.message);
      return [];
    }
  }

  // 2. Upstash / KV
  if (kvUrl && kvToken) {
    try {
      const res = await fetch(kvUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${kvToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(['LRANGE', 'responses', '0', '-1']),
        cache: 'no-store',
      });
      if (!res.ok) {
        console.error('KV fetch error status:', res.status);
        return [];
      }
      const data = await res.json();
      if (Array.isArray(data.result)) {
        return data.result.map(item => {
          try {
            return typeof item === 'string' ? JSON.parse(item) : item;
          } catch {
            return null;
          }
        }).filter(Boolean);
      }
      return [];
    } catch (err) {
      console.error('Could not load responses from KV:', err.message);
      return [];
    }
  }

  // 3. Fallback to local file
  try {
    const parsed = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    console.error('Could not read response data:', error.message);
    return [];
  }
}

async function saveResponse(row) {
  // 1. Supabase
  if (supabaseUrl && supabaseKey) {
    const endpoint = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/responses`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        date: row.date,
        answers: row.answers,
        result: row.result,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Supabase save error (${res.status}): ${text}`);
    }
    return;
  }

  // 2. Upstash / KV
  if (kvUrl && kvToken) {
    const res = await fetch(kvUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${kvToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(['RPUSH', 'responses', JSON.stringify(row)]),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`KV save error (${res.status}): ${text}`);
    }
    return;
  }

  // 3. Fallback to local file
  fs.mkdirSync(dataDir, { recursive: true });
  const rows = await loadResponses();
  rows.push(row);
  fs.writeFileSync(dataFile, `${JSON.stringify(rows, null, 2)}\n`, { mode: 0o600 });
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
    if (!row || !row.answers) continue;
    for (const [key, options] of Object.entries(allowed)) {
      for (const option of options) {
        counts[key][option] = (counts[key][option] || 0) + (row.answers[key] === option ? 1 : 0);
      }
    }
    if (Object.hasOwn(results, row.result)) results[row.result] += 1;
    if (typeof row.date === 'string') days[row.date] = (days[row.date] || 0) + 1;
  }
  return { total: responses.length, results, counts, days };
}

const requestHandler = async (req, res) => {
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
      
      await saveResponse(row);
      return send(res, 201, { saved: true, result });
    } catch (error) {
      if (error.message === 'too_large') return send(res, 413, { error: 'Request too large.' });
      if (error.message === 'invalid_json') return send(res, 400, { error: 'Invalid request.' });
      console.error('Could not save response:', error.message);
      return send(res, 500, { error: 'Could not save response.' });
    }
  }

  if (url.pathname === '/api/admin/stats') {
    const responses = await loadResponses();
    return send(res, 200, summarize(responses));
  }

  if (req.method === 'GET' && (url.pathname === '/admin' || url.pathname === '/admin.html')) {
    return send(res, 200, fs.readFileSync(path.join(root, 'admin.html'), 'utf8'), 'text/html; charset=utf-8');
  }

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    return send(res, 200, fs.readFileSync(path.join(root, 'index.html'), 'utf8'), 'text/html; charset=utf-8');
  }
  
  if (req.method === 'GET' && url.pathname === '/favicon.ico') return send(res, 204, '', 'text/plain');
  
  send(res, 404, { error: 'Not found.' });
};

const server = http.createServer(requestHandler);

module.exports = requestHandler;

if (require.main === module) {
  server.listen(port, () => console.log(`Safety check running at http://localhost:${port}`));
}
