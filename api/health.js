export default async function handler(req, res) {
  // Handle multiple services based on query parameters
  const { service } = req.query;
  
  if (service === 'teaching-progress') {
    return handleTeachingProgress(req, res);
  }
  if (service === 'teaching-class') {
    return handleTeachingClass(req, res);  
  }
  if (service === 'balance') {
    return handleBalance(req, res);
  }
  
  // Default health check
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(200).json({ status: 'ok', time: new Date().toISOString() });
}

// Teaching Progress Handler
async function handleTeachingProgress(req, res) {
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
  const key = 'teaching-progress-' + user;
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

// Teaching Class Handler
async function handleTeachingClass(req, res) {
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
  const key = 'teaching-class-' + user;
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

// Balance Handler  
async function handleBalance(req, res) {
  const apiUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const apiToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!apiUrl || !apiToken) {
    return res.status(500).json({ error: 'KV_REST_API_URL/KV_REST_API_TOKEN or UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN not set' });
  }
  const { user } = req.method === 'GET' ? req.query : req.body;
  if (!user) {
    return res.status(400).json({ error: 'Missing user parameter' });
  }
  const key = `balance-${user}`;
  if (req.method === 'GET') {
    try {
      const response = await fetch(`${apiUrl}/get/${key}`, {
        headers: { 'Authorization': `Bearer ${apiToken}` }
      });
      if (!response.ok) {
        return res.status(200).json({ amount: 0, cardType: 'M1' });
      }
      const data = await response.json();
      let result = data.result?.value || data.result;
      if (typeof result === 'string') {
        try { result = JSON.parse(result); } catch {}
      }
      while (result && result.value) result = result.value;
      res.status(200).json(result || { amount: 0, cardType: 'M1' });
    } catch (error) {
      console.error('Balance fetch error:', error);
      res.status(200).json({ amount: 0, cardType: 'M1' });
    }
  } else if (req.method === 'POST') {
    try {
      let body = req.body;
      if (!body) {
        let rawBody = '';
        await new Promise((resolve) => {
          req.on('data', (chunk) => { rawBody += chunk; });
          req.on('end', resolve);
        });
        body = JSON.parse(rawBody);
      }
      const { data: balanceData } = body;
      const response = await fetch(`${apiUrl}/set/${key}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: balanceData })
      });
      if (!response.ok) {
        return res.status(500).json({ error: 'Failed to update balance' });
      }
      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Balance update error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
