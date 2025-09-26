// Removed verbose env logging to avoid leaking secrets in logs

const TREND_KEY = 'trend-doc-data';
const CHARITY_KEY_PREFIX = 'charity-';
const USER_POINTS_KEY_PREFIX = 'user-points-';

export default async function handler(req, res) {
  const apiUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const apiToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!apiUrl || !apiToken) {
    console.error('KV_REST_API_URL/KV_REST_API_TOKEN or UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN not set');
    res.status(500).json({ error: 'KV_REST_API_URL/KV_REST_API_TOKEN or UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN not set' });
    return;
  }

  // 处理公益相关请求
  const { type, username } = req.query;
  
  if (type === 'charity') {
    return handleCharityRequest(req, res, apiUrl, apiToken);
  }
  
  if (type === 'userPoints' && username) {
    return handleUserPointsRequest(req, res, apiUrl, apiToken, username);
  }

  if (req.method === 'GET') {
    try {
      const kvRes = await fetch(`${apiUrl}/get/${TREND_KEY}`, {
        headers: { Authorization: `Bearer ${apiToken}` }
      });
      if (!kvRes.ok) {
        const text = await kvRes.text();
        console.error('Failed to fetch from KV:', text);
        res.status(500).json({ error: 'Failed to fetch from KV', detail: text });
        return;
      }
      const { result } = await kvRes.json();
      if (!result) {
        // 默认内容
        res.status(200).json({
          catalog: [
            '智能教学简介',
            '核心功能',
            '应用场景',
            '未来趋势'
          ],
          contents: [
            '<h2>智能教学简介</h2><p>智能教学结合AI与大数据，为师生提供个性化、数据驱动的学习体验。</p>',
            '<h2>核心功能</h2><ul><li>智能作业批改</li><li>学习路径推荐</li><li>实时学习分析</li></ul>',
            '<h2>应用场景</h2><p>适用于K12、高校、职业培训等多种教育场景。</p>',
            '<h2>未来趋势</h2><p>AI驱动的教育将持续进化，助力每一位学习者成长。</p>'
          ]
        });
        return;
      }
      let data = result.value || result;
      if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch (e) {}
      }
      // 防止多层嵌套 value
      while (data && data.value) data = data.value;
      res.status(200).json(data);
    } catch (err) {
      console.error('GET /api/trend error:', err);
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
      if (!body || !Array.isArray(body.catalog) || !Array.isArray(body.contents)) {
        console.error('Invalid data:', body);
        res.status(400).json({ error: 'Invalid data' });
        return;
      }
      const kvRes = await fetch(`${apiUrl}/set/${TREND_KEY}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ value: body })
      });
      if (!kvRes.ok) {
        const text = await kvRes.text();
        console.error('Failed to write to KV:', text);
        res.status(500).json({ error: 'Failed to write to KV', detail: text });
        return;
      }
      console.log('保存时的docData:', JSON.stringify(body, null, 2));
      res.status(200).json({ success: true });
    } catch (err) {
      console.error('POST /api/trend error:', err);
      res.status(500).json({ error: 'Internal Server Error', detail: String(err) });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}

// 处理公益请求
async function handleCharityRequest(req, res, apiUrl, apiToken) {
  if (req.method === 'GET') {
    const now = new Date();
    const monthKey = `${CHARITY_KEY_PREFIX}${now.getFullYear()}-${now.getMonth() + 1}`;
    
    try {
      const monthRes = await fetch(`${apiUrl}/get/${monthKey}`, {
        headers: { Authorization: `Bearer ${apiToken}` }
      });
      
      let monthlyTotal = 0;
      if (monthRes.ok) {
        const { result } = await monthRes.json();
        if (result) {
          const data = typeof result === 'string' ? JSON.parse(result) : result;
          monthlyTotal = data.total || 0;
        }
      }
      
      const donorsKey = `${CHARITY_KEY_PREFIX}donors`;
      const donorsRes = await fetch(`${apiUrl}/get/${donorsKey}`, {
        headers: { Authorization: `Bearer ${apiToken}` }
      });
      
      let recentDonors = [];
      if (donorsRes.ok) {
        const { result } = await donorsRes.json();
        if (result) {
          const data = typeof result === 'string' ? JSON.parse(result) : result;
          recentDonors = data.donors || [];
        }
      }
      
      res.status(200).json({ monthlyTotal, recentDonors });
      
    } catch (error) {
      console.error('获取公益数据失败:', error);
      res.status(500).json({ error: '获取数据失败' });
    }
  } else if (req.method === 'POST') {
    const { action, username, amount, anonymous } = req.body;
    
    if (action === 'donate') {
      try {
        const userPointsKey = `${USER_POINTS_KEY_PREFIX}${username}`;
        const pointsRes = await fetch(`${apiUrl}/get/${userPointsKey}`, {
          headers: { Authorization: `Bearer ${apiToken}` }
        });
        
        let userPoints = 1000;
        if (pointsRes.ok) {
          const { result } = await pointsRes.json();
          if (result) {
            const data = typeof result === 'string' ? JSON.parse(result) : result;
            userPoints = data.points || 1000;
          }
        }
        
        if (userPoints < amount) {
          return res.status(400).json({ message: '积分不足' });
        }
        
        userPoints -= amount;
        await fetch(`${apiUrl}/set/${userPointsKey}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ value: JSON.stringify({ points: userPoints }) })
        });
        
        const now = new Date();
        const monthKey = `${CHARITY_KEY_PREFIX}${now.getFullYear()}-${now.getMonth() + 1}`;
        
        const monthRes = await fetch(`${apiUrl}/get/${monthKey}`, {
          headers: { Authorization: `Bearer ${apiToken}` }
        });
        
        let monthlyTotal = 0;
        if (monthRes.ok) {
          const { result } = await monthRes.json();
          if (result) {
            const data = typeof result === 'string' ? JSON.parse(result) : result;
            monthlyTotal = data.total || 0;
          }
        }
        
        monthlyTotal += amount;
        await fetch(`${apiUrl}/set/${monthKey}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ value: JSON.stringify({ total: monthlyTotal }) })
        });
        
        const donorsKey = `${CHARITY_KEY_PREFIX}donors`;
        const donorsRes = await fetch(`${apiUrl}/get/${donorsKey}`, {
          headers: { Authorization: `Bearer ${apiToken}` }
        });
        
        let donors = [];
        if (donorsRes.ok) {
          const { result } = await donorsRes.json();
          if (result) {
            const data = typeof result === 'string' ? JSON.parse(result) : result;
            donors = data.donors || [];
          }
        }
        
        const users = [
          { username: 'taosir', name: 'Oliver Tao', avatar: 'images/user00001.jpg' },
          { username: 'user00002', name: '生物杨老师', avatar: 'images/user00002.jpg' },
          { username: 'user00003', name: '化学孙老师', avatar: 'images/user00003.jpg' }
        ];
        
        const user = users.find(u => u.username === username) || { username, name: username, avatar: 'images/login-default.png' };
        
        donors.unshift({
          name: user.name,
          avatar: user.avatar,
          amount,
          anonymous,
          timestamp: Date.now()
        });
        
        donors = donors.slice(0, 10);
        
        await fetch(`${apiUrl}/set/${donorsKey}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ value: JSON.stringify({ donors }) })
        });
        
        res.status(200).json({ success: true });
        
      } catch (error) {
        console.error('提交捐助失败:', error);
        res.status(500).json({ message: '捐助失败' });
      }
    } else {
      res.status(400).json({ error: '无效的操作' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}

// 处理用户积分请求
async function handleUserPointsRequest(req, res, apiUrl, apiToken, username) {
  const userPointsKey = `${USER_POINTS_KEY_PREFIX}${username}`;
  
  try {
    const pointsRes = await fetch(`${apiUrl}/get/${userPointsKey}`, {
      headers: { Authorization: `Bearer ${apiToken}` }
    });
    
    let points = 1000;
    if (pointsRes.ok) {
      const { result } = await pointsRes.json();
      if (result) {
        const data = typeof result === 'string' ? JSON.parse(result) : result;
        points = data.points || 1000;
      }
    } else {
      await fetch(`${apiUrl}/set/${userPointsKey}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ value: JSON.stringify({ points: 1000 }) })
      });
      points = 1000;
    }
    
    res.status(200).json({ points });
    
  } catch (error) {
    console.error('获取用户积分失败:', error);
    res.status(500).json({ error: '获取积分失败' });
  }
} 