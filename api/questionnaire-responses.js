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
  let data = result;
  if (data && data.value) data = data.value;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch {}
  }
  while (data && data.value) data = data.value;
  return data;
}

export default async function handler(req, res) {
  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const apiUrl = process.env.KV_REST_API_URL;
  const apiToken = process.env.KV_REST_API_TOKEN;
  if (!apiUrl || !apiToken) {
    return res.status(500).json({ error: 'KV_REST_API_URL or KV_REST_API_TOKEN not set' });
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
      // 使用scan替代keys获取答卷列表
      const listResponse = await fetch(`${apiUrl}/scan`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prefix: `${RESPONSES_KEY_PREFIX}${questionnaireId}-`,
          limit: 100
        })
      });

      if (!listResponse.ok) {
        return res.status(200).json({ responses: [] });
      }

      const listData = await listResponse.json();
      console.log(`[获取答卷列表] 返回结果:`, JSON.stringify(listData));
      const keys = Array.isArray(listData.keys) ? listData.keys : (Array.isArray(listData.result) ? listData.result : []);
      const responses = [];

      for (const key of keys) {
        try {
          const respResponse = await fetch(`${apiUrl}/get/${key}`, {
            headers: { 'Authorization': `Bearer ${apiToken}` }
          });
          
          if (respResponse.ok) {
            const respData = await respResponse.json();
            const response = unwrapKV(respData.result);
            if (response) {
              responses.push({
                id: key.split('-').pop(),
                ...response
              });
            }
          }
        } catch (error) {
          console.error(`Error loading response ${key}:`, error);
        }
      }

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

      // 读取校验码映射
      const codeRes = await fetch(`${apiUrl}/get/${CODES_KEY_PREFIX}${code}`, {
        headers: { Authorization: `Bearer ${apiToken}` }
      });
      if (!codeRes.ok) return res.status(404).json({ error: '校验码无效或不存在' });
      const codeJson = await codeRes.json();
      if (!codeJson || codeJson.result == null) {
        return res.status(404).json({ error: '校验码无效或不存在' });
      }
      const codeObj = unwrapKV(codeJson.result);
      const qnId = codeObj?.questionnaireId;
      const enabled = codeObj?.enabled !== false;
      if (!qnId || !enabled) {
        return res.status(404).json({ error: '校验码未启用或未绑定问卷' });
      }

      // 读取问卷，确认已发布
      const qnRes = await fetch(`${apiUrl}/get/${QUESTIONNAIRES_KEY_PREFIX}${qnId}`, {
        headers: { Authorization: `Bearer ${apiToken}` }
      });
      if (!qnRes.ok) return res.status(404).json({ error: '问卷不存在' });
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
