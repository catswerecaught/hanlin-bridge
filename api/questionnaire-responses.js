// 悠然问卷答卷提交 API
const QN_KEY_PREFIX = 'qn:'; // qn:<id>
const QN_CODE_KEY_PREFIX = 'qn:code:'; // qn:code:<code> -> { questionnaireId, enabled }
const QN_RESP_KEY_PREFIX = 'qn:resp:'; // qn:resp:<qnId>:<respId>

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
  const apiUrl = process.env.KV_REST_API_URL;
  const apiToken = process.env.KV_REST_API_TOKEN;
  if (!apiUrl || !apiToken) {
    return res.status(500).json({ error: 'KV_REST_API_URL or KV_REST_API_TOKEN not set' });
  }

  const { method } = req;
  try {
    if (method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).json({ error: `Method ${method} Not Allowed` });
    }

    let body = req.body;
    if (!body) {
      let raw = '';
      await new Promise(resolve => { req.on('data', c => raw += c); req.on('end', resolve); });
      try { body = JSON.parse(raw); } catch { body = {}; }
    }

    const { code, questionnaireId, answers, meta } = body || {};
    if (!code || !isValidCode(code)) return res.status(400).json({ error: '校验码无效' });
    if (!questionnaireId) return res.status(400).json({ error: '缺少问卷ID' });
    if (!answers || typeof answers !== 'object') return res.status(400).json({ error: '答案格式无效' });

    // 校验校验码映射
    const codeRes = await fetch(`${apiUrl}/get/${QN_CODE_KEY_PREFIX}${code}`, {
      headers: { Authorization: `Bearer ${apiToken}` }
    });
    if (!codeRes.ok) return res.status(404).json({ error: '校验码无效或不存在' });
    const codeJson = await codeRes.json();
    if (!codeJson || codeJson.result == null) return res.status(404).json({ error: '校验码无效或不存在' });
    const codeObj = unwrapKV(codeJson.result);
    const mappedId = codeObj?.questionnaireId;
    const enabled = codeObj?.enabled !== false; // 默认启用
    if (!mappedId || !enabled) return res.status(403).json({ error: '校验码未启用或未绑定问卷' });
    if (String(mappedId) !== String(questionnaireId)) return res.status(400).json({ error: '问卷ID与校验码不匹配' });

    // 验证问卷存在且已发布
    const qnRes = await fetch(`${apiUrl}/get/${QN_KEY_PREFIX}${questionnaireId}`, {
      headers: { Authorization: `Bearer ${apiToken}` }
    });
    if (!qnRes.ok) return res.status(404).json({ error: '问卷不存在' });
    const qnJson = await qnRes.json();
    if (!qnJson || qnJson.result == null) return res.status(404).json({ error: '问卷不存在' });
    const qn = unwrapKV(qnJson.result) || {};
    if (qn.published !== true) return res.status(403).json({ error: '问卷未发布' });

    const respId = genId();
    const record = {
      questionnaireId,
      code,
      answers,
      meta: meta || {},
      ts: new Date().toISOString(),
    };

    const kvRes = await fetch(`${apiUrl}/set/${QN_RESP_KEY_PREFIX}${questionnaireId}:${respId}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ value: record })
    });
    if (!kvRes.ok) return res.status(500).json({ error: '写入答卷失败' });

    return res.status(200).json({ success: true, respId });
  } catch (err) {
    console.error('Questionnaire Responses API Error:', err);
    return res.status(500).json({ error: '服务器内部错误' });
  }
}
