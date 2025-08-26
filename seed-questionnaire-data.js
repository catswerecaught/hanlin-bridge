// 向 Upstash KV 添加问卷测试数据
import { promises as fs } from 'fs';
import path from 'path';
import url from 'url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

// 加载环境变量
async function loadDotEnv() {
  try {
    const envPath = path.join(__dirname, '.env.local');
    const raw = await fs.readFile(envPath, 'utf8');
    raw.split(/\r?\n/).forEach((line) => {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m) return;
      let [, key, val] = m;
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    });
  } catch {}
}

await loadDotEnv();

const apiUrl = process.env.KV_REST_API_URL;
const apiToken = process.env.KV_REST_API_TOKEN;

if (!apiUrl || !apiToken) {
  console.error('❌ 缺少环境变量 KV_REST_API_URL 或 KV_REST_API_TOKEN');
  console.log('请在 .env.local 文件中设置这些变量');
  process.exit(1);
}

async function setKV(key, value) {
  try {
    const response = await fetch(`${apiUrl}/set/${key}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ value })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    
    console.log(`✅ 设置成功: ${key}`);
    return true;
  } catch (error) {
    console.error(`❌ 设置失败 ${key}:`, error.message);
    return false;
  }
}

// 示例问卷数据
const sampleQuestionnaire = {
  title: "悠然问卷示例",
  description: "这是一个示例问卷，用于测试问卷系统功能。",
  published: true,
  createdAt: new Date().toISOString(),
  fields: [
    {
      type: "text",
      name: "name",
      label: "姓名",
      required: true,
      placeholder: "请输入您的姓名"
    },
    {
      type: "radio",
      name: "grade",
      label: "年级",
      required: true,
      options: ["高一", "高二", "高三", "其他"]
    },
    {
      type: "checkbox",
      name: "subjects",
      label: "感兴趣的学科（可多选）",
      required: false,
      options: ["语文", "数学", "英语", "物理", "化学", "生物", "历史", "地理", "政治"]
    },
    {
      type: "select",
      name: "region",
      label: "所在地区",
      required: true,
      options: ["北京", "上海", "广州", "深圳", "杭州", "成都", "其他"]
    },
    {
      type: "textarea",
      name: "feedback",
      label: "意见建议",
      required: false,
      placeholder: "请留下您的宝贵意见和建议",
      help: "您的反馈对我们很重要"
    }
  ]
};

// 校验码映射
const codeMapping = {
  questionnaireId: "demo-001",
  enabled: true,
  createdAt: new Date().toISOString()
};

async function seedData() {
  console.log('🚀 开始添加问卷测试数据到 Upstash KV...\n');
  
  // 1. 添加问卷
  console.log('1. 添加示例问卷...');
  await setKV('qn:demo-001', sampleQuestionnaire);
  
  // 2. 添加校验码映射
  console.log('\n2. 添加校验码映射...');
  await setKV('qn:code:abcd-ef12-3456', codeMapping);
  
  console.log('\n✨ 测试数据添加完成！');
  console.log('\n📋 测试步骤:');
  console.log('1. 访问 questionnaire.html');
  console.log('2. 输入校验码: abcd-ef12-3456');
  console.log('3. 填写并提交问卷');
  console.log('4. 答卷将保存到 qn:resp:demo-001:<随机ID>');
}

seedData().catch(console.error);
