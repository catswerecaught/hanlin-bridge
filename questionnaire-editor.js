document.addEventListener('DOMContentLoaded', () => {
  // 从URL获取问卷ID
  const urlParams = new URLSearchParams(window.location.search);
  const questionnaireId = urlParams.get('id');
  
  let currentQuestionnaire = {
    id: questionnaireId || '',
    title: '测试问卷',
    description: '测试问卷说明',
    code: '',
    published: false,
    fields: [
      {
        id: '1',
        type: 'radio',
        name: 'q1',
        label: '标题',
        required: true,
        options: ['选项1', '选项2']
      }
    ]
  };

  // 如果有ID，加载现有问卷
  if (questionnaireId) {
    loadExistingQuestionnaire(questionnaireId);
  }

  const titleInput = document.getElementById('titleInput');
  const descInput = document.getElementById('descInput');
  const codeInput = document.getElementById('codeInput');
  const questionsList = document.getElementById('questionsList');
  const addQuestionBtn = document.getElementById('addQuestionBtn');
  const saveBtn = document.getElementById('saveBtn');
  const previewBtn = document.getElementById('previewBtn');

  // 加载现有问卷
  async function loadExistingQuestionnaire(id) {
    try {
      // Wait for DOM to be fully ready
      await new Promise(resolve => {
        if (document.getElementById('qnTitle') && 
            document.getElementById('qnDesc') && 
            document.getElementById('qnCode')) {
          resolve();
        } else {
          setTimeout(resolve, 100);
        }
      });

      // Try API first
      const response = await fetch(`/api/questionnaires?id=${id}`);
      if (response.ok) {
        const { id: qnId, ...questionnaire } = await response.json();
        currentQuestionnaire = { 
          id: qnId,
          ...questionnaire,
          // Always preserve original code when editing
          code: questionnaire.code
        };
        
        // Safely set values
        const titleEl = document.getElementById('qnTitle');
        const descEl = document.getElementById('qnDesc');
        const codeEl = document.getElementById('qnCode');
        
        if (titleEl) titleEl.value = currentQuestionnaire.title || '';
        if (descEl) descEl.value = currentQuestionnaire.description || '';
        if (codeEl) {
          codeEl.value = currentQuestionnaire.code || '';
          codeEl.readOnly = true; // Make code field read-only for existing questionnaires
        }
        
        renderQuestions();
        return;
      }
    } catch (error) {
      console.error('API加载失败:', error);
    }
    
    // Fallback to localStorage
    try {
      const savedQuestionnaires = JSON.parse(localStorage.getItem('questionnaires') || '[]');
      const questionnaire = savedQuestionnaires.find(q => q.id === id);
      if (questionnaire) {
        currentQuestionnaire = questionnaire;
        renderQuestions();
      }
    } catch (error) {
      console.error('本地数据加载失败:', error);
    }
  }

  // 生成随机校验码
  function generateCode() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    const seg = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `${seg()}-${seg()}-${seg()}`;
  }

  // 生成问题ID
  function generateQuestionId() {
    return Date.now().toString();
  }

  // 渲染问题编辑器
  function renderQuestion(field, index) {
    const isRequired = field.required ? 'active' : '';
    const questionNumber = field.required ? `*${index + 1}` : `${index + 1}`;
    
    let optionsHtml = '';
    if (['radio', 'checkbox', 'select'].includes(field.type)) {
      const optionSymbol = field.type === 'radio' ? '○' : field.type === 'checkbox' ? '☑' : '▼';
      optionsHtml = `
        <div class="option-list">
          ${(field.options || []).map((option, i) => `
            <div class="option-item">
              <span>${optionSymbol}</span>
              <input type="text" class="option-input" value="${option}" placeholder="选项内容" data-option-index="${i}">
              <span class="option-delete" data-option-index="${i}">×</span>
            </div>
          `).join('')}
          <div class="add-option">+ 添加选项</div>
        </div>
      `;
    }

    return `
      <div class="question-editor" data-question-id="${field.id}">
        <div class="question-number">${questionNumber}</div>
        <div class="question-actions">
          <button class="action-btn" title="复制" data-action="copy">📋</button>
          <button class="action-btn" title="删除" data-action="delete">🗑️</button>
        </div>
        
        <div class="form-group">
          <label class="form-label">题目</label>
          <input type="text" class="form-input question-title-input" value="${field.label || ''}" placeholder="请输入问题标题">
        </div>
        
        <div class="question-controls">
          <button class="control-btn ${isRequired}" data-required="true">必填</button>
          <button class="control-btn" data-action="add-help">添加说明</button>
        </div>
        
        ${optionsHtml}
      </div>
    `;
  }

  // 渲染所有问题
  function renderQuestions() {
    questionsList.innerHTML = currentQuestionnaire.fields.map((field, index) => 
      renderQuestion(field, index)
    ).join('');
    bindQuestionEvents();
  }

  // 绑定问题事件
  function bindQuestionEvents() {
    // 题目输入
    document.querySelectorAll('.question-title-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const questionId = e.target.closest('.question-editor').dataset.questionId;
        const field = currentQuestionnaire.fields.find(f => f.id === questionId);
        if (field) field.label = e.target.value;
      });
    });

    // 必填切换
    document.querySelectorAll('[data-required]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const questionId = e.target.closest('.question-editor').dataset.questionId;
        const field = currentQuestionnaire.fields.find(f => f.id === questionId);
        if (field) {
          field.required = !field.required;
          e.target.classList.toggle('active');
          renderQuestions(); // 重新渲染以更新问题编号
        }
      });
    });

    // 选项输入
    document.querySelectorAll('.option-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const questionId = e.target.closest('.question-editor').dataset.questionId;
        const optionIndex = parseInt(e.target.dataset.optionIndex);
        const field = currentQuestionnaire.fields.find(f => f.id === questionId);
        if (field && field.options) {
          field.options[optionIndex] = e.target.value;
        }
      });
    });

    // 删除选项
    document.querySelectorAll('.option-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const questionId = e.target.closest('.question-editor').dataset.questionId;
        const optionIndex = parseInt(e.target.dataset.optionIndex);
        const field = currentQuestionnaire.fields.find(f => f.id === questionId);
        if (field && field.options && field.options.length > 1) {
          field.options.splice(optionIndex, 1);
          renderQuestions();
        }
      });
    });

    // 添加选项
    document.querySelectorAll('.add-option').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const questionId = e.target.closest('.question-editor').dataset.questionId;
        const field = currentQuestionnaire.fields.find(f => f.id === questionId);
        if (field && field.options) {
          field.options.push(`选项${field.options.length + 1}`);
          renderQuestions();
        }
      });
    });

    // 问题操作
    document.querySelectorAll('.action-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = e.target.dataset.action;
        const questionId = e.target.closest('.question-editor').dataset.questionId;
        
        if (action === 'delete') {
          if (confirm('确定要删除这个问题吗？')) {
            currentQuestionnaire.fields = currentQuestionnaire.fields.filter(f => f.id !== questionId);
            renderQuestions();
          }
        } else if (action === 'copy') {
          const field = currentQuestionnaire.fields.find(f => f.id === questionId);
          if (field) {
            const newField = { ...field, id: generateQuestionId(), label: field.label + ' (副本)' };
            currentQuestionnaire.fields.push(newField);
            renderQuestions();
          }
        }
      });
    });
  }

  // 添加新问题
  function addQuestion(type = 'radio') {
    const newField = {
      id: generateQuestionId(),
      type: type,
      name: `q${currentQuestionnaire.fields.length + 1}`,
      label: '新问题',
      required: false
    };

    if (['radio', 'checkbox', 'select'].includes(type)) {
      newField.options = ['选项1', '选项2'];
    }

    currentQuestionnaire.fields.push(newField);
    renderQuestions();
  }

  // 题型选择
  document.querySelectorAll('.type-item').forEach(item => {
    item.addEventListener('click', (e) => {
      const type = e.currentTarget.dataset.type;
      addQuestion(type);
    });
  });

  // 基本信息更新
  titleInput.addEventListener('input', (e) => {
    currentQuestionnaire.title = e.target.value;
    document.getElementById('questionnaireTitle').textContent = e.target.value || '未命名问卷';
  });

  descInput.addEventListener('input', (e) => {
    currentQuestionnaire.description = e.target.value;
  });

  codeInput.addEventListener('input', (e) => {
    currentQuestionnaire.code = e.target.value;
  });

  // 添加问题按钮
  addQuestionBtn.addEventListener('click', () => {
    addQuestion('radio');
  });

  // 保存问卷
  saveBtn.addEventListener('click', async () => {
    if (!currentQuestionnaire.title.trim()) {
      alert('请输入问卷标题');
      return;
    }
    
    if (!currentQuestionnaire.code.trim() || !/^[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/i.test(currentQuestionnaire.code)) {
      alert('请输入正确格式的校验码（xxxx-xxxx-xxxx）');
      return;
    }

    try {
      // 尝试保存到API
      const response = await fetch('/api/questionnaires', {
        method: currentQuestionnaire.id ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...currentQuestionnaire,
          id: currentQuestionnaire.id || `qn-${Date.now()}`,
          createdAt: currentQuestionnaire.createdAt || new Date().toISOString()
        })
      });

      if (response.ok) {
        alert('问卷保存成功！');
        window.close();
        return;
      }
    } catch (error) {
      console.log('API保存失败，使用本地保存:', error);
    }

    // 降级到localStorage
    try {
      const savedQuestionnaires = JSON.parse(localStorage.getItem('questionnaires') || '[]');
      
      if (currentQuestionnaire.id) {
        // 更新现有问卷
        const index = savedQuestionnaires.findIndex(q => q.id === currentQuestionnaire.id);
        if (index >= 0) {
          savedQuestionnaires[index] = currentQuestionnaire;
        }
      } else {
        // 创建新问卷
        currentQuestionnaire.id = generateQuestionId();
        currentQuestionnaire.createdAt = new Date().toISOString();
        savedQuestionnaires.push(currentQuestionnaire);
      }
      
      localStorage.setItem('questionnaires', JSON.stringify(savedQuestionnaires));
      
      alert('问卷保存成功（本地保存）！');
      window.close();
    } catch (error) {
      console.error('保存失败:', error);
      alert('保存失败，请重试');
    }
  });

  // 预览问卷
  previewBtn.addEventListener('click', () => {
    const previewData = {
      ...currentQuestionnaire,
      published: true
    };
    
    // 在新窗口打开预览
    const previewWindow = window.open('questionnaire.html', '_blank');
    // 这里可以通过postMessage传递数据给预览窗口
  });

  // 初始化
  codeInput.value = generateCode();
  currentQuestionnaire.code = codeInput.value;
  renderQuestions();
});
