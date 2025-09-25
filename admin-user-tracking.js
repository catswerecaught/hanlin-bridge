// 管理员查看用户登录历史功能
class UserTrackingModal {
  constructor() {
    this.modal = null;
    this.currentUsername = null;
    this.init();
  }

  init() {
    // 创建模态框
    this.createModal();
    // 绑定头像点击事件
    this.bindAvatarClicks();
  }

  createModal() {
    // 如果模态框已存在，先移除
    const existing = document.getElementById('userTrackingModal');
    if (existing) existing.remove();

    // 创建模态框 HTML
    const modalHTML = `
      <div id="userTrackingModal" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:9999;align-items:center;justify-content:center;">
        <div style="background:white;border-radius:18px;padding:24px;max-width:800px;width:90%;max-height:80vh;display:flex;flex-direction:column;box-shadow:0 10px 40px rgba(0,0,0,0.2);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
            <h2 style="margin:0;color:#333;font-size:20px;">
              <span id="trackingModalUsername"></span> 的登录记录
            </h2>
            <button id="closeTrackingModal" style="background:none;border:none;font-size:24px;cursor:pointer;color:#999;">&times;</button>
          </div>
          
          <div style="display:flex;gap:16px;margin-bottom:16px;">
            <div style="flex:1;padding:12px;background:#f0f9ff;border-radius:10px;">
              <div style="font-size:12px;color:#666;margin-bottom:4px;">总访问次数</div>
              <div id="totalVisits" style="font-size:24px;font-weight:bold;color:#007aff;">0</div>
            </div>
            <div style="flex:1;padding:12px;background:#f0fff4;border-radius:10px;">
              <div style="font-size:12px;color:#666;margin-bottom:4px;">最后访问</div>
              <div id="lastVisit" style="font-size:14px;font-weight:600;color:#34c759;">-</div>
            </div>
            <div style="flex:1;padding:12px;background:#fff4f0;border-radius:10px;">
              <div style="font-size:12px;color:#666;margin-bottom:4px;">活跃地区</div>
              <div id="activeLocation" style="font-size:14px;font-weight:600;color:#ff9500;">-</div>
            </div>
          </div>

          <div id="trackingList" style="flex:1;overflow-y:auto;border:1px solid #e0e0e0;border-radius:12px;padding:16px;">
            <div style="text-align:center;color:#999;padding:40px;">
              <div class="loading-spinner" style="border:3px solid #f3f3f3;border-top:3px solid #007aff;border-radius:50%;width:40px;height:40px;animation:spin 1s linear infinite;margin:0 auto 16px;"></div>
              加载中...
            </div>
          </div>
        </div>
      </div>
      <style>
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .tracking-item {
          padding: 12px;
          border-bottom: 1px solid #f0f0f0;
          transition: background 0.2s;
        }
        .tracking-item:hover {
          background: #f8f9fa;
        }
        .tracking-item:last-child {
          border-bottom: none;
        }
      </style>
    `;

    // 添加到页面
    const modalDiv = document.createElement('div');
    modalDiv.innerHTML = modalHTML;
    document.body.appendChild(modalDiv.firstElementChild);

    this.modal = document.getElementById('userTrackingModal');

    // 绑定关闭按钮
    document.getElementById('closeTrackingModal').addEventListener('click', () => {
      this.hideModal();
    });

    // 点击背景关闭
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.hideModal();
      }
    });
  }

  bindAvatarClicks() {
    // 使用事件委托，监听账户管理面板的点击
    const panel = document.getElementById('accountManagePanel');
    if (!panel) return;

    panel.addEventListener('click', (e) => {
      // 检查是否点击了头像
      const img = e.target.closest('img');
      if (!img && e.target.tagName !== 'IMG') return;
      
      const targetImg = img || e.target;
      
      // 从父元素中找到用户名
      const userItem = targetImg.closest('[data-user]') || targetImg.closest('div');
      if (!userItem) return;
      
      // 尝试从不同位置获取用户名
      let username = null;
      
      // 方法1: 从 data-user 属性获取
      const actionBtn = userItem.querySelector('[data-user]');
      if (actionBtn) {
        username = actionBtn.dataset.user;
      }
      
      // 方法2: 从文本内容获取
      if (!username) {
        const usernameDiv = userItem.querySelector('div[style*="font-size:12px"]');
        if (usernameDiv) {
          username = usernameDiv.textContent.trim();
        }
      }

      if (username) {
        this.showModal(username);
      }
    });
  }

  async showModal(username) {
    this.currentUsername = username;
    
    // 显示模态框
    this.modal.style.display = 'flex';
    
    // 更新用户名
    document.getElementById('trackingModalUsername').textContent = username;
    
    // 显示加载状态
    document.getElementById('trackingList').innerHTML = `
      <div style="text-align:center;color:#999;padding:40px;">
        <div class="loading-spinner" style="border:3px solid #f3f3f3;border-top:3px solid #007aff;border-radius:50%;width:40px;height:40px;animation:spin 1s linear infinite;margin:0 auto 16px;"></div>
        加载中...
      </div>
    `;
    
    // 重置统计
    document.getElementById('totalVisits').textContent = '0';
    document.getElementById('lastVisit').textContent = '-';
    document.getElementById('activeLocation').textContent = '-';
    
    try {
      // 获取用户访问记录
      const response = await fetch(`/api/user-tracking?username=${encodeURIComponent(username)}&limit=100`);
      if (!response.ok) throw new Error('Failed to fetch tracking data');
      
      const data = await response.json();
      const records = data.records || [];
      
      // 更新统计信息
      this.updateStats(records);
      
      // 显示记录列表
      this.displayRecords(records);
      
    } catch (error) {
      console.error('Error loading tracking data:', error);
      document.getElementById('trackingList').innerHTML = `
        <div style="text-align:center;color:#ff3b30;padding:40px;">
          加载失败，请重试
        </div>
      `;
    }
  }

  updateStats(records) {
    // 总访问次数
    document.getElementById('totalVisits').textContent = records.length;
    
    // 最后访问时间
    if (records.length > 0) {
      const lastTime = new Date(records[0].timestamp);
      const now = new Date();
      const diffMs = now - lastTime;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);
      
      let timeAgo = '';
      if (diffMins < 1) {
        timeAgo = '刚刚';
      } else if (diffMins < 60) {
        timeAgo = `${diffMins}分钟前`;
      } else if (diffHours < 24) {
        timeAgo = `${diffHours}小时前`;
      } else {
        timeAgo = `${diffDays}天前`;
      }
      
      document.getElementById('lastVisit').textContent = timeAgo;
      
      // 最活跃地区（出现最多的地区）
      const locationCount = {};
      records.forEach(r => {
        const loc = r.location || '未知';
        locationCount[loc] = (locationCount[loc] || 0) + 1;
      });
      
      const mostActive = Object.entries(locationCount)
        .sort((a, b) => b[1] - a[1])[0];
      
      if (mostActive) {
        document.getElementById('activeLocation').textContent = mostActive[0];
      }
    }
  }

  displayRecords(records) {
    if (records.length === 0) {
      document.getElementById('trackingList').innerHTML = `
        <div style="text-align:center;color:#999;padding:40px;">
          暂无访问记录
        </div>
      `;
      return;
    }

    const html = records.map(record => {
      const time = new Date(record.timestamp).toLocaleString('zh-CN');
      const page = this.getPageName(record.page);
      
      return `
        <div class="tracking-item">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div style="flex:1;">
              <div style="font-weight:600;color:#333;margin-bottom:4px;">
                ${record.location || '位置未知'}
              </div>
              <div style="font-size:13px;color:#666;">
                IP: ${record.ip || '-'} · 访问页面: ${page}
              </div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:13px;color:#007aff;font-weight:500;">
                ${time}
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    document.getElementById('trackingList').innerHTML = html;
  }

  getPageName(path) {
    const pageNames = {
      '/': '首页',
      '/index.html': '首页',
      '/profile.html': '个人主页',
      '/tutors.html': '助学人',
      '/trend.html': '趋势',
      '/lingning.html': '灵凝',
      '/customize.html': '定制',
      '/help.html': '帮助',
      '/cooperation.html': '新闻',
      '/socialmedia.html': '社媒',
      '/email.html': '邮件',
      '/questionnaire.html': '问卷',
      '/questionnaire-admin.html': '问卷管理'
    };
    
    return pageNames[path] || path || '未知页面';
  }

  hideModal() {
    this.modal.style.display = 'none';
    this.currentUsername = null;
  }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  // 延迟初始化，确保账户管理面板已加载
  setTimeout(() => {
    // 只有管理员才能使用此功能
    const user = JSON.parse(localStorage.getItem('loginUser') || '{}');
    if (user && user.supreme === true) {
      new UserTrackingModal();
    }
  }, 1000);
});
