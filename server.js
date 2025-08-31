import http from 'http';
import { promises as fs } from 'fs';
import path from 'path';
import url from 'url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = __dirname;
const PORT = process.env.PORT ? Number(process.env.PORT) : 8000;

// Load env from .env.local if present (simple parser, no dependency)
async function loadDotEnv() {
  try {
    const envPath = path.join(ROOT, '.env.local');
    const raw = await fs.readFile(envPath, 'utf8');
    raw.split(/\r?\n/).forEach((line) => {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m) return;
      let [, key, val] = m;
      // strip surrounding quotes
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    });
  } catch {}
}

function contentTypeFromExt(ext) {
  return ({
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
  }[ext.toLowerCase()]) || 'application/octet-stream';
}

function send(res, status, body, headers = {}) {
  res.statusCode = status;
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  if (typeof body === 'string' || Buffer.isBuffer(body)) {
    res.end(body);
  } else if (body == null) {
    res.end();
  } else {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(body));
  }
}

function enhanceRes(res) {
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (obj) => { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(obj)); };
  res.send = (data) => {
    if (typeof data === 'object') return res.json(data);
    res.end(String(data));
  };
  return res;
}

function enhanceReq(req, parsedUrl) {
  req.query = Object.fromEntries(new URLSearchParams(parsedUrl.search || ''));
  return req;
}

async function handleApi(req, res, pathname) {
  // Map /api/foo to api/foo.js
  const rel = pathname.replace(/^\/api\/?/, '');
  const file = path.join(ROOT, 'api', rel.endsWith('.js') ? rel : `${rel}.js`);
  try {
    await fs.access(file);
  } catch {
    return send(res, 404, { error: 'API file not found' });
  }

  // 简单的 JSON 请求体解析器
  async function parseJsonBody(request) {
    return await new Promise((resolve) => {
      const chunks = [];
      request.on('data', (c) => chunks.push(c));
      request.on('end', () => {
        if (!chunks.length) return resolve(undefined);
        const raw = Buffer.concat(chunks).toString('utf8');
        if (!raw) return resolve(undefined);
        try {
          resolve(JSON.parse(raw));
        } catch {
          resolve(undefined);
        }
      });
    });
  }
  try {
    // 使用文件修改时间作为查询参数，避免 ESM 缓存，便于开发时热加载 API 代码
    const st = await fs.stat(file).catch(() => null);
    const ver = st ? st.mtimeMs : Date.now();
    const modPath = url.pathToFileURL(file).href + `?v=${ver}`;
    const mod = await import(modPath);
    const handler = mod.default;
    if (typeof handler !== 'function') return send(res, 500, { error: 'Invalid API handler' });
    enhanceRes(res);
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    enhanceReq(req, parsedUrl);
    // 仅当是 JSON 请求时解析 body
    const ct = (req.headers['content-type'] || '').toLowerCase();
    if (ct.includes('application/json')) {
      req.body = await parseJsonBody(req);
    }
    await handler(req, res);
  } catch (e) {
    console.error('API error:', e);
    send(res, 500, { error: 'Internal Server Error', detail: String(e) });
  }
}

async function handleStatic(req, res, pathname) {
  let filePath = path.join(ROOT, pathname);
  try {
    const stat = await fs.stat(filePath).catch(() => null);
    if (!stat) {
      // Fallback to index.html for root or 404
      if (pathname === '/' || pathname === '') {
        filePath = path.join(ROOT, 'index.html');
      } else {
        return send(res, 404, '<!DOCTYPE HTML><title>404</title>Not Found', { 'Content-Type': 'text/html; charset=utf-8' });
      }
    } else if (stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }
    const ext = path.extname(filePath);
    const data = await fs.readFile(filePath);
    res.setHeader('Content-Type', contentTypeFromExt(ext));
    res.end(data);
  } catch (e) {
    send(res, 500, { error: 'Static server error', detail: String(e) });
  }
}

await loadDotEnv();

const server = http.createServer(async (req, res) => {
  const parsed = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(parsed.pathname);

  if (pathname.startsWith('/api/')) {
    return handleApi(req, res, pathname);
  }
  return handleStatic(req, res, pathname);
});

server.listen(PORT, () => {
  console.log(`Dev server running at http://localhost:${PORT}`);
});
