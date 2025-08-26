// api/teaching-class.js
const TREND_KEY_PREFIX = 'teaching-class-';

export default async function handler(req, res) {
  const apiUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const apiToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!apiUrl || !apiToken) {
    res.status(500).json({ error: 'KV_REST_API_URL/KV_REST_API_TOKEN or UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN not set' });
    return;
  }
  const { user } = req.method === 'GET' ? req.query : req.body;
  if (!user) {
    res.status(400).json({ error: 'Missing user' });
    return;
  }
  const key = TREND_KEY_PREFIX + user;
  if (req.method === 'GET') {
    try {
      const kvRes = await fetch(`${apiUrl}/get/${key}`, {
        headers: { Authorization: `Bearer ${apiToken}` }
      });
      if (!kvRes.ok) {
        res.status(500).json({ error: 'Failed to fetch from KV' });
        return;
      }
      const { result } = await kvRes.json();
      let data = result?.value || result;
      if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch (e) {}
      }
      while (data && data.value) data = data.value;
      res.status(200).json(Array.isArray(data) ? data : []);
    } catch (err) {
      res.status(500).json({ error: 'Internal Server Error', detail: String(err) });
    }
  } else if (req.method === 'POST') {
    try {
      let body = req.body;
      if (!body) {
        let raw = '';
        await new Promise(resolve => {
          req.on('data', chunk => { raw += chunk; });
          req.on('end', resolve);
        });
        body = JSON.parse(raw);
      }
      if (!body || !Array.isArray(body.data)) {
        res.status(400).json({ error: 'Invalid data' });
        return;
      }
      const kvRes = await fetch(`${apiUrl}/set/${key}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ value: body.data })
      });
      if (!kvRes.ok) {
        res.status(500).json({ error: 'Failed to write to KV' });
        return;
      }
      res.status(200).json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Internal Server Error', detail: String(err) });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
} 