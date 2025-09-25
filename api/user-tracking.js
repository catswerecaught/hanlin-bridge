// 用户访问追踪 API - 记录和查询用户登录历史
const TRACKING_KEY_PREFIX = 'user-tracking-';

// IP 地址转地区（使用免费 API）
async function getLocationFromIP(ip) {
  try {
    // 使用 ip-api.com 免费服务（无需密钥）
    const response = await fetch(`http://ip-api.com/json/${ip}?lang=zh-CN`);
    if (response.ok) {
      const data = await response.json();
      if (data.status === 'success') {
        return {
          country: data.country || '未知',
          region: data.regionName || '',
          city: data.city || '',
          isp: data.isp || '',
          formatted: `${data.country || ''}${data.regionName ? ' · ' + data.regionName : ''}${data.city ? ' · ' + data.city : ''}`
        };
      }
    }
  } catch (error) {
    console.error('IP geolocation failed:', error);
  }
  return {
    country: '未知',
    region: '',
    city: '',
    isp: '',
    formatted: '位置未知'
  };
}

// 获取客户端 IP
function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
         req.headers['x-real-ip'] || 
         req.connection?.remoteAddress || 
         req.socket?.remoteAddress ||
         '127.0.0.1';
}

export default async function handler(req, res) {
  // 设置 CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const apiUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const apiToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  
  if (!apiUrl || !apiToken) {
    return res.status(500).json({ error: 'Upstash configuration missing' });
  }

  try {
    if (req.method === 'POST') {
      // 记录用户访问
      const { username, page } = req.body;
      
      if (!username) {
        return res.status(400).json({ error: '缺少用户名' });
      }

      const clientIP = getClientIP(req);
      const location = await getLocationFromIP(clientIP);
      const timestamp = new Date().toISOString();
      
      const trackingEntry = {
        ip: clientIP,
        location: location.formatted,
        country: location.country,
        region: location.region,
        city: location.city,
        page: page || 'unknown',
        timestamp,
        userAgent: req.headers['user-agent'] || ''
      };

      // 获取现有记录
      const key = `${TRACKING_KEY_PREFIX}${username}`;
      const getResponse = await fetch(`${apiUrl}/get/${key}`, {
        headers: { 'Authorization': `Bearer ${apiToken}` }
      });

      let records = [];
      if (getResponse.ok) {
        const data = await getResponse.json();
        if (data.result) {
          // 解包 Upstash 的嵌套数据结构
          let parsed = data.result;
          if (typeof parsed === 'string') {
            try { parsed = JSON.parse(parsed); } catch {}
          }
          // 处理 {value: [...]} 结构
          if (parsed && typeof parsed === 'object' && 'value' in parsed) {
            parsed = parsed.value;
          }
          if (typeof parsed === 'string') {
            try { parsed = JSON.parse(parsed); } catch {}
          }
          records = Array.isArray(parsed) ? parsed : [];
        }
      }

      // 添加新记录（最多保留最近 100 条）
      records.unshift(trackingEntry);
      if (records.length > 100) {
        records = records.slice(0, 100);
      }

      // 保存更新后的记录
      const storeResponse = await fetch(`${apiUrl}/set/${key}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ value: records })
      });

      if (!storeResponse.ok) {
        throw new Error('Failed to store tracking data');
      }

      return res.status(200).json({ 
        success: true,
        location: location.formatted 
      });

    } else if (req.method === 'GET') {
      // 查询用户访问历史
      const { username, limit = 50 } = req.query;
      
      if (!username) {
        return res.status(400).json({ error: '缺少用户名' });
      }

      const key = `${TRACKING_KEY_PREFIX}${username}`;
      const getResponse = await fetch(`${apiUrl}/get/${key}`, {
        headers: { 'Authorization': `Bearer ${apiToken}` }
      });

      if (!getResponse.ok) {
        return res.status(200).json({ records: [] });
      }

      const data = await getResponse.json();
      if (!data.result) {
        return res.status(200).json({ records: [] });
      }

      // 解包 Upstash 的嵌套数据结构
      let parsed = data.result;
      if (typeof parsed === 'string') {
        try { parsed = JSON.parse(parsed); } catch {}
      }
      // 处理 {value: [...]} 结构
      if (parsed && typeof parsed === 'object' && 'value' in parsed) {
        parsed = parsed.value;
      }
      if (typeof parsed === 'string') {
        try { parsed = JSON.parse(parsed); } catch {}
      }
      
      const records = Array.isArray(parsed) ? parsed : [];
      
      // 限制返回数量
      const limitedRecords = records.slice(0, parseInt(limit));

      return res.status(200).json({ 
        records: limitedRecords,
        total: records.length
      });

    } else if (req.method === 'DELETE') {
      // 清除用户登录记录
      const { username } = req.query;
      
      if (!username) {
        return res.status(400).json({ error: '缺少用户名' });
      }

      const key = `${TRACKING_KEY_PREFIX}${username}`;
      
      // 删除记录（使用 POST 方法设置 null 值来删除）
      const deleteResponse = await fetch(`${apiUrl}/set/${key}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(null)
      });

      if (!deleteResponse.ok) {
        throw new Error('Failed to delete tracking data');
      }

      return res.status(200).json({ 
        success: true,
        message: '登录记录已清除'
      });

    } else {
      res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
      return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

  } catch (error) {
    console.error('User tracking API error:', error);
    return res.status(500).json({ error: '服务器内部错误' });
  }
}
