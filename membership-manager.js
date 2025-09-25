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
      if (!response.ok) {
        console.log('会员 API 不可用，使用本地数据');
        return;
      }
      
      const data = await response.json();
      this.memberships = data.memberships || {};
      
      // 初次同步：将 users.js 中的数据上传到云端
      if (Object.keys(this.memberships).length === 0 && typeof users !== 'undefined') {
        console.log('初始化会员数据到云端...');
        for (const user of users) {
          try {
            await this.updateMembership(user.username, {
              vip: user.vip,
              expire: user.expire,
              supreme: user.supreme
            });
          } catch (err) {
            console.log(`跳过用户 ${user.username} 的云端同步:`, err.message);
          }
        }
      }
    } catch (error) {
      console.log('会员系统在离线模式下运行，使用本地 users.js 数据');
      // 离线模式：直接从 users.js 加载数据
      if (typeof users !== 'undefined') {
        users.forEach(user => {
          this.memberships[user.username] = {
            vip: user.vip,
            expire: user.expire,
            supreme: user.supreme
          };
        });
      }
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
      // 尝试云端更新
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

      if (response.ok) {
        const data = await response.json();
        // 更新本地缓存
        this.memberships[username] = data.membership;
        console.log(`✅ 云端更新成功: ${username}`);
      } else {
        throw new Error('云端更新失败');
      }
    } catch (error) {
      console.log(`⚠️ 云端不可用，仅更新本地数据: ${username}`);
    }
    
    // 无论云端是否成功，都更新本地数据（主要数据源）
    const user = users.find(u => u.username === username);
    if (user) {
      user.vip = membershipData.vip || user.vip;
      user.expire = membershipData.expire || user.expire;
      user.supreme = membershipData.supreme !== undefined ? membershipData.supreme : user.supreme;
      
      console.log(`✅ 已同步到本地 users.js: ${username} -> ${user.vip}, 到期: ${user.expire}`);
    }
    
    // 更新本地缓存
    this.memberships[username] = {
      vip: membershipData.vip || (user && user.vip),
      expire: membershipData.expire || (user && user.expire),
      supreme: membershipData.supreme !== undefined ? membershipData.supreme : (user && user.supreme)
    };
    
    // 如果修改的是当前用户，更新 localStorage
    const loginUser = JSON.parse(localStorage.getItem('loginUser') || '{}');
    if (loginUser.username === username) {
      loginUser.vip = membershipData.vip || loginUser.vip;
      loginUser.expire = membershipData.expire || loginUser.expire;
      loginUser.supreme = membershipData.supreme !== undefined ? membershipData.supreme : loginUser.supreme;
      localStorage.setItem('loginUser', JSON.stringify(loginUser));
      
      console.log(`✅ 已同步当前用户登录状态: ${username}`);
    }
    
    return this.memberships[username];
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
