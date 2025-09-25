// 用户访问追踪脚本 - 记录每次页面访问和切换
(function() {
  let lastTrackedPage = '';
  let trackingEnabled = true;

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
  async function trackVisit(source = 'pageload') {
    const user = getCurrentUser();
    if (!user || !user.username || !trackingEnabled) return;

    const currentPage = window.location.pathname || '/';
    
    // 避免重复记录同一页面（除非是手动刷新）
    if (currentPage === lastTrackedPage && source !== 'pageload') {
      return;
    }

    lastTrackedPage = currentPage;
    
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
      console.log(`Tracked visit: ${currentPage} (${source})`);
    } catch (error) {
      console.error('Failed to track visit:', error);
    }
  }

  // 拦截站内链接点击
  function interceptLinks() {
    document.addEventListener('click', function(e) {
      const link = e.target.closest('a');
      if (!link) return;

      const href = link.getAttribute('href');
      if (!href) return;

      // 检查是否为站内链接
      if (href.startsWith('/') || 
          href.startsWith('./') || 
          href.startsWith('../') ||
          href.includes(window.location.hostname)) {
        
        // 延迟一点时间，让页面导航完成
        setTimeout(() => {
          trackVisit('link-click');
        }, 100);
      }
    });
  }

  // 监听浏览器前进后退
  function listenToNavigation() {
    window.addEventListener('popstate', function(e) {
      setTimeout(() => {
        trackVisit('browser-navigation');
      }, 100);
    });

    // 监听 hash 变化（单页应用路由）
    window.addEventListener('hashchange', function(e) {
      setTimeout(() => {
        trackVisit('hash-change');
      }, 100);
    });
  }

  // 监听页面可见性变化（用户切换标签页回来）
  function listenToVisibility() {
    document.addEventListener('visibilitychange', function() {
      if (!document.hidden) {
        // 页面变为可见时，检查是否需要记录
        setTimeout(() => {
          trackVisit('tab-focus');
        }, 200);
      }
    });
  }

  // 定期检查URL变化（兜底机制）
  function startPeriodicCheck() {
    setInterval(() => {
      const currentPage = window.location.pathname || '/';
      if (currentPage !== lastTrackedPage) {
        trackVisit('periodic-check');
      }
    }, 3000); // 每3秒检查一次
  }

  // 初始化
  function init() {
    // 页面加载时记录
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => trackVisit('pageload'));
    } else {
      trackVisit('pageload');
    }

    // 设置各种监听器
    interceptLinks();
    listenToNavigation();
    listenToVisibility();
    startPeriodicCheck();

    // 监听登录状态变化
    window.addEventListener('storage', (e) => {
      if (e.key === 'loginUser' && e.newValue) {
        trackVisit('login-change');
      }
    });
  }

  // 提供全局控制接口
  window.userTracking = {
    enable: () => { trackingEnabled = true; },
    disable: () => { trackingEnabled = false; },
    track: () => trackVisit('manual'),
    getLastPage: () => lastTrackedPage
  };

  // 启动追踪
  init();
})();
