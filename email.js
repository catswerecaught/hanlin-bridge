document.addEventListener('DOMContentLoaded', () => {
    // 检查用户登录状态
    let currentUser = null;
    try {
        currentUser = JSON.parse(localStorage.getItem('loginUser'));
    } catch (e) {
        currentUser = null;
    }

    if (!currentUser) {
        alert('请先登录以使用邮件功能');
        window.location.href = 'index.html';
        return;
    }

    // DOM 元素
    const composeBtn = document.getElementById('composeBtn');
    const composeArea = document.getElementById('composeArea');
    const readingArea = document.getElementById('readingArea');
    const emailDetail = document.getElementById('emailDetail');
    const cancelComposeBtn = document.getElementById('cancelComposeBtn');
    const sendBtn = document.getElementById('sendBtn');
    const saveDraftBtn = document.getElementById('saveDraftBtn');
    const refreshBtn = document.getElementById('refreshBtn');
    const selectAllBtn = document.getElementById('selectAllBtn');
    const searchInput = document.getElementById('searchInput');
    const emailItems = document.getElementById('emailItems');
    const userEmailAddress = document.getElementById('userEmailAddress');
    const composeForm = document.getElementById('composeForm');
    
    // 文件夹相关元素
    const folderItems = document.querySelectorAll('.folder-item');
    const emailListTitle = document.querySelector('.email-list-title');
    
    // 计数元素
    const inboxCount = document.getElementById('inboxCount');
    const sentCount = document.getElementById('sentCount');
    const draftsCount = document.getElementById('draftsCount');
    const deletedCount = document.getElementById('deletedCount');

    // 当前状态
    let currentFolder = 'inbox';
    let selectedEmails = new Set();
    let emails = {
        inbox: [],
        sent: [],
        drafts: [],
        deleted: []
    };
    let currentEmailId = null;

    // 生成用户邮箱地址
    function generateUserEmail(username) {
        return `${username}@oceantie.top`;
    }

    // 显示用户邮箱地址
    const userEmail = generateUserEmail(currentUser.username);
    userEmailAddress.textContent = userEmail;

    // 根据用户名获取显示名称（优先 users 列表中的 name）
    function displayNameFromUsername(username) {
        if (!username) return '';
        const u = (typeof users !== 'undefined' && Array.isArray(users)) ? users.find(u => u.username === username) : null;
        return u ? (u.name || username) : username;
    }

    // 设置页眉头像（保障该页独立运行时也能显示头像）
    function setHeaderAvatarEmailPage(user) {
        const avatar = document.getElementById('userAvatar');
        if (!avatar) return;
        avatar.innerHTML = '';
        if (user) {
            avatar.classList.add('logged-in');
            const img = document.createElement('img');
            img.src = user.avatar || 'images/user00001.jpg';
            img.alt = user.name;
            img.className = 'user-avatar-img';
            avatar.appendChild(img);
            const badge = document.createElement('img');
            badge.className = 'vip-badge';
            if (user.vip === 'Pro会员') {
                badge.src = 'images/vip-pro.png';
                badge.alt = 'Pro会员';
            } else {
                badge.src = 'images/vip-normal.png';
                badge.alt = '普通会员';
            }
            avatar.appendChild(badge);
        } else {
            avatar.classList.remove('logged-in');
            const img = document.createElement('img');
            img.src = 'images/login-default.png';
            img.alt = '登录';
            img.id = 'avatarImg';
            avatar.appendChild(img);
        }
    }
    setHeaderAvatarEmailPage(currentUser);

    // 获取用户头像初始字母
    function getAvatarInitial(name) {
        return name ? name.charAt(0).toUpperCase() : '?';
    }

    // 格式化时间
    function formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        const diffDays = Math.floor(diff / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) {
            return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        } else if (diffDays === 1) {
            return '昨天';
        } else if (diffDays < 7) {
            return `${diffDays}天前`;
        } else {
            return date.toLocaleDateString('zh-CN');
        }
    }

    // 验证邮箱地址
    function validateEmail(email) {
        const pattern = /^[a-zA-Z0-9._%+-]+@oceantie\.top$/;
        return pattern.test(email);
    }

    // 检查用户是否存在
    function isValidUser(email) {
        const username = email.split('@')[0];
        return users.some(user => user.username === username);
    }

    // 根据用户名获取用户信息
    function getUserByUsername(username) {
        return users.find(user => user.username === username);
    }

    // 切换视图
    function showComposeArea() {
        composeArea.style.display = 'flex';
        readingArea.style.display = 'none';
        emailDetail.style.display = 'none';
        clearComposeForm();
    }

    function showReadingArea() {
        composeArea.style.display = 'none';
        readingArea.style.display = 'flex';
        emailDetail.style.display = 'none';
    }

    function showEmailDetail() {
        composeArea.style.display = 'none';
        readingArea.style.display = 'none';
        emailDetail.style.display = 'block';
    }

    // 清空撰写表单
    function clearComposeForm() {
        document.getElementById('toInput').value = '';
        document.getElementById('ccInput').value = '';
        document.getElementById('subjectInput').value = '';
        document.getElementById('bodyInput').value = '';
    }

    function ensureEmailShape(obj) {
        const empty = { inbox: [], sent: [], drafts: [], deleted: [] };
        return {
            inbox: Array.isArray(obj?.inbox) ? obj.inbox : [],
            sent: Array.isArray(obj?.sent) ? obj.sent : [],
            drafts: Array.isArray(obj?.drafts) ? obj.drafts : [],
            deleted: Array.isArray(obj?.deleted) ? obj.deleted : []
        };
    }

    // 加载邮件数据
    async function loadEmails() {
        try {
            const response = await fetch('/api/emails', {
                headers: {
                    'Authorization': `Bearer ${currentUser.username}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                emails = ensureEmailShape(data.emails);
            } else {
                // 如果API失败，使用本地存储
                const savedEmails = localStorage.getItem(`emails_${currentUser.username}`);
                if (savedEmails) {
                    emails = ensureEmailShape(JSON.parse(savedEmails));
                } else {
                    // 创建示例邮件数据
                    emails = ensureEmailShape({
                        inbox: [
                            {
                                id: 'demo_' + Date.now(),
                                from: 'system@oceantie.top',
                                fromName: '系统管理员',
                                to: userEmail,
                                subject: '欢迎使用翰林桥邮件系统',
                                body: `亲爱的 ${currentUser.name},\n\n欢迎使用翰林桥邮件系统！\n\n您的邮箱地址是：${userEmail}\n\n您可以与系统中的其他用户进行邮件通信。\n\n祝您使用愉快！\n\n翰林桥团队`,
                                timestamp: Date.now() - 3600000, // 1小时前
                                read: false,
                                attachments: []
                            }
                        ],
                        sent: [],
                        drafts: [],
                        deleted: []
                    });
                    saveEmailsToLocal();
                }
            }
        } catch (error) {
            console.error('加载邮件失败:', error);
            // 使用默认数据
            emails = { inbox: [], sent: [], drafts: [], deleted: [] };
        }
        
        updateEmailCounts();
        renderEmailList();
    }

    // 保存邮件到本地存储
    function saveEmailsToLocal() {
        localStorage.setItem(`emails_${currentUser.username}`, JSON.stringify(emails));
    }

    // 更新邮件数量显示
    function updateEmailCounts() {
        const inbox = Array.isArray(emails?.inbox) ? emails.inbox : [];
        // 仅收件箱显示未读数
        const unread = inbox.filter(email => !email.read).length;
        inboxCount.textContent = String(unread);
        inboxCount.style.display = unread > 0 ? 'inline-block' : 'none';
        // 其他文件夹不显示计数
        sentCount.textContent = '';
        draftsCount.textContent = '';
        deletedCount.textContent = '';
        sentCount.style.display = 'none';
        draftsCount.style.display = 'none';
        deletedCount.style.display = 'none';
    }

    // 渲染邮件列表
    function renderEmailList() {
        const folderEmails = emails[currentFolder] || [];
        // 新邮件置顶：按时间倒序
        const folderEmailsSorted = [...folderEmails].sort((a, b) => (b?.timestamp || 0) - (a?.timestamp || 0));
        emailItems.innerHTML = '';

        if (folderEmailsSorted.length === 0) {
            emailItems.innerHTML = `
                <div style="padding: 40px 16px; text-align: center; color: #8a8886;">
                    <div style="margin-bottom: 8px; display: inline-block;">
                        <svg class="icon-lg icon-primary" viewBox="0 0 64 64" aria-hidden="true"><path d="M8 16h48a4 4 0 0 1 4 4v28a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V20a4 4 0 0 1 4-4zm0 6v26h48V22l-24 14L8 22z"/></svg>
                    </div>
                    <div>该文件夹为空</div>
                </div>
            `;
            return;
        }
        
        const iconPaperclip = '<svg class="icon icon-primary" viewBox="0 0 24 24" aria-hidden="true"><path d="M16.5 6.5l-7.78 7.78a3 3 0 1 0 4.24 4.24l7.07-7.07a5 5 0 1 0-7.07-7.07L5.64 11.7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        folderEmailsSorted.forEach(email => {
            const emailDiv = document.createElement('div');
            emailDiv.className = `email-item ${!email.read ? 'unread' : ''}`;
            emailDiv.dataset.emailId = email.id;
            
            const senderName = email.fromName || displayNameFromUsername((email.from || '').split('@')[0]);
            const senderInitial = getAvatarInitial(senderName);
            const fromEmail = email.from || '';
            const preview = email.body.substring(0, 80) + (email.body.length > 80 ? '...' : '');
            
            emailDiv.innerHTML = `
                <div class="email-top">
                  <div class="email-left">
                    <div class="email-avatar">${senderInitial}</div>
                    <div style="min-width:0;">
                      <div class="email-sender">${senderName}</div>
                      <div class="email-from">${fromEmail.split('@')[0]}@${(fromEmail.split('@')[1]||'')}</div>
                    </div>
                  </div>
                  <div class="email-time">${formatTime(email.timestamp)}</div>
                </div>
                <div class="email-subject">${email.subject}</div>
                <div class="email-preview">${preview}</div>
                <div class="email-meta">
                    ${email.attachments && email.attachments.length > 0 ? `<div class="email-attachment">${iconPaperclip}</div>` : ''}
                </div>
            `;
            
            emailDiv.addEventListener('click', () => {
                // 移除其他邮件的激活状态
                document.querySelectorAll('.email-item').forEach(item => {
                    item.classList.remove('active');
                });
                
                // 激活当前邮件
                emailDiv.classList.add('active');
                
                // 显示邮件详情
                showEmailDetail();
                displayEmailDetail(email);
                
                // 标记为已读（前端与后端同步）
                if (!email.read) {
                    email.read = true;
                    emailDiv.classList.remove('unread');
                    updateEmailCounts();
                    saveEmailsToLocal();
                    // 后端同步
                    syncRead(email.id, currentFolder).catch(() => {});
                }
            });
            
            emailItems.appendChild(emailDiv);
        });
    }

    // 显示邮件详情
    function displayEmailDetail(email) {
        currentEmailId = email.id;
        
        document.getElementById('detailSubject').textContent = email.subject;
        document.getElementById('detailSenderName').textContent = email.fromName || displayNameFromUsername((email.from || '').split('@')[0]);
        document.getElementById('detailSenderEmail').textContent = email.from;
        document.getElementById('detailTime').textContent = new Date(email.timestamp).toLocaleString('zh-CN');
        document.getElementById('detailBody').innerHTML = email.body.replace(/\n/g, '<br>');
        
        // 设置头像
        const avatar = document.getElementById('detailAvatar');
        const initial = getAvatarInitial(email.fromName || email.from.split('@')[0]);
        avatar.textContent = initial;
        
        // 绑定操作按钮
        document.getElementById('replyBtn').onclick = () => replyToEmail(email);
        document.getElementById('forwardBtn').onclick = () => forwardEmail(email);
        document.getElementById('deleteBtn').onclick = () => deleteEmail(email.id);
    }

    // 回复邮件
    function replyToEmail(originalEmail) {
        showComposeArea();
        document.getElementById('toInput').value = originalEmail.from;
        document.getElementById('subjectInput').value = `Re: ${originalEmail.subject}`;
        document.getElementById('bodyInput').value = `\n\n--- 原始邮件 ---\n发件人: ${originalEmail.from}\n时间: ${new Date(originalEmail.timestamp).toLocaleString('zh-CN')}\n主题: ${originalEmail.subject}\n\n${originalEmail.body}`;
    }

    // 转发邮件
    function forwardEmail(originalEmail) {
        showComposeArea();
        document.getElementById('subjectInput').value = `Fwd: ${originalEmail.subject}`;
        document.getElementById('bodyInput').value = `\n\n--- 转发邮件 ---\n发件人: ${originalEmail.from}\n时间: ${new Date(originalEmail.timestamp).toLocaleString('zh-CN')}\n主题: ${originalEmail.subject}\n\n${originalEmail.body}`;
    }

    // 删除邮件
    async function deleteEmail(emailId) {
        if (!confirm('确定要删除这封邮件吗？')) return;
        try {
            const resp = await fetch(`/api/emails?emailId=${encodeURIComponent(emailId)}&folder=${encodeURIComponent(currentFolder)}` , {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${currentUser.username}` }
            });
            if (!resp.ok) throw new Error('删除失败');
            // 重新拉取，确保进入“已删除邮件”并按后端状态展示
            await loadEmails();
            // 从非 deleted 删除时，自动切换到已删除
            if (currentFolder !== 'deleted') selectFolder('deleted');
            showReadingArea();
        } catch (e) {
            alert('删除失败，请稍后重试');
        }
    }

    async function syncRead(emailId, folder) {
        try {
            await fetch('/api/emails', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${currentUser.username}`
                },
                body: JSON.stringify({ emailId, folder, updates: { read: true } })
            });
        } catch {}
    }

    // 发送邮件
    async function sendEmail(emailData) {
        try {
            const response = await fetch('/api/emails', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${currentUser.username}`
                },
                body: JSON.stringify({ action: 'send', ...emailData })
            });
            
            if (response.ok) {
                return await response.json();
            } else {
                throw new Error('发送失败');
            }
        } catch (error) {
            console.error('发送邮件失败:', error);
            // 降级到本地处理
            return sendEmailLocally(emailData);
        }
    }

    // 本地发送邮件处理
    function sendEmailLocally(emailData) {
        const emailId = 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        // 添加到发件箱
        const sentEmail = {
            id: emailId,
            from: userEmail,
            fromName: currentUser.name,
            to: emailData.to,
            cc: emailData.cc,
            subject: emailData.subject,
            body: emailData.body,
            timestamp: Date.now(),
            read: true,
            attachments: []
        };
        
        emails.sent.push(sentEmail);
        
        // 如果收件人是系统内用户，添加到其收件箱
        const recipientUsername = emailData.to.split('@')[0];
        if (isValidUser(emailData.to)) {
            // 模拟添加到收件人收件箱（实际应该通过API处理）
            const recipientEmails = JSON.parse(localStorage.getItem(`emails_${recipientUsername}`) || '{"inbox":[], "sent":[], "drafts":[], "deleted":[]}');
            
            const receivedEmail = {
                id: emailId + '_received',
                from: userEmail,
                fromName: currentUser.name,
                to: emailData.to,
                cc: emailData.cc,
                subject: emailData.subject,
                body: emailData.body,
                timestamp: Date.now(),
                read: false,
                attachments: []
            };
            
            recipientEmails.inbox.push(receivedEmail);
            localStorage.setItem(`emails_${recipientUsername}`, JSON.stringify(recipientEmails));
        }
        
        saveEmailsToLocal();
        return { success: true, emailId };
    }

    // 保存草稿
    function saveDraft() {
        const draftData = {
            id: 'draft_' + Date.now(),
            from: userEmail,
            fromName: currentUser.name,
            to: document.getElementById('toInput').value,
            cc: document.getElementById('ccInput').value,
            subject: document.getElementById('subjectInput').value,
            body: document.getElementById('bodyInput').value,
            timestamp: Date.now(),
            read: true,
            attachments: []
        };
        
        emails.drafts.push(draftData);
        updateEmailCounts();
        saveEmailsToLocal();
        
        alert('草稿已保存');
        showReadingArea();
        clearComposeForm();
    }

    // 搜索邮件
    function searchEmails(query) {
        const q = query.trim().toLowerCase();
        const folderEmails = emails[currentFolder] || [];
        // 按时间倒序
        const listBase = !q ? folderEmails : folderEmails.filter(email =>
            (email.subject || '').toLowerCase().includes(q) ||
            (email.body || '').toLowerCase().includes(q) ||
            (email.from || '').toLowerCase().includes(q) ||
            (email.fromName || '').toLowerCase().includes(q)
        );
        const list = [...listBase].sort((a, b) => (b?.timestamp || 0) - (a?.timestamp || 0));

        emailItems.innerHTML = '';
        if (list.length === 0) {
            emailItems.innerHTML = '<div style="padding: 40px 16px; text-align: center; color: #8a8886;">未找到匹配的邮件</div>';
            return;
        }
        const iconPaperclip = '<svg class="icon icon-primary" viewBox="0 0 24 24" aria-hidden="true"><path d="M16.5 6.5l-7.78 7.78a3 3 0 1 0 4.24 4.24l7.07-7.07a5 5 0 1 0-7.07-7.07L5.64 11.7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        list.forEach(email => {
            const emailDiv = document.createElement('div');
            emailDiv.className = `email-item ${!email.read ? 'unread' : ''}`;
            emailDiv.dataset.emailId = email.id;
            const senderName = email.fromName || displayNameFromUsername((email.from || '').split('@')[0]);
            const preview = (email.body || '').substring(0, 80) + ((email.body || '').length > 80 ? '...' : '');
            emailDiv.innerHTML = `
                <div class="email-sender">${senderName}</div>
                <div class="email-subject">${email.subject || ''}</div>
                <div class="email-preview">${preview}</div>
                <div class="email-meta">
                    <div class="email-time">${formatTime(email.timestamp)}</div>
                    ${email.attachments && email.attachments.length > 0 ? `<div class=\"email-attachment\">${iconPaperclip}</div>` : ''}
                </div>`;
            emailDiv.addEventListener('click', () => {
                document.querySelectorAll('.email-item').forEach(item => item.classList.remove('active'));
                emailDiv.classList.add('active');
                showEmailDetail();
                displayEmailDetail(email);
                if (!email.read) {
                    email.read = true;
                    emailDiv.classList.remove('unread');
                    updateEmailCounts();
                    saveEmailsToLocal();
                }
            });
            emailItems.appendChild(emailDiv);
        });
    }

    // 事件监听器
    composeBtn.addEventListener('click', showComposeArea);
    cancelComposeBtn.addEventListener('click', () => {
        showReadingArea();
        clearComposeForm();
    });
    
    saveDraftBtn.addEventListener('click', saveDraft);
    // 发送按钮在表单外部，手动触发表单提交
    sendBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (composeForm) {
            // 使用浏览器原生提交流程，触发我们注册的 submit 监听
            if (typeof composeForm.requestSubmit === 'function') {
                composeForm.requestSubmit();
            } else {
                composeForm.dispatchEvent(new Event('submit', { cancelable: true }));
            }
        }
    });
    // 刷新按钮：点击旋转一周并触发拉取
    refreshBtn.addEventListener('click', async () => {
        try {
            refreshBtn.classList.add('spinning');
            await loadEmails();
        } finally {
            setTimeout(() => refreshBtn.classList.remove('spinning'), 800);
        }
    });
    
    // 发送邮件表单提交
    composeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const toEmail = document.getElementById('toInput').value.trim();
        const subject = document.getElementById('subjectInput').value.trim();
        const body = document.getElementById('bodyInput').value.trim();
        
        if (!toEmail || !subject || !body) {
            alert('请填写所有必填字段');
            return;
        }
        
        if (!validateEmail(toEmail)) {
            alert('请输入有效的邮箱地址（格式：username@oceantie.top）');
            return;
        }
        // 禁止给自己发邮件
        if (toEmail.toLowerCase() === userEmail.toLowerCase()) {
            alert('不能给自己发送邮件');
            return;
        }
        
        if (!isValidUser(toEmail)) {
            alert('收件人不存在，请检查邮箱地址');
            return;
        }
        
        const emailData = {
            to: toEmail,
            cc: document.getElementById('ccInput').value.trim(),
            subject: subject,
            body: body
        };
        
        sendBtn.disabled = true;
        sendBtn.textContent = '发送中...';
        
        try {
            const result = await sendEmail(emailData);
            if (result.success) {
                alert('邮件发送成功');
                // 重新从服务器拉取，确保与Upstash同步
                await loadEmails();
                // 切换到已发送并展示最新列表
                selectFolder('sent');
                clearComposeForm();
            } else {
                alert('邮件发送失败，请重试');
            }
        } catch (error) {
            alert('邮件发送失败：' + error.message);
        } finally {
            sendBtn.disabled = false;
            sendBtn.textContent = '发送';
        }
    });
    
    // 程序化选择文件夹
    function selectFolder(folderKey) {
        currentFolder = folderKey;
        // 更新左侧激活态
        document.querySelectorAll('.folder-item').forEach(li => {
            if (li.dataset.folder === folderKey) li.classList.add('active');
            else li.classList.remove('active');
        });
        // 更新标题
        const folderNames = { inbox: '收件箱', sent: '已发送邮件', drafts: '草稿箱', deleted: '已删除邮件' };
        emailListTitle.textContent = folderNames[folderKey] || '邮件';
        // 渲染
        renderEmailList();
        showReadingArea();
    }

    // 文件夹切换
    folderItems.forEach(item => {
        item.addEventListener('click', () => {
            // 移除所有激活状态
            folderItems.forEach(f => f.classList.remove('active'));
            
            // 激活当前文件夹
            item.classList.add('active');
            
            // 更新当前文件夹
            currentFolder = item.dataset.folder;
            
            // 更新标题
            const folderNames = {
                inbox: '收件箱',
                sent: '已发送邮件',
                drafts: '草稿箱',
                deleted: '已删除邮件'
            };
            emailListTitle.textContent = folderNames[currentFolder];
            
            // 重新渲染邮件列表
            renderEmailList();
            showReadingArea();
        });
    });
    
    // 搜索功能
    searchInput.addEventListener('input', (e) => {
        searchEmails(e.target.value);
    });
    
    // 全选功能（简化实现）
    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', () => {
            const emailItems = document.querySelectorAll('.email-item');
            emailItems.forEach(item => {
                item.classList.toggle('selected');
            });
        });
    }
    
    // 初始化
    loadEmails();
});
