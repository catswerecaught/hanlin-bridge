// 用户交互 API（点赞/转发）- 使用 Upstash KV
const USER_INTERACTIONS_PREFIX = 'user-interactions:';

function unwrapKV(result) {
  try {
    let data = typeof result === 'string' ? JSON.parse(result.replace(/\\"/g, '"')) : result;
    while (data && typeof data === 'object' && data.value) data = data.value;
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch {}
    }
    return data;
  } catch {
    return null;
  }
}

async function readUserInteractions(userId, apiUrl, apiToken) {
  const key = `${USER_INTERACTIONS_PREFIX}${userId}`;
  try {
    const resp = await fetch(`${apiUrl}/get/${key}`, { headers: { 'Authorization': `Bearer ${apiToken}` } });
    if (!resp.ok) return { liked: [], retweeted: [] };
    const data = await resp.json();
    const unpacked = unwrapKV(data.result);
    if (unpacked && typeof unpacked === 'object') {
      return {
        liked: Array.isArray(unpacked.liked) ? unpacked.liked : [],
        retweeted: Array.isArray(unpacked.retweeted) ? unpacked.retweeted : []
      };
    }
  } catch {}
  return { liked: [], retweeted: [] };
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const apiUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const apiToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!apiUrl || !apiToken) {
    return res.status(500).json({ error: 'KV_REST_API_URL/KV_REST_API_TOKEN or UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN not set' });
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const userId = req.query && (req.query.userId || req.query.uid);
  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  try {
    const data = await readUserInteractions(userId, apiUrl, apiToken);
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: 'Internal server error', detail: String(e) });
  }
}
