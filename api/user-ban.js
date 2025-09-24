const BAN_KEY = 'user-ban-map';

function unwrapKV(raw) {
  let data = raw;
  let safety = 0;
  while (safety++ < 10) {
    if (data == null) break;
    if (typeof data === 'string') {
      try { data = JSON.parse(data); continue; } catch { break; }
    }
    if (typeof data === 'object' && data.value != null) { data = data.value; continue; }
    break;
  }
  return data;
}

export default async function handler(req, res) {
  const apiUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const apiToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!apiUrl || !apiToken) {
    return res.status(500).json({ error: 'Upstash env not set' });
  }

  // Auth optional for GET, required for PUT (must be taosir)
  const authHeader = req.headers.authorization || '';
  const requester = authHeader.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : '';

  try {
    if (req.method === 'GET') {
      const urlObj = new URL(req.url, `http://${req.headers.host}`);
      const wantList = urlObj.searchParams.get('list') === '1';
      const username = urlObj.searchParams.get('username') || '';

      const resp = await fetch(`${apiUrl}/get/${BAN_KEY}`, { headers: { Authorization: `Bearer ${apiToken}` } });
      const data = await resp.json().catch(() => ({}));
      const map = unwrapKV(unwrapKV(data?.result)) || {};

      if (wantList) return res.status(200).json(map);
      if (!username) return res.status(400).json({ error: 'username required' });
      return res.status(200).json({ banned: !!map[username] });
    }

    if (req.method === 'PUT') {
      if (requester !== 'taosir') {
        return res.status(403).json({ error: 'forbidden' });
      }
      const { username, banned } = req.body || {};
      if (!username || typeof banned !== 'boolean') {
        return res.status(400).json({ error: 'invalid body' });
      }
      // Get current map
      const getResp = await fetch(`${apiUrl}/get/${BAN_KEY}`, { headers: { Authorization: `Bearer ${apiToken}` } });
      const getData = await getResp.json().catch(() => ({}));
      const map = unwrapKV(unwrapKV(getData?.result)) || {};
      if (banned) map[username] = true; else delete map[username];
      await fetch(`${apiUrl}/set/${BAN_KEY}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: JSON.stringify(map) })
      });
      return res.status(200).json({ success: true, username, banned });
    }

    return res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    console.error('user-ban api error', e);
    return res.status(500).json({ error: 'internal error' });
  }
}
