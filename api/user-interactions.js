// 用户交互 API（点赞/转发）- 使用 Upstash KV
const USER_INTERACTIONS_PREFIX = 'user-interactions:';

// 安全的解包函数：避免替换转义字符，迭代解析字符串并解包 value 层
function unwrapKV(result) {
  try {
    // 初始数据可为字符串或对象
    let data = result;

    // 尝试多次解析字符串（处理双/三重字符串化）
    for (let i = 0; i < 3 && typeof data === 'string'; i++) {
      try {
        data = JSON.parse(data);
      } catch {
        break;
      }
    }

    // 解包嵌套的 { value: ... } 结构
    let guard = 0;
    while (data && typeof data === 'object' && 'value' in data && guard < 3) {
      data = data.value;
      // 若 value 为字符串，再尝试解析
      for (let i = 0; i < 2 && typeof data === 'string'; i++) {
        try { data = JSON.parse(data); } catch { break; }
      }
      guard++;
    }

    // 兜底再解析一次字符串
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
    if (!resp.ok) return { liked: [], retweeted: [], followings: [] };
    const data = await resp.json();
    const unpacked = unwrapKV(data.result);
    if (unpacked && typeof unpacked === 'object') {
      return {
        liked: Array.isArray(unpacked.liked) ? unpacked.liked : [],
        retweeted: Array.isArray(unpacked.retweeted) ? unpacked.retweeted : [],
        followings: Array.isArray(unpacked.followings) ? unpacked.followings : []
      };
    }
  } catch {}
  return { liked: [], retweeted: [], followings: [] };
}

async function writeUserInteractions(userId, interactions, apiUrl, apiToken) {
  const key = `${USER_INTERACTIONS_PREFIX}${userId}`;
  try {
    const resp = await fetch(`${apiUrl}/set/${key}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ value: interactions })
    });
    return resp.ok;
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const apiUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const apiToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!apiUrl || !apiToken) {
    return res.status(500).json({ error: 'KV_REST_API_URL/KV_REST_API_TOKEN or UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN not set' });
  }

  const userId = (req.query && (req.query.userId || req.query.uid)) || (req.body && req.body.userId);
  if (req.method === 'GET') {
    if (!userId) return res.status(400).json({ error: 'Missing userId' });
    try {
      const data = await readUserInteractions(userId, apiUrl, apiToken);
      res.status(200).json(data);
    } catch (e) {
      res.status(500).json({ error: 'Internal server error', detail: String(e) });
    }
    return;
  }

  if (req.method === 'PATCH') {
    if (!userId) return res.status(400).json({ error: 'Missing userId' });
    const { action, target, followings } = req.body || {};
    try {
      const current = await readUserInteractions(userId, apiUrl, apiToken);
      const next = {
        liked: Array.isArray(current.liked) ? current.liked : [],
        retweeted: Array.isArray(current.retweeted) ? current.retweeted : [],
        followings: Array.isArray(current.followings) ? current.followings : []
      };

      if (action === 'follow' && typeof target === 'string' && target.trim()) {
        if (!next.followings.includes(target)) next.followings.push(target);
      } else if (action === 'unfollow' && typeof target === 'string' && target.trim()) {
        next.followings = next.followings.filter(u => u !== target);
      } else if (action === 'sync' && Array.isArray(followings)) {
        next.followings = [...new Set(followings.filter(u => typeof u === 'string'))];
      } else {
        res.status(400).json({ error: 'Invalid action' });
        return;
      }

      const ok = await writeUserInteractions(userId, next, apiUrl, apiToken);
      if (!ok) return res.status(500).json({ error: 'Failed to persist followings' });
      return res.status(200).json(next);
    } catch (e) {
      return res.status(500).json({ error: 'Internal server error', detail: String(e) });
    }
  }

  res.setHeader('Allow', ['GET', 'PATCH']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}
