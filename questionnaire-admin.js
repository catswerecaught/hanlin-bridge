document.addEventListener('DOMContentLoaded', () => {
  // 权限检查
  let user = null;
  try {
    user = JSON.parse(localStorage.getItem('loginUser'));
  } catch (e) {
    user = null;
  }
  
  if (!user || user.supreme !== true) {
    alert('权限不足，仅管理员可访问');
    window.location.href = 'profile.html';
    return;
  }

  const loadingState = document.getElementById('loadingState');
  const questionnaireList = document.getElementById('questionnaireList');
  const emptyState = document.getElementById('emptyState');
  const qnTableBody = document.getElementById('qnTableBody');
  
  const createQnBtn = document.getElementById('createQnBtn');
  const qnModal = document.getElementById('qnModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalClose = document.getElementById('modalClose');
  const cancelBtn = document.getElementById('cancelBtn');
  const qnForm = document.getElementById('qnForm');
  
  const qnTitleInput = document.getElementById('qnTitleInput');
  const qnDescInput = document.getElementById('qnDescInput');
  const qnCodeInput = document.getElementById('qnCodeInput');

  let questionnaires = [];
  let editingQnId = null;

  // 生成随机校验码
  function generateCode() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    const seg = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `${seg()}-${seg()}-${seg()}`;
  }

  // 格式化时间
  function formatTime(timestamp) {
    return new Date(timestamp).toLocaleString('zh-CN');
  }

  // 显示模态框
  function showModal(title = '创建问卷', qn = null) {
    // 直接打开编辑器页面
    window.open('questionnaire-editor.html', '_blank');
  }

  // 隐藏模态框
  function hideModal() {
    qnModal.style.display = 'none';
    editingQnId = null;
  }

  // 渲染问卷列表
  function renderQuestionnaires() {
    if (questionnaires.length === 0) {
      loadingState.style.display = 'none';
      questionnaireList.style.display = 'none';
      emptyState.style.display = 'block';
      return;
    }

    loadingState.style.display = 'none';
    emptyState.style.display = 'none';
    questionnaireList.style.display = 'block';

    qnTableBody.innerHTML = questionnaires.map(qn => `
      <tr>
        <td><strong>${qn.title || '未命名问卷'}</strong></td>
        <td><span class="${qn.published ? 'status-published' : 'status-draft'}">${qn.published ? '已发布' : '草稿'}</span></td>
        <td>${formatTime(qn.createdAt)}</td>
        <td><code>${qn.code || '-'}</code></td>
        <td>${qn.responseCount || 0}</td>
        <td>
          <div class="actions">
            <button class="btn-success" onclick="editQuestionnaire('${qn.id}')">编辑</button>
            <button class="btn-primary" onclick="viewResponses('${qn.id}')" title="查看答卷统计">查看答卷</button>
            <button class="btn-primary" onclick="togglePublish('${qn.id}')">${qn.published ? '取消发布' : '发布'}</button>
            <button class="btn-danger" onclick="deleteQuestionnaire('${qn.id}')">删除</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  // 加载问卷列表
  async function loadQuestionnaires() {
    try {
      // 从localStorage加载问卷
      const savedQuestionnaires = JSON.parse(localStorage.getItem('questionnaires') || '[]');
      questionnaires = [
        {
          id: 'demo-001',
          title: '悠然问卷示例',
          description: '这是一个示例问卷',
          code: 'abcd-ef12-3456',
          published: true,
          createdAt: new Date().toISOString(),
          responseCount: 10
        },
        ...savedQuestionnaires
      ];
      renderQuestionnaires();
    } catch (error) {
      console.error('加载问卷失败:', error);
      loadingState.innerHTML = '<div style="color:#ff3b30;">加载失败，请刷新重试</div>';
    }
  }

  // 保存问卷
  async function saveQuestionnaire(formData) {
    try {
      const qnData = {
        id: editingQnId || `qn-${Date.now()}`,
        title: formData.get('title'),
        description: formData.get('description'),
        code: formData.get('code'),
        published: false,
        createdAt: editingQnId ? questionnaires.find(q => q.id === editingQnId)?.createdAt : new Date().toISOString(),
        fields: [] // 暂时为空，后续添加字段编辑功能
      };

      if (editingQnId) {
        const index = questionnaires.findIndex(q => q.id === editingQnId);
        if (index >= 0) questionnaires[index] = { ...questionnaires[index], ...qnData };
      } else {
        questionnaires.push(qnData);
      }

      renderQuestionnaires();
      hideModal();
      alert(editingQnId ? '问卷更新成功' : '问卷创建成功');
    } catch (error) {
      console.error('保存问卷失败:', error);
      alert('保存失败，请重试');
    }
  }

  // 全局函数供HTML调用
  window.editQuestionnaire = (id) => {
    const qn = questionnaires.find(q => q.id === id);
    if (!qn) return;
    
    if (qn.published) {
      alert('已发布的问卷不能修改，这会影响作答统计。请先取消发布后再编辑。');
      return;
    }
    
    // 打开编辑器页面并传递问卷ID
    window.open(`questionnaire-editor.html?id=${id}`, '_blank');
  };

  window.togglePublish = (id) => {
    const qn = questionnaires.find(q => q.id === id);
    if (qn) {
      qn.published = !qn.published;
      renderQuestionnaires();
      alert(qn.published ? '问卷已发布' : '问卷已取消发布');
    }
  };

  window.viewResponses = (id) => {
    // 打开答卷统计页面
    window.open(`questionnaire-responses.html?id=${id}`, '_blank');
  };

  window.deleteQuestionnaire = (id) => {
    if (confirm('确定要删除这个问卷吗？此操作不可撤销。')) {
      questionnaires = questionnaires.filter(q => q.id !== id);
      // 同步更新localStorage
      const savedQuestionnaires = JSON.parse(localStorage.getItem('questionnaires') || '[]');
      const updatedQuestionnaires = savedQuestionnaires.filter(q => q.id !== id);
      localStorage.setItem('questionnaires', JSON.stringify(updatedQuestionnaires));
      
      renderQuestionnaires();
      alert('问卷已删除');
    }
  };

  // 事件绑定
  createQnBtn.addEventListener('click', () => showModal());
  modalClose.addEventListener('click', hideModal);
  cancelBtn.addEventListener('click', hideModal);
  
  qnModal.addEventListener('click', (e) => {
    if (e.target === qnModal) hideModal();
  });

  qnForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('title', qnTitleInput.value.trim());
    formData.append('description', qnDescInput.value.trim());
    formData.append('code', qnCodeInput.value.trim());
    
    if (!formData.get('title')) {
      alert('请输入问卷标题');
      return;
    }
    
    if (!formData.get('code') || !/^[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/i.test(formData.get('code'))) {
      alert('请输入正确格式的校验码（xxxx-xxxx-xxxx）');
      return;
    }

    saveQuestionnaire(formData);
  });

  // 初始化
  loadQuestionnaires();
});
