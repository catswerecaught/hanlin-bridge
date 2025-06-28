// AI聊天API接口 - 重新部署测试
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const { message, user } = req.body;
    
    if (!message) {
        res.status(400).json({ error: 'Missing message' });
        return;
    }

    try {
        // 添加调试信息
        console.log('API Key exists:', !!process.env.OPENAI_API_KEY);
        console.log('API Key length:', process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.length : 0);
        
        // 直接调用AI服务，暂时跳过积分检查
        const aiResponse = await callAIService(message);
        
        res.status(200).json({
            response: aiResponse
        });
        
    } catch (error) {
        console.error('AI chat error:', error);
        res.status(500).json({ error: 'Internal server error', detail: error.message });
    }
}

// 卡种等级与门槛（与balance.js保持一致）
const CARD_LEVELS = [
    { type: '大众M1', threshold: 0 },
    { type: '大众M2', threshold: 1000 },
    { type: '金卡M1', threshold: 50000 },
    { type: '金卡M2', threshold: 200000 },
    { type: '金玉兰M1', threshold: 500000 },
    { type: '金玉兰M2', threshold: 2000000 },
    { type: '金玉兰M3', threshold: 5000000 },
    { type: '至臻明珠M1', threshold: 10000000 },
    { type: '至臻明珠M2', threshold: 50000000 },
    { type: '至臻明珠M3', threshold: 100000000 },
];

function getCardType(amount) {
    let card = CARD_LEVELS[0].type;
    for (const level of CARD_LEVELS) {
        if (amount >= level.threshold) card = level.type;
        else break;
    }
    return card;
}

async function callAIService(message) {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    
    console.log('Checking OpenAI API key...');
    console.log('API Key exists:', !!OPENAI_API_KEY);
    
    if (!OPENAI_API_KEY) {
        console.log('OpenAI API key not found, using mock response');
        return getMockResponse(message);
    }
    
    console.log('API Key found, attempting to call OpenAI API...');
    console.log('API Key starts with:', OPENAI_API_KEY.substring(0, 10) + '...');
    
    try {
        const requestBody = {
            model: 'gpt-3.5-turbo',
            messages: [
                {
                    role: 'system',
                    content: '你是一个智能学习助手，专门帮助中国学生解答学习问题。请用中文回答，回答要简洁明了、准确有用。'
                },
                {
                    role: 'user',
                    content: message
                }
            ],
            max_tokens: 1000,
            temperature: 0.7
        };
        
        console.log('Request body:', JSON.stringify(requestBody, null, 2));
        
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        console.log('OpenAI response status:', response.status);
        console.log('OpenAI response headers:', Object.fromEntries(response.headers.entries()));
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('OpenAI API error response:', errorText);
            throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
        }
        
        const data = await response.json();
        console.log('OpenAI API success, response received');
        console.log('Response data:', JSON.stringify(data, null, 2));
        
        return data.choices[0].message.content;
        
    } catch (error) {
        console.error('OpenAI API call failed:', error);
        return getMockResponse(message);
    }
}

function getMockResponse(message) {
    const responses = [
        '我理解您的问题。让我为您详细解答...',
        '这是一个很好的问题。根据我的分析...',
        '我可以帮您解决这个问题。建议您...',
        '对于您提到的情况，我建议...',
        '这是一个常见的问题，让我为您提供一些建议...'
    ];
    
    const randomResponse = responses[Math.floor(Math.random() * responses.length)];
    return `${randomResponse}\n\n（注：当前为模拟响应，实际AI服务正在配置中）`;
} 