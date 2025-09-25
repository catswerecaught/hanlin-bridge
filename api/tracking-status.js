// 批量检查用户追踪状态 API - 用于显示红点提示
const TRACKING_KEY_PREFIX = 'user-tracking-';
const READ_KEY_PREFIX = 'user-tracking-read-';

// 解包 Upstash 数据
function unwrapKV(result) {
  try {
    let data = result;
    for (let i = 0; i < 3 && typeof data === 'string'; i++) {
      try { data = JSON.parse(data); } catch { break; }
    }
    let guard = 0;
    while (data && typeof data === 'object' && 'value' in data && guard++ < 3) {
      data = data.value;
      for (let i = 0; i < 2 && typeof data === 'string'; i++) {
        try { data = JSON.parse(data); } catch { break; }
      }
    }
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch {}
    }
    return data;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  // 设置 CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const apiUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const apiToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  
  if (!apiUrl || !apiToken) {
    return res.status(500).json({ error: 'Upstash configuration missing' });
  }

  try {
    const { usernames } = req.query;
    
    if (!usernames) {
      return res.status(400).json({ error: '缺少用户名列表' });
    }

    const usernameList = usernames.split(',').filter(u => u.trim());
    const statusMap = {};

    // 并行检查所有用户状态
    await Promise.all(usernameList.map(async (username) => {
      try {
        const trackingKey = `${TRACKING_KEY_PREFIX}${username}`;
        const readKey = `${READ_KEY_PREFIX}${username}`;

        // 获取用户追踪记录
        const [trackingResponse, readResponse] = await Promise.all([
          fetch(`${apiUrl}/get/${trackingKey}`, {
            headers: { 'Authorization': `Bearer ${apiToken}` }
          }),
          fetch(`${apiUrl}/get/${readKey}`, {
            headers: { 'Authorization': `Bearer ${apiToken}` }
          })
        ]);

        let hasNewRecords = false;
        let recordCount = 0;

        // 解析追踪记录
        if (trackingResponse.ok) {
          const trackingData = await trackingResponse.json();
          if (trackingData.result) {
            const records = unwrapKV(trackingData.result);
            if (Array.isArray(records)) {
              recordCount = records.length;
              
              // 检查已读状态
              if (readResponse.ok) {
                const readData = await readResponse.json();
                if (readData.result) {
                  const readInfo = unwrapKV(readData.result);
                  if (readInfo && readInfo.lastReadAt) {
                    const lastReadTime = new Date(readInfo.lastReadAt);
                    hasNewRecords = records.some(record => 
                      record.timestamp && new Date(record.timestamp) > lastReadTime
                    );
                  } else {
                    hasNewRecords = recordCount > 0;
                  }
                } else {
                  hasNewRecords = recordCount > 0;
                }
              } else {
                hasNewRecords = recordCount > 0;
              }
            }
          }
        }

        statusMap[username] = {
          hasNewRecords,
          recordCount
        };
      } catch (error) {
        console.error(`Error checking status for ${username}:`, error);
        statusMap[username] = {
          hasNewRecords: false,
          recordCount: 0
        };
      }
    }));

    return res.status(200).json({ 
      status: statusMap,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Tracking status API error:', error);
    return res.status(500).json({ error: '服务器内部错误' });
  }
}
