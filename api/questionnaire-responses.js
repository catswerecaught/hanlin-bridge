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
    return res.status(500).json({ error: 'Upstash env not set: please set KV_REST_API_URL/KV_REST_API_TOKEN or UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN' });
  }

  const { method, query } = req;

  try {
    if (method === 'GET') {
      // 获取问卷的答卷列表（管理员）
      const { questionnaireId } = query;
      if (!questionnaireId) {
        return res.status(400).json({ error: '缺少问卷ID' });
      }

      console.log(`[获取答卷列表] 尝试获取问卷ID=${questionnaireId}的答卷`);
      // 扫描所有可能的键格式
      console.log('开始扫描问卷响应，问卷ID:', questionnaireId);
      const keyPatterns = [
        `qn-response-qn-${questionnaireId}-*`,
        `qn:resp:${questionnaireId.replace('qn-','')}:*`
      ];
      console.log('使用的键模式:', keyPatterns);
      
      const responses = [];
      
      for (const pattern of keyPatterns) {
        try {
          console.log('正在扫描模式:', pattern);
          const res = await fetch(`${apiUrl}/keys/${pattern}`, {
            headers: { 'Authorization': `Bearer ${apiToken}` }
          });
          
          console.log('扫描结果状态:', res.status);
          if (res.ok) {
            const data = await res.json();
            console.log('扫描到的键:', data.result);
            const keys = Array.isArray(data.result) ? data.result : [];
            
            for (const key of keys) {
              console.log('正在获取键:', key);
              const resp = await handleUpstashResponse(key);
              if (resp) {
                responses.push({
                  id: key.split(/[-:]/).pop(),
                  ...resp
                });
              }
            }
          }
        } catch (error) {
          console.error(`Error scanning pattern ${pattern}:`, error);
        }
      }
      
      console.log('最终响应数据:', responses);

      return res.status(200).json({ responses });

    } else if (method === 'POST') {
      // 提交答卷
      const { code, answers } = req.body;
      if (!code || !isValidCode(code)) {
        return res.status(400).json({ error: '校验码格式无效' });
      }
      if (!answers || typeof answers !== 'object') {
        return res.status(400).json({ error: '答案数据无效' });
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
      if (!codeRes.ok) return res.status(404).json({ error: '校验码无效或不存在' });
      const codeJson = await codeRes.json();
      if (!codeJson || codeJson.result == null) {
        // 再次尝试旧前缀
        const codeRes2 = await fetch(`${apiUrl}/get/qn:code:${code}`, {
          headers: { Authorization: `Bearer ${apiToken}` }
        }).catch(() => null);
        if (!codeRes2 || !codeRes2.ok) {
          return res.status(404).json({ error: '校验码无效或不存在' });
        }
        const cj2 = await codeRes2.json();
        codeJson.result = cj2.result;
      }
      const codeObj = unwrapKV(codeJson.result);
      const qnId = codeObj?.questionnaireId;
      const enabled = codeObj?.enabled !== false;
      if (!qnId || !enabled) {
        return res.status(404).json({ error: '校验码未启用或未绑定问卷' });
      }

      // 读取问卷，确认已发布（新前缀，失败则用旧前缀 qn:）
      let qnRes = await fetch(`${apiUrl}/get/${QUESTIONNAIRES_KEY_PREFIX}${qnId}`, {
        headers: { Authorization: `Bearer ${apiToken}` }
      });
      if (!qnRes.ok) {
        qnRes = await fetch(`${apiUrl}/get/qn:${qnId}`, {
          headers: { Authorization: `Bearer ${apiToken}` }
        });
        if (!qnRes.ok) return res.status(404).json({ error: '问卷不存在' });
      }
      const qnJson = await qnRes.json();
      if (!qnJson || qnJson.result == null) return res.status(404).json({ error: '问卷不存在' });
      const qn = unwrapKV(qnJson.result) || {};
      if (qn.published !== true) return res.status(403).json({ error: '问卷未发布' });

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
        responseId: respId,
        message: '答卷提交成功'
      });

    } else {
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).json({ error: `Method ${method} Not Allowed` });
    }
  } catch (err) {
    console.error('Questionnaire Responses API Error:', err);
    return res.status(500).json({ error: '服务器内部错误' });
  }
}
