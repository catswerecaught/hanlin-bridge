// 个人主页 profile.js 全新重写
// 仅在登录状态下渲染信息，否则跳转首页
// 显示会员等级、到期时间、用户名、账号、密码（星号/显示切换）
// 进入个人主页自动弹出登出按钮

// 1. 本地模拟用户数据库（与script.js保持一致）
const users = [
  { name: 'admin', username: 'admin', password: '962777', vip: 'Pro会员', avatar: 'images/user00001.jpg', supreme: true, expire: '2025-12-31' },
  { name: '李雷', username: 'user00002', password: 'abc123', vip: 'Pro会员', avatar: 'images/user00002.jpg', supreme: false, expire: '2025-11-30' },
  { name: '张三', username: 'user00003', password: 'pass321', vip: '普通会员', avatar: 'images/user00003.jpg', supreme: false, expire: '2024-12-31' },
  { name: '赵四', username: 'user00004', password: 'qwerty', vip: '普通会员', avatar: 'images/user00004.jpg', supreme: false, expire: '2024-10-15' },
  { name: '邬学长', username: 'goxuezhang', password: 'letmein', vip: '', avatar: 'images/user00005.jpg', supreme: false, expire: '-' }
];

document.addEventListener('DOMContentLoaded', function() {
  // 1. 登录检测
  let user = null;
  try {
    user = JSON.parse(localStorage.getItem('loginUser'));
  } catch (e) {
    user = null;
  }
  if (!user || typeof user !== 'object') {
    window.location.href = 'index.html';
    return;
  }
  // 2. 每次刷新页面都用本地users数组同步最新会员信息
  const latest = users.find(u => u.username === user.username);
  if (latest) {
    user = { ...latest };
    localStorage.setItem('loginUser', JSON.stringify(user));
  }

  // 2. 渲染个人主页内容
  const wrapper = document.getElementById('profileWrapper');
  // 会员等级与样式
  let vipText = '非会员';
  let vipClass = '';
  if (user.vip === 'Pro会员') {
    vipText = 'Pro会员';
    vipClass = 'profile-vip-pro';
  } else if (user.vip === '普通会员') {
    vipText = '普通会员';
    vipClass = 'profile-vip-normal';
  }
  // 头像和认证标识
  let badge = '';
  if (user.vip === 'Pro会员') {
    badge = '<img class="profile-vip-badge" src="images/vip-pro.png" alt="Pro会员" style="position:absolute;right:-2px;bottom:-2px;width:22px;height:22px;">';
  } else if (user.vip === '普通会员') {
    badge = '<img class="profile-vip-badge" src="images/vip-normal.png" alt="普通会员" style="position:absolute;right:-2px;bottom:-2px;width:22px;height:22px;">';
  }
  let subText = '';
  if (user.vip === 'Pro会员') {
    subText = `尊敬的${user.name || user.username || '用户'}，您已解锁全部会员权益。`;
  } else if (user.vip === '普通会员') {
    subText = '普通会员';
  } else {
    subText = '非会员';
  }
  // 会员到期时间显示逻辑
  let expireText = '-';
  if (user.expire === 'forever' || user.expire === '终身') {
    expireText = '终身会员';
  } else if (user.expire) {
    expireText = user.expire;
  }
  wrapper.innerHTML = `
    <div class="profile-header" style="display:flex;align-items:center;gap:18px;margin-bottom:28px;">
      <div style="position:relative;display:inline-block;">
        <img class="profile-avatar" src="${user.avatar || 'images/login-default.png'}" alt="头像" style="width:64px;height:64px;border-radius:50%;object-fit:cover;border:3px solid #fff;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        ${badge ? badge : ''}
      </div>
      <div>
        <div style="font-size:1.25em;font-weight:700;">${user.name || user.username || '未命名'}</div>
        <div class="${vipClass}" style="margin-top:2px;">${subText}</div>
      </div>
    </div>
    <div class="profile-info-row"><div class="profile-info-label">会员等级</div><div class="profile-info-value ${vipClass}">${vipText}</div></div>
    <div class="profile-info-row"><div class="profile-info-label">到期时间</div><div class="profile-info-value">${expireText}</div></div>
    <div class="profile-info-row"><div class="profile-info-label">用户名</div><div class="profile-info-value">${user.name || '-'}</div></div>
    <div class="profile-info-row"><div class="profile-info-label">账号</div><div class="profile-info-value">${user.username || '-'}</div></div>
    <div class="profile-info-row"><div class="profile-info-label">密码</div><div class="profile-info-value"><span class="profile-password" id="profilePassword">******</span><button class="profile-show-btn" id="showPwdBtn">显示</button></div></div>
  `;
  // 密码显示/隐藏逻辑
  document.getElementById('showPwdBtn').onclick = function() {
    const pwdSpan = document.getElementById('profilePassword');
    if (pwdSpan.textContent === '******') {
      pwdSpan.textContent = user.password || '******';
      this.textContent = '隐藏';
    } else {
      pwdSpan.textContent = '******';
      this.textContent = '显示';
    }
  };
  // 进入个人主页时自动弹出登出按钮
  setTimeout(function() {
    var avatar = document.getElementById('userAvatar');
    if (avatar) avatar.classList.add('show-logout');
  }, 80);
}); 