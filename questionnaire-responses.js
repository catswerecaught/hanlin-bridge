document.addEventListener('DOMContentLoaded', () => {
  // 从URL获取问卷ID
  const urlParams = new URLSearchParams(window.location.search);
  const questionnaireId = urlParams.get('id');
  const questionIndex = urlParams.get('question') || 0;
  
  let currentQuestionnaire = null;
  let responses = [];
  let currentResponseIndex = 0;
  
  // 模拟答卷数据
  const mockResponses = [
    {
      id: 1,
      ip: '101.87.108.178 (上海-上海)',
      time: '2025/6/15 12:29:14',
      source: '微信',
      answers: {
        name: '徐彤佳',
        subject: '数学',
        scores: '117 124 115',
        format: '均可',
        sessions: '12',
        slogan: '我到数学的乐趣，挖掘数学的潜能'
      }
    },
    {
      id: 2,
      ip: '192.168.1.100 (北京-北京)',
      time: '2025/6/15 12:56:00',
      source: '网页',
      answers: {
        name: '王泽宇',
        subject: '英语',
        scores: '120 118 125',
        format: '线上',
        sessions: '8',
        slogan: '英语学习，从基础开始'
      }
    }
  ];
  
  // 初始化页面
  function initPage() {
    if (questionnaireId) {
      loadQuestionnaireData(questionnaireId);
    }
    loadResponses();
  }
  
  // 加载问卷数据
  function loadQuestionnaireData(id) {
    // 模拟加载问卷数据
    currentQuestionnaire = {
      id: id,
      title: '助学人员登记问卷',
      fields: [
        { name: 'name', label: '姓名', required: true },
        { name: 'subject', label: '助学科目 （建议选择最弱的学科）', required: true },
        { name: 'scores', label: '助学科目分数 （主科填一模+二模+青考+高考成绩，小三门填等级考成绩）', required: true },
        { name: 'format', label: '助学形式', required: true },
        { name: 'sessions', label: '你在暑期大约能为一位学生助学几次？ （即单人总课时）', required: true },
        { name: 'slogan', label: '你的助学宣传语 （50字以内） 暂时未想好请填"暂无"', required: true }
      ]
    };
    
    // 更新页面标题
    const questionTitle = currentQuestionnaire.fields[questionIndex];
    if (questionTitle) {
      document.getElementById('questionnaireTitle').textContent = 
        `第${parseInt(questionIndex) + 1}题：${questionTitle.label}`;
    }
  }
  
  // 加载答卷数据
  function loadResponses() {
    responses = mockResponses;
    renderResponsesTable();
  }
  
  // 渲染答卷表格
  function renderResponsesTable() {
    const tbody = document.getElementById('responsesTableBody');
    const currentField = currentQuestionnaire?.fields[questionIndex];
    
    tbody.innerHTML = responses.map((response, index) => {
      const answer = currentField ? response.answers[currentField.name] || '-' : '-';
      const time = new Date(response.time).toLocaleString('zh-CN', {
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
          <td><a href="#" class="view-response-btn" onclick="viewResponse(${index})">查看答卷</a></td>
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
    document.getElementById('responseModalTitle').textContent = `序号：${index + 1}`;
    
    // 更新元数据
    document.getElementById('responseIP').textContent = response.ip;
    document.getElementById('responseTime').textContent = response.time;
    document.getElementById('responseSource').textContent = response.source;
    
    // 更新答卷详情
    const detailsContainer = document.getElementById('responseDetails');
    if (currentQuestionnaire) {
      detailsContainer.innerHTML = currentQuestionnaire.fields.map((field, i) => {
        const answer = response.answers[field.name] || '未填写';
        return `
          <div class="question-response">
            <div class="question-label">
              ${field.required ? '<span class="required-mark">* </span>' : ''}
              ${i + 1}. ${field.label}
            </div>
            <div class="question-answer">${answer}</div>
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
