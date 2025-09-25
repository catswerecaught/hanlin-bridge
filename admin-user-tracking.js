// 管理员查看用户登录历史功能
class UserTrackingModal {
  constructor() {
    this.modal = null;
    this.currentUsername = null;
    this.init();
  }

  init() {
    // 添加红点动画样式
    this.addRedDotStyles();
    // 创建模态框
    this.createModal();
    // 绑定头像点击事件
    this.bindAvatarClicks();
    // 初始化红点显示
    this.initRedDots();
    
    // 添加全局方法供调试使用
    window.refreshRedDots = () => this.initRedDots();
  }

  addRedDotStyles() {
    // 检查是否已添加样式
    if (document.getElementById('redDotStyles')) return;
    
    const style = document.createElement('style');
    style.id = 'redDotStyles';
    style.textContent = `
      @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.2); }
        100% { transform: scale(1); }
      }
    `;
    document.head.appendChild(style);
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
          
          <div style="margin-top:16px;text-align:center;border-top:1px solid #e0e0e0;padding-top:16px;">
            <button id="clearTrackingBtn" style="background:#ff3b30;color:white;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:500;">
              清除登录记录
            </button>
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
        .red-dot {
          position: absolute;
          top: -2px;
          right: -2px;
          width: 8px;
          height: 8px;
          background: #ff3b30;
          border-radius: 50%;
          border: 1.5px solid white;
          z-index: 10;
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.2); opacity: 0.8; }
          100% { transform: scale(1); opacity: 1; }
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

    // 绑定清除按钮
    document.getElementById('clearTrackingBtn').addEventListener('click', () => {
      this.clearTrackingData();
    });
  }

  bindAvatarClicks() {
    // 使用事件委托，监听账户管理面板的点击
    const panel = document.getElementById('accountManagePanel');
    if (!panel) return;

    panel.addEventListener('click', (e) => {
      // 检查是否点击了头像或头像包装器
      const img = e.target.closest('img') || e.target.closest('.avatar-wrapper')?.querySelector('img');
      if (!img && e.target.tagName !== 'IMG') return;
      
      const targetImg = img || e.target;
      
      // 从父元素中找到用户名，需要向上查找更多层级
      let userItem = targetImg.closest('[data-user]');
      if (!userItem) {
        // 如果没找到，向上查找包含 data-user 的容器
        let currentElement = targetImg.parentElement;
        for (let i = 0; i < 10; i++) { // 最多向上查找10层
          if (!currentElement) break;
          const dataUserElement = currentElement.querySelector('[data-user]');
          if (dataUserElement) {
            userItem = currentElement;
            break;
          }
          currentElement = currentElement.parentElement;
        }
      }
      
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
      
      // 标记为已读并移除红点
      await this.markAsRead(username);
      
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
      const device = this.parseDeviceInfo(record.userAgent);
      
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
              <div style="font-size:12px;color:#999;margin-top:3px;">
                ${device}
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

  parseDeviceInfo(userAgent) {
    if (!userAgent) return '未知设备';
    
    let os = '';
    let browser = '';
    
    // 检测操作系统
    if (userAgent.includes('Windows')) os = 'Win';
    else if (userAgent.includes('Mac')) os = 'Mac';
    else if (userAgent.includes('Linux')) os = 'Linux';
    else if (userAgent.includes('Android')) os = 'Android';
    else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) os = 'iOS';
    
    // 检测浏览器
    if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) browser = 'Chrome';
    else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) browser = 'Safari';
    else if (userAgent.includes('Firefox')) browser = 'Firefox';
    else if (userAgent.includes('Edg')) browser = 'Edge';
    
    // 检测设备类型
    const isMobile = /Mobile|Android|iPhone|iPad/.test(userAgent);
    const icon = isMobile ? '📱' : '💻';
    
    let result = icon;
    if (os) result += ` ${os}`;
    if (browser) result += ` · ${browser}`;
    
    return result || '未知设备';
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

  async clearTrackingData() {
    if (!this.currentUsername) return;
    
    if (!confirm(`确定要清除 ${this.currentUsername} 的所有登录记录吗？此操作不可撤销。`)) {
      return;
    }

    const clearBtn = document.getElementById('clearTrackingBtn');
    const originalText = clearBtn.textContent;
    clearBtn.textContent = '清除中...';
    clearBtn.disabled = true;

    try {
      const response = await fetch(`/api/user-tracking?username=${encodeURIComponent(this.currentUsername)}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('删除失败');

      const data = await response.json();
      
      if (data.success) {
        // 重新加载数据显示空状态
        document.getElementById('totalVisits').textContent = '0';
        document.getElementById('lastVisit').textContent = '-';
        document.getElementById('activeLocation').textContent = '-';
        document.getElementById('trackingList').innerHTML = `
          <div style="text-align:center;color:#999;padding:40px;">
            暂无访问记录
          </div>
        `;
        
        alert('登录记录已清除');
      } else {
        throw new Error(data.error || '删除失败');
      }
    } catch (error) {
      console.error('清除记录失败:', error);
      alert('清除失败: ' + error.message);
    } finally {
      clearBtn.textContent = originalText;
      clearBtn.disabled = false;
    }
  }

  async initRedDots() {
    // 获取账户管理面板中的所有用户
    const panel = document.getElementById('accountManagePanel');
    if (!panel) return;

    // 收集所有用户名
    const userElements = panel.querySelectorAll('[data-user]');
    const usernames = Array.from(userElements).map(el => el.dataset.user).filter(Boolean);
    
    if (usernames.length === 0) return;

    try {
      // 批量检查用户状态
      const response = await fetch(`/api/tracking-status?usernames=${usernames.join(',')}`);
      if (!response.ok) return;

      const data = await response.json();
      const statusMap = data.status;

      // 为每个有新记录的用户添加红点
      userElements.forEach(userEl => {
        const username = userEl.dataset.user;
        const status = statusMap[username];
        
        if (status && status.hasNewRecords) {
          this.addRedDot(username);
        } else {
          this.removeRedDot(username);
        }
      });

    } catch (error) {
      console.error('Failed to load user status:', error);
    }
  }

  addRedDot(username) {
    // 更直接的查找策略：先找到按钮，然后找到同一行的头像
    const userButton = document.querySelector(`[data-user="${username}"]`);
    if (!userButton) return;

    let avatar = null;
    
    // 策略1: 向上找到最近的flex容器（用户行）
    let currentElement = userButton;
    for (let i = 0; i < 5; i++) { // 最多向上查找5层
      currentElement = currentElement.parentElement;
      if (!currentElement) break;
      
      const style = window.getComputedStyle(currentElement);
      if (style.display === 'flex' || 
          currentElement.style.display === 'flex' ||
          currentElement.style.justifyContent === 'space-between') {
        // 在这个flex容器中查找img
        avatar = currentElement.querySelector('img');
        if (avatar) break;
      }
    }
    
    // 策略2: 如果还没找到，在按钮的兄弟元素中查找
    if (!avatar && userButton.parentElement) {
      let sibling = userButton.parentElement.previousElementSibling;
      while (sibling && !avatar) {
        avatar = sibling.querySelector('img');
        sibling = sibling.previousElementSibling;
      }
    }
    
    // 策略3: 最后的兜底，按照用户名匹配
    if (!avatar) {
      const panel = document.getElementById('accountManagePanel');
      if (panel) {
        const allImgs = panel.querySelectorAll('img');
        for (const img of allImgs) {
          // 检查img的alt属性或附近文本是否包含用户ID
          if (img.alt && img.alt.includes(username)) {
            avatar = img;
            break;
          }
          // 或者检查同一行是否有对应的data-user
          const rowContainer = img.closest('div[style*="display:flex"], div[style*="justify-content"]');
          if (rowContainer && rowContainer.querySelector(`[data-user="${username}"]`)) {
            avatar = img;
            break;
          }
        }
      }
    }

    if (!avatar) {
      console.warn(`无法找到用户 ${username} 的头像元素`);
      return;
    }

    // 移除已存在的红点
    this.removeRedDot(username);

    // 创建专门的头像包装器，确保红点只显示在头像上
    let avatarWrapper = avatar.parentElement;
    
    // 检查当前父元素是否已经是我们创建的包装器
    if (!avatarWrapper.classList.contains('avatar-wrapper')) {
      // 创建新的包装器
      const newWrapper = document.createElement('div');
      newWrapper.className = 'avatar-wrapper';
      newWrapper.style.cssText = `
        position: relative !important;
        display: inline-block !important;
        width: 26px !important;
        height: 26px !important;
      `;
      
      // 将头像插入到包装器中
      avatar.parentElement.insertBefore(newWrapper, avatar);
      newWrapper.appendChild(avatar);
      avatarWrapper = newWrapper;
    }

    // 添加红点到头像包装器
    const redDot = document.createElement('div');
    redDot.className = 'red-dot';
    redDot.dataset.username = username;
    
    // 直接设置内联样式，确保样式生效
    redDot.style.cssText = `
      position: absolute !important;
      top: -2px !important;
      right: -2px !important;
      width: 8px !important;
      height: 8px !important;
      background: #ff3b30 !important;
      border-radius: 50% !important;
      border: 1.5px solid white !important;
      z-index: 9999 !important;
      animation: pulse 2s infinite !important;
      pointer-events: none !important;
    `;
    
    avatarWrapper.appendChild(redDot);
  }

  removeRedDot(username) {
    const existingDot = document.querySelector(`.red-dot[data-username="${username}"]`);
    if (existingDot) {
      existingDot.remove();
    }
  }

  async markAsRead(username) {
    try {
      const response = await fetch('/api/user-tracking', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: username,
          action: 'mark_read'
        })
      });

      if (response.ok) {
        // 移除红点
        this.removeRedDot(username);
      }
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  }

  hideModal() {
    this.modal.style.display = 'none';
    this.currentUsername = null;
  }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  // 只有管理员才能使用此功能
  const user = JSON.parse(localStorage.getItem('loginUser') || '{}');
  if (user && user.supreme === true) {
    // 等待账户管理面板加载完成
    const waitForPanel = () => {
      const panel = document.getElementById('accountManagePanel');
      if (panel && panel.children.length > 0) {
        // 面板已加载，创建追踪模态框
        new UserTrackingModal();
      } else {
        // 面板还没加载，继续等待
        setTimeout(waitForPanel, 500);
      }
    };
    
    // 延迟一点时间再开始检查，让其他脚本有时间加载面板
    setTimeout(waitForPanel, 800);
  }
});
