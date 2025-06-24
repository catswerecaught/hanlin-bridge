console.log('KV_REST_API_URL:', process.env.KV_REST_API_URL);
console.log('KV_REST_API_TOKEN:', process.env.KV_REST_API_TOKEN);

const TREND_KEY = 'trend-doc-data';

export default async function handler(req, res) {
  const apiUrl = process.env.KV_REST_API_URL;
  const apiToken = process.env.KV_REST_API_TOKEN;

  if (!apiUrl || !apiToken) {
    console.error('KV_REST_API_URL or KV_REST_API_TOKEN not set');
    res.status(500).json({ error: 'KV_REST_API_URL or KV_REST_API_TOKEN not set' });
    return;
  }

  if (req.method === 'GET') {
    try {
      const kvRes = await fetch(`${apiUrl}/get/${TREND_KEY}`, {
        headers: { Authorization: `Bearer ${apiToken}` }
      });
      if (!kvRes.ok) {
        const text = await kvRes.text();
        console.error('Failed to fetch from KV:', text);
        res.status(500).json({ error: 'Failed to fetch from KV', detail: text });
        return;
      }
      const { result } = await kvRes.json();
      if (!result) {
        // 默认内容
        res.status(200).json({
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
        });
        return;
      }
      res.status(200).json(JSON.parse(result));
    } catch (err) {
      console.error('GET /api/trend error:', err);
      res.status(500).json({ error: 'Internal Server Error', detail: String(err) });
    }
  } else if (req.method === 'POST') {
    try {
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
        console.error('Invalid data:', body);
        res.status(400).json({ error: 'Invalid data' });
        return;
      }
      const kvRes = await fetch(`${apiUrl}/set/${TREND_KEY}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ value: JSON.stringify(body) })
      });
      if (!kvRes.ok) {
        const text = await kvRes.text();
        console.error('Failed to write to KV:', text);
        res.status(500).json({ error: 'Failed to write to KV', detail: text });
        return;
      }
      res.status(200).json({ success: true });
    } catch (err) {
      console.error('POST /api/trend error:', err);
      res.status(500).json({ error: 'Internal Server Error', detail: String(err) });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
} 