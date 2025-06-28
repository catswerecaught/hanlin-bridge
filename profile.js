// 个人主页 profile.js 全新重写
// 仅在登录状态下渲染信息，否则跳转首页
// 显示会员等级、到期时间、用户名、账号、密码（星号/显示切换）
// 进入个人主页自动弹出登出按钮

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
  // 保证余额卡片容器存在
  let balanceCardWrapper = document.getElementById('balanceCardWrapper');
  if (!balanceCardWrapper) {
    balanceCardWrapper = document.createElement('div');
    balanceCardWrapper.className = 'balance-card-wrapper';
    balanceCardWrapper.id = 'balanceCardWrapper';
    balanceCardWrapper.style.width = '100%';
    balanceCardWrapper.style.margin = '18px 0 0 0';
    wrapper.appendChild(balanceCardWrapper);
  }
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
  // 重新插入余额卡片容器到profile信息下方
  if (!wrapper.contains(balanceCardWrapper)) {
    wrapper.appendChild(balanceCardWrapper);
  }
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

  // ========== 助学工具组件 ========== //
  const teachingToolWrapper = document.getElementById('teachingToolWrapper');
  const teachingProgressList = document.getElementById('teachingProgressList');
  const newProgressBtn = document.getElementById('newProgressBtn');
  const teachingProgressForm = document.getElementById('teachingProgressForm');
  const classCardList = document.getElementById('classCardList');

  let teachingProgressData = [];
  let editingIndex = null;
  let classList = [];
  let selectedClass = null;

  function getCurrentUser() {
    try {
      return JSON.parse(localStorage.getItem('loginUser'));
    } catch { return null; }
  }

  function renderClassCardList() {
    classCardList.innerHTML = '';
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.flexWrap = 'wrap';
    row.style.gap = '14px';
    // 班级卡片
    classList.forEach((cls, idx) => {
      const card = document.createElement('div');
      card.className = 'class-card-apple';
      card.textContent = cls;
      if(selectedClass===cls) card.classList.add('active');
      card.onclick = async function(){
        selectedClass = cls;
        renderClassCardList();
        teachingProgressData = await fetchTeachingProgressData();
        renderTeachingProgressList();
      };
      // 删除按钮
      const delBtn = document.createElement('button');
      delBtn.textContent = '×';
      delBtn.className = 'class-card-del';
      delBtn.onclick = function(e){
        e.stopPropagation();
        if(confirm('确定删除该班级及其所有进度？')){
          // 删除该班级及其进度
          const idx = classList.indexOf(cls);
          if(idx>-1) classList.splice(idx,1);
          teachingProgressData = teachingProgressData.filter(item=>item.class!==cls);
          if(selectedClass===cls) selectedClass = classList[0]||null;
          saveClassList();
          saveTeachingProgressData();
          renderClassCardList();
          renderTeachingProgressList();
        }
      };
      card.appendChild(delBtn);
      row.appendChild(card);
    });
    // 新建班级按钮
    const addBtn = document.createElement('button');
    addBtn.textContent = '+ 新建班级';
    addBtn.className = 'apple-btn-outline';
    addBtn.onclick = function(){
      showAddClassDialog();
    };
    row.appendChild(addBtn);
    classCardList.appendChild(row);
  }

  function showAddClassDialog() {
    // 弹窗式新建班级
    const modal = document.createElement('div');
    modal.style.position = 'fixed';
    modal.style.left = '0';
    modal.style.top = '0';
    modal.style.width = '100vw';
    modal.style.height = '100vh';
    modal.style.background = 'rgba(0,0,0,0.18)';
    modal.style.zIndex = '9999';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    const box = document.createElement('div');
    box.style.background = '#fff';
    box.style.borderRadius = '16px';
    box.style.boxShadow = '0 4px 24px rgba(0,0,0,0.13)';
    box.style.padding = '32px 36px 24px 36px';
    box.style.minWidth = '320px';
    box.innerHTML = '<div style="font-size:1.18em;font-weight:600;margin-bottom:18px;">新建班级</div>';
    const gradeSelect = document.createElement('select');
    gradeSelect.className = 'apple-input';
    gradeSelect.style.marginRight = '12px';
    ['高一','高二','高三'].forEach(g => {
      const opt = document.createElement('option');
      opt.value = g;
      opt.textContent = g;
      gradeSelect.appendChild(opt);
    });
    const classSelect = document.createElement('select');
    classSelect.className = 'apple-input';
    for(let i=1;i<=10;i++){
      const opt = document.createElement('option');
      opt.value = i+'班';
      opt.textContent = i+'班';
      classSelect.appendChild(opt);
    }
    box.appendChild(gradeSelect);
    box.appendChild(classSelect);
    const btnRow = document.createElement('div');
    btnRow.style.display = 'flex';
    btnRow.style.gap = '18px';
    btnRow.style.marginTop = '24px';
    const okBtn = document.createElement('button');
    okBtn.textContent = '确定';
    okBtn.className = 'apple-btn-primary';
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = '取消';
    cancelBtn.className = 'apple-btn-outline';
    btnRow.appendChild(okBtn);
    btnRow.appendChild(cancelBtn);
    box.appendChild(btnRow);
    modal.appendChild(box);
    document.body.appendChild(modal);
    okBtn.onclick = function(){
      const cls = gradeSelect.value+classSelect.value;
      if(classList.includes(cls)){
        alert('该班级已存在');
        return;
      }
      classList.push(cls);
      selectedClass = cls;
      saveClassList();
      renderClassCardList();
      renderTeachingProgressList();
      document.body.removeChild(modal);
    };
    cancelBtn.onclick = function(){
      document.body.removeChild(modal);
    };
  }

  function renderTeachingProgressList() {
    teachingProgressList.innerHTML = '';
    if (!teachingProgressData || teachingProgressData.length === 0 || !selectedClass) {
      teachingProgressList.innerHTML = '<div style="color:#888;margin-bottom:18px;">暂无教学进度记录</div>';
      newProgressBtn.style.display = selectedClass ? '' : 'none';
      return;
    }
    newProgressBtn.style.display = '';
    const list = document.createElement('div');
    list.style.display = 'flex';
    list.style.flexDirection = 'column';
    list.style.gap = '18px';
    teachingProgressData.filter(item=>item.class===selectedClass).forEach((item, idx) => {
      const card = document.createElement('div');
      card.className = 'teaching-progress-card';
      card.style.background = '#fff';
      card.style.borderRadius = '16px';
      card.style.boxShadow = '0 4px 16px rgba(0,0,0,0.06)';
      card.style.padding = '20px 22px 14px 22px';
      card.style.position = 'relative';
      card.style.border = '1px solid #e0e6ef';
      card.innerHTML = `
        <div style="font-size:1.08em;font-weight:600;color:#007aff;letter-spacing:0.5px;">${item.class || '-'}
          <span style="font-size:0.95em;color:#888;font-weight:400;margin-left:12px;">${item.type || ''}${item.paper ? ' · ' + item.paper : ''}${item.remark ? '（' + item.remark + '）' : ''}</span>
        </div>
        <div style="margin:8px 0 10px 0;color:#222;line-height:1.7;font-weight:500;">${item.content ? item.content : ''}</div>
        <div style="font-size:13px;color:#aaa;">${item.time || ''}</div>
        <div style="position:absolute;top:18px;right:18px;display:flex;gap:10px;">
          <button class="edit-progress-btn apple-btn-outline" data-idx="${idx}">编辑</button>
          <button class="delete-progress-btn apple-btn-outline-red" data-idx="${idx}">删除</button>
        </div>
      `;
      list.appendChild(card);
    });
    teachingProgressList.appendChild(list);
    // 绑定编辑/删除
    teachingProgressList.querySelectorAll('.edit-progress-btn').forEach(btn => {
      btn.onclick = function() {
        const idx = parseInt(btn.getAttribute('data-idx'));
        const filtered = teachingProgressData.filter(item=>item.class===selectedClass);
        editingIndex = teachingProgressData.indexOf(filtered[idx]);
        showTeachingProgressForm(teachingProgressData[editingIndex]);
      };
    });
    teachingProgressList.querySelectorAll('.delete-progress-btn').forEach(btn => {
      btn.onclick = async function() {
        const idx = parseInt(btn.getAttribute('data-idx'));
        const filtered = teachingProgressData.filter(item=>item.class===selectedClass);
        const realIdx = teachingProgressData.indexOf(filtered[idx]);
        if (confirm('确定要删除这条教学进度吗？')) {
          teachingProgressData.splice(realIdx, 1);
          await saveTeachingProgressData();
          renderTeachingProgressList();
        }
      };
    });
  }

  function showTeachingProgressForm(data) {
    teachingProgressForm.style.display = '';
    newProgressBtn.style.display = 'none';
    teachingProgressForm.innerHTML = '';
    // 步骤1：班级显示
    const classRow = document.createElement('div');
    classRow.style.marginBottom = '16px';
    classRow.innerHTML = `<div style=\"font-weight:600;margin-bottom:7px;margin-top:22px;\">班级</div><div style=\"font-size:1.1em;font-weight:500;color:#007aff;\">${selectedClass||'-'}</div>`;
    teachingProgressForm.appendChild(classRow);
    // 步骤2：课堂内容
    const typeRow = document.createElement('div');
    typeRow.style.marginBottom = '16px';
    typeRow.innerHTML = '<div style="font-weight:600;margin-bottom:7px;">课堂内容</div>';
    const typeSelect = document.createElement('select');
    typeSelect.className = 'apple-input';
    ['试卷讲评','上课'].forEach(t => {
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = t;
      typeSelect.appendChild(opt);
    });
    typeRow.appendChild(typeSelect);
    // 试卷讲评细分
    const paperSelect = document.createElement('select');
    paperSelect.className = 'apple-input';
    ['一模卷','二模卷','月考','随堂测试'].forEach(p => {
      const opt = document.createElement('option');
      opt.value = p;
      opt.textContent = p;
      paperSelect.appendChild(opt);
    });
    paperSelect.style.marginLeft = '10px';
    paperSelect.style.display = 'none';
    // 备注
    const remarkInput = document.createElement('input');
    remarkInput.type = 'text';
    remarkInput.placeholder = '备注（可选）';
    remarkInput.className = 'apple-input';
    remarkInput.style.marginLeft = '10px';
    remarkInput.style.width = '120px';
    remarkInput.style.display = 'none';
    // 上课自定义内容
    const customInput = document.createElement('input');
    customInput.type = 'text';
    customInput.placeholder = '自定义内容（可选）';
    customInput.className = 'apple-input';
    customInput.style.marginLeft = '10px';
    customInput.style.width = '120px';
    customInput.style.display = 'none';
    // 切换显示
    typeSelect.onchange = function() {
      if(typeSelect.value==='试卷讲评'){
        paperSelect.style.display = '';
        remarkInput.style.display = '';
        customInput.style.display = 'none';
      }else{
        paperSelect.style.display = 'none';
        remarkInput.style.display = 'none';
        customInput.style.display = '';
      }
    };
    typeRow.appendChild(paperSelect);
    typeRow.appendChild(remarkInput);
    typeRow.appendChild(customInput);
    teachingProgressForm.appendChild(typeRow);
    // 默认触发一次change，确保试卷讲评的后续选项显示
    setTimeout(()=>{ typeSelect.onchange(); }, 0);
    // 步骤3：教学进度
    const contentRow = document.createElement('div');
    contentRow.style.marginBottom = '16px';
    contentRow.innerHTML = '<div style="font-weight:600;margin-bottom:7px;">教学进度</div>';
    const contentInput = document.createElement('textarea');
    contentInput.rows = 3;
    contentInput.className = 'apple-input';
    contentInput.style.width = '100%';
    contentInput.style.maxWidth = '480px';
    contentInput.style.minWidth = '180px';
    contentInput.style.display = 'block';
    contentInput.style.margin = '0';
    contentInput.placeholder = '可留空';
    contentRow.appendChild(contentInput);
    teachingProgressForm.appendChild(contentRow);
    // 步骤4：保存/取消
    const btnRow = document.createElement('div');
    btnRow.style.display = 'flex';
    btnRow.style.gap = '18px';
    const saveBtn = document.createElement('button');
    saveBtn.textContent = '保存';
    saveBtn.className = 'apple-btn-primary';
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = '取消';
    cancelBtn.className = 'apple-btn-outline';
    btnRow.appendChild(saveBtn);
    btnRow.appendChild(cancelBtn);
    teachingProgressForm.appendChild(btnRow);
    // 回填数据
    if(data){
      if(data.type) typeSelect.value = data.type;
      if(data.type==='试卷讲评'){
        paperSelect.style.display = '';
        remarkInput.style.display = '';
        customInput.style.display = 'none';
        if(data.paper) paperSelect.value = data.paper;
        if(data.remark) remarkInput.value = data.remark;
      }else{
        paperSelect.style.display = 'none';
        remarkInput.style.display = 'none';
        customInput.style.display = '';
        if(data.paper) customInput.value = data.paper;
      }
      if(data.content) contentInput.value = data.content;
    }
    // 保存
    saveBtn.onclick = async function() {
      const item = {
        class: selectedClass,
        type: typeSelect.value,
        paper: typeSelect.value==='试卷讲评' ? paperSelect.value : customInput.value,
        remark: typeSelect.value==='试卷讲评' ? remarkInput.value : '',
        content: contentInput.value,
        time: getCurrentHourString()
      };
      if(editingIndex!==null){
        teachingProgressData[editingIndex] = item;
      }else{
        teachingProgressData.unshift(item);
      }
      await saveTeachingProgressData();
      teachingProgressForm.style.display = 'none';
      editingIndex = null;
      showSaveSuccessToast();
      // 自动点击当前班级卡片，刷新进度
      setTimeout(() => {
        const cards = document.querySelectorAll('.class-card-apple');
        for (let card of cards) {
          if (card.textContent.replace('×','') === selectedClass) {
            card.click();
            break;
          }
        }
      }, 0);
    };
    // 取消
    cancelBtn.onclick = function() {
      teachingProgressForm.style.display = 'none';
      editingIndex = null;
      newProgressBtn.style.display = '';
    };
  }

  function getCurrentHourString() {
    const d = new Date();
    d.setMinutes(0,0,0);
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')+' '+String(d.getHours()).padStart(2,'0')+':00';
  }

  async function fetchTeachingProgressData() {
    const user = getCurrentUser();
    if(!user) return [];
    try {
      const res = await fetch(`/api/teaching-progress?user=${encodeURIComponent(user.username)}`);
      if(!res.ok) return [];
      return await res.json();
    }catch{return[];}
  }

  async function saveTeachingProgressData() {
    const user = getCurrentUser();
    if(!user) return;
    await fetch(`/api/teaching-progress`,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({user:user.username,data:teachingProgressData})
    });
  }

  async function fetchClassList() {
    const user = getCurrentUser();
    if(!user) return [];
    try {
      const res = await fetch(`/api/teaching-class?user=${encodeURIComponent(user.username)}`);
      if(!res.ok) return [];
      return await res.json();
    }catch{return[];}
  }

  async function saveClassList() {
    const user = getCurrentUser();
    if(!user) return;
    await fetch(`/api/teaching-class`,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({user:user.username,data:classList})
    });
  }

  // 初始化
  if(teachingToolWrapper){
    (async function(){
      classList = await fetchClassList();
      teachingProgressData = await fetchTeachingProgressData();
      selectedClass = classList[0]||null;
      renderClassCardList();
      renderTeachingProgressList();
      newProgressBtn.onclick = function(){
        editingIndex = null;
        showTeachingProgressForm();
      };
    })();
  }

  // 保存成功提示
  function showSaveSuccessToast() {
    let toast = document.getElementById('saveSuccessToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'saveSuccessToast';
      toast.style.position = 'fixed';
      toast.style.left = '50%';
      toast.style.top = '80px';
      toast.style.transform = 'translateX(-50%)';
      toast.style.background = 'rgba(34,34,34,0.97)';
      toast.style.color = '#fff';
      toast.style.fontSize = '17px';
      toast.style.padding = '14px 36px';
      toast.style.borderRadius = '14px';
      toast.style.zIndex = '3000';
      toast.style.boxShadow = '0 4px 24px rgba(0,0,0,0.18)';
      toast.style.pointerEvents = 'none';
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.4s';
      toast.textContent = '保存成功';
      document.body.appendChild(toast);
    }
    toast.textContent = '保存成功';
    toast.style.opacity = '1';
    setTimeout(() => {
      toast.style.opacity = '0';
    }, 1500);
  }

  // ===== 余额卡片组件 =====
  async function fetchBalance() {
    const user = getCurrentUser();
    if (!user) return { amount: 0, cardType: 'M1' };
    try {
      const res = await fetch(`/api/balance?user=${encodeURIComponent(user.username)}`);
      if (!res.ok) return { amount: 0, cardType: 'M1' };
      return await res.json();
    } catch {
      return { amount: 0, cardType: 'M1' };
    }
  }
  async function saveBalance(data) {
    const user = getCurrentUser();
    if (!user) return;
    await fetch(`/api/balance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: user.username, data })
    });
  }
  function renderBalanceCard(balance) {
    if (!balanceCardWrapper) return;
    const { amount = 0, cardType = 'M1' } = balance || {};
    // 卡片配色与风格（10卡种共用4主色）
    const cardStyle = {
      '大众': 'background:linear-gradient(90deg,#e6e9f0 0%,#eef1f5 100%);color:#222;',
      '金卡': 'background:linear-gradient(90deg,#f7ecd0 0%,#f5e7b2 100%);color:#bfa14b;',
      '金玉兰': 'background:linear-gradient(90deg,#f7d9e3 0%,#fbeee6 100%);color:#b71c1c;',
      '至臻明珠': 'background:linear-gradient(120deg,#232526 0%,#414345 100%);color:#fff;position:relative;overflow:hidden;'
    };
    function getCardClass(type) {
      if(type.startsWith('大众')) return '大众';
      if(type.startsWith('金卡')) return '金卡';
      if(type.startsWith('金玉兰')) return '金玉兰';
      if(type.startsWith('至臻明珠')) return '至臻明珠';
      return '大众';
    }
    const cardClass = getCardClass(cardType);
    balanceCardWrapper.innerHTML = `
      <div class="balance-card-mplus" style="width:100%;max-width:420px;margin:0 auto 0 auto;padding:0;">
        <div class="balance-card-bg-${cardClass}" style="${cardStyle[cardClass]}border-radius:18px;padding:28px 32px 22px 32px;box-shadow:0 4px 24px rgba(0,0,0,0.10);display:flex;flex-direction:column;align-items:flex-start;gap:12px;">
          <div style="font-size:1.1em;font-weight:600;letter-spacing:1px;opacity:0.85;">账户积分余额</div>
          <div id="balanceAmount" style="font-size:2.2em;font-weight:700;letter-spacing:1px;margin:6px 0 0 0;${cardClass==='至臻明珠' ? 'background:linear-gradient(90deg,#7ed6ff 0%,#b2e0ff 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;text-fill-color:transparent;' : ''}">${formatBalance(amount)}</div>
          <div style="font-size:1em;font-weight:500;opacity:0.7;margin-top:8px;${cardClass==='至臻明珠' ? 'background:linear-gradient(90deg,#7ed6ff 0%,#b2e0ff 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;text-fill-color:transparent;font-weight:700;' : ''}">${cardType}</div>
        </div>
      </div>
    `;
  }
  function formatBalance(val) {
    return '￥' + Number(val).toLocaleString('zh-CN', {minimumFractionDigits: 2, maximumFractionDigits: 2});
  }
  // 初始化余额卡片
  if (balanceCardWrapper) {
    (async function(){
      const balance = await fetchBalance();
      renderBalanceCard(balance);
    })();
  }
}); 