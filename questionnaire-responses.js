document.addEventListener('DOMContentLoaded', () => {
  // 从URL获取问卷ID
  const urlParams = new URLSearchParams(window.location.search);
  const questionnaireId = urlParams.get('id');
  const questionIndex = urlParams.get('question') || 0;
  
  let currentQuestionnaire = null;
  let responses = [];
  let currentResponseIndex = 0;
  
  // 从API或localStorage加载答卷数据
  let mockResponses = [];
  
  // 初始化页面
  function initPage() {
    if (questionnaireId) {
      loadQuestionnaireData(questionnaireId);
    }
    loadResponses();
  }
  
  // 加载问卷数据
  async function loadQuestionnaireData(id) {
    try {
      // 先尝试从API加载问卷
      try {
        const response = await fetch(`/api/questionnaires?id=${id}`);
        if (response.ok) {
          const { id: qnId, ...questionnaire } = await response.json();
          currentQuestionnaire = { id: qnId, ...questionnaire };
        }
      } catch (error) {
        console.log('API加载问卷失败，尝试本地数据:', error);
      }
      
      // 如果API失败，尝试从localStorage加载问卷
      if (!currentQuestionnaire) {
        const savedQuestionnaires = JSON.parse(localStorage.getItem('questionnaires') || '[]');
        let questionnaire = savedQuestionnaires.find(q => q.id === id);
        
        // 如果没找到，使用示例问卷
        if (!questionnaire && id === 'demo-001') {
          questionnaire = {
            id: 'demo-001',
            title: '悠然问卷示例',
            fields: [
              { name: 'name', label: '姓名', type: 'text', required: true },
              { name: 'subject', label: '助学科目', type: 'text', required: true },
              { name: 'scores', label: '成绩', type: 'text', required: true }
            ]
          };
        }
        
        if (questionnaire) {
          currentQuestionnaire = questionnaire;
        }
      }
      
      // 更新页面标题
      if (currentQuestionnaire) {
        if (currentQuestionnaire.fields && currentQuestionnaire.fields[questionIndex]) {
          const questionTitle = currentQuestionnaire.fields[questionIndex];
          document.getElementById('questionnaireTitle').textContent = 
            `第${parseInt(questionIndex) + 1}题：${questionTitle.label}`;
        } else {
          document.getElementById('questionnaireTitle').textContent = currentQuestionnaire.title;
        }
      }
    } catch (error) {
      console.error('加载问卷数据失败:', error);
      document.getElementById('questionnaireTitle').textContent = '问卷加载失败';
    }
  }
  
  // 加载答卷数据
  async function loadResponses() {
    try {
      // 尝试从API加载答卷数据
      if (questionnaireId) {
        console.log('正在加载问卷响应数据:', questionnaireId);
        const resp = await fetch(`/api/questionnaire-responses?questionnaireId=${questionnaireId}`);
        if (resp.ok) {
          const data = await resp.json();
          console.log('API返回数据:', data);
          mockResponses = data.responses || [];
          
          // 更新响应计数显示
          const responseCountEl = document.getElementById('responseCount');
          if (responseCountEl) {
            responseCountEl.textContent = `共 ${data.count || mockResponses.length} 条答卷`;
          }
        } else {
          console.error('API请求失败:', resp.status, resp.statusText);
        }
      }
    } catch (error) {
      console.log('使用本地数据，API暂不可用:', error);
      
      const responseCountEl = document.getElementById('responseCount');
      if (responseCountEl) {
        responseCountEl.textContent = `共 ${mockResponses.length} 条答卷`;
      }
      
      // 如果是示例问卷，提供一些示例数据
      if (questionnaireId === 'demo-001') {
        mockResponses = [
          {
            id: 1,
            ip: '127.0.0.1 (本地)',
            time: new Date().toISOString(),
            source: '网页',
            answers: {
              name: '测试用户1',
              subject: '数学',
              scores: '85'
            }
          }
        ];
      }
    }
    
    responses = mockResponses;
    console.log('最终响应数据:', responses);
    renderResponsesTable();
  }
  
  // 渲染答卷表格
  function renderResponsesTable() {
    const tbody = document.getElementById('responsesTableBody');
    if (!tbody) return;

    console.log('渲染答卷表格，响应数据:', responses);
    console.log('当前问卷:', currentQuestionnaire);
    console.log('问题索引:', questionIndex);

    if (!responses || responses.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">暂无答卷数据</td></tr>';
      return;
    }

    const currentField = currentQuestionnaire?.fields[questionIndex];
    
    tbody.innerHTML = responses.map((response, index) => {
      const answer = currentField ? response.answers?.[currentField.name] || '-' : '-';
      const time = new Date(response.time || response.submittedAt).toLocaleString('zh-CN', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      return `
        <tr>
          <td>${index + 1}</td>
          <td>${time}</td>
          <td>${answer}</td>
          <td><a href="#" class="view-response-btn" data-index="${index}" onclick="viewResponse(${index})">查看答卷</a></td>
        </tr>
      `;
    }).join('');
  }
  
  // 查看答卷详情
  window.viewResponse = (index) => {
    currentResponseIndex = index;
    const response = responses[index];
    if (!response) return;
    
    // 更新模态框标题
    const modalTitle = document.getElementById('responseModalTitle');
    if (modalTitle) modalTitle.textContent = `序号：${index + 1}`;
    
    // 更新元数据
    const updateField = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };
    
    updateField('responseIP', response.ip);
    updateField('responseTime', response.time || response.submittedAt);
    updateField('responseSource', response.source || '网页');
    
    // 更新答卷详情
    const detailsContainer = document.getElementById('responseDetails');
    if (detailsContainer && currentQuestionnaire) {
      detailsContainer.innerHTML = currentQuestionnaire.fields.map((field, i) => {
        const answer = response.answers[field.name] || '-';
        return `
          <div class="response-field">
            <label for="field-${i}">${field.label || field.name}:</label>
            <input type="text" id="field-${i}" name="field-${i}" value="${answer}" readonly>
          </div>
        `;
      }).join('');
    }
    
    // 更新导航按钮状态
    document.getElementById('prevBtn').disabled = index === 0;
    document.getElementById('nextBtn').disabled = index === responses.length - 1;
    
    // 显示模态框
    document.getElementById('responseModal').style.display = 'block';
  };
  
  // 关闭答卷详情模态框
  window.closeResponseModal = () => {
    document.getElementById('responseModal').style.display = 'none';
  };
  
  // 查看上一份答卷
  window.viewPrevResponse = () => {
    if (currentResponseIndex > 0) {
      viewResponse(currentResponseIndex - 1);
    }
  };
  
  // 查看下一份答卷
  window.viewNextResponse = () => {
    if (currentResponseIndex < responses.length - 1) {
      viewResponse(currentResponseIndex + 1);
    }
  };
  
  // 切换星标
  window.toggleStar = () => {
    const starBtn = document.querySelector('.star-btn');
    if (starBtn.textContent.includes('☆')) {
      starBtn.innerHTML = '★ 是否';
    } else {
      starBtn.innerHTML = '☆ 是否';
    }
  };
  
  // 搜索功能
  document.getElementById('searchInput').addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const filteredResponses = mockResponses.filter(response => {
      const currentField = currentQuestionnaire?.fields[questionIndex];
      if (!currentField) return true;
      
      const answer = response.answers[currentField.name] || '';
      return answer.toLowerCase().includes(searchTerm);
    });
    
    responses = filteredResponses;
    renderResponsesTable();
  });
  
  // 过滤空选项
  document.getElementById('filterEmpty').addEventListener('change', (e) => {
    if (e.target.checked) {
      const currentField = currentQuestionnaire?.fields[questionIndex];
      responses = mockResponses.filter(response => {
        const answer = response.answers[currentField?.name] || '';
        return answer.trim() !== '';
      });
    } else {
      responses = mockResponses;
    }
    renderResponsesTable();
  });
  
  // 导出Excel功能
  document.querySelector('.export-btn').addEventListener('click', () => {
    alert('导出Excel功能开发中...');
  });
  
  // 点击模态框外部关闭
  document.getElementById('responseModal').addEventListener('click', (e) => {
    if (e.target.id === 'responseModal') {
      closeResponseModal();
    }
  });
  
  // 初始化
  initPage();
});
