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

export default async function handler(req, res) {
  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const apiUrl = process.env.KV_REST_API_URL;
  const apiToken = process.env.KV_REST_API_TOKEN;
  
  if (!apiUrl || !apiToken) {
    return res.status(500).json({ error: 'KV_REST_API_URL or KV_REST_API_TOKEN not set' });
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
    const listResponse = await fetch(`${apiUrl}/keys/${QUESTIONNAIRES_KEY_PREFIX}*`, {
      headers: { 'Authorization': `Bearer ${apiToken}` }
    });
    
    if (!listResponse.ok) {
      throw new Error('Failed to fetch questionnaires list');
    }
    
    const listData = await listResponse.json();
    const keys = listData.result || [];
    
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
              id: key.replace(QUESTIONNAIRES_KEY_PREFIX, ''),
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
    if (!isValidCode(code)) {
      return res.status(400).json({ error: '校验码格式无效' });
    }
    
    // 读取校验码映射
    const codeRes = await fetch(`${apiUrl}/get/${CODES_KEY_PREFIX}${code}`, {
      headers: { Authorization: `Bearer ${apiToken}` }
    });
    
    if (!codeRes.ok) {
      return res.status(404).json({ error: '校验码无效或不存在' });
    }
    
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
    
    // 读取问卷
    const qnRes = await fetch(`${apiUrl}/get/${QUESTIONNAIRES_KEY_PREFIX}${qnId}`, {
      headers: { Authorization: `Bearer ${apiToken}` }
    });
    
    if (!qnRes.ok) {
      return res.status(404).json({ error: '问卷不存在' });
    }
    
    const qnJson = await qnRes.json();
    if (!qnJson || qnJson.result == null) {
      return res.status(404).json({ error: '问卷不存在' });
    }
    
    const qn = unwrapKV(qnJson.result) || {};
    if (qn.published !== true) {
      return res.status(403).json({ error: '问卷未发布' });
    }
    
    return res.status(200).json({
      id: qnId,
      title: qn.title || '未命名问卷',
      description: qn.description || '',
      fields: Array.isArray(qn.fields) ? qn.fields : []
    });
  } catch (error) {
    console.error('Error in getQuestionnaireByCode:', error);
    return res.status(500).json({ error: '获取问卷失败' });
  }
}

// 通过ID获取问卷
async function getQuestionnaireById(id, apiUrl, apiToken, res) {
  try {
    const qnRes = await fetch(`${apiUrl}/get/${QUESTIONNAIRES_KEY_PREFIX}${id}`, {
      headers: { Authorization: `Bearer ${apiToken}` }
    });
    
    if (!qnRes.ok) {
      return res.status(404).json({ error: '问卷不存在' });
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
    const { id, title, description, code, published, fields } = body;
    
    if (!id) {
      return res.status(400).json({ error: '问卷ID不能为空' });
    }
    
    // 获取现有问卷
    const existingRes = await fetch(`${apiUrl}/get/${QUESTIONNAIRES_KEY_PREFIX}${id}`, {
      headers: { Authorization: `Bearer ${apiToken}` }
    });
    
    if (!existingRes.ok) {
      return res.status(404).json({ error: '问卷不存在' });
    }
    
    const existingJson = await existingRes.json();
    const existingData = unwrapKV(existingJson.result) || {};
    
    // 更新数据
    const updatedData = {
      ...existingData,
      title: title || existingData.title,
      description: description !== undefined ? description : existingData.description,
      code: code !== undefined ? code : existingData.code,
      published: published !== undefined ? published : existingData.published,
      fields: fields !== undefined ? fields : existingData.fields,
      updatedAt: new Date().toISOString()
    };
    
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
      throw new Error('Failed to update questionnaire');
    }
    
    // 更新校验码映射（如果有变化）
    if (code && isValidCode(code) && code !== existingData.code) {
      // 删除旧的校验码映射
      if (existingData.code && isValidCode(existingData.code)) {
        await fetch(`${apiUrl}/del/${CODES_KEY_PREFIX}${existingData.code}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${apiToken}` }
        });
      }
      
      // 创建新的校验码映射
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
      message: '问卷更新成功'
    });
  } catch (error) {
    console.error('Error in updateQuestionnaire:', error);
    return res.status(500).json({ error: '更新问卷失败' });
  }
}

// 删除问卷
async function deleteQuestionnaire(id, apiUrl, apiToken, res) {
  try {
    if (!id) {
      return res.status(400).json({ error: '问卷ID不能为空' });
    }
    
    // 获取问卷信息（用于删除校验码映射）
    const qnRes = await fetch(`${apiUrl}/get/${QUESTIONNAIRES_KEY_PREFIX}${id}`, {
      headers: { Authorization: `Bearer ${apiToken}` }
    });
    
    if (qnRes.ok) {
      const qnJson = await qnRes.json();
      const qnData = unwrapKV(qnJson.result);
      
      // 删除校验码映射
      if (qnData?.code && isValidCode(qnData.code)) {
        await fetch(`${apiUrl}/del/${CODES_KEY_PREFIX}${qnData.code}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${apiToken}` }
        });
      }
    }
    
    // 删除问卷
    const deleteResponse = await fetch(`${apiUrl}/del/${QUESTIONNAIRES_KEY_PREFIX}${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${apiToken}` }
    });
    
    if (!deleteResponse.ok) {
      throw new Error('Failed to delete questionnaire');
    }
    
    return res.status(200).json({ 
      success: true,
      message: '问卷删除成功'
    });
  } catch (error) {
    console.error('Error in deleteQuestionnaire:', error);
    return res.status(500).json({ error: '删除问卷失败' });
  }
}

// 校验码格式验证
function isValidCode(code) {
  return /^[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/i.test(code);
}
