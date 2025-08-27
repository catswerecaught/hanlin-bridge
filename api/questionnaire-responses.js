// 悠然问卷答卷提交 API
const QUESTIONNAIRES_KEY_PREFIX = 'questionnaire-';
const CODES_KEY_PREFIX = 'qn-code-';
const RESPONSES_KEY_PREFIX = 'qn-response-';

function isValidCode(code) {
  return /^[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/i.test(code);
}

function genId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const seg = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${seg()}-${seg()}-${seg()}`;
}

function unwrapKV(result) {
  try {
    console.log('原始数据:', typeof result === 'string' ? result : JSON.stringify(result));
    
    // 首次解析（处理字符串或对象）
    let data = typeof result === 'string' ? 
      JSON.parse(result.replace(/\\"/g, '"')) : 
      result;
    
    // 解包嵌套的value结构
    while (data && typeof data === 'object' && data.value) {
      data = data.value;
    }
    
    // 处理可能存在的二次字符串化情况
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch (e) {
        console.error('二级JSON解析失败:', e);
      }
    }
    
    console.log('最终解包结果:', data);
    return data;
  } catch (e) {
    console.error('解包过程异常:', e);
    return null;
  }
}

// 处理Upstash响应数据
const handleUpstashResponse = async (key) => {
  const resp = await fetch(`${apiUrl}/get/${key}`, {
    headers: { 'Authorization': `Bearer ${apiToken}` }
  });
  
  if (!resp.ok) return null;
  
  const respData = await resp.json();
  console.log('Upstash原始响应:', respData);
  
  // Upstash直接返回格式处理
  if (respData.result && typeof respData.result === 'string') {
    try {
      return JSON.parse(respData.result);
    } catch (e) {
      console.error('解析响应数据失败:', e);
    }
  }
  return respData.result;
};

async function fetchResponses(apiUrl, apiToken, questionnaireId) {
  try {
    console.log(`[获取答卷列表] 尝试获取问卷ID=${questionnaireId}的答卷`);
    
    // 使用正确的键前缀和格式
    const keyPattern = `${RESPONSES_KEY_PREFIX}${questionnaireId}-*`;
    console.log('开始扫描问卷响应，问卷ID:', questionnaireId);
    console.log('使用的键模式:', [keyPattern]);
    
    // 获取所有匹配的键
    const scanRes = await fetch(`${apiUrl}/keys/${encodeURIComponent(keyPattern)}`, {
      headers: { 'Authorization': `Bearer ${apiToken}` }
    });
    
    if (!scanRes.ok) {
      console.log('扫描结果状态:', scanRes.status);
      return [];
    }
    
    const keysData = await scanRes.json();
    const keys = keysData.result || [];
    console.log('扫描到的键:', keys);
    
    // 批量获取所有响应数据
    const responses = await Promise.all(
      keys.map(async key => {
        const resp = await fetch(`${apiUrl}/get/${key}`, {
          headers: { 'Authorization': `Bearer ${apiToken}` }
        });
        
        if (resp.ok) {
          const data = await resp.json();
          return unwrapKV(data.result);
        }
        return null;
      })
    );
    
    // 过滤无效响应
    const validResponses = responses.filter(Boolean);
    console.log('最终响应数据:', validResponses);
    return validResponses;
  } catch (error) {
    console.error('获取答卷失败:', error);
    return [];
  }
}

export default async function handler(req, res) {
  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const apiUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const apiToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  console.log('Debug - Environment Variables:', { apiUrl, apiToken });
  if (!apiUrl || !apiToken) {
    return res.status(500).json({ 
      error: 'KV_REST_API_URL/KV_REST_API_TOKEN or UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN not set',
      timestamp: new Date().toISOString()
    });
  }

  try {
    if (req.method === 'GET') {
      const { questionnaireId } = req.query;
      
      if (!questionnaireId) {
        return res.status(400).json({ 
          error: 'Missing questionnaireId parameter',
          timestamp: new Date().toISOString()
        });
      }

      // 获取问卷响应数量
      const countRes = await fetch(`${apiUrl}/get/${QUESTIONNAIRES_KEY_PREFIX}${questionnaireId}`);
      let responseCount = 0;
      if (countRes.ok) {
        const qnData = await countRes.json();
        const questionnaire = unwrapKV(qnData.result);
        responseCount = questionnaire?.responseCount || 0;
      }

      // 获取问卷响应数据
      const responses = await fetchResponses(apiUrl, apiToken, questionnaireId);
      
      return res.status(200).json({
        success: true,
        count: responseCount,
        responses,
        timestamp: new Date().toISOString()
      });
    } else if (req.method === 'POST') {
      // 提交答卷
      const { code, answers } = req.body;
      if (!code || !isValidCode(code)) {
        return res.status(400).json({
          error: '校验码格式无效',
          detail: '请提供有效的校验码',
          timestamp: new Date().toISOString()
        });
      }
      if (!answers || typeof answers !== 'object') {
        return res.status(400).json({
          error: '答案数据无效',
          detail: '请提供有效的答案数据',
          timestamp: new Date().toISOString()
        });
      }

      // 读取校验码映射（新前缀，失败则用旧前缀 qn:code:）
      let codeRes = await fetch(`${apiUrl}/get/${CODES_KEY_PREFIX}${code}`, {
        headers: { Authorization: `Bearer ${apiToken}` }
      });
      if (!codeRes.ok) {
        codeRes = await fetch(`${apiUrl}/get/qn:code:${code}`, {
          headers: { Authorization: `Bearer ${apiToken}` }
        });
      }
      if (!codeRes.ok) return res.status(404).json({
        error: '校验码无效或不存在',
        detail: '请检查校验码是否正确',
        timestamp: new Date().toISOString()
      });
      const codeJson = await codeRes.json();
      if (!codeJson || codeJson.result == null) {
        // 再次尝试旧前缀
        const codeRes2 = await fetch(`${apiUrl}/get/qn:code:${code}`, {
          headers: { Authorization: `Bearer ${apiToken}` }
        }).catch(() => null);
        if (!codeRes2 || !codeRes2.ok) {
          return res.status(404).json({
            error: '校验码无效或不存在',
            detail: '请检查校验码是否正确',
            timestamp: new Date().toISOString()
          });
        }
        const cj2 = await codeRes2.json();
        codeJson.result = cj2.result;
      }
      const codeObj = unwrapKV(codeJson.result);
      const qnId = codeObj?.questionnaireId;
      const enabled = codeObj?.enabled !== false;
      if (!qnId || !enabled) {
        return res.status(404).json({
          error: '校验码未启用或未绑定问卷',
          detail: '请检查校验码是否正确',
          timestamp: new Date().toISOString()
        });
      }

      // 读取问卷，确认已发布（新前缀，失败则用旧前缀 qn:）
      let qnRes = await fetch(`${apiUrl}/get/${QUESTIONNAIRES_KEY_PREFIX}${qnId}`, {
        headers: { Authorization: `Bearer ${apiToken}` }
      });
      if (!qnRes.ok) {
        qnRes = await fetch(`${apiUrl}/get/qn:${qnId}`, {
          headers: { Authorization: `Bearer ${apiToken}` }
        });
        if (!qnRes.ok) return res.status(404).json({
          error: '问卷不存在',
          detail: '请检查问卷ID是否正确',
          timestamp: new Date().toISOString()
        });
      }
      const qnJson = await qnRes.json();
      if (!qnJson || qnJson.result == null) return res.status(404).json({
        error: '问卷不存在',
        detail: '请检查问卷ID是否正确',
        timestamp: new Date().toISOString()
      });
      const qn = unwrapKV(qnJson.result) || {};
      if (qn.published !== true) return res.status(403).json({
        error: '问卷未发布',
        detail: '请检查问卷是否已发布',
        timestamp: new Date().toISOString()
      });

      // 生成答卷ID并存储
      const respId = genId();
      const respData = {
        questionnaireId: qnId,
        code,
        answers,
        submittedAt: new Date().toISOString(),
        ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress || '127.0.0.1'
      };

      const storeRes = await fetch(`${apiUrl}/set/${RESPONSES_KEY_PREFIX}${qnId}-${respId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(respData)
      });

      if (!storeRes.ok) {
        throw new Error('Failed to store response');
      }

      return res.status(200).json({
        success: true,
        code: 200,
        message: '答卷提交成功',
        data: {
          responseId: respId
        },
        timestamp: new Date().toISOString()
      });

    } else {
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).json({
        error: `Method ${req.method} Not Allowed`,
        detail: '请使用正确的请求方法',
        timestamp: new Date().toISOString()
      });
    }
  } catch (err) {
    console.error('Questionnaire Responses API Error:', err);
    return res.status(500).json({
      error: '获取答卷失败',
      code: 500,
      message: '内部错误',
      detail: err.message || '未知错误',
      timestamp: new Date().toISOString()
    });
  }
}
