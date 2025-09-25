// 会员管理系统 - 同步本地和云端会员数据
class MembershipManager {
  constructor() {
    this.memberships = {};
    this.init();
  }

  async init() {
    // 同步云端会员数据
    await this.syncMemberships();
    
    // 检查会员到期
    this.checkExpirations();
    
    // 每小时检查一次
    setInterval(() => this.checkExpirations(), 3600000);
    
    // 提供全局访问
    window.membershipManager = this;
  }

  // 同步所有用户的会员数据
  async syncMemberships() {
    try {
      const response = await fetch('/api/membership');
      if (!response.ok) return;
      
      const data = await response.json();
      this.memberships = data.memberships || {};
      
      // 初次同步：将 users.js 中的数据上传到云端
      if (Object.keys(this.memberships).length === 0 && typeof users !== 'undefined') {
        console.log('初始化会员数据到云端...');
        for (const user of users) {
          await this.updateMembership(user.username, {
            vip: user.vip,
            expire: user.expire,
            supreme: user.supreme
          });
        }
      }
    } catch (error) {
      console.error('同步会员数据失败:', error);
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

  // 更新会员信息
  async updateMembership(username, membershipData) {
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

      if (!response.ok) throw new Error('更新失败');
      
      const data = await response.json();
      
      // 更新本地缓存
      this.memberships[username] = data.membership;
      
      // 更新本地 localStorage
      const loginUser = JSON.parse(localStorage.getItem('loginUser') || '{}');
      if (loginUser.username === username) {
        loginUser.vip = membershipData.vip || loginUser.vip;
        loginUser.expire = membershipData.expire || loginUser.expire;
        loginUser.supreme = membershipData.supreme !== undefined ? membershipData.supreme : loginUser.supreme;
        localStorage.setItem('loginUser', JSON.stringify(loginUser));
      }
      
      return data.membership;
    } catch (error) {
      console.error('更新会员信息失败:', error);
      throw error;
    }
  }

  // 检查会员到期
  checkExpirations() {
    const now = new Date();
    
    for (const [username, membership] of Object.entries(this.memberships)) {
      if (membership.expire && membership.expire !== '终身会员') {
        const expireDate = new Date(membership.expire);
        
        if (expireDate < now) {
          console.log(`用户 ${username} 的会员已到期`);
          // 可以在这里添加到期处理逻辑
          // 比如降级为普通会员
        }
      }
    }
  }

  // 检查当前用户权限
  checkUserPermission(username) {
    const membership = this.memberships[username];
    if (!membership) return { hasPermission: false, reason: '无会员信息' };
    
    if (membership.expire === '终身会员') {
      return { hasPermission: true };
    }
    
    const now = new Date();
    const expireDate = new Date(membership.expire);
    
    if (expireDate < now) {
      return { hasPermission: false, reason: '会员已到期' };
    }
    
    if (membership.vip === 'Pro会员') {
      return { hasPermission: true };
    }
    
    return { hasPermission: false, reason: '需要Pro会员' };
  }
}

// 初始化会员管理系统
document.addEventListener('DOMContentLoaded', () => {
  new MembershipManager();
});
