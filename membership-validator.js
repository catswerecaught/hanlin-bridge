// 全局会员权限验证 - 完全依赖云端数据
class MembershipValidator {
  
  // 检查当前用户的Pro权限
  static async checkProAccess() {
    const loginUser = JSON.parse(localStorage.getItem('loginUser') || '{}');
    
    if (!loginUser.username) {
      return {
        hasAccess: false,
        reason: '请先登录',
        showModal: false
      };
    }

    try {
      // 从云端获取最新的会员信息
      const response = await fetch(`/api/membership?username=${loginUser.username}`);
      if (!response.ok) {
        throw new Error('无法验证会员状态');
      }

      const data = await response.json();
      const membership = data.membership;

      if (!membership) {
        return {
          hasAccess: false,
          reason: '无会员信息',
          showModal: true
        };
      }

      // 检查是否到期
      if (membership.expire && membership.expire !== '终身会员') {
        const now = new Date();
        const expireDate = new Date(membership.expire);
        
        if (expireDate < now) {
          // 如果本地 localStorage 还显示Pro，立即更新
          if (loginUser.vip === 'Pro会员') {
            loginUser.vip = '普通会员';
            localStorage.setItem('loginUser', JSON.stringify(loginUser));
            console.log('⚠️ 检测到会员已到期，已更新本地状态');
          }
          
          return {
            hasAccess: false,
            reason: `会员已于 ${membership.expire} 到期`,
            showModal: true,
            expireDate: membership.expire
          };
        }
      }

      // 检查会员等级
      const isProMember = membership.vip === 'Pro会员' || membership.expire === '终身会员';
      
      if (!isProMember) {
        return {
          hasAccess: false,
          reason: '该功能仅向Pro会员开放',
          showModal: true,
          currentLevel: membership.vip
        };
      }

      // 更新本地状态（确保一致性）
      if (loginUser.vip !== membership.vip || loginUser.expire !== membership.expire) {
        loginUser.vip = membership.vip;
        loginUser.expire = membership.expire;
        loginUser.supreme = membership.supreme;
        localStorage.setItem('loginUser', JSON.stringify(loginUser));
        console.log('✅ 已同步最新会员状态到本地');
      }

      return {
        hasAccess: true,
        reason: '权限验证通过',
        membershipInfo: membership
      };

    } catch (error) {
      console.error('❌ 权限验证失败:', error);
      return {
        hasAccess: false,
        reason: '权限验证失败，请重试',
        showModal: true
      };
    }
  }

  // 显示Pro会员提示弹窗
  static showProOnlyModal(reason = '该功能仅向Pro会员开放', details = null) {
    // 移除已存在的弹窗
    const existingModal = document.getElementById('proOnlyModal');
    if (existingModal) existingModal.remove();

    // 创建弹窗
    const modal = document.createElement('div');
    modal.id = 'proOnlyModal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.6);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: fadeIn 0.3s ease;
    `;

    let detailsText = '';
    if (details && details.expireDate) {
      detailsText = `<p style="color:#ff6b6b;font-size:14px;margin-top:8px;">到期时间: ${details.expireDate}</p>`;
    } else if (details && details.currentLevel) {
      detailsText = `<p style="color:#999;font-size:14px;margin-top:8px;">当前等级: ${details.currentLevel}</p>`;
    }

    modal.innerHTML = `
      <div style="background:white;border-radius:16px;padding:24px;max-width:400px;width:90%;text-align:center;animation:slideUp 0.3s ease;">
        <div style="color:#ff6b6b;font-size:48px;margin-bottom:16px;">🔒</div>
        <h3 style="margin:0 0 12px 0;color:#333;font-size:18px;">需要Pro会员</h3>
        <p style="color:#666;margin:0;line-height:1.5;">${reason}</p>
        ${detailsText}
        <button onclick="this.closest('#proOnlyModal').remove()" 
          style="margin-top:20px;padding:10px 24px;background:#007aff;color:white;border:none;border-radius:8px;cursor:pointer;font-size:16px;">
          我知道了
        </button>
      </div>
      <style>
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      </style>
    `;

    document.body.appendChild(modal);

    // 3秒后自动关闭
    setTimeout(() => {
      if (modal.parentElement) {
        modal.remove();
      }
    }, 3000);
  }

  // 便捷方法：检查权限并在无权限时显示弹窗
  static async validateAndShowModal() {
    const result = await this.checkProAccess();
    
    if (!result.hasAccess && result.showModal) {
      this.showProOnlyModal(result.reason, {
        expireDate: result.expireDate,
        currentLevel: result.currentLevel
      });
    }
    
    return result.hasAccess;
  }
}

// 全局函数，供其他脚本调用
window.checkProAccess = MembershipValidator.checkProAccess.bind(MembershipValidator);
window.showProOnlyModal = MembershipValidator.showProOnlyModal.bind(MembershipValidator);
window.validateProAccess = MembershipValidator.validateAndShowModal.bind(MembershipValidator);

console.log('✅ 会员权限验证器已加载');
