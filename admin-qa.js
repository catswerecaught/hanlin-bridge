// 问一问管理面板 JavaScript
class AdminQAPanel {
    constructor() {
        this.questions = [];
        this.currentUser = null;
        this.init();
    }

    init() {
        // 检查用户权限并显示面板
        this.checkAdminAccess();
        
        // 绑定事件
        this.bindEvents();
    }

    checkAdminAccess() {
        // 获取当前登录用户（以 loginUser 为准）
        let storedUser = null;
        try {
            storedUser = JSON.parse(localStorage.getItem('loginUser'));
        } catch (e) {
            storedUser = null;
        }
        if (!storedUser || typeof storedUser !== 'object') {
            // 未登录，保持面板隐藏
            const panel = document.getElementById('adminQAPanel');
            if (panel) panel.style.display = 'none';
            return;
        }

        // 与全局 users 同步最新信息（如权限、会员）
        const synced = Array.isArray(window.users)
            ? window.users.find(u => u.username === storedUser.username)
            : null;
        this.currentUser = synced ? { ...synced } : storedUser;

        // 检查是否为超级管理员
        const panel = document.getElementById('adminQAPanel');
        if (this.currentUser && this.currentUser.supreme === true) {
            if (panel) panel.style.display = 'block';
            this.loadQuestions();
        } else {
            if (panel) panel.style.display = 'none';
        }
    }

    bindEvents() {
        // 如果需要刷新按钮，可以在这里添加
    }

    async loadQuestions() {
        try {
            const response = await fetch('/api/questions?admin=true');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status} ${response.statusText}`);
            }
            const ct = response.headers.get('content-type') || '';
            if (!ct.includes('application/json')) {
                const text = await response.text();
                throw new Error(`非JSON响应: ${text.slice(0, 120)}`);
            }
            const data = await response.json();
            
            if (data.questions) {
                this.questions = data.questions;
                this.updateStats();
                this.renderQuestions();
            }
        } catch (error) {
            console.error('加载问题失败:', error);
            document.getElementById('questionsLoading').innerHTML = 
                '<div style="color:#ff3b30;">加载失败，请刷新重试</div>';
        }
    }

    updateStats() {
        const total = this.questions.length;
        const pending = this.questions.filter(q => q.status === 'pending').length;
        const answered = this.questions.filter(q => q.status === 'answered').length;

        document.getElementById('totalQuestions').textContent = `总问题: ${total}`;
        document.getElementById('pendingQuestions').textContent = `待回答: ${pending}`;
        document.getElementById('answeredQuestions').textContent = `已回答: ${answered}`;
    }

    renderQuestions() {
        const container = document.getElementById('questionsList');
        
        if (this.questions.length === 0) {
            container.innerHTML = '<div style="padding:20px;text-align:center;color:#666;">暂无问题</div>';
            return;
        }

        const questionsHTML = this.questions.map(question => this.createQuestionHTML(question)).join('');
        container.innerHTML = questionsHTML;

        // 绑定答复按钮事件
        this.bindAnswerEvents();
    }

    createQuestionHTML(question) {
        const formatTime = (timestamp) => {
            return new Date(timestamp).toLocaleString('zh-CN');
        };

        const statusBadge = question.status === 'answered' 
            ? '<span style="background:#34c759;color:white;padding:2px 8px;border-radius:12px;font-size:12px;">已回答</span>'
            : '<span style="background:#ff9500;color:white;padding:2px 8px;border-radius:12px;font-size:12px;">待回答</span>';

        return `
            <div class="question-item" style="border-bottom:1px solid #f0f0f0;padding:16px;" data-key="${question.key}">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
                    <div style="font-weight:600;color:#1a1a1a;">密钥: ${question.key}</div>
                    ${statusBadge}
                </div>
                <div style="color:#666;font-size:13px;margin-bottom:12px;">
                    提问时间: ${formatTime(question.timestamp)} | IP: ${question.ip}
                </div>
                <div style="background:#f8f9fa;padding:12px;border-radius:8px;margin-bottom:12px;">
                    <strong>问题:</strong><br>
                    ${question.question}
                </div>
                ${question.answer ? `
                    <div style="background:#e8f5e8;padding:12px;border-radius:8px;margin-bottom:12px;">
                        <strong>回答:</strong><br>
                        ${question.answer}
                        <div style="color:#666;font-size:12px;margin-top:8px;">
                            回答时间: ${formatTime(question.answerTime)}
                        </div>
                    </div>
                ` : `
                    <div class="answer-form" style="margin-top:12px;">
                        <textarea 
                            class="answer-input" 
                            placeholder="输入您的回答..."
                            style="width:100%;min-height:80px;padding:12px;border:2px solid #e1e8ed;border-radius:8px;resize:vertical;font-size:14px;box-sizing:border-box;"
                        ></textarea>
                        <div style="margin-top:8px;text-align:right;">
                            <button 
                                class="submit-answer-btn"
                                style="background:#007aff;color:white;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:14px;"
                                data-key="${question.key}"
                            >
                                提交回答
                            </button>
                        </div>
                    </div>
                `}
            </div>
        `;
    }

    bindAnswerEvents() {
        const submitButtons = document.querySelectorAll('.submit-answer-btn');
        submitButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const key = e.target.dataset.key;
                const questionItem = e.target.closest('.question-item');
                const answerInput = questionItem.querySelector('.answer-input');
                const answer = answerInput.value.trim();

                if (!answer) {
                    alert('请输入回答内容');
                    return;
                }

                this.submitAnswer(key, answer, e.target);
            });
        });
    }

    async submitAnswer(key, answer, button) {
        const originalText = button.textContent;
        button.textContent = '提交中...';
        button.disabled = true;

        try {
            const response = await fetch('/api/questions', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ key, answer })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status} ${response.statusText}`);
            }
            const ct = response.headers.get('content-type') || '';
            if (!ct.includes('application/json')) {
                const text = await response.text();
                throw new Error(`非JSON响应: ${text.slice(0, 120)}`);
            }
            const data = await response.json();

            if (data.success) {
                // 重新加载问题列表
                await this.loadQuestions();
            } else {
                throw new Error(data.error || '提交失败');
            }
        } catch (error) {
            console.error('提交回答失败:', error);
            alert('提交失败: ' + error.message);
            button.textContent = originalText;
            button.disabled = false;
        }
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    // 延迟初始化，确保用户数据已加载
    setTimeout(() => {
        new AdminQAPanel();
    }, 500);
});
