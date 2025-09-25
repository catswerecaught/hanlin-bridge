// 会员管理 API - 存储和管理用户会员数据
const MEMBERSHIP_KEY_PREFIX = 'membership-';

export default async function handler(req, res) {
  // 设置 CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
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
    if (req.method === 'GET') {
      // 获取用户会员信息
      const { username } = req.query;
      
      if (!username) {
        // 获取所有用户的会员信息
        const scanResponse = await fetch(`${apiUrl}/scan`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            prefix: MEMBERSHIP_KEY_PREFIX,
            limit: 1000
          })
        });

        if (!scanResponse.ok) {
          return res.status(200).json({ memberships: {} });
        }

        const scanData = await scanResponse.json();
        const memberships = {};

        // 解析所有会员数据
        if (scanData.result && Array.isArray(scanData.result)) {
          for (const item of scanData.result) {
            if (item.key && item.value) {
              const username = item.key.replace(MEMBERSHIP_KEY_PREFIX, '');
              let data = item.value;
              
              // 解析嵌套的 JSON
              if (typeof data === 'string') {
                try { data = JSON.parse(data); } catch {}
              }
              if (data && typeof data === 'object' && 'value' in data) {
                data = data.value;
              }
              if (typeof data === 'string') {
                try { data = JSON.parse(data); } catch {}
              }
              
              memberships[username] = data;
            }
          }
        }

        return res.status(200).json({ memberships });
      }

      // 获取单个用户会员信息
      const key = `${MEMBERSHIP_KEY_PREFIX}${username}`;
      const getResponse = await fetch(`${apiUrl}/get/${key}`, {
        headers: { 'Authorization': `Bearer ${apiToken}` }
      });

      if (!getResponse.ok) {
        return res.status(200).json({ membership: null });
      }

      const data = await getResponse.json();
      if (!data.result) {
        return res.status(200).json({ membership: null });
      }

      // 解包数据
      let membership = data.result;
      if (typeof membership === 'string') {
        try { membership = JSON.parse(membership); } catch {}
      }
      if (membership && typeof membership === 'object' && 'value' in membership) {
        membership = membership.value;
      }
      if (typeof membership === 'string') {
        try { membership = JSON.parse(membership); } catch {}
      }

      return res.status(200).json({ membership });

    } else if (req.method === 'POST' || req.method === 'PUT') {
      // 更新会员信息
      const { username, vip, expire, supreme } = req.body;
      
      if (!username) {
        return res.status(400).json({ error: '缺少用户名' });
      }

      const key = `${MEMBERSHIP_KEY_PREFIX}${username}`;
      const membershipData = {
        vip: vip || '普通会员',
        expire: expire || '2025-12-31',
        supreme: supreme || false,
        updatedAt: new Date().toISOString()
      };

      // 保存到 Upstash
      const setResponse = await fetch(`${apiUrl}/set/${key}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ value: membershipData })
      });

      if (!setResponse.ok) {
        throw new Error('Failed to update membership');
      }

      return res.status(200).json({ 
        success: true,
        membership: membershipData
      });

    } else if (req.method === 'DELETE') {
      // 删除会员信息
      const { username } = req.query;
      
      if (!username) {
        return res.status(400).json({ error: '缺少用户名' });
      }

      const key = `${MEMBERSHIP_KEY_PREFIX}${username}`;
      
      const deleteResponse = await fetch(`${apiUrl}/set/${key}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(null)
      });

      if (!deleteResponse.ok) {
        throw new Error('Failed to delete membership');
      }

      return res.status(200).json({ 
        success: true,
        message: '会员信息已删除'
      });

    } else {
      res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
      return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

  } catch (error) {
    console.error('Membership API error:', error);
    return res.status(500).json({ error: '服务器内部错误' });
  }
}
