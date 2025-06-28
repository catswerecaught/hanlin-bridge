// 灵凝页面功能
document.addEventListener('DOMContentLoaded', function() {
    // 全局变量
    let currentChatId = null;
    let chatHistory = [];
    let userBalance = 0;
    
    // DOM 元素
    const newChatBtn = document.getElementById('newChatBtn');
    const chatHistoryContainer = document.getElementById('chatHistory');
    const welcomeScreen = document.getElementById('welcomeScreen');
    const chatMessages = document.getElementById('chatMessages');
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    const charCount = document.getElementById('charCount');
    const userInfo = document.getElementById('userInfo');
    const insufficientPointsModal = document.getElementById('insufficientPointsModal');
    const insufficientPointsCloseBtn = document.getElementById('insufficientPointsCloseBtn');
    const currentPointsSpan = document.getElementById('currentPoints');
    
    // 初始化
    init();
    
    function init() {
        // 检查用户登录状态
        const user = getLoginUser();
        if (!user) {
            showLoginModal(true);
            return;
        }
        
        // 更新用户信息
        updateUserInfo(user);
        
        // 获取用户积分
        fetchUserBalance(user.username);
        
        // 加载聊天历史
        loadChatHistory(user.username);
        
        // 绑定事件
        bindEvents();
        
        // 自动调整输入框高度
        autoResizeTextarea();
    }
    
    function bindEvents() {
        // 新对话按钮
        newChatBtn.addEventListener('click', startNewChat);
        
        // 发送按钮
        sendBtn.addEventListener('click', sendMessage);
        
        // 输入框事件
        chatInput.addEventListener('input', handleInputChange);
        chatInput.addEventListener('keydown', handleKeyDown);
        
        // 积分不足模态框
        insufficientPointsCloseBtn.addEventListener('click', () => {
            insufficientPointsModal.classList.remove('show');
        });
        
        // 点击模态框外部关闭
        insufficientPointsModal.addEventListener('click', (e) => {
            if (e.target === insufficientPointsModal) {
                insufficientPointsModal.classList.remove('show');
            }
        });
    }
    
    function updateUserInfo(user) {
        const userAvatar = userInfo.querySelector('.user-avatar-small');
        const userName = userInfo.querySelector('.user-name');
        const userPoints = userInfo.querySelector('.user-points');
        
        userAvatar.src = user.avatar || 'images/login-default.png';
        userName.textContent = user.name;
        userPoints.textContent = `积分: ${userBalance}`;
    }
    
    async function fetchUserBalance(username) {
        try {
            const response = await fetch(`/api/balance?user=${username}`);
            if (response.ok) {
                const data = await response.json();
                userBalance = data.amount || 0;
                updateUserInfo(getLoginUser());
                currentPointsSpan.textContent = userBalance;
            }
        } catch (error) {
            console.error('获取用户积分失败:', error);
        }
    }
    
    function loadChatHistory(username) {
        // 从localStorage加载聊天历史
        const savedHistory = localStorage.getItem(`chatHistory_${username}`);
        if (savedHistory) {
            try {
                chatHistory = JSON.parse(savedHistory);
                renderChatHistory();
            } catch (error) {
                console.error('加载聊天历史失败:', error);
                chatHistory = [];
            }
        }
    }
    
    function renderChatHistory() {
        chatHistoryContainer.innerHTML = '';
        
        chatHistory.forEach((chat, index) => {
            const historyItem = document.createElement('div');
            historyItem.className = 'chat-history-item';
            if (chat.id === currentChatId) {
                historyItem.classList.add('active');
            }
            
            historyItem.innerHTML = `
                <img src="images/lingning-chat-icon.png" alt="对话" class="chat-history-icon">
                <span>${chat.title || '新对话'}</span>
            `;
            
            historyItem.addEventListener('click', () => {
                loadChat(chat.id);
            });
            
            chatHistoryContainer.appendChild(historyItem);
        });
    }
    
    function startNewChat() {
        currentChatId = Date.now().toString();
        const newChat = {
            id: currentChatId,
            title: '新对话',
            messages: [],
            timestamp: Date.now()
        };
        
        chatHistory.unshift(newChat);
        saveChatHistory();
        renderChatHistory();
        
        // 显示欢迎界面
        showWelcomeScreen();
    }
    
    function loadChat(chatId) {
        currentChatId = chatId;
        const chat = chatHistory.find(c => c.id === chatId);
        
        if (chat) {
            renderChatHistory();
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
        
        // 滚动到底部
        scrollToBottom();
    }
    
    function createMessageElement(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${message.role}`;
        
        const avatar = document.createElement('img');
        avatar.className = 'message-avatar';
        
        if (message.role === 'user') {
            const user = getLoginUser();
            avatar.src = user.avatar || 'images/login-default.png';
        } else {
            avatar.src = 'images/lingning-ai-avatar.png';
        }
        
        const content = document.createElement('div');
        content.className = 'message-content';
        
        const text = document.createElement('div');
        text.className = 'message-text';
        text.textContent = message.content;
        
        content.appendChild(text);
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(content);
        
        return messageDiv;
    }
    
    function handleInputChange() {
        const text = chatInput.value.trim();
        sendBtn.disabled = !text;
        
        // 更新字符计数
        const count = chatInput.value.length;
        charCount.textContent = `${count}/4000`;
        
        // 自动调整高度
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
        
        // 显示AI回复
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
            
            // 更新AI消息内容
            aiMessage.content = response;
            aiMessageElement.querySelector('.message-text').textContent = response;
            
            // 扣除积分
            await deductPoints();
            
            // 更新聊天标题
            updateChatTitle(text);
            
        } catch (error) {
            console.error('AI API调用失败:', error);
            aiMessageElement.querySelector('.message-text').textContent = '抱歉，AI服务暂时不可用，请稍后重试。';
        }
        
        scrollToBottom();
    }
    
    function addMessageToChat(message) {
        const chat = chatHistory.find(c => c.id === currentChatId);
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
        // 这里需要替换为实际的AI API调用
        // 示例：调用OpenAI API或其他AI服务
        const response = await fetch('/api/ai-chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: message,
                user: getLoginUser().username
            })
        });
        
        if (!response.ok) {
            throw new Error('AI API调用失败');
        }
        
        const data = await response.json();
        return data.response;
    }
    
    async function deductPoints() {
        const user = getLoginUser();
        const newBalance = userBalance - 35;
        
        try {
            const response = await fetch('/api/balance', {
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
        const chat = chatHistory.find(c => c.id === currentChatId);
        if (chat && chat.title === '新对话') {
            // 使用第一条消息的前20个字符作为标题
            chat.title = firstMessage.length > 20 ? firstMessage.substring(0, 20) + '...' : firstMessage;
            saveChatHistory();
            renderChatHistory();
        }
    }
    
    function saveChatHistory() {
        const user = getLoginUser();
        if (user) {
            localStorage.setItem(`chatHistory_${user.username}`, JSON.stringify(chatHistory));
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
    
    function showLoginModal(show) {
        const modal = document.getElementById('loginModal');
        if (show) {
            modal.classList.add('show');
        } else {
            modal.classList.remove('show');
        }
    }
}); 