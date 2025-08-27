// 问卷API - 处理问卷的CRUD操作
const QUESTIONNAIRES_KEY_PREFIX = 'questionnaire-';
const CODES_KEY_PREFIX = 'qn-code-';

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

// 带超时的 fetch，防止外部请求长时间挂起
async function fetchWithTimeout(resource, options = {}, timeout = 15000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(resource, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

export default async function handler(req, res) {
  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const apiUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const apiToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  
  if (!apiUrl || !apiToken) {
    return res.status(500).json({ error: 'Upstash env not set: please set KV_REST_API_URL/KV_REST_API_TOKEN or UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN' });
  }

  const { method, query, body } = req;

  try {
    if (method === 'GET') {
      const { code, id, admin } = query;
      
      if (admin === 'true') {
        // 获取所有问卷（管理员）
        return await getAllQuestionnaires(apiUrl, apiToken, res);
      } else if (code) {
        // 通过校验码获取问卷
        return await getQuestionnaireByCode(code, apiUrl, apiToken, res);
      } else if (id) {
        // 通过ID获取问卷
        return await getQuestionnaireById(id, apiUrl, apiToken, res);
      } else {
        return res.status(400).json({ error: 'Missing required parameters' });
      }
    } else if (method === 'POST') {
      // 创建新问卷
      return await createQuestionnaire(body, apiUrl, apiToken, res);
    } else if (method === 'PUT') {
      // 更新问卷
      return await updateQuestionnaire(body, apiUrl, apiToken, res);
    } else if (method === 'DELETE') {
      // 删除问卷
      const { id } = query;
      return await deleteQuestionnaire(id, apiUrl, apiToken, res);
    }

    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
    return res.status(405).json({ error: `Method ${method} Not Allowed` });
  } catch (err) {
    console.error('Questionnaires API Error:', err);
    return res.status(500).json({ error: '服务器内部错误' });
  }
}

// 获取所有问卷（管理员）
async function getAllQuestionnaires(apiUrl, apiToken, res) {
  try {
    let listResponse = await fetchWithTimeout(`${apiUrl}/scan`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prefix: QUESTIONNAIRES_KEY_PREFIX,
        limit: 100
      })
    });
    
    // 若 /scan 不可用，兼容性回退到 /keys
    if (!listResponse.ok) {
      console.warn(`[getAllQuestionnaires] /scan failed: ${listResponse.status} ${listResponse.statusText}`);
      const legacy = await fetchWithTimeout(`${apiUrl}/keys/${QUESTIONNAIRES_KEY_PREFIX}*`, {
        headers: { 'Authorization': `Bearer ${apiToken}` }
      }).catch(() => null);
      if (!legacy || !legacy.ok) {
        const status = legacy ? `${legacy.status} ${legacy.statusText}` : 'no response';
        console.warn(`[getAllQuestionnaires] /keys fallback failed: ${status}`);
        // 继续尝试读取旧前缀 'qn:'
        // KEYS qn:* 仅用于兼容旧数据
        const legacyQn = await fetchWithTimeout(`${apiUrl}/keys/qn:*`, {
          headers: { 'Authorization': `Bearer ${apiToken}` }
        }).catch(() => null);
        if (!legacyQn || !legacyQn.ok) {
          const status2 = legacyQn ? `${legacyQn.status} ${legacyQn.statusText}` : 'no response';
          console.warn(`[getAllQuestionnaires] legacy prefix qn:* keys failed: ${status2}`);
          return res.status(200).json({ questionnaires: [] });
        }
        listResponse = legacyQn;
      }
      listResponse = legacy;
    }
    
    let listData;
    try {
      listData = await listResponse.json();
    } catch (e) {
      console.warn('[getAllQuestionnaires] listResponse JSON parse failed, returning empty list');
      return res.status(200).json({ questionnaires: [] });
    }
    let keys = Array.isArray(listData.keys) ? listData.keys : (listData.result || []);
    
    // 如果没有读取到任何问卷且我们还未尝试旧前缀，则补充尝试一次 'qn:' 前缀
    if ((!keys || keys.length === 0)) {
      const legacyQn = await fetchWithTimeout(`${apiUrl}/keys/qn:*`, {
        headers: { 'Authorization': `Bearer ${apiToken}` }
      }).catch(() => null);
      if (legacyQn && legacyQn.ok) {
        try {
          const legacyData = await legacyQn.json();
          const legacyKeys = Array.isArray(legacyData.keys) ? legacyData.keys : (legacyData.result || []);
          keys = legacyKeys;
        } catch {}
      }
    }
    
    const questionnaires = [];
    
    for (const key of keys) {
      try {
        const qnResponse = await fetch(`${apiUrl}/get/${key}`, {
          headers: { 'Authorization': `Bearer ${apiToken}` }
        });
        
        if (qnResponse.ok) {
          const qnData = await qnResponse.json();
          const questionnaire = unwrapKV(qnData.result);
          if (questionnaire) {
            questionnaires.push({
              id: key.startsWith(QUESTIONNAIRES_KEY_PREFIX)
                ? key.replace(QUESTIONNAIRES_KEY_PREFIX, '')
                : key.replace('qn:', ''),
              ...questionnaire
            });
          }
        }
      } catch (error) {
        console.error(`Error loading questionnaire ${key}:`, error);
      }
    }
    
    return res.status(200).json({ questionnaires });
  } catch (error) {
    console.error('Error in getAllQuestionnaires:', error);
    return res.status(500).json({ error: '获取问卷列表失败' });
  }
}

// 通过校验码获取问卷
async function getQuestionnaireByCode(code, apiUrl, apiToken, res) {
  try {
    console.log(`[getQuestionnaireByCode] 开始获取问卷，校验码: ${code}`);
    
    if (!isValidCode(code)) {
      console.log(`[getQuestionnaireByCode] 校验码格式无效: ${code}`);
      return res.status(400).json({ error: '校验码格式无效' });
    }
    
    // 读取校验码映射
    console.log(`[getQuestionnaireByCode] 尝试获取校验码映射: ${CODES_KEY_PREFIX}${code}`);
    let codeRes = await fetch(`${apiUrl}/get/${CODES_KEY_PREFIX}${code}`, {
      headers: { Authorization: `Bearer ${apiToken}` }
    });
    
    // 兼容旧前缀 'qn:code:'
    if (!codeRes.ok) {
      console.log(`[getQuestionnaireByCode] 首次读取失败，尝试旧前缀 qn:code:`);
      codeRes = await fetch(`${apiUrl}/get/qn:code:${code}`, {
        headers: { Authorization: `Bearer ${apiToken}` }
      });
      if (!codeRes.ok) {
        console.log(`[getQuestionnaireByCode] 校验码获取失败，状态: ${codeRes.status}`);
        return res.status(404).json({ error: '校验码无效或不存在' });
      }
    }
    
    const codeJson = await codeRes.json();
    console.log(`[getQuestionnaireByCode] 校验码响应:`, JSON.stringify(codeJson));
    
    if (!codeJson || !codeJson.result) {
      // 再次尝试按旧前缀解析
      const codeRes2 = await fetch(`${apiUrl}/get/qn:code:${code}`, {
        headers: { Authorization: `Bearer ${apiToken}` }
      }).catch(() => null);
      if (!codeRes2 || !codeRes2.ok) {
        console.log(`[getQuestionnaireByCode] 校验码映射数据为空或无效`);
        return res.status(404).json({ error: '校验码无效或不存在' });
      }
      const cj2 = await codeRes2.json();
      codeJson.result = cj2.result;
    }
    
    const codeObj = unwrapKV(codeJson.result);
    console.log(`[getQuestionnaireByCode] 解析后的校验码数据:`, JSON.stringify(codeObj));
    
    const qnId = codeObj?.questionnaireId;
    const enabled = codeObj?.enabled !== false;
    
    if (!qnId || !enabled) {
      console.log(`[getQuestionnaireByCode] 校验码未启用或未绑定问卷: ${code}, qnId=${qnId}, enabled=${enabled}`);
      return res.status(404).json({ error: '校验码未启用或未绑定问卷' });
    }
    
    // 读取问卷
    console.log(`[getQuestionnaireByCode] 尝试获取问卷: ${QUESTIONNAIRES_KEY_PREFIX}${qnId}`);
    let qnRes = await fetch(`${apiUrl}/get/${QUESTIONNAIRES_KEY_PREFIX}${qnId}`, {
      headers: { Authorization: `Bearer ${apiToken}` }
    });
    
    if (!qnRes.ok) {
      // 兼容旧前缀 'qn:'
      qnRes = await fetch(`${apiUrl}/get/qn:${qnId}`, {
        headers: { Authorization: `Bearer ${apiToken}` }
      });
      if (!qnRes.ok) {
        console.log(`[getQuestionnaireByCode] 问卷获取失败，状态: ${qnRes.status}`);
        return res.status(404).json({ error: '问卷不存在' });
      }
    }
    
    const qnJson = await qnRes.json();
    console.log(`[getQuestionnaireByCode] 问卷响应:`, JSON.stringify(qnJson));
    
    if (!qnJson || !qnJson.result) {
      console.log(`[getQuestionnaireByCode] 问卷数据为空或无效`);
      return res.status(404).json({ error: '问卷不存在' });
    }
    
    const qn = unwrapKV(qnJson.result) || {};
    console.log(`[getQuestionnaireByCode] 解析后的问卷数据:`, JSON.stringify({
      id: qnId,
      title: qn.title,
      published: qn.published,
      fields: Array.isArray(qn.fields) ? qn.fields.length : 0
    }));
    
    if (qn.published !== true) {
      console.log(`[getQuestionnaireByCode] 问卷未发布: ${qnId}`);
      return res.status(403).json({ error: '问卷未发布' });
    }
    
    const responseData = {
      id: qnId,
      title: qn.title || '未命名问卷',
      description: qn.description || '',
      fields: Array.isArray(qn.fields) ? qn.fields : []
    };
    
    console.log(`[getQuestionnaireByCode] 返回问卷数据成功: ${qnId}`);
    return res.status(200).json(responseData);
  } catch (error) {
    console.error('Error in getQuestionnaireByCode:', error);
    return res.status(500).json({ error: '获取问卷失败: ' + (error.message || '未知错误') });
  }
}

// 通过ID获取问卷
async function getQuestionnaireById(id, apiUrl, apiToken, res) {
  try {
    let qnRes = await fetch(`${apiUrl}/get/${QUESTIONNAIRES_KEY_PREFIX}${id}`, {
      headers: { Authorization: `Bearer ${apiToken}` }
    });
    
    if (!qnRes.ok) {
      // 兼容旧前缀 'qn:'
      qnRes = await fetch(`${apiUrl}/get/qn:${id}`, {
        headers: { Authorization: `Bearer ${apiToken}` }
      });
      if (!qnRes.ok) {
        return res.status(404).json({ error: '问卷不存在' });
      }
    }
    
    const qnJson = await qnRes.json();
    if (!qnJson || qnJson.result == null) {
      return res.status(404).json({ error: '问卷不存在' });
    }
    
    const qn = unwrapKV(qnJson.result) || {};
    return res.status(200).json({ id, ...qn });
  } catch (error) {
    console.error('Error in getQuestionnaireById:', error);
    return res.status(500).json({ error: '获取问卷失败' });
  }
}

// 创建问卷
async function createQuestionnaire(body, apiUrl, apiToken, res) {
  try {
    const { id, title, description, code, fields } = body;
    
    if (!id || !title) {
      return res.status(400).json({ error: '问卷ID和标题不能为空' });
    }
    
    const questionnaireData = {
      title,
      description: description || '',
      code: code || '',
      published: false,
      createdAt: new Date().toISOString(),
      responseCount: 0,
      fields: fields || []
    };
    
    // 存储问卷
    const storeResponse = await fetch(`${apiUrl}/set/${QUESTIONNAIRES_KEY_PREFIX}${id}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(questionnaireData)
    });
    
    if (!storeResponse.ok) {
      throw new Error('Failed to store questionnaire');
    }
    
    // 如果有校验码，创建校验码映射
    if (code && isValidCode(code)) {
      const codeData = {
        questionnaireId: id,
        enabled: true,
        createdAt: new Date().toISOString()
      };
      
      await fetch(`${apiUrl}/set/${CODES_KEY_PREFIX}${code}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(codeData)
      });
    }
    
    return res.status(200).json({ 
      success: true,
      id,
      message: '问卷创建成功'
    });
  } catch (error) {
    console.error('Error in createQuestionnaire:', error);
    return res.status(500).json({ error: '创建问卷失败' });
  }
}

// 更新问卷
async function updateQuestionnaire(body, apiUrl, apiToken, res) {
  try {
    console.log('[updateQuestionnaire] 收到更新问卷请求', JSON.stringify(body));
    
    if (!body || typeof body !== 'object') {
      console.log('[updateQuestionnaire] 请求体为空或无效');
      return res.status(400).json({ error: '请求体无效' });
    }
    
    const { id, title, description, code, published, fields } = body;
    
    if (!id) {
      console.log('[updateQuestionnaire] 缺失问卷ID');
      return res.status(400).json({ error: '问卷ID不能为空' });
    }
    
    console.log(`[updateQuestionnaire] 尝试获取现有问卷: ${id}`);
    // 获取现有问卷
    const existingRes = await fetch(`${apiUrl}/get/${QUESTIONNAIRES_KEY_PREFIX}${id}`, {
      headers: { Authorization: `Bearer ${apiToken}` }
    });
    
    if (!existingRes.ok) {
      console.log(`[updateQuestionnaire] 获取现有问卷失败，状态码: ${existingRes.status}`);
      return res.status(404).json({ error: '问卷不存在' });
    }
    
    const existingJson = await existingRes.json();
    console.log('[updateQuestionnaire] 现有问卷数据原始响应:', JSON.stringify(existingJson));
    
    if (!existingJson || !existingJson.result) {
      console.log('[updateQuestionnaire] 现有问卷数据为空或无效');
      return res.status(404).json({ error: '问卷不存在或数据无效' });
    }
    
    const existingData = unwrapKV(existingJson.result) || {};
    console.log('[updateQuestionnaire] 解析后的现有问卷数据:', JSON.stringify({
      id: id,
      title: existingData.title,
      published: existingData.published,
      fieldsCount: Array.isArray(existingData.fields) ? existingData.fields.length : 0
    }));
    
    // 更新数据
    const updatedData = {
      ...existingData,
      title: title !== undefined ? title : existingData.title,
      description: description !== undefined ? description : existingData.description,
      code: code !== undefined ? code : existingData.code,
      published: published !== undefined ? !!published : !!existingData.published, // 确保是布尔值
      fields: fields !== undefined ? fields : existingData.fields,
      updatedAt: new Date().toISOString()
    };
    
    console.log('[updateQuestionnaire] 准备保存更新后的问卷数据:', JSON.stringify({
      id: id,
      title: updatedData.title,
      published: updatedData.published,
      fieldsCount: Array.isArray(updatedData.fields) ? updatedData.fields.length : 0
    }));
    
    // 存储更新的问卷
    const storeResponse = await fetch(`${apiUrl}/set/${QUESTIONNAIRES_KEY_PREFIX}${id}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updatedData)
    });
    
    if (!storeResponse.ok) {
      console.log(`[updateQuestionnaire] 存储更新后的问卷失败，状态码: ${storeResponse.status}`);
      throw new Error(`Failed to update questionnaire: ${storeResponse.status} ${storeResponse.statusText}`);
    }
    
    // 更新校验码映射（如果有变化）
    if (code && isValidCode(code) && code !== existingData.code) {
      console.log(`[updateQuestionnaire] 校验码变更，旧码: ${existingData.code}, 新码: ${code}`);
      // 删除旧的校验码映射
      if (existingData.code && isValidCode(existingData.code)) {
        const deleteCodeRes = await fetch(`${apiUrl}/del/${CODES_KEY_PREFIX}${existingData.code}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${apiToken}` }
        });
        console.log(`[updateQuestionnaire] 删除旧校验码映射状态: ${deleteCodeRes.status}`);
      }
      
      // 创建新的校验码映射
      const codeData = {
        questionnaireId: id,
        enabled: true,
        createdAt: new Date().toISOString()
      };
      
      const setCodeRes = await fetch(`${apiUrl}/set/${CODES_KEY_PREFIX}${code}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(codeData)
      });
      console.log(`[updateQuestionnaire] 创建新校验码映射状态: ${setCodeRes.status}`);
    }
    
    console.log(`[updateQuestionnaire] 问卷更新成功: ${id}`);
    return res.status(200).json({ 
      success: true,
      id,
      message: '问卷更新成功'
    });
  } catch (error) {
    console.error('Error in updateQuestionnaire:', error);
    return res.status(500).json({ error: '更新问卷失败: ' + (error.message || '未知错误') });
  }
}

// 删除问卷
async function deleteQuestionnaire(id, apiUrl, apiToken, res) {
  try {
    console.log(`[deleteQuestionnaire] 开始删除问卷: ${id}`);
    
    if (!id) {
      console.log('[deleteQuestionnaire] 错误: 问卷ID不能为空');
      return res.status(400).json({ error: '问卷ID不能为空' });
    }
    
    // 获取问卷信息（用于删除校验码映射）
    console.log(`[deleteQuestionnaire] 获取问卷数据: ${QUESTIONNAIRES_KEY_PREFIX}${id}`);
    const qnRes = await fetch(`${apiUrl}/get/${QUESTIONNAIRES_KEY_PREFIX}${id}`, {
      headers: { Authorization: `Bearer ${apiToken}` }
    });
    
    let qnData = null;
    if (qnRes.ok) {
      const qnJson = await qnRes.json();
      console.log('Upstash GET response:', qnJson);
      qnData = unwrapKV(qnJson.result);
      
      // 删除校验码映射
      if (qnData?.code && isValidCode(qnData.code)) {
        console.log(`[deleteQuestionnaire] 删除校验码映射: ${CODES_KEY_PREFIX}${qnData.code}`);
        const codeDelRes = await fetch(`${apiUrl}/del/${CODES_KEY_PREFIX}${qnData.code}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${apiToken}` }
        });
        
        const codeDelJson = await codeDelRes.json();
        console.log('Upstash DEL code response:', codeDelJson);
        
        if (!codeDelRes.ok) {
          console.log(`[deleteQuestionnaire] 删除校验码失败: ${codeDelRes.status}`, codeDelJson);
        }
      }
    } else {
      const error = await qnRes.json().catch(() => ({}));
      console.log(`[deleteQuestionnaire] 问卷不存在: ${id}`, error);
    }
    
    // 删除问卷
    console.log(`[deleteQuestionnaire] 删除问卷: ${QUESTIONNAIRES_KEY_PREFIX}${id}`);
    const deleteResponse = await fetch(`${apiUrl}/del/${QUESTIONNAIRES_KEY_PREFIX}${id}`, {
      method: 'DELETE',
      headers: { 
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json' 
      }
    });
    
    const delJson = await deleteResponse.json();
    console.log('Upstash DEL questionnaire response:', delJson);
    
    if (!deleteResponse.ok) {
      console.log(`[deleteQuestionnaire] 删除问卷失败: ${deleteResponse.status}`, delJson);
      throw new Error(`Failed to delete questionnaire: ${deleteResponse.status} - ${JSON.stringify(delJson)}`);
    }
    
    console.log(`[deleteQuestionnaire] 问卷删除成功: ${id}`);
    return res.status(200).json({ 
      success: true,
      message: '问卷删除成功'
    });
  } catch (error) {
    console.error('[deleteQuestionnaire] 错误:', error);
    return res.status(500).json({ 
      error: '删除问卷失败',
      detail: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
