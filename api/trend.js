const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, 'trend-data.json');

function readData() {
  if (!fs.existsSync(DATA_PATH)) {
    return {
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
  }
  return JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
}

function writeData(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    const data = readData();
    res.status(200).json(data);
  } else if (req.method === 'POST') {
    let body = req.body;
    if (!body) {
      let raw = '';
      await new Promise(resolve => {
        req.on('data', chunk => { raw += chunk; });
        req.on('end', resolve);
      });
      body = JSON.parse(raw);
    }
    if (!body || !Array.isArray(body.catalog) || !Array.isArray(body.contents)) {
      res.status(400).json({ error: 'Invalid data' });
      return;
    }
    writeData(body);
    res.status(200).json({ success: true });
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}; 