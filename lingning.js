// 灵凝AI聊天功能
document.addEventListener('DOMContentLoaded', function() {
    const chatContainer = document.getElementById('chatContainer');
    const chatMessages = document.getElementById('chatMessages');
    const welcomeScreen = document.getElementById('welcomeScreen');
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    const charCount = document.getElementById('charCount');
    const newChatBtn = document.getElementById('newChatBtn');
    const chatHistory = document.getElementById('chatHistory');
    const userInfo = document.getElementById('userInfo');
    const insufficientPointsModal = document.getElementById('insufficientPointsModal');
    const currentPointsSpan = document.getElementById('currentPoints');
    
    let currentChatId = null;
    let chatHistoryData = [];
    let userBalance = 0;
    
    // 初始化
    init();
    
    function init() {
        loadUserInfo();
        loadChatHistory();
        renderChatHistory();
        
        // 事件监听
        chatInput.addEventListener('input', handleInputChange);
        chatInput.addEventListener('keydown', handleKeyDown);
        sendBtn.addEventListener('click', sendMessage);
        newChatBtn.addEventListener('click', startNewChat);
        
        // 关闭积分不足弹窗
        document.getElementById('insufficientPointsCloseBtn').addEventListener('click', function() {
            insufficientPointsModal.classList.remove('show');
        });
    }
    
    function loadUserInfo() {
        const user = getLoginUser();
        if (user) {
            // 加载用户积分
            fetch(`/api/health?service=balance&user=${user.username}`)
                .then(response => response.json())
                .then(data => {
                    userBalance = data.amount || 0;
                    updateUserInfo(user);
                    currentPointsSpan.textContent = userBalance;
                })
                .catch(error => {
                    console.error('加载用户积分失败:', error);
                    userBalance = 0;
                });
        }
    }
    
    function updateUserInfo(user) {
        const userAvatar = userInfo.querySelector('.user-avatar-small');
        const userName = userInfo.querySelector('.user-name');
        const userPoints = userInfo.querySelector('.user-points');
        
        userAvatar.src = user.avatar || 'images/login-default.png';
        userName.textContent = user.username;
        userPoints.textContent = `积分: ${userBalance}`;
    }
    
    function loadChatHistory() {
        const user = getLoginUser();
        if (user) {
            const saved = localStorage.getItem(`chatHistory_${user.username}`);
            if (saved) {
                try {
                    chatHistoryData = JSON.parse(saved);
                } catch (e) {
                    chatHistoryData = [];
                }
            }
        }
    }
    
    function saveChatHistory() {
        const user = getLoginUser();
        if (user) {
            localStorage.setItem(`chatHistory_${user.username}`, JSON.stringify(chatHistoryData));
        }
    }
    
    function renderChatHistory() {
        chatHistory.innerHTML = '';
        
        chatHistoryData.forEach(chat => {
            const chatItem = document.createElement('div');
            chatItem.className = 'chat-history-item';
            chatItem.dataset.chatId = chat.id;
            
            const chatContent = document.createElement('div');
            chatContent.className = 'chat-history-content';
            chatContent.textContent = chat.title;
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'chat-delete-btn';
            deleteBtn.innerHTML = '⋮';
            deleteBtn.title = '删除对话';
            
            const deleteMenu = document.createElement('div');
            deleteMenu.className = 'delete-menu';
            deleteMenu.innerHTML = '<div class="delete-option">删除对话</div>';
            
            chatItem.appendChild(chatContent);
            chatItem.appendChild(deleteBtn);
            chatItem.appendChild(deleteMenu);
            
            // 点击聊天项
            chatItem.addEventListener('click', (e) => {
                // 如果点击的是删除按钮或菜单，不跳转
                if (e.target === deleteBtn || deleteMenu.contains(e.target)) {
                    return;
                }
                loadChat(chat.id);
            });
            
            // 点击三个点按钮显示删除菜单
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                // 隐藏其他所有删除菜单
                document.querySelectorAll('.delete-menu').forEach(menu => {
                    if (menu !== deleteMenu) {
                        menu.classList.remove('show');
                    }
                });
                // 切换当前删除菜单
                deleteMenu.classList.toggle('show');
            });
            
            // 删除对话
            deleteMenu.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteChat(chat.id);
            });
            
            chatHistory.appendChild(chatItem);
        });
    }
    
    function deleteChat(chatId) {
        chatHistoryData = chatHistoryData.filter(chat => chat.id !== chatId);
        saveChatHistory();
        renderChatHistory();
        
        if (currentChatId === chatId) {
            currentChatId = null;
            showWelcomeScreen();
        }
    }
    
    function startNewChat() {
        currentChatId = Date.now().toString();
        const newChat = {
            id: currentChatId,
            title: '新对话',
            messages: [],
            timestamp: Date.now()
        };
        
        chatHistoryData.unshift(newChat);
        saveChatHistory();
        renderChatHistory();
        
        showWelcomeScreen();
    }
    
    function loadChat(chatId) {
        currentChatId = chatId;
        const chat = chatHistoryData.find(c => c.id === chatId);
        if (chat) {
            renderMessages(chat.messages);
        }
    }
    
    function showWelcomeScreen() {
        welcomeScreen.style.display = 'flex';
        chatMessages.style.display = 'none';
        chatMessages.innerHTML = '';
    }
    
    function renderMessages(messages) {
        if (messages.length === 0) {
            showWelcomeScreen();
            return;
        }
        
        welcomeScreen.style.display = 'none';
        chatMessages.style.display = 'block';
        chatMessages.innerHTML = '';
        
        messages.forEach(message => {
            const messageElement = createMessageElement(message);
            chatMessages.appendChild(messageElement);
        });
        
        scrollToBottom();
    }
    
    function createMessageElement(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${message.role}`;
        
        const content = document.createElement('div');
        content.className = 'message-content';
        
        const text = document.createElement('div');
        text.className = 'message-text';
        if (message.role === 'assistant') {
            text.innerHTML = renderMarkdown(message.content);
        } else {
            text.textContent = message.content;
        }
        
        const time = document.createElement('div');
        time.className = 'message-time';
        time.textContent = formatTime(message.timestamp);
        
        content.appendChild(text);
        content.appendChild(time);
        messageDiv.appendChild(content);
        
        return messageDiv;
    }
    
    // 简单Markdown渲染（仅支持换行、粗体、斜体、代码）
    function renderMarkdown(text) {
        if (!text) return '';
        let html = text
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`([^`]+)`/g, '<code>$1</code>');
        return html;
    }
    
    function formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('zh-CN', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }
    
    function handleInputChange() {
        const text = chatInput.value.trim();
        sendBtn.disabled = !text;
        
        const count = chatInput.value.length;
        charCount.textContent = `${count}/4000`;
        
        autoResizeTextarea();
    }
    
    function handleKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!sendBtn.disabled) {
                sendMessage();
            }
        }
    }
    
    function autoResizeTextarea() {
        chatInput.style.height = 'auto';
        chatInput.style.height = Math.min(chatInput.scrollHeight, 200) + 'px';
    }
    
    async function sendMessage() {
        const text = chatInput.value.trim();
        if (!text) return;
        
        // 检查积分
        if (userBalance < 35) {
            insufficientPointsModal.classList.add('show');
            return;
        }
        
        // 如果没有当前对话，创建新对话
        if (!currentChatId) {
            startNewChat();
        }
        
        // 添加用户消息
        const userMessage = {
            role: 'user',
            content: text,
            timestamp: Date.now()
        };
        
        addMessageToChat(userMessage);
        
        // 清空输入框
        chatInput.value = '';
        handleInputChange();
        
        // 显示AI回复loading
        const aiMessage = {
            role: 'assistant',
            content: '',
            timestamp: Date.now()
        };
        
        const aiMessageElement = createMessageElement(aiMessage);
        aiMessageElement.querySelector('.message-text').innerHTML = '<div class="loading-dots"><div class="loading-dot"></div><div class="loading-dot"></div><div class="loading-dot"></div></div>';
        chatMessages.appendChild(aiMessageElement);
        scrollToBottom();
        
        try {
            // 调用AI API
            const response = await callAIAPI(text);
            
            // 移除loading的AI消息
            aiMessageElement.remove();
            
            // 保存AI消息到本地历史（会自动渲染）
            aiMessage.content = response;
            addMessageToChat(aiMessage);
            
            // 扣除积分
            await deductPoints();
            
            // 更新聊天标题
            updateChatTitle(text);
            
        } catch (error) {
            console.error('AI API调用失败:', error);
            let errorMessage = '抱歉，AI服务暂时不可用，请稍后重试。';
            
            if (error.message.includes('429')) {
                errorMessage = 'AI服务暂时繁忙，请稍后再试。';
            } else if (error.message.includes('401')) {
                errorMessage = 'AI服务认证失败，请联系管理员。';
            } else if (error.message.includes('403')) {
                errorMessage = 'AI服务访问被拒绝，请联系管理员。';
            } else if (error.message.includes('500')) {
                errorMessage = 'AI服务内部错误，请稍后重试。';
            } else if (error.message.includes('API key not found')) {
                errorMessage = 'AI服务配置错误，请联系管理员。';
            }
            aiMessageElement.querySelector('.message-text').textContent = errorMessage;
        }
        
        scrollToBottom();
    }
    
    function addMessageToChat(message) {
        const chat = chatHistoryData.find(c => c.id === currentChatId);
        if (chat) {
            chat.messages.push(message);
            saveChatHistory();
        }
        
        // 渲染消息
        if (welcomeScreen.style.display !== 'none') {
            welcomeScreen.style.display = 'none';
            chatMessages.style.display = 'block';
        }
        
        const messageElement = createMessageElement(message);
        chatMessages.appendChild(messageElement);
    }
    
    async function callAIAPI(message) {
        const user = getLoginUser();
        if (!user) return '请先登录';
        
        // 获取当前对话的历史消息作为上下文
        const chat = chatHistoryData.find(c => c.id === currentChatId);
        const conversationHistory = chat ? chat.messages.slice(-10) : []; // 最近10条消息作为上下文
        
        const response = await fetch('/api/ai-chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: message,
                user: user.username,
                conversationHistory: conversationHistory // 发送对话历史
            })
        });
        
        if (!response.ok) {
            if (response.status === 429) {
                throw new Error('AI服务暂时繁忙，请稍后再试');
            }
            throw new Error('AI API调用失败');
        }
        
        const data = await response.json();
        return data.response;
    }
    
    async function deductPoints() {
        const user = getLoginUser();
        const newBalance = userBalance - 35;
        
        try {
            const response = await fetch('/api/health?service=balance', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user: user.username,
                    data: { amount: newBalance }
                })
            });
            
            if (response.ok) {
                userBalance = newBalance;
                updateUserInfo(user);
                currentPointsSpan.textContent = userBalance;
            }
        } catch (error) {
            console.error('扣除积分失败:', error);
        }
    }
    
    function updateChatTitle(firstMessage) {
        const chat = chatHistoryData.find(c => c.id === currentChatId);
        if (chat && chat.title === '新对话') {
            chat.title = firstMessage.length > 20 ? firstMessage.substring(0, 20) + '...' : firstMessage;
            saveChatHistory();
            renderChatHistory();
        }
    }
    
    function scrollToBottom() {
        const chatContainer = document.getElementById('chatContainer');
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
    
    // 工具函数
    function getLoginUser() {
        try {
            return JSON.parse(localStorage.getItem('loginUser'));
        } catch {
            return null;
        }
    }
}); 