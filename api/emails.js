const EMAIL_KEY_PREFIX = 'emails-';
const EMAIL_COUNTER_KEY = 'email-counter';

export default async function handler(req, res) {
  const apiUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const apiToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  
  if (!apiUrl || !apiToken) {
    return res.status(500).json({ 
      error: 'KV_REST_API_URL/KV_REST_API_TOKEN or UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN not set' 
    });
  }

// 尝试多层解包 Upstash 返回的 {result: string} 与我们历史写入的 {value: string} 嵌套
function unwrapKV(raw) {
  // 初始：raw 可能是字符串或对象
  let data = raw;
  let safety = 0;
  while (safety++ < 10) {
    if (data == null) break;
    // 字符串尝试 JSON.parse
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
        continue;
      } catch {
        break; // 非 JSON 字符串
      }
    }
    // 对象且存在 value 字段
    if (typeof data === 'object' && data.value != null) {
      // 如果 value 还是字符串，继续
      if (typeof data.value === 'string') { data = data.value; continue; }
      // 如果 value 已是对象
      data = data.value;
      continue;
    }
    break;
  }
  return data;
}

  // 验证授权
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '需要授权' });
  }
  
  const username = authHeader.replace('Bearer ', '');
  if (!username) {
    return res.status(401).json({ error: '无效的授权令牌' });
  }

  try {
    if (req.method === 'GET') {
      // 获取用户邮件
      await handleGetEmails(req, res, apiUrl, apiToken, username);
    } else if (req.method === 'POST') {
      // 发送邮件或创建草稿（通过 action 字段）
      const action = (req.body && req.body.action) || '';
      if (action === 'send') {
        await handleSendEmail(req, res, apiUrl, apiToken, username);
      } else {
        await handleCreateDraft(req, res, apiUrl, apiToken, username);
      }
    } else if (req.method === 'PUT') {
      // 更新邮件状态（已读/未读等）
      await handleUpdateEmail(req, res, apiUrl, apiToken, username);
    } else if (req.method === 'DELETE') {
      // 删除邮件
      await handleDeleteEmail(req, res, apiUrl, apiToken, username);
    } else {
      res.status(405).json({ error: '不支持的请求方法' });
    }
  } catch (error) {
    console.error('邮件API错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
}

// 获取用户邮件
async function handleGetEmails(req, res, apiUrl, apiToken, username) {
  const userEmailKey = `${EMAIL_KEY_PREFIX}${username}`;
  
  try {
    const response = await fetch(`${apiUrl}/get/${userEmailKey}`, {
      headers: { 'Authorization': `Bearer ${apiToken}` }
    });
    
    const data = await response.json();
    
    if (data.result) {
      // 兼容多层嵌套
      const unwrapped = unwrapKV(data.result);
      const emails = unwrapKV(unwrapped);
      const normalized = {
        inbox: Array.isArray(emails?.inbox) ? emails.inbox : [],
        sent: Array.isArray(emails?.sent) ? emails.sent : [],
        drafts: Array.isArray(emails?.drafts) ? emails.drafts : [],
        deleted: Array.isArray(emails?.deleted) ? emails.deleted : []
      };
      // 回写一次，消除历史多层 value 嵌套
      await fetch(`${apiUrl}/set/${userEmailKey}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: JSON.stringify(normalized) })
      }).catch(() => {});
      res.status(200).json({ emails: normalized });
    } else {
      // 用户首次使用，创建默认邮件结构
      const defaultEmails = {
        inbox: [
          {
            id: `welcome_${Date.now()}`,
            from: 'system@oceantie.top',
            fromName: '翰林桥系统',
            to: `${username}@oceantie.top`,
            subject: '欢迎使用翰林桥邮件系统',
            body: `亲爱的用户，\n\n欢迎使用翰林桥邮件系统！\n\n您的邮箱地址是：${username}@oceantie.top\n\n您可以与系统中的其他用户进行邮件通信。\n\n功能特点：\n- 发送和接收邮件\n- 草稿保存\n- 邮件搜索\n- 文件夹管理\n\n祝您使用愉快！\n\n翰林桥团队`,
            timestamp: Date.now(),
            read: false,
            attachments: []
          }
        ],
        sent: [],
        drafts: [],
        deleted: []
      };
      
      // 保存默认邮件到数据库
      await fetch(`${apiUrl}/set/${userEmailKey}`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ value: JSON.stringify(defaultEmails) })
      });
      
      res.status(200).json({ emails: defaultEmails });
    }
  } catch (error) {
    console.error('获取邮件失败:', error);
    res.status(500).json({ error: '获取邮件失败' });
  }
}

// 发送邮件
async function handleSendEmail(req, res, apiUrl, apiToken, username) {
  const { to, cc, subject, body } = req.body;
  
  if (!to || !subject || !body) {
    return res.status(400).json({ error: '缺少必填字段' });
  }
  
  // 验证收件人邮箱格式
  if (!to.endsWith('@oceantie.top')) {
    return res.status(400).json({ error: '只能发送给 @oceantie.top 邮箱地址' });
  }
  // 禁止给自己发邮件
  const senderEmail = `${username}@oceantie.top`;
  if (to.toLowerCase() === senderEmail.toLowerCase()) {
    return res.status(400).json({ error: '不能给自己发送邮件' });
  }
  
  const recipientUsername = to.split('@')[0];
  
  try {
    // 生成邮件ID
    const emailId = await generateEmailId(apiUrl, apiToken);
    const timestamp = Date.now();
    
    const emailData = {
      id: emailId,
      from: `${username}@oceantie.top`,
      fromName: await getUserDisplayName(username),
      to,
      cc: cc || '',
      subject,
      body,
      timestamp,
      read: true, // 发件人已读
      attachments: []
    };
    
    // 1. 添加到发件人的已发送邮件
    await addEmailToFolder(apiUrl, apiToken, username, 'sent', emailData);
    
    // 2. 添加到收件人的收件箱
    const receivedEmail = {
      ...emailData,
      id: `${emailId}_received`,
      read: false // 收件人未读
    };
    
    await addEmailToFolder(apiUrl, apiToken, recipientUsername, 'inbox', receivedEmail);
    
    // 3. 如果有抄送，也添加到抄送人收件箱
    if (cc) {
      const ccEmails = cc.split(',').map(email => email.trim()).filter(email => 
        email.endsWith('@oceantie.top') && email !== to
      );
      
      for (const ccEmail of ccEmails) {
        const ccUsername = ccEmail.split('@')[0];
        const ccEmailData = {
          ...emailData,
          id: `${emailId}_cc_${ccUsername}`,
          read: false
        };
        await addEmailToFolder(apiUrl, apiToken, ccUsername, 'inbox', ccEmailData);
      }
    }
    
    res.status(200).json({ 
      success: true, 
      emailId,
      message: '邮件发送成功' 
    });
    
  } catch (error) {
    console.error('发送邮件失败:', error);
    res.status(500).json({ error: '发送邮件失败' });
  }
}

// 创建草稿
async function handleCreateDraft(req, res, apiUrl, apiToken, username) {
  const { to, cc, subject, body } = req.body;
  
  try {
    const emailId = await generateEmailId(apiUrl, apiToken);
    
    const draftData = {
      id: emailId,
      from: `${username}@oceantie.top`,
      fromName: await getUserDisplayName(username),
      to: to || '',
      cc: cc || '',
      subject: subject || '',
      body: body || '',
      timestamp: Date.now(),
      read: true,
      attachments: []
    };
    
    await addEmailToFolder(apiUrl, apiToken, username, 'drafts', draftData);
    
    res.status(200).json({ 
      success: true, 
      emailId,
      message: '草稿保存成功' 
    });
    
  } catch (error) {
    console.error('保存草稿失败:', error);
    res.status(500).json({ error: '保存草稿失败' });
  }
}

// 更新邮件状态
async function handleUpdateEmail(req, res, apiUrl, apiToken, username) {
  const { emailId, folder, updates } = req.body;
  
  if (!emailId || !folder) {
    return res.status(400).json({ error: '缺少邮件ID或文件夹参数' });
  }
  
  try {
    const userEmailKey = `${EMAIL_KEY_PREFIX}${username}`;
    
    // 获取用户邮件数据
    const response = await fetch(`${apiUrl}/get/${userEmailKey}`, {
      headers: { 'Authorization': `Bearer ${apiToken}` }
    });
    
    const data = await response.json();
    if (!data.result) {
      return res.status(404).json({ error: '用户邮件数据未找到' });
    }
    const emails = unwrapKV(unwrapKV(data.result)) || {};
    const folderEmails = emails[folder];
    
    if (!folderEmails) {
      return res.status(400).json({ error: '无效的文件夹' });
    }
    
    const emailIndex = folderEmails.findIndex(email => email.id === emailId);
    if (emailIndex === -1) {
      return res.status(404).json({ error: '邮件未找到' });
    }
    
    // 更新邮件
    Object.assign(folderEmails[emailIndex], updates);
    
    // 保存到数据库
    await fetch(`${apiUrl}/set/${userEmailKey}`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ value: JSON.stringify(emails) })
    });
    
    res.status(200).json({ 
      success: true,
      message: '邮件更新成功'
    });
    
  } catch (error) {
    console.error('更新邮件失败:', error);
    res.status(500).json({ error: '更新邮件失败' });
  }
}

// 删除邮件
async function handleDeleteEmail(req, res, apiUrl, apiToken, username) {
  const { emailId, folder } = req.query;
  
  if (!emailId || !folder) {
    return res.status(400).json({ error: '缺少邮件ID或文件夹参数' });
  }
  
  try {
    const userEmailKey = `${EMAIL_KEY_PREFIX}${username}`;
    
    // 获取用户邮件数据
    const response = await fetch(`${apiUrl}/get/${userEmailKey}`, {
      headers: { 'Authorization': `Bearer ${apiToken}` }
    });
    
    const data = await response.json();
    if (!data.result) {
      return res.status(404).json({ error: '用户邮件数据未找到' });
    }
    
    const emails = JSON.parse(data.result);
    const folderEmails = emails[folder];
    
    if (!folderEmails) {
      return res.status(400).json({ error: '无效的文件夹' });
    }
    
    const emailIndex = folderEmails.findIndex(email => email.id === emailId);
    if (emailIndex === -1) {
      return res.status(404).json({ error: '邮件未找到' });
    }
    
    // 移除邮件
    const [removedEmail] = folderEmails.splice(emailIndex, 1);
    
    // 如果不是从已删除文件夹删除，则移动到已删除文件夹
    if (folder !== 'deleted') {
      emails.deleted.push(removedEmail);
    }
    
    // 保存到数据库
    await fetch(`${apiUrl}/set/${userEmailKey}`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ value: JSON.stringify(emails) })
    });
    
    res.status(200).json({ 
      success: true,
      message: folder === 'deleted' ? '邮件永久删除成功' : '邮件已移至垃圾箱'
    });
    
  } catch (error) {
    console.error('删除邮件失败:', error);
    res.status(500).json({ error: '删除邮件失败' });
  }
}

// 辅助函数：生成邮件ID
async function generateEmailId(apiUrl, apiToken) {
  try {
    const response = await fetch(`${apiUrl}/incr/${EMAIL_COUNTER_KEY}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiToken}` }
    });
    
    const data = await response.json();
    const counter = data.result || 1;
    
    return `email_${Date.now()}_${counter}`;
  } catch (error) {
    console.error('生成邮件ID失败:', error);
    return `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// 辅助函数：获取用户显示名称
async function getUserDisplayName(username) {
  // 这里可以从用户数据库获取真实姓名
  // 暂时返回用户名，实际应该查询用户信息
  const userMap = {
    'taosir': 'Oliver Tao',
    'user00002': '生物杨老师',
    'user00003': '化学孙老师',
    'user00004': '化学张老师',
    'user00005': '邬学长',
    'user00006': 'BenLi'
  };
  
  return userMap[username] || username;
}

// 辅助函数：添加邮件到指定文件夹
async function addEmailToFolder(apiUrl, apiToken, username, folder, emailData) {
  const userEmailKey = `${EMAIL_KEY_PREFIX}${username}`;
  
  // 获取用户现有邮件数据
  const response = await fetch(`${apiUrl}/get/${userEmailKey}`, {
    headers: { 'Authorization': `Bearer ${apiToken}` }
  });
  
  const data = await response.json();
  let emails = data.result ? (unwrapKV(unwrapKV(data.result)) || {}) : {
    inbox: [],
    sent: [],
    drafts: [],
    deleted: []
  };
  
  // 添加邮件到指定文件夹
  if (!emails[folder]) {
    emails[folder] = [];
  }
  
  emails[folder].push(emailData);
  
  // 保存到数据库
  await fetch(`${apiUrl}/set/${userEmailKey}`, {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ value: JSON.stringify(emails) })
  });
}
