import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import handler from '../api/questions.js';

// Load .env.local to ensure KV_REST_API_URL and KV_REST_API_TOKEN are available
function loadEnvIfNeeded() {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) return;
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const envPath = path.resolve(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) {
    console.warn('[smoke] .env.local not found at', envPath);
    return;
  }
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function createMockReqRes(method, { query = {}, body = null, headers = {} } = {}) {
  let statusCode = 200;
  let payload = null;
  const resHeaders = {};
  const p = new Promise((resolve) => {
    const res = {
      setHeader: (k, v) => { resHeaders[k] = v; },
      status: (code) => { statusCode = code; return res; },
      json: (data) => { payload = data; resolve({ statusCode, headers: resHeaders, body: data }); },
      end: (data) => { payload = data; resolve({ statusCode, headers: resHeaders, body: data }); }
    };
    const req = {
      method,
      query,
      body,
      headers: Object.assign({ 'x-forwarded-for': '127.0.0.1' }, headers),
      connection: { remoteAddress: '127.0.0.1', socket: { remoteAddress: '127.0.0.1' } },
      socket: { remoteAddress: '127.0.0.1' }
    };
    // trigger handler asynchronously
    setImmediate(async () => {
      try {
        await handler(req, res);
      } catch (err) {
        // If handler throws, emulate 500
        res.status(500).json({ error: String(err && err.message ? err.message : err) });
      }
    });
  });
  return p;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async function run() {
  loadEnvIfNeeded();

  console.log('--- Smoke Test: /api/questions ---');
  console.log('[1/4] Submitting a question...');
  const qText = `Smoke test question at ${new Date().toISOString()}`;
  const postRes = await createMockReqRes('POST', { body: { question: qText } });
  console.log('POST status:', postRes.statusCode, 'body:', postRes.body);
  assert(postRes.statusCode === 200, 'POST should return 200');
  assert(postRes.body && postRes.body.success, 'POST should indicate success');
  assert(typeof postRes.body.key === 'string', 'POST should return a key');
  const key = postRes.body.key;

  // small delay to ensure KV write visibility
  await sleep(200);

  console.log('[2/4] Querying before answer...');
  const getRes1 = await createMockReqRes('GET', { query: { key } });
  console.log('GET(before) status:', getRes1.statusCode, 'body:', getRes1.body);
  assert(getRes1.statusCode === 200, 'GET(before) should return 200');
  assert(getRes1.body && getRes1.body.hasAnswer === false, 'GET(before) should have no answer');

  console.log('[3/4] Admin submitting an answer...');
  const answerText = `Answer posted at ${new Date().toISOString()}`;
  const putRes = await createMockReqRes('PUT', { body: { key, answer: answerText } });
  console.log('PUT status:', putRes.statusCode, 'body:', putRes.body);
  assert(putRes.statusCode === 200, 'PUT should return 200');
  assert(putRes.body && putRes.body.success, 'PUT should indicate success');

  await sleep(200);

  console.log('[4/4] Querying after answer...');
  const getRes2 = await createMockReqRes('GET', { query: { key } });
  console.log('GET(after) status:', getRes2.statusCode, 'body:', getRes2.body);
  assert(getRes2.statusCode === 200, 'GET(after) should return 200');
  assert(getRes2.body && getRes2.body.hasAnswer === true, 'GET(after) should have answer');
  assert(getRes2.body.answer && typeof getRes2.body.answer === 'string', 'GET(after) should return answer text');

  console.log('✔ Smoke test passed. Key:', key);
  process.exit(0);
})().catch(err => {
  console.error('✘ Smoke test failed:', err);
  process.exit(1);
});
