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
                emails = data.emails || { inbox: [], sent: [], drafts: [], deleted: [] };
            } else {
                // 如果API失败，使用本地存储
                const savedEmails = localStorage.getItem(`emails_${currentUser.username}`);
                if (savedEmails) {
                    emails = JSON.parse(savedEmails);
                } else {
                    // 创建示例邮件数据
                    emails = {
                        inbox: [
                            {
                                id: 'demo_' + Date.now(),
                                from: 'system@oceantie.top',
                                fromName: '系统管理员',
                                to: userEmail,
                                subject: '欢迎使用翰林桥邮件系统',
                                body: `亲爱的 ${currentUser.name}，\n\n欢迎使用翰林桥邮件系统！\n\n您的邮箱地址是：${userEmail}\n\n您可以与系统中的其他用户进行邮件通信。\n\n祝您使用愉快！\n\n翰林桥团队`,
                                timestamp: Date.now() - 3600000, // 1小时前
                                read: false,
                                attachments: []
                            }
                        ],
                        sent: [],
                        drafts: [],
                        deleted: []
                    };
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
        inboxCount.textContent = emails.inbox.filter(email => !email.read).length;
        sentCount.textContent = emails.sent.length;
        draftsCount.textContent = emails.drafts.length;
        deletedCount.textContent = emails.deleted.length;
        
        // 隐藏计数为0的标签
        [inboxCount, sentCount, draftsCount, deletedCount].forEach(el => {
            if (parseInt(el.textContent) === 0) {
                el.style.display = 'none';
            } else {
                el.style.display = 'inline-block';
            }
        });
    }

    // 渲染邮件列表
    function renderEmailList() {
        const folderEmails = emails[currentFolder] || [];
        emailItems.innerHTML = '';
        
        if (folderEmails.length === 0) {
            emailItems.innerHTML = `
                <div style="padding: 40px 16px; text-align: center; color: #8a8886;">
                    <div style="font-size: 24px; margin-bottom: 8px;">📭</div>
                    <div>该文件夹为空</div>
                </div>
            `;
            return;
        }
        
        folderEmails.forEach(email => {
            const emailDiv = document.createElement('div');
            emailDiv.className = `email-item ${!email.read ? 'unread' : ''}`;
            emailDiv.dataset.emailId = email.id;
            
            const senderName = email.fromName || email.from.split('@')[0];
            const preview = email.body.substring(0, 80) + (email.body.length > 80 ? '...' : '');
            
            emailDiv.innerHTML = `
                <div class="email-sender">${senderName}</div>
                <div class="email-subject">${email.subject}</div>
                <div class="email-preview">${preview}</div>
                <div class="email-meta">
                    <div class="email-time">${formatTime(email.timestamp)}</div>
                    ${email.attachments && email.attachments.length > 0 ? '<div class="email-attachment">📎</div>' : ''}
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
                
                // 标记为已读
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

    // 显示邮件详情
    function displayEmailDetail(email) {
        currentEmailId = email.id;
        
        document.getElementById('detailSubject').textContent = email.subject;
        document.getElementById('detailSenderName').textContent = email.fromName || email.from.split('@')[0];
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
    function deleteEmail(emailId) {
        if (confirm('确定要删除这封邮件吗？')) {
            // 从当前文件夹移除邮件
            const emailIndex = emails[currentFolder].findIndex(email => email.id === emailId);
            if (emailIndex !== -1) {
                const email = emails[currentFolder].splice(emailIndex, 1)[0];
                
                // 如果不是从已删除文件夹删除，则移动到已删除文件夹
                if (currentFolder !== 'deleted') {
                    emails.deleted.push(email);
                }
                
                updateEmailCounts();
                renderEmailList();
                showReadingArea();
                saveEmailsToLocal();
            }
        }
    }

    // 发送邮件
    async function sendEmail(emailData) {
        try {
            const response = await fetch('/api/emails/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${currentUser.username}`
                },
                body: JSON.stringify(emailData)
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
        if (!query.trim()) {
            renderEmailList();
            return;
        }
        
        const folderEmails = emails[currentFolder] || [];
        const filteredEmails = folderEmails.filter(email => 
            email.subject.toLowerCase().includes(query.toLowerCase()) ||
            email.body.toLowerCase().includes(query.toLowerCase()) ||
            email.from.toLowerCase().includes(query.toLowerCase()) ||
            (email.fromName && email.fromName.toLowerCase().includes(query.toLowerCase()))
        );
        
        emailItems.innerHTML = '';
        filteredEmails.forEach(email => {
            // 使用相同的渲染逻辑，但应用到过滤后的邮件
            // 这里简化处理，实际可以抽取成公共函数
        });
    }

    // 事件监听器
    composeBtn.addEventListener('click', showComposeArea);
    cancelComposeBtn.addEventListener('click', () => {
        showReadingArea();
        clearComposeForm();
    });
    
    saveDraftBtn.addEventListener('click', saveDraft);
    refreshBtn.addEventListener('click', loadEmails);
    
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
                showReadingArea();
                clearComposeForm();
                updateEmailCounts();
                
                // 如果当前在发件箱，刷新列表
                if (currentFolder === 'sent') {
                    renderEmailList();
                }
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
    selectAllBtn.addEventListener('click', () => {
        const emailItems = document.querySelectorAll('.email-item');
        emailItems.forEach(item => {
            item.classList.toggle('selected');
        });
    });
    
    // 初始化
    loadEmails();
});
