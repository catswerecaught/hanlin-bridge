// 用户访问追踪脚本 - 记录每次页面访问
(function() {
  // 检查用户是否已登录
  function getCurrentUser() {
    try {
      const stored = localStorage.getItem('loginUser');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  // 记录访问
  async function trackVisit() {
    const user = getCurrentUser();
    if (!user || !user.username) return;

    const currentPage = window.location.pathname || '/';
    
    try {
      await fetch('/api/user-tracking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: user.username,
          page: currentPage
        })
      });
    } catch (error) {
      console.error('Failed to track visit:', error);
    }
  }

  // 页面加载时记录
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', trackVisit);
  } else {
    trackVisit();
  }

  // 监听登录状态变化
  window.addEventListener('storage', (e) => {
    if (e.key === 'loginUser' && e.newValue) {
      trackVisit();
    }
  });
})();
