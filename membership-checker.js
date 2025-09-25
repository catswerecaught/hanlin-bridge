// 客户端会员状态检查器 - 检查并更新过期会员状态
class MembershipChecker {
  
  // 检查单个用户的会员状态
  static checkMembershipStatus(user) {
    if (!user || !user.expire) return user;
    
    // 跳过终身会员
    if (user.expire === '终身会员') return user;
    
    const now = new Date();
    const expireDate = new Date(user.expire);
    
    // 如果已过期且还是Pro会员，自动降级
    if (expireDate < now && user.vip === 'Pro会员') {
      console.log(`⚠️ 检测到用户 ${user.username} 会员已到期 (${user.expire})，自动降级`);
      
      // 创建更新后的用户对象
      const updatedUser = {
        ...user,
        vip: '普通会员'
      };
      
      return updatedUser;
    }
    
    return user;
  }
  
  // 检查并更新当前登录用户的状态
  static checkAndUpdateCurrentUser() {
    const loginUser = JSON.parse(localStorage.getItem('loginUser') || '{}');
    
    if (!loginUser.username) return null;
    
    // 检查用户状态
    const updatedUser = this.checkMembershipStatus(loginUser);
    
    // 如果状态发生变化，更新 localStorage
    if (updatedUser.vip !== loginUser.vip) {
      localStorage.setItem('loginUser', JSON.stringify(updatedUser));
      console.log(`✅ 已更新当前用户会员状态: ${loginUser.username} -> ${updatedUser.vip}`);
      
      // 触发页面更新事件
      window.dispatchEvent(new CustomEvent('membershipStatusChanged', {
        detail: { 
          username: updatedUser.username, 
          oldStatus: loginUser.vip, 
          newStatus: updatedUser.vip 
        }
      }));
      
      return updatedUser;
    }
    
    return loginUser;
  }
  
  // 检查并更新 users 数组中的所有用户
  static checkAndUpdateAllUsers() {
    if (typeof users === 'undefined') return;
    
    let updatedCount = 0;
    
    for (let i = 0; i < users.length; i++) {
      const originalUser = users[i];
      const checkedUser = this.checkMembershipStatus(originalUser);
      
      // 如果状态发生变化，更新用户数组
      if (checkedUser.vip !== originalUser.vip) {
        users[i] = checkedUser;
        updatedCount++;
        console.log(`✅ 已更新用户状态: ${originalUser.username} -> ${checkedUser.vip}`);
      }
    }
    
    if (updatedCount > 0) {
      console.log(`📊 共更新了 ${updatedCount} 个过期用户的状态`);
      
      // 触发全局更新事件
      window.dispatchEvent(new CustomEvent('usersDataUpdated', {
        detail: { updatedCount }
      }));
    }
  }
  
  // 获取用户的实际会员状态（检查到期）
  static getRealTimeUserStatus(username) {
    // 先从 users 数组查找
    if (typeof users !== 'undefined') {
      const user = users.find(u => u.username === username);
      if (user) {
        return this.checkMembershipStatus(user);
      }
    }
    
    // 如果是当前登录用户，从 localStorage 获取
    const loginUser = JSON.parse(localStorage.getItem('loginUser') || '{}');
    if (loginUser.username === username) {
      return this.checkMembershipStatus(loginUser);
    }
    
    return null;
  }
  
  // 初始化会员检查器
  static init() {
    console.log('🔄 启动会员状态检查器...');
    
    // 检查并更新所有用户数据
    this.checkAndUpdateAllUsers();
    
    // 检查并更新当前登录用户
    this.checkAndUpdateCurrentUser();
    
    // 定期检查（每5分钟）
    setInterval(() => {
      this.checkAndUpdateAllUsers();
      this.checkAndUpdateCurrentUser();
    }, 5 * 60 * 1000);
    
    console.log('✅ 会员状态检查器已启动');
  }
}

// 页面加载时自动启动检查器
document.addEventListener('DOMContentLoaded', () => {
  MembershipChecker.init();
});

// 提供全局访问
window.MembershipChecker = MembershipChecker;
