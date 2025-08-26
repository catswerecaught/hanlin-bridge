// 悠然问卷 API - 获取问卷（按校验码）/ 预留管理操作
const QN_KEY_PREFIX = 'qn:'; // qn:<id>
const QN_CODE_KEY_PREFIX = 'qn:code:'; // qn:code:<code> -> { questionnaireId, enabled }

function isValidCode(code) {
  return /^[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/i.test(code);
}

function unwrapKV(result) {
  // Unwrap Upstash result possibly nested or stringified
  let data = result;
  if (data && data.value) data = data.value;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch {}
  }
  while (data && data.value) data = data.value;
  return data;
}

export default async function handler(req, res) {
  const apiUrl = process.env.KV_REST_API_URL;
  const apiToken = process.env.KV_REST_API_TOKEN;
  if (!apiUrl || !apiToken) {
    return res.status(500).json({ error: 'KV_REST_API_URL or KV_REST_API_TOKEN not set' });
  }

  const { method } = req;
  try {
    if (method === 'GET') {
      const { code, id } = req.query;

      if (code) {
        // 访客通过校验码进入：校验码需存在且对应问卷已发布
        if (!isValidCode(code)) {
          return res.status(400).json({ error: '校验码格式无效' });
        }
        // 读取校验码映射
        const codeRes = await fetch(`${apiUrl}/get/${QN_CODE_KEY_PREFIX}${code}`, {
          headers: { Authorization: `Bearer ${apiToken}` }
        });
        if (!codeRes.ok) return res.status(404).json({ error: '校验码无效或不存在' });
        const codeJson = await codeRes.json();
        if (!codeJson || codeJson.result == null) {
          return res.status(404).json({ error: '校验码无效或不存在' });
        }
        const codeObj = unwrapKV(codeJson.result);
        const qnId = codeObj?.questionnaireId;
        const enabled = codeObj?.enabled !== false; // 缺省为启用
        if (!qnId || !enabled) {
          return res.status(404).json({ error: '校验码未启用或未绑定问卷' });
        }
        // 读取问卷
        const qnRes = await fetch(`${apiUrl}/get/${QN_KEY_PREFIX}${qnId}`, {
          headers: { Authorization: `Bearer ${apiToken}` }
        });
        if (!qnRes.ok) return res.status(404).json({ error: '问卷不存在' });
        const qnJson = await qnRes.json();
        if (!qnJson || qnJson.result == null) return res.status(404).json({ error: '问卷不存在' });
        const qn = unwrapKV(qnJson.result) || {};
        if (qn.published !== true) return res.status(403).json({ error: '问卷未发布' });
        // 仅返回前台必要字段
        return res.status(200).json({
          id: qnId,
          title: qn.title || '未命名问卷',
          description: qn.description || '',
          fields: Array.isArray(qn.fields) ? qn.fields : []
        });
      }

      // 预留：支持按 id 获取（未来用于管理端）
      if (id) {
        const qnRes = await fetch(`${apiUrl}/get/${QN_KEY_PREFIX}${id}`, {
          headers: { Authorization: `Bearer ${apiToken}` }
        });
        if (!qnRes.ok) return res.status(404).json({ error: '问卷不存在' });
        const qnJson = await qnRes.json();
        if (!qnJson || qnJson.result == null) return res.status(404).json({ error: '问卷不存在' });
        const qn = unwrapKV(qnJson.result) || {};
        return res.status(200).json({ id, ...qn });
      }

      return res.status(400).json({ error: '缺少必要参数' });
    }

    // 预留：PUT/POST/DELETE 用于管理端，等安全方案就绪后实现
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${method} Not Allowed` });
  } catch (err) {
    console.error('Questionnaires API Error:', err);
    return res.status(500).json({ error: '服务器内部错误' });
  }
}
