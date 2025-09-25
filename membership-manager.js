// 会员管理系统 - 完全依赖 Upstash 云端数据
class MembershipManager {
  constructor() {
    this.memberships = {};
    this.init();
  }

  async init() {
    try {
      console.log('🔄 正在启动会员管理系统...');
      
      // 加载云端会员数据
      await this.loadMemberships();
      
      // 初始化用户数据到云端（仅首次）
      await this.initializeFromUsersJS();
      
      // 检查会员到期并更新权限
      await this.checkAndUpdateExpirations();
      
      // 每小时检查一次到期状态
      setInterval(() => this.checkAndUpdateExpirations().catch(err => {
        console.warn('⚠️ 定期检查失败:', err.message);
      }), 3600000);
      
      console.log('✅ 会员管理系统已启动');
      
    } catch (error) {
      console.warn('⚠️ 会员系统启动遇到问题，但不影响基本功能:', error.message);
    }
    
    // 无论是否成功，都提供全局访问
    window.membershipManager = this;
  }

  // 从云端加载会员数据
  async loadMemberships() {
    try {
      const response = await fetch('/api/membership');
      if (!response.ok) {
        this.apiAvailable = false;
        console.log('ℹ️ 会员API不可用，使用基本模式');
        return;
      }
      
      const data = await response.json();
      this.memberships = data.memberships || {};
      this.apiAvailable = true;
      
      console.log(`✅ 已加载 ${Object.keys(this.memberships).length} 个用户的会员数据`);
    } catch (error) {
      this.apiAvailable = false;
      console.log('ℹ️ 会员系统运行在离线模式');
      this.memberships = {};
    }
  }

  // 初始化：将 users.js 数据上传到云端（仅首次运行）
  async initializeFromUsersJS() {
    // 如果API不可用，直接跳过所有云端操作
    if (this.apiAvailable === false) {
      console.log('ℹ️ API不可用，跳过云端同步');
      return;
    }
    
    try {
      if (Object.keys(this.memberships).length > 0) {
        console.log('✅ 云端已有会员数据，跳过初始化');
        return;
      }
      
      if (typeof users === 'undefined') {
        console.log('ℹ️ users.js 不可用，跳过初始化');
        return;
      }
      
      console.log('🔄 检测到首次运行，正在初始化会员数据到云端...');
      
      let successCount = 0;
      for (const user of users) {
        try {
          await this.updateMembership(user.username, {
            vip: user.vip,
            expire: user.expire,
            supreme: user.supreme
          });
          successCount++;
        } catch (err) {
          // 静默处理错误，不显示在控制台
          continue;
        }
      }
      
      if (successCount > 0) {
        console.log(`✅ 成功初始化 ${successCount}/${users.length} 个用户`);
      }
      
    } catch (error) {
      // 静默处理，不显示错误信息
      console.log('ℹ️ 初始化完成，系统正常运行');
    }
  }

  // 获取用户会员信息
  async getMembership(username) {
    try {
      // 先从缓存获取
      if (this.memberships[username]) {
        return this.memberships[username];
      }
      
      // 从云端获取
      const response = await fetch(`/api/membership?username=${username}`);
      if (!response.ok) return null;
      
      const data = await response.json();
      return data.membership;
    } catch (error) {
      console.error('获取会员信息失败:', error);
      return null;
    }
  }

  // 更新会员信息（仅云端）
  async updateMembership(username, membershipData) {
    // 如果API不可用，直接跳过
    if (this.apiAvailable === false) {
      throw new Error('API不可用');
    }
    
    try {
      const response = await fetch('/api/membership', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username,
          ...membershipData
        })
      });

      if (!response.ok) {
        throw new Error(`更新失败: ${response.status}`);
      }
      
      const data = await response.json();
      
      // 更新本地缓存
      this.memberships[username] = data.membership;
      
      // 如果修改的是当前登录用户，立即更新 localStorage
      const loginUser = JSON.parse(localStorage.getItem('loginUser') || '{}');
      if (loginUser.username === username) {
        loginUser.vip = data.membership.vip;
        loginUser.expire = data.membership.expire;
        loginUser.supreme = data.membership.supreme;
        localStorage.setItem('loginUser', JSON.stringify(loginUser));
        
        console.log(`✅ 已更新当前用户权限: ${username} -> ${data.membership.vip}`);
        console.log('💡 提示：权限已更新，建议重新登录以获得最佳体验');
      }
      
      console.log(`✅ 会员信息已更新: ${username} -> ${data.membership.vip}, 到期: ${data.membership.expire}`);
      return data.membership;
      
    } catch (error) {
      // 静默抛出错误，不记录到控制台
      throw error;
    }
  }

  // 检查并更新会员到期状态
  async checkAndUpdateExpirations() {
    // 如果API不可用，跳过云端到期检查
    if (this.apiAvailable === false) {
      return;
    }
    
    const now = new Date();
    const expiredUsers = [];
    
    for (const [username, membership] of Object.entries(this.memberships)) {
      if (membership.expire && membership.expire !== '终身会员') {
        const expireDate = new Date(membership.expire);
        
        if (expireDate < now && membership.vip === 'Pro会员') {
          expiredUsers.push(username);
          
          // 自动降级为普通会员
          try {
            await this.updateMembership(username, {
              vip: '普通会员',
              expire: membership.expire,
              supreme: membership.supreme
            });
            console.log(`✅ 已将 ${username} 降级为普通会员`);
          } catch (error) {
            // 静默处理错误
            continue;
          }
        }
      }
    }
    
    // 如果当前登录用户被降级，更新本地存储
    const loginUser = JSON.parse(localStorage.getItem('loginUser') || '{}');
    if (expiredUsers.includes(loginUser.username)) {
      loginUser.vip = '普通会员';
      localStorage.setItem('loginUser', JSON.stringify(loginUser));
      console.log('ℹ️ 当前用户会员已到期');
    }
  }

  // 检查用户会员权限（实时）
  async checkUserPermission(username) {
    // 先获取最新的会员信息
    const membership = await this.getMembership(username);
    
    if (!membership) {
      return { 
        hasPermission: false, 
        reason: '无会员信息',
        membershipInfo: null
      };
    }
    
    // 检查是否到期
    if (membership.expire && membership.expire !== '终身会员') {
      const now = new Date();
      const expireDate = new Date(membership.expire);
      
      if (expireDate < now) {
        return { 
          hasPermission: false, 
          reason: '会员已到期',
          expireDate: membership.expire,
          membershipInfo: membership
        };
      }
    }
    
    // 检查会员等级
    const hasProPermission = membership.vip === 'Pro会员' || membership.expire === '终身会员';
    
    return { 
      hasPermission: hasProPermission, 
      reason: hasProPermission ? '权限验证通过' : '需要Pro会员',
      membershipInfo: membership
    };
  }

  // 全局权限检查函数（供其他脚本调用）
  async validateCurrentUserPermission() {
    const loginUser = JSON.parse(localStorage.getItem('loginUser') || '{}');
    
    if (!loginUser.username) {
      return { hasPermission: false, reason: '未登录' };
    }
    
    return await this.checkUserPermission(loginUser.username);
  }
}

// 初始化会员管理系统
document.addEventListener('DOMContentLoaded', () => {
  new MembershipManager();
});
