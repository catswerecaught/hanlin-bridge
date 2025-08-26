document.addEventListener('DOMContentLoaded', () => {
  const gateSection = document.getElementById('gateSection');
  const codeInput = document.getElementById('codeInput');
  const enterBtn = document.getElementById('enterBtn');
  const gateStatus = document.getElementById('gateStatus');

  const qnSection = document.getElementById('questionnaireSection');
  const qnTitle = document.getElementById('qnTitle');
  const qnDesc = document.getElementById('qnDesc');
  const qnForm = document.getElementById('qnForm');
  const submitBtn = document.getElementById('submitQnBtn');
  const submitStatus = document.getElementById('submitStatus');
  const successSection = document.getElementById('successSection');
  const countdownEl = document.getElementById('countdown');

  let currentQn = null;
  let currentCode = '';

  async function parseJSONSafe(resp) {
    const ctype = resp.headers.get('content-type') || '';
    if (!ctype.includes('application/json')) {
      const text = await resp.text();
      throw new Error(text?.slice(0, 200) || '服务器返回了非 JSON 响应');
    }
    try {
      return await resp.json();
    } catch (e) {
      const text = await resp.text().catch(() => '');
      throw new Error(text?.slice(0, 200) || '响应解析失败');
    }
  }

  function setGateStatus(text, isError = false) {
    gateStatus.textContent = text || '';
    gateStatus.style.color = isError ? '#ff3b30' : '#666';
  }

  function setSubmitStatus(text, isError = false) {
    submitStatus.textContent = text || '';
    submitStatus.style.color = isError ? '#ff3b30' : '#666';
  }

  function validCode(code) {
    return /^[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/i.test(code);
  }

  // Render questionnaire fields
  function renderQuestionnaire(qn) {
    qnForm.innerHTML = '';

    if (!qn || !Array.isArray(qn.fields)) return;

    qn.fields.forEach((field, index) => {
      const wrap = document.createElement('div');
      wrap.className = 'qn-field';

      // label
      const label = document.createElement('label');
      label.className = 'qn-label';
      label.setAttribute('for', `field_${index}`);
      label.textContent = field.label || `问题 ${index + 1}`;
      if (field.required) {
        const req = document.createElement('span');
        req.className = 'qn-required';
        req.textContent = '*';
        label.appendChild(req);
      }
      wrap.appendChild(label);

      const type = (field.type || 'text').toLowerCase();
      const name = field.name || `field_${index}`;
      const placeholder = field.placeholder || '';

      let inputEl = null;
      if (type === 'textarea') {
        inputEl = document.createElement('textarea');
        inputEl.className = 'qn-textarea';
        inputEl.placeholder = placeholder;
      } else if (type === 'select') {
        inputEl = document.createElement('select');
        inputEl.className = 'qn-select';
        (field.options || []).forEach(opt => {
          const o = document.createElement('option');
          if (typeof opt === 'string') {
            o.value = opt; o.textContent = opt;
          } else {
            o.value = opt?.value ?? '';
            o.textContent = opt?.label ?? String(opt?.value ?? '');
          }
          inputEl.appendChild(o);
        });
      } else if (type === 'radio') {
        const group = document.createElement('div');
        group.className = 'qn-radio-group';
        (field.options || []).forEach((opt, idx) => {
          const id = `field_${index}_${idx}`;
          const wrapOpt = document.createElement('label');
          wrapOpt.style.display = 'flex';
          wrapOpt.style.alignItems = 'center';
          wrapOpt.style.gap = '8px';

          const radio = document.createElement('input');
          radio.type = 'radio';
          radio.name = name;
          radio.id = id;
          radio.value = typeof opt === 'string' ? opt : (opt?.value ?? '');

          const span = document.createElement('span');
          span.textContent = typeof opt === 'string' ? opt : (opt?.label ?? String(opt?.value ?? ''));

          wrapOpt.appendChild(radio);
          wrapOpt.appendChild(span);
          group.appendChild(wrapOpt);
        });
        inputEl = group;
      } else if (type === 'checkbox') {
        const group = document.createElement('div');
        group.className = 'qn-checkbox-group';
        (field.options || []).forEach((opt, idx) => {
          const id = `field_${index}_${idx}`;
          const wrapOpt = document.createElement('label');
          wrapOpt.style.display = 'flex';
          wrapOpt.style.alignItems = 'center';
          wrapOpt.style.gap = '8px';

          const cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.name = name;
          cb.id = id;
          cb.value = typeof opt === 'string' ? opt : (opt?.value ?? '');

          const span = document.createElement('span');
          span.textContent = typeof opt === 'string' ? opt : (opt?.label ?? String(opt?.value ?? ''));

          wrapOpt.appendChild(cb);
          wrapOpt.appendChild(span);
          group.appendChild(wrapOpt);
        });
        inputEl = group;
      } else {
        // text, number, date, email, etc.
        inputEl = document.createElement('input');
        inputEl.className = 'qn-input';
        inputEl.type = ['text', 'number', 'date', 'email', 'tel'].includes(type) ? type : 'text';
        inputEl.placeholder = placeholder;
      }

      inputEl.dataset.qnName = name;
      inputEl.dataset.qnType = type;
      if (field.required) inputEl.dataset.qnRequired = '1';
      wrap.appendChild(inputEl);

      if (field.help) {
        const help = document.createElement('div');
        help.className = 'qn-help';
        help.textContent = field.help;
        wrap.appendChild(help);
      }

      qnForm.appendChild(wrap);
    });
  }

  function collectAnswers() {
    const data = {};
    const nodes = qnForm.querySelectorAll('[data-qn-name]');
    nodes.forEach(node => {
      const name = node.dataset.qnName;
      const type = node.dataset.qnType;
      if (type === 'radio') {
        const checked = qnForm.querySelector(`input[type="radio"][name="${name}"]:checked`);
        data[name] = checked ? checked.value : '';
      } else if (type === 'checkbox') {
        const checked = Array.from(qnForm.querySelectorAll(`input[type="checkbox"][name="${name}"]:checked`)).map(i => i.value);
        data[name] = checked;
      } else if (type === 'select') {
        data[name] = node.value;
      } else if (type === 'textarea') {
        data[name] = node.value.trim();
      } else {
        data[name] = node.value;
      }
    });
    return data;
  }

  function validateRequired() {
    // Validate required fields
    const nodes = qnForm.querySelectorAll('[data-qn-name][data-qn-required="1"]');
    for (const node of nodes) {
      const type = node.dataset.qnType;
      if (type === 'radio') {
        const name = node.dataset.qnName;
        const checked = qnForm.querySelector(`input[type="radio"][name="${name}"]:checked`);
        if (!checked) return false;
      } else if (type === 'checkbox') {
        const name = node.dataset.qnName;
        const checked = qnForm.querySelectorAll(`input[type="checkbox"][name="${name}"]:checked`);
        if (!checked || checked.length === 0) return false;
      } else {
        if (!node.value || String(node.value).trim() === '') return false;
      }
    }
    return true;
  }

  async function loadQuestionnaireByCode(code) {
    setGateStatus('校验中...');
    try {
      const resp = await fetch(`/api/questionnaires?code=${encodeURIComponent(code)}`);
      const data = await parseJSONSafe(resp);
      if (!resp.ok) throw new Error(data?.error || '校验失败');
      // Expecting: { id, title, description, fields: [...] }
      currentQn = data;
      qnTitle.textContent = data.title || '未命名问卷';
      qnDesc.textContent = data.description || '';
      renderQuestionnaire(data);
      gateSection.style.display = 'none';
      qnSection.style.display = '';
      setGateStatus('');
    } catch (e) {
      setGateStatus(e.message || '校验失败，请确认校验码是否正确或问卷是否已发布', true);
    }
  }

  async function submitResponse() {
    if (!currentQn || !currentQn.id) {
      setSubmitStatus('问卷未加载', true);
      return;
    }
    if (!validateRequired()) {
      setSubmitStatus('请填写所有必填项', true);
      return;
    }
    const answers = collectAnswers();
    setSubmitStatus('提交中...');
    submitBtn.disabled = true;
    const payload = {
      code: currentCode,
      questionnaireId: currentQn.id,
      answers,
      meta: {
        ts: new Date().toISOString(),
        ua: navigator.userAgent || '',
      }
    };
    try {
      const resp = await fetch('/api/questionnaire-responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await parseJSONSafe(resp);
      if (!resp.ok) throw new Error(data?.error || '提交失败');
      showSuccessAndRedirect();
    } catch (e) {
      setSubmitStatus(e.message || '提交失败，请稍后再试', true);
    } finally {
      submitBtn.disabled = false;
    }
  }

  function showSuccessAndRedirect() {
    // Hide questionnaire section and show success
    qnSection.style.display = 'none';
    successSection.style.display = 'block';
    
    // Start 5-second countdown
    let seconds = 5;
    const updateCountdown = () => {
      countdownEl.textContent = `将在 ${seconds} 秒后返回`;
      if (seconds <= 0) {
        window.location.href = 'https://oceantie.top/customize.html';
        return;
      }
      seconds--;
      setTimeout(updateCountdown, 1000);
    };
    updateCountdown();
  }

  enterBtn.addEventListener('click', () => {
    const code = (codeInput.value || '').trim().toLowerCase();
    if (!code) { setGateStatus('请输入校验码', true); return; }
    if (!validCode(code)) { setGateStatus('校验码格式无效（格式：xxxx-xxxx-xxxx）', true); return; }
    currentCode = code;
    loadQuestionnaireByCode(code);
  });

  submitBtn.addEventListener('click', (e) => {
    e.preventDefault();
    submitResponse();
  });
});
