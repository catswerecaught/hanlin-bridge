// Removed verbose env logging to avoid leaking secrets in logs

const TREND_KEY = 'trend-doc-data';
const CHARITY_KEY_PREFIX = 'charity-';
const USER_POINTS_KEY_PREFIX = 'user-points-';

// 卡种等级与门槛（与health.js保持一致）
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
    if (amount >= level.threshold) card = level.type; else break;
  }
  return card;
}

export default async function handler(req, res) {
  const apiUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const apiToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!apiUrl || !apiToken) {
    console.error('KV_REST_API_URL/KV_REST_API_TOKEN or UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN not set');
    res.status(500).json({ error: 'KV_REST_API_URL/KV_REST_API_TOKEN or UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN not set' });
    return;
  }

  // 处理公益相关请求
  const queryType = req.query.type;
  const bodyType = req.body ? req.body.type : null;
  const type = queryType || bodyType;
  const username = req.query.username;
  
  console.log('API请求调试:', { method: req.method, queryType, bodyType, type, body: req.body });
  
  if (type === 'charity') {
    console.log('处理公益请求');
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
  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  console.log('handleCharityRequest调用:', { method: req.method, body: req.body });
  
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
        console.log('读取月度数据原始结果:', { monthKey, result });
        if (result) {
          // Upstash数据可能需要多层解析
          let data = result;
          try {
            // 第一层解析
            if (typeof data === 'string') {
              data = JSON.parse(data);
            }
            // 检查是否有value字段（Upstash包装）
            if (data && typeof data === 'object' && 'value' in data) {
              data = data.value;
              if (typeof data === 'string') {
                data = JSON.parse(data);
              }
            }
            console.log('解析后的月度数据:', data);
            monthlyTotal = data.total || 0;
          } catch (e) {
            console.error('解析月度数据失败:', e, result);
          }
        }
      }
      console.log('最终月度总额:', monthlyTotal);
      
      const donorsKey = `${CHARITY_KEY_PREFIX}donors`;
      const donorsRes = await fetch(`${apiUrl}/get/${donorsKey}`, {
        headers: { Authorization: `Bearer ${apiToken}` }
      });
      
      let recentDonors = [];
      if (donorsRes.ok) {
        const { result } = await donorsRes.json();
        console.log('读取捐助者数据原始结果:', { donorsKey, result });
        if (result) {
          let data = result;
          try {
            // 第一层解析
            if (typeof data === 'string') {
              data = JSON.parse(data);
            }
            // 检查是否有value字段（Upstash包装）
            if (data && typeof data === 'object' && 'value' in data) {
              data = data.value;
              if (typeof data === 'string') {
                data = JSON.parse(data);
              }
            }
            console.log('解析后的捐助者数据:', data);
            recentDonors = data.donors || [];
          } catch (e) {
            console.error('解析捐助者数据失败:', e, result);
          }
        }
      }
      
      res.status(200).json({ monthlyTotal, recentDonors });
      
    } catch (error) {
      console.error('获取公益数据失败:', error);
      res.status(500).json({ error: '获取数据失败' });
    }
  } else if (req.method === 'POST') {
    const { action, username, amount, anonymous } = req.body;
    
    console.log('POST请求数据:', { action, username, amount, anonymous });
    
    if (action !== 'donate') {
      console.log('无效的action:', action);
      return res.status(400).json({ error: '无效的操作类型' });
    }
    
    if (!username || !amount) {
      console.log('缺少必要参数:', { username, amount });
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    if (action === 'donate') {
      try {
        // 使用与health.js相同的balance系统
        const balanceKey = `balance-${username}`;
        const balanceRes = await fetch(`${apiUrl}/get/${balanceKey}`, {
          headers: { Authorization: `Bearer ${apiToken}` }
        });
        
        let userPoints = 0;
        if (balanceRes.ok) {
          const { result } = await balanceRes.json();
          console.log('用户积分原始数据:', { balanceKey, result });
          if (result) {
            let data = result;
            try {
              // 解析Upstash数据结构
              if (data && typeof data === 'object' && 'value' in data) {
                data = data.value;
              }
              if (typeof data === 'string') {
                data = JSON.parse(data);
              }
              // 检查嵌套的value结构
              while (data && data.value) {
                data = data.value;
              }
              console.log('解析后的用户积分数据:', data);
              userPoints = Number(data?.amount ?? 0);
            } catch (e) {
              console.error('解析用户积分失败:', e);
              userPoints = 0;
            }
          }
        }
        
        console.log('当前用户积分:', userPoints, '捐助金额:', amount);
        
        if (userPoints < amount) {
          return res.status(400).json({ message: '积分不足' });
        }
        
        userPoints -= amount;
        console.log('扣除后用户积分:', userPoints);
        
        // 保存到balance系统，与health.js保持一致
        const saveBalanceRes = await fetch(`${apiUrl}/set/${balanceKey}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            value: { 
              amount: userPoints, 
              cardType: getCardType(userPoints) 
            } 
          })
        });
        
        if (!saveBalanceRes.ok) {
          console.error('保存用户积分失败:', await saveBalanceRes.text());
          throw new Error('保存用户积分失败');
        }
        console.log('用户积分保存成功');
        
        const now = new Date();
        const monthKey = `${CHARITY_KEY_PREFIX}${now.getFullYear()}-${now.getMonth() + 1}`;
        
        const monthRes = await fetch(`${apiUrl}/get/${monthKey}`, {
          headers: { Authorization: `Bearer ${apiToken}` }
        });
        
        let monthlyTotal = 0;
        if (monthRes.ok) {
          const { result } = await monthRes.json();
          console.log('POST-读取现有月度数据:', result);
          if (result) {
            let data = result;
            try {
              if (typeof data === 'string') {
                data = JSON.parse(data);
              }
              if (data && typeof data === 'object' && 'value' in data) {
                data = data.value;
                if (typeof data === 'string') {
                  data = JSON.parse(data);
                }
              }
              monthlyTotal = data.total || 0;
            } catch (e) {
              console.error('POST-解析现有月度数据失败:', e);
            }
          }
        }
        
        monthlyTotal += amount;
        console.log('保存月度总额:', { monthKey, monthlyTotal });
        
        const saveMonthRes = await fetch(`${apiUrl}/set/${monthKey}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ value: JSON.stringify({ total: monthlyTotal }) })
        });
        
        if (!saveMonthRes.ok) {
          console.error('保存月度总额失败:', await saveMonthRes.text());
          throw new Error('保存月度总额失败');
        }
        
        const donorsKey = `${CHARITY_KEY_PREFIX}donors`;
        const donorsRes = await fetch(`${apiUrl}/get/${donorsKey}`, {
          headers: { Authorization: `Bearer ${apiToken}` }
        });
        
        let donors = [];
        if (donorsRes.ok) {
          const { result } = await donorsRes.json();
          console.log('POST-读取现有捐助者数据:', result);
          if (result) {
            let data = result;
            try {
              if (typeof data === 'string') {
                data = JSON.parse(data);
              }
              if (data && typeof data === 'object' && 'value' in data) {
                data = data.value;
                if (typeof data === 'string') {
                  data = JSON.parse(data);
                }
              }
              donors = data.donors || [];
            } catch (e) {
              console.error('POST-解析现有捐助者数据失败:', e);
            }
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
        // 只保留最近3条记录
        donors = donors.slice(0, 3);
        
        console.log('保存捐助者列表:', { donorsKey, donors });
        
        const saveDonorsRes = await fetch(`${apiUrl}/set/${donorsKey}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ value: JSON.stringify({ donors }) })
        });
        
        if (!saveDonorsRes.ok) {
          console.error('保存捐助者列表失败:', await saveDonorsRes.text());
          throw new Error('保存捐助者列表失败');
        }
        
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
      console.log('用户积分查询原始数据:', { userPointsKey, result });
      if (result) {
        let data = result;
        try {
          // 第一层解析
          if (typeof data === 'string') {
            data = JSON.parse(data);
          }
          // 检查是否有value字段（Upstash包装）
          if (data && typeof data === 'object' && 'value' in data) {
            data = data.value;
            if (typeof data === 'string') {
              data = JSON.parse(data);
            }
          }
          console.log('解析后的用户积分查询数据:', data);
          points = data.points || 1000;
        } catch (e) {
          console.error('解析用户积分查询失败:', e);
          points = 1000;
        }
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