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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 验证授权
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '需要授权' });
  }
  const username = authHeader.replace('Bearer ', '');

  try {
    const { to, cc, subject, body } = req.body || {};
    if (!to || !subject || !body) {
      return res.status(400).json({ error: '缺少必填字段' });
    }
    if (!String(to).endsWith('@oceantie.top')) {
      return res.status(400).json({ error: '只能发送给 @oceantie.top 邮箱地址' });
    }

    const emailId = await generateEmailId(apiUrl, apiToken);
    const timestamp = Date.now();
    const senderEmail = `${username}@oceantie.top`;

    const emailData = {
      id: emailId,
      from: senderEmail,
      fromName: await getUserDisplayName(username),
      to,
      cc: cc || '',
      subject,
      body,
      timestamp,
      read: true,
      attachments: []
    };

    // 1. 添加到发件人的已发送
    await addEmailToFolder(apiUrl, apiToken, username, 'sent', emailData);

    // 2. 添加到收件人的收件箱
    const recipientUsername = to.split('@')[0];
    const receivedEmail = { ...emailData, id: `${emailId}_received`, read: false };
    await addEmailToFolder(apiUrl, apiToken, recipientUsername, 'inbox', receivedEmail);

    // 3. 抄送
    if (cc) {
      const ccEmails = String(cc).split(',').map(e => e.trim()).filter(e => e && e.endsWith('@oceantie.top') && e !== to);
      for (const ccEmail of ccEmails) {
        const ccUsername = ccEmail.split('@')[0];
        const ccEmailData = { ...emailData, id: `${emailId}_cc_${ccUsername}`, read: false };
        await addEmailToFolder(apiUrl, apiToken, ccUsername, 'inbox', ccEmailData);
      }
    }

    return res.status(200).json({ success: true, emailId, message: '邮件发送成功' });
  } catch (err) {
    console.error('发送邮件失败:', err);
    return res.status(500).json({ error: '发送邮件失败' });
  }
}

async function generateEmailId(apiUrl, apiToken) {
  try {
    const response = await fetch(`${apiUrl}/incr/${EMAIL_COUNTER_KEY}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiToken}` }
    });
    const data = await response.json();
    const counter = data.result || 1;
    return `email_${Date.now()}_${counter}`;
  } catch (e) {
    return `email_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

async function getUserDisplayName(username) {
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

async function addEmailToFolder(apiUrl, apiToken, username, folder, emailData) {
  const userEmailKey = `${EMAIL_KEY_PREFIX}${username}`;
  const resp = await fetch(`${apiUrl}/get/${userEmailKey}`, { headers: { 'Authorization': `Bearer ${apiToken}` } });
  const data = await resp.json();
  let emails = data.result ? JSON.parse(data.result) : { inbox: [], sent: [], drafts: [], deleted: [] };
  if (!Array.isArray(emails[folder])) emails[folder] = [];
  emails[folder].push(emailData);
  await fetch(`${apiUrl}/set/${userEmailKey}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: JSON.stringify(emails) })
  });
}
