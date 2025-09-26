// 公益页面脚本
document.addEventListener('DOMContentLoaded', function() {
    let selectedAmount = 100;
    let monthlyTotal = 0;
    const targetAmount = 10000;
    
    // 初始化页面
    initCharity();
    
    async function initCharity() {
        // 设置当前月份
        setCurrentMonth();
        
        // 加载捐助数据
        await loadCharityData();
        
        // 绑定事件
        bindEvents();
    }
    
    function setCurrentMonth() {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        document.getElementById('currentMonth').textContent = `${year}年${month}月`;
    }
    
    async function loadCharityData() {
        try {
            console.log('🔄 开始加载公益数据...');
            const response = await fetch('/api/trend?type=charity');
            console.log('📊 API响应状态:', response.status);
            
            if (response.ok) {
                const data = await response.json();
                console.log('💾 获取到的数据:', data);
                
                // 更新进度
                monthlyTotal = data.monthlyTotal || 0;
                console.log('📈 当前月度总额:', monthlyTotal);
                updateProgress();
                
                // 显示最近捐助者
                displayDonors(data.recentDonors || []);
            } else {
                console.error('❌ API响应失败:', response.status, response.statusText);
            }
        } catch (error) {
            console.error('💥 加载公益数据失败:', error);
            // 使用默认数据
            displayDonors([]);
        }
    }
    
    function updateProgress() {
        const currentEl = document.getElementById('currentAmount');
        const targetEl = document.getElementById('targetAmount');
        const progressFill = document.getElementById('progressFill');
        
        currentEl.textContent = monthlyTotal.toLocaleString();
        
        // 如果捐款已达到或超过目标
        if (monthlyTotal >= targetAmount) {
            targetEl.textContent = '0';
            progressFill.style.width = '100%';
            
            // 显示完成状态
            const progressInfo = document.querySelector('.progress-info');
            if (progressInfo && !document.querySelector('.completion-message')) {
                const completionMsg = document.createElement('div');
                completionMsg.className = 'completion-message';
                completionMsg.innerHTML = '<span style="color: #4CAF50; font-weight: bold;">🎉 本月目标已达成！感谢您的爱心捐助！</span>';
                progressInfo.appendChild(completionMsg);
            }
        } else {
            targetEl.textContent = (targetAmount - monthlyTotal).toLocaleString();
            const percentage = Math.min((monthlyTotal / targetAmount) * 100, 100);
            progressFill.style.width = percentage + '%';
        }
    }
    
    function displayDonors(donors) {
        const donorsList = document.getElementById('donorsList');
        
        if (donors.length === 0) {
            donorsList.innerHTML = '<div style="text-align:center;color:rgba(255,255,255,0.5);">暂无捐助记录</div>';
            return;
        }
        
        donorsList.innerHTML = donors.map(donor => `
            <div class="donor-item">
                <div class="donor-info">
                    <img src="${donor.anonymous ? 'images/anonymous.png' : donor.avatar}" alt="${donor.anonymous ? '匿名捐助者' : donor.name}" class="donor-avatar">
                    <div class="donor-details">
                        <div class="donor-name">${donor.anonymous ? '匿名捐助者' : donor.name}</div>
                        <div class="donor-time">${formatTime(donor.timestamp)}</div>
                    </div>
                </div>
                <div class="donor-amount">${donor.amount} 积分</div>
            </div>
        `).join('');
    }
    
    function formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) return '刚刚';
        if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前';
        if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前';
        return Math.floor(diff / 86400000) + ' 天前';
    }
    
    function bindEvents() {
        // 金额按钮点击
        document.querySelectorAll('.amount-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.amount-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                selectedAmount = parseInt(this.dataset.amount);
                document.getElementById('customAmount').value = '';
            });
        });
        
        // 自定义金额输入
        const customAmount = document.getElementById('customAmount');
        customAmount.addEventListener('input', function() {
            const value = parseInt(this.value);
            if (value > 0) {
                selectedAmount = value;
                document.querySelectorAll('.amount-btn').forEach(b => b.classList.remove('active'));
            }
        });
        
        // 捐助按钮
        document.getElementById('donateBtn').addEventListener('click', async function() {
            const user = getCurrentUser();
            if (!user) {
                alert('请先登录');
                return;
            }
            
            if (!selectedAmount || selectedAmount <= 0) {
                alert('请选择捐助金额');
                return;
            }
            
            // 检查用户积分是否足够
            const userPoints = await getUserPoints(user.username);
            if (userPoints < selectedAmount) {
                alert(`积分不足！您当前有 ${userPoints} 积分，需要 ${selectedAmount} 积分`);
                return;
            }
            
            const anonymous = document.getElementById('anonymousDonation').checked;
            
            // 提交捐助
            await submitDonation(user, selectedAmount, anonymous);
        });
    }
    
    function getCurrentUser() {
        const storedUser = localStorage.getItem('loginUser');
        if (storedUser) {
            try {
                return JSON.parse(storedUser);
            } catch (e) {
                console.error('解析用户数据失败:', e);
            }
        }
        return null;
    }
    
    async function getUserPoints(username) {
        try {
            const response = await fetch(`/api/trend?type=userPoints&username=${username}`);
            if (response.ok) {
                const data = await response.json();
                return data.points || 0;
            }
        } catch (error) {
            console.error('获取用户积分失败:', error);
        }
        return 0;
    }
    
    async function submitDonation(user, amount, anonymous) {
        try {
            const response = await fetch('/api/trend', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    type: 'charity',
                    action: 'donate',
                    username: user.username,
                    amount: amount,
                    anonymous: anonymous
                })
            });
            
            if (response.ok) {
                alert(`感谢您的捐助！已成功捐助 ${amount} 积分`);
                
                // 重新加载数据（不要临时更新，直接从服务器获取最新数据）
                await loadCharityData();
            } else {
                const error = await response.json();
                alert(error.message || '捐助失败，请稍后重试');
            }
        } catch (error) {
            console.error('提交捐助失败:', error);
            alert('捐助失败，请稍后重试');
        }
    }
});
