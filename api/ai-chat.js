// AI聊天API接口
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const { message, user } = req.body;
    
    if (!message || !user) {
        res.status(400).json({ error: 'Missing message or user' });
        return;
    }

    try {
        // 检查用户积分
        const balanceResponse = await fetch(`${process.env.KV_REST_API_URL}/get/balance-${user}`, {
            headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` }
        });
        
        if (!balanceResponse.ok) {
            res.status(500).json({ error: 'Failed to check balance' });
            return;
        }
        
        const balanceData = await balanceResponse.json();
        const currentBalance = balanceData.result?.value?.amount || 0;
        
        if (currentBalance < 35) {
            res.status(402).json({ error: 'Insufficient points', balance: currentBalance });
            return;
        }

        // 调用AI服务
        const aiResponse = await callAIService(message);
        
        // 扣除积分
        const newBalance = currentBalance - 35;
        await fetch(`${process.env.KV_REST_API_URL}/set/balance-${user}`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                value: {
                    amount: newBalance,
                    cardType: getCardType(newBalance)
                }
            })
        });

        res.status(200).json({
            response: aiResponse,
            balance: newBalance
        });
        
    } catch (error) {
        console.error('AI chat error:', error);
        res.status(500).json({ error: 'Internal server error' });
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
    // 这里需要替换为实际的AI服务调用
    // 示例：调用OpenAI API
    
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const OPENAI_API_URL = process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions';
    
    if (!OPENAI_API_KEY) {
        // 如果没有配置OpenAI API，返回模拟响应
        return getMockResponse(message);
    }
    
    try {
        const response = await fetch(OPENAI_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
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
            })
        });
        
        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.status}`);
        }
        
        const data = await response.json();
        return data.choices[0].message.content;
        
    } catch (error) {
        console.error('OpenAI API error:', error);
        // 如果AI服务失败，返回模拟响应
        return getMockResponse(message);
    }
}

function getMockResponse(message) {
    // 简单的模拟AI响应
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