// 问一问功能API - 处理问题提交和查询
const QUESTIONS_KEY_PREFIX = 'question-';
const ANSWERS_KEY_PREFIX = 'answer-';

// 带超时的 fetch，防止外部请求长时间挂起
async function fetchWithTimeout(resource, options = {}, timeout = 15000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const res = await fetch(resource, { ...options, signal: controller.signal });
        return res;
    } finally {
        clearTimeout(id);
    }
}

// 生成查询密钥
function generateKey() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    const segments = [];
    
    for (let i = 0; i < 3; i++) {
        let segment = '';
        for (let j = 0; j < 4; j++) {
            segment += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        segments.push(segment);
    }
    
    return segments.join('-');
}

// 获取客户端IP地址
function getClientIP(req) {
    return req.headers['x-forwarded-for'] || 
           req.headers['x-real-ip'] || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress ||
           (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
           '127.0.0.1';
}

export default async function handler(req, res) {
    const apiUrl = process.env.KV_REST_API_URL;
    const apiToken = process.env.KV_REST_API_TOKEN;
    
    if (!apiUrl || !apiToken) {
        return res.status(500).json({ error: 'KV_REST_API_URL or KV_REST_API_TOKEN not set' });
    }

    const { method } = req;

    try {
        if (method === 'POST') {
            // 提交问题
            const { question } = req.body;
            
            if (!question || question.trim().length === 0) {
                return res.status(400).json({ error: '问题不能为空' });
            }

            if (question.length > 1000) {
                return res.status(400).json({ error: '问题长度不能超过1000字符' });
            }

            const key = generateKey();
            const timestamp = new Date().toISOString();
            const clientIP = getClientIP(req);

            const questionData = {
                question: question.trim(),
                timestamp,
                ip: clientIP,
                status: 'pending', // pending, answered
                key
            };

            // 存储问题数据
            const storeResponse = await fetch(`${apiUrl}/set/${QUESTIONS_KEY_PREFIX}${key}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(questionData)
            });

            if (!storeResponse.ok) {
                throw new Error('Failed to store question');
            }

            return res.status(200).json({ 
                success: true, 
                key,
                message: '问题提交成功'
            });

        } else if (method === 'GET') {
            const { key, admin, limit } = req.query;

            if (admin === 'true') {
                // 管理员查看所有问题（使用 /scan 替代已弃用的 /keys）
                const count = Math.max(1, Math.min(Number(limit) || 200, 500));
                let listResponse = await fetchWithTimeout(`${apiUrl}/scan`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${apiToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ prefix: QUESTIONS_KEY_PREFIX, limit: count })
                });

                // 若 /scan 不可用，兼容性回退到 /keys
                if (!listResponse.ok) {
                    const legacy = await fetchWithTimeout(`${apiUrl}/keys/${QUESTIONS_KEY_PREFIX}*`, {
                        headers: { 'Authorization': `Bearer ${apiToken}` }
                    }).catch(() => null);
                    if (!legacy || !legacy.ok) {
                        const status = legacy ? `${legacy.status} ${legacy.statusText}` : 'no response';
                        throw new Error(`Failed to fetch questions list via /scan and /keys fallback (${status})`);
                    }
                    listResponse = legacy;
                }

                const listData = await listResponse.json();
                const keys = Array.isArray(listData.keys) ? listData.keys : (listData.result || []);
                const questions = [];

                // 获取每个问题的详细信息（分批并行，减少整体耗时）
                const chunkSize = 20;
                for (let i = 0; i < keys.length; i += chunkSize) {
                    const batch = keys.slice(i, i + chunkSize);
                    await Promise.all(batch.map(async (questionKey) => {
                        try {
                            const getResponse = await fetchWithTimeout(`${apiUrl}/get/${questionKey}`, {
                                headers: {
                                    'Authorization': `Bearer ${apiToken}`
                                }
                            });

                            if (getResponse.ok) {
                                const questionData = await getResponse.json();
                                if (questionData.result) {
                                    const parsedData = typeof questionData.result === 'string'
                                        ? JSON.parse(questionData.result)
                                        : questionData.result;

                                    // 获取对应的答案
                                    const answerKey = questionKey.replace(QUESTIONS_KEY_PREFIX, ANSWERS_KEY_PREFIX);
                                    const answerResponse = await fetchWithTimeout(`${apiUrl}/get/${answerKey}`, {
                                        headers: {
                                            'Authorization': `Bearer ${apiToken}`
                                        }
                                    });

                                    let answer = null;
                                    if (answerResponse.ok) {
                                        const answerData = await answerResponse.json();
                                        if (answerData.result) {
                                            answer = typeof answerData.result === 'string'
                                                ? JSON.parse(answerData.result)
                                                : answerData.result;
                                        }
                                    }

                                    questions.push({
                                        ...parsedData,
                                        answer: answer ? answer.answer : null,
                                        answerTime: answer ? answer.timestamp : null
                                    });
                                }
                            }
                        } catch (e) {
                            // 单个key失败不影响整体
                            console.error('Failed to load question item:', questionKey, e);
                        }
                    }));
                }

                // 按时间排序，最新的在前
                questions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

                return res.status(200).json({ questions });

            } else if (key) {
                // 用户查询特定问题的答案
                if (!/^[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/.test(key)) {
                    return res.status(400).json({ error: '密钥格式无效' });
                }

                // 获取问题信息
                const questionResponse = await fetch(`${apiUrl}/get/${QUESTIONS_KEY_PREFIX}${key}`, {
                    headers: {
                        'Authorization': `Bearer ${apiToken}`
                    }
                });

                if (!questionResponse.ok) {
                    return res.status(404).json({ error: '问题不存在或密钥无效' });
                }

                const questionData = await questionResponse.json();
                if (!questionData.result) {
                    return res.status(404).json({ error: '问题不存在或密钥无效' });
                }

                const parsedQuestion = typeof questionData.result === 'string' 
                    ? JSON.parse(questionData.result) 
                    : questionData.result;

                // 获取答案信息
                const answerResponse = await fetch(`${apiUrl}/get/${ANSWERS_KEY_PREFIX}${key}`, {
                    headers: {
                        'Authorization': `Bearer ${apiToken}`
                    }
                });

                let answer = null;
                if (answerResponse.ok) {
                    const answerData = await answerResponse.json();
                    if (answerData.result) {
                        answer = typeof answerData.result === 'string' 
                            ? JSON.parse(answerData.result) 
                            : answerData.result;
                    }
                }

                return res.status(200).json({
                    question: parsedQuestion.question,
                    answer: answer ? answer.answer : null,
                    answerTime: answer ? answer.timestamp : null,
                    hasAnswer: !!answer
                });

            } else {
                return res.status(400).json({ error: '缺少必要参数' });
            }

        } else if (method === 'PUT') {
            // 管理员回答问题
            const { key, answer } = req.body;

            if (!key || !answer) {
                return res.status(400).json({ error: '缺少必要参数' });
            }

            if (!/^[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/.test(key)) {
                return res.status(400).json({ error: '密钥格式无效' });
            }

            // 验证问题是否存在
            const questionResponse = await fetch(`${apiUrl}/get/${QUESTIONS_KEY_PREFIX}${key}`, {
                headers: {
                    'Authorization': `Bearer ${apiToken}`
                }
            });

            if (!questionResponse.ok) {
                return res.status(404).json({ error: '问题不存在' });
            }

            const answerData = {
                answer: answer.trim(),
                timestamp: new Date().toISOString()
            };

            // 存储答案
            const storeResponse = await fetch(`${apiUrl}/set/${ANSWERS_KEY_PREFIX}${key}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(answerData)
            });

            if (!storeResponse.ok) {
                throw new Error('Failed to store answer');
            }

            // 更新问题状态
            const questionData = await questionResponse.json();
            const parsedQuestion = typeof questionData.result === 'string' 
                ? JSON.parse(questionData.result) 
                : questionData.result;
            
            parsedQuestion.status = 'answered';

            const updateResponse = await fetch(`${apiUrl}/set/${QUESTIONS_KEY_PREFIX}${key}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(parsedQuestion)
            });

            if (!updateResponse.ok) {
                throw new Error('Failed to update question status');
            }

            return res.status(200).json({ 
                success: true, 
                message: '回答提交成功' 
            });

        } else {
            res.setHeader('Allow', ['GET', 'POST', 'PUT']);
            return res.status(405).json({ error: `Method ${method} Not Allowed` });
        }

    } catch (error) {
        console.error('Questions API Error:', error);
        return res.status(500).json({ error: '服务器内部错误' });
    }
}
