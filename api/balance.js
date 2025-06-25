const BALANCE_KEY_PREFIX = 'balance-';

// 卡种等级与门槛
const CARD_LEVELS = [
  { type: '大众M1', threshold: 0 },
  { type: '大众M2', threshold: 1000 },
  { type: '金卡M1', threshold: 50000 },
  { type: '金卡M2', threshold: 200000 },
  { type: '金玉兰M1', threshold: 500000 },
  { type: '金玉兰M2', threshold: 2000000 },
  { type: '金玉兰M3', threshold: 5000000 },
  { type: '至臻明珠M1', threshold: 10000000 },
  { type: '至臻明珠M2', threshold: 50000000 },
  { type: '至臻明珠M3', threshold: 100000000 },
];

function getCardType(amount) {
  let card = CARD_LEVELS[0].type;
  for (const level of CARD_LEVELS) {
    if (amount >= level.threshold) card = level.type;
    else break;
  }
  return card;
}

export default async function handler(req, res) {
  const apiUrl = process.env.KV_REST_API_URL;
  const apiToken = process.env.KV_REST_API_TOKEN;
  if (!apiUrl || !apiToken) {
    res.status(500).json({ error: 'KV_REST_API_URL or KV_REST_API_TOKEN not set' });
    return;
  }
  const { user } = req.method === 'GET' ? req.query : req.body;
  if (!user) {
    res.status(400).json({ error: 'Missing user' });
    return;
  }
  const key = BALANCE_KEY_PREFIX + user;
  if (req.method === 'GET') {
    try {
      const kvRes = await fetch(`${apiUrl}/get/${key}`, {
        headers: { Authorization: `Bearer ${apiToken}` }
      });
      const { result } = await kvRes.json();
      let data;
      if (result == null) {
        // 余额不存在，自动新建
        data = { amount: 0, cardType: getCardType(0) };
        await fetch(`${apiUrl}/set/${key}` , {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ value: data })
        });
      } else {
        data = result?.value || result;
        if (typeof data === 'string') {
          try { data = JSON.parse(data); } catch (e) {}
        }
        while (data && data.value) data = data.value;
        if (!data || typeof data !== 'object') {
          data = { amount: 0, cardType: getCardType(0) };
        }
        // 自动修正卡种
        const correctType = getCardType(Number(data.amount) || 0);
        if (data.cardType !== correctType) {
          data.cardType = correctType;
          // 同步修正到Upstash
          await fetch(`${apiUrl}/set/${key}` , {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ value: data })
          });
        }
      }
      res.status(200).json(data);
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
      if (!body || typeof body.data !== 'object') {
        res.status(400).json({ error: 'Invalid data' });
        return;
      }
      let { amount = 0 } = body.data;
      amount = Number(amount) || 0;
      const cardType = getCardType(amount);
      const data = { ...body.data, amount, cardType };
      const kvRes = await fetch(`${apiUrl}/set/${key}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ value: data })
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