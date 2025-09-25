// 会员服务 - 专门处理线上会员数据的获取和更新
class MembershipService {
  
  // 获取用户会员信息
  static async getUserMembership(username) {
    try {
      const response = await fetch(`/api/membership?username=${username}`);
      if (!response.ok) {
        console.warn('会员API不可用，使用默认状态');
        return { vip: '普通会员', expire: null, supreme: false };
      }
      
      const data = await response.json();
      return data.membership || { vip: '普通会员', expire: null, supreme: false };
    } catch (error) {
      console.warn('获取会员信息失败，使用默认状态');
      return { vip: '普通会员', expire: null, supreme: false };
    }
  }
  
  // 获取当前登录用户的完整信息（基础信息 + 会员信息）
  static async getCurrentUserInfo() {
    const loginUser = JSON.parse(localStorage.getItem('loginUser') || '{}');
    if (!loginUser.username) return null;
    
    // 获取基础信息
    const baseUser = users.find(u => u.username === loginUser.username);
    if (!baseUser) return null;
    
    // 获取会员信息
    const membership = await this.getUserMembership(loginUser.username);
    
    // 合并信息
    const fullUser = {
      ...baseUser,
      ...membership
    };
    
    // 更新 localStorage
    localStorage.setItem('loginUser', JSON.stringify(fullUser));
    
    return fullUser;
  }
  
  // 更新用户会员信息
  static async updateUserMembership(username, membershipData) {
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
        throw new Error('API更新失败');
      }
      
      const data = await response.json();
      
      // 如果是当前用户，更新 localStorage
      const loginUser = JSON.parse(localStorage.getItem('loginUser') || '{}');
      if (loginUser.username === username) {
        const updatedUser = {
          ...loginUser,
          vip: data.membership.vip,
          expire: data.membership.expire,
          supreme: data.membership.supreme
        };
        localStorage.setItem('loginUser', JSON.stringify(updatedUser));
      }
      
      return data.membership;
    } catch (error) {
      console.error('更新会员信息失败:', error);
      throw error;
    }
  }
  
  // 获取所有用户的会员信息（管理员用）
  static async getAllMemberships() {
    try {
      const response = await fetch('/api/membership');
      if (!response.ok) {
        console.warn('会员API不可用，返回默认会员信息');
        // API不可用时，返回默认的会员信息
        return this.getDefaultMemberships();
      }
      
      const data = await response.json();
      const memberships = data.memberships || {};
      
      // 如果返回空对象，使用默认数据
      if (Object.keys(memberships).length === 0) {
        console.warn('API返回空数据，使用默认会员信息');
        return this.getDefaultMemberships();
      }
      
      return memberships;
    } catch (error) {
      console.warn('获取会员信息失败，使用默认数据:', error);
      return this.getDefaultMemberships();
    }
  }
  
  // 获取默认会员信息（当API不可用时使用）
  static getDefaultMemberships() {
    const defaultMemberships = {};
    
    // 为关键用户设置默认会员状态
    defaultMemberships['taosir'] = { vip: 'Pro会员', expire: '终身会员', supreme: true };
    defaultMemberships['user00002'] = { vip: 'Pro会员', expire: '终身会员', supreme: false };
    defaultMemberships['user00003'] = { vip: 'Pro会员', expire: '终身会员', supreme: false };
    defaultMemberships['user00007'] = { vip: '普通会员', expire: '2025-09-15', supreme: false };
    defaultMemberships['user00012'] = { vip: 'Pro会员', expire: '终身会员', supreme: false };
    
    // 其他用户默认为普通会员
    users.forEach(user => {
      if (!defaultMemberships[user.username]) {
        defaultMemberships[user.username] = { vip: '普通会员', expire: null, supreme: false };
      }
    });
    
    return defaultMemberships;
  }
  
  // 获取用户完整信息（基础信息 + 会员信息）
  static async getUserFullInfo(username) {
    const baseUser = users.find(u => u.username === username);
    if (!baseUser) return null;
    
    const membership = await this.getUserMembership(username);
    
    return {
      ...baseUser,
      ...membership
    };
  }
}

// 全局可访问
window.MembershipService = MembershipService;
