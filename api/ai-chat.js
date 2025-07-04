// AI聊天API接口 - 详细诊断版本
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { message, user, conversationHistory = [] } = req.body;
        
        if (!message || !user) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // === 自我介绍问题拦截 ===
        const introKeywords = [
            '你是谁', '你叫什么', '你是哪个AI', '你是哪个助手', '你是什么',
            'who are you', 'what are you', 'your name', '你来自哪里', '你是谁开发的', '你是谁训练的', '你是谁创造的', '你是谁的产品', '你是谁的机器人', '你是谁的人工智能'
        ];
        const lowerMsg = message.toLowerCase();
        if (introKeywords.some(k => message.includes(k) || lowerMsg.includes(k))) {
            return res.status(200).json({ response: '我是灵凝，翰林桥的AI智能助手。' });
        }

        console.log('=== AI聊天请求 ===');
        console.log('用户:', user);
        console.log('消息:', message);
        console.log('对话历史条数:', conversationHistory.length);

        // 构建包含历史上下文的完整消息
        let fullMessage = message;
        if (conversationHistory.length > 0) {
            const historyContext = conversationHistory
                .map(msg => `${msg.role === 'user' ? '用户' : 'AI'}: ${msg.content}`)
                .join('\n');
            fullMessage = `对话历史:\n${historyContext}\n\n当前用户消息: ${message}\n\n请基于以上对话历史回答用户的问题。`;
        }

        const response = await callAIService(fullMessage);
        
        console.log('AI回复:', response);
        
        res.status(200).json({ response });
        
    } catch (error) {
        console.error('AI聊天API错误:', error);
        res.status(500).json({ error: error.message });
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
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    
    console.log('=== AI服务调用开始 ===');
    
    if (GEMINI_API_KEY) {
        try {
            return await callGemini(message);
        } catch (error) {
            console.error('Gemini调用失败:', error);
            throw new Error('Gemini API 调用失败: ' + error.message);
        }
    } else if (OPENAI_API_KEY) {
        try {
            return await callOpenAI(message);
        } catch (error) {
            console.error('OpenAI调用失败:', error);
            throw new Error('OpenAI API 调用失败: ' + error.message);
        }
    } else {
        return await callBackupAI(message);
    }
}

// Google Gemini API 调用（使用 REST API）
async function callGemini(message) {
    try {
        console.log('调用 Google Gemini API (REST)...');
        const apiKey = process.env.GEMINI_API_KEY;
        const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        
        const requestBody = {
            contents: [
                {
                    role: 'user',
                    parts: [{ text: message }]
                }
            ]
        };
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        const responseText = await response.text();
        console.log('Gemini REST Response:', response.status, responseText);
        
        if (!response.ok) {
            throw new Error(`Gemini API error: ${response.status} - ${responseText}`);
        }
        
        const data = JSON.parse(responseText);
        if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0].text) {
            return data.candidates[0].content.parts[0].text;
        }
        throw new Error('Gemini API response format error');
    } catch (err) {
        console.error('Gemini REST调用失败:', err);
        throw new Error('Gemini API 调用失败: ' + err.message);
    }
}

async function callOpenAI(message) {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    
    // 尝试不同的免费模型
    const models = [
        'gpt-3.5-turbo',
        'gpt-3.5-turbo-16k',
        'gpt-4',
        'gpt-4-turbo-preview'
    ];
    
    for (const model of models) {
        try {
            console.log(`尝试使用模型: ${model}`);
            
            const requestBody = {
                model: model,
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
                max_tokens: 300, // 减少token使用
                temperature: 0.7
            };
            
            console.log(`调用OpenAI API (${model})...`);
            
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });
            
            console.log(`OpenAI Response status (${model}):`, response.status);
            
            const responseText = await response.text();
            console.log(`OpenAI Response body (${model}):`, responseText);
            
            if (response.ok) {
                const data = JSON.parse(responseText);
                
                if (!data.choices || !data.choices[0] || !data.choices[0].message) {
                    throw new Error('Invalid response format from OpenAI');
                }
                
                console.log(`OpenAI API调用成功 (${model})`);
                return data.choices[0].message.content;
            } else {
                const errorData = JSON.parse(responseText);
                console.log(`模型 ${model} 失败:`, errorData.error?.message);
                
                // 如果是余额不足，尝试下一个模型
                if (errorData.error?.code === 'insufficient_quota') {
                    console.log(`模型 ${model} 余额不足，尝试下一个模型...`);
                    continue;
                }
                
                // 其他错误直接抛出
                throw new Error(`OpenAI API error: ${response.status} - ${responseText}`);
            }
            
        } catch (error) {
            console.error(`模型 ${model} 调用失败:`, error);
            
            // 如果是余额不足，尝试下一个模型
            if (error.message.includes('insufficient_quota')) {
                console.log(`模型 ${model} 余额不足，尝试下一个模型...`);
                continue;
            }
            
            // 其他错误直接抛出
            throw error;
        }
    }
    
    // 所有模型都失败了
    throw new Error('所有OpenAI模型都无法使用，可能是账户配置问题');
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
    return `${randomResponse}\n\n（注：当前为模拟响应。AI服务正在处理中，请稍后再试。如果问题持续存在，请联系客服。）`;
}

// 备用AI服务函数（目前只返回模拟响应）
async function callBackupAI(message) {
    console.log('使用备用AI服务...');
    // 这里可以实现其他AI服务的调用
    // 暂时返回模拟响应
    return getMockResponse(message);
} 