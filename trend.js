// 预留：趋势页面专用脚本 

const API_URL = '/api/trend';

// 文档数据结构
const defaultData = {
    catalog: [
        '智能教学简介',
        '核心功能',
        '应用场景',
        '未来趋势'
    ],
    contents: [
        '<h2>智能教学简介</h2><p>智能教学结合AI与大数据，为师生提供个性化、数据驱动的学习体验。</p>',
        '<h2>核心功能</h2><ul><li>智能作业批改</li><li>学习路径推荐</li><li>实时学习分析</li></ul>',
        '<h2>应用场景</h2><p>适用于K12、高校、职业培训等多种教育场景。</p>',
        '<h2>未来趋势</h2><p>AI驱动的教育将持续进化，助力每一位学习者成长。</p>'
    ]
};

async function loadTrendData() {
    try {
        const res = await fetch(API_URL);
        if (!res.ok) throw new Error('fetch error');
        return await res.json();
    } catch {
        return JSON.parse(JSON.stringify(defaultData));
    }
}
async function saveTrendData(data) {
    await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
}

const catalogUl = document.getElementById('trendCatalog');
const contentSection = document.getElementById('trendContent');
const editBtn = document.getElementById('editBtn');
const saveBtn = document.getElementById('saveBtn');
const sidebar = document.getElementById('trendSidebar');
const saveStatus = document.getElementById('trendSaveStatus');

let docData = null;
let editMode = false;
let currentIndex = 0;

function renderCatalog(editing) {
    catalogUl.innerHTML = '';
    docData.catalog.forEach((item, idx) => {
        const li = document.createElement('li');
        li.textContent = item;
        li.setAttribute('data-index', idx);
        if (editing) {
            // 绿色小圆点
            const dot = document.createElement('span');
            dot.className = 'catalog-dot' + (idx === currentIndex ? ' active' : '');
            dot.title = '切换到此目录';
            dot.onclick = (e) => {
                e.stopPropagation();
                switchCatalog(idx);
            };
            li.appendChild(dot);
            // 可编辑目录文本
            li.contentEditable = true;
            li.spellcheck = false;
            li.oninput = function() {
                docData.catalog[idx] = li.textContent.replace(/\u200B/g, '').trim();
            };
        } else {
            li.onclick = () => {
                switchCatalog(idx);
                scrollToContent(idx);
            };
            if (idx === currentIndex) li.classList.add('active');
        }
        catalogUl.appendChild(li);
    });
}

function renderContent(editing) {
    contentSection.innerHTML = '';
    if (!editing) {
        // 阅览模式：显示所有内容
        contentSection.innerHTML = '<h1>智能教学产品文档</h1>' + docData.contents.map(c => c).join('');
        contentSection.contentEditable = false;
        contentSection.spellcheck = false;
    } else {
        // 编辑模式：只编辑当前目录对应内容
        contentSection.innerHTML = docData.contents[currentIndex] || '';
        contentSection.contentEditable = true;
        contentSection.spellcheck = false;
        // 监听内容变化
        contentSection.oninput = function() {
            docData.contents[currentIndex] = contentSection.innerHTML;
        };
    }
}

function switchCatalog(idx) {
    currentIndex = idx;
    if (editMode) {
        renderCatalog(true);
        renderContent(true);
    } else {
        // 阅览模式下跳转锚点
        scrollToContent(idx);
        renderCatalog(false);
    }
}

function scrollToContent(idx) {
    // 根据 h2 标题跳转
    const h2s = contentSection.querySelectorAll('h2');
    if (h2s[idx]) {
        h2s[idx].scrollIntoView({behavior: 'smooth', block: 'start'});
    }
}

editBtn.onclick = function() {
    editMode = true;
    editBtn.style.display = 'none';
    saveBtn.style.display = '';
    renderCatalog(true);
    renderContent(true);
};

function showSaveStatus(type, msg) {
    if (!saveStatus) return;
    saveStatus.className = 'trend-save-status show' + (type === 'fail' ? ' fail' : '');
    saveStatus.innerHTML =
        type === 'loading'
            ? '<span class="trend-save-spinner"></span>保存中...'
            : msg;
    if (type === 'success' || type === 'fail') {
        setTimeout(() => {
            saveStatus.className = 'trend-save-status';
            saveStatus.innerHTML = '';
        }, 2000);
    }
}

saveBtn.onclick = async function() {
    // 清理空目录
    docData.catalog = docData.catalog.map(t => t.trim()).filter(t => t);
    // 保证内容数组长度一致
    if (docData.contents.length < docData.catalog.length) {
        for (let i = docData.contents.length; i < docData.catalog.length; i++) {
            docData.contents[i] = '';
        }
    } else if (docData.contents.length > docData.catalog.length) {
        docData.contents = docData.contents.slice(0, docData.catalog.length);
    }
    showSaveStatus('loading');
    try {
        await saveTrendData(docData);
        editMode = false;
        editBtn.style.display = '';
        saveBtn.style.display = 'none';
        renderCatalog(false);
        renderContent(false);
        showSaveStatus('success', '保存成功');
    } catch (e) {
        showSaveStatus('fail', '保存失败');
    }
};

// 初始化
async function init() {
    docData = await loadTrendData();
    renderCatalog(false);
    renderContent(false);
}
init(); 