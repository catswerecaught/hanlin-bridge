// 社交媒体帖子 API - 使用 Upstash 存储
const SOCIAL_POSTS_KEY = 'social-posts';
const SOCIAL_POST_PREFIX = 'social-post-';
const USER_INTERACTIONS_PREFIX = 'user-interactions:';
// 仅当显式开启时才注入模拟数据
const SEED_MOCK_POSTS = String(process.env.SEED_MOCK_POSTS || '').toLowerCase() === 'true';

function unwrapKV(result) {
  try {
    console.log('原始数据:', typeof result === 'string' ? result : JSON.stringify(result));
    
    // 安全解析：迭代解析字符串（最多三次），不破坏转义字符
    let data = result;
    for (let i = 0; i < 3 && typeof data === 'string'; i++) {
      try {
        data = JSON.parse(data);
      } catch {
        break;
      }
    }
    
    // 解包嵌套的 value 结构
    let guard = 0;
    while (data && typeof data === 'object' && 'value' in data && guard < 3) {
      data = data.value;
      // 若 value 仍为字符串，继续尝试解析
      for (let i = 0; i < 2 && typeof data === 'string'; i++) {
        try { data = JSON.parse(data); } catch { break; }
      }
      guard++;
    }
    
    // 再做一次兜底解析（处理双重字符串化的数组/对象）
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch {}
    }
    
    console.log('最终解包结果:', data);
    return data;
  } catch (e) {
    console.error('解包过程异常:', e);
    return null;
  }
}

// 读取指定用户的交互数据（点赞、转发）
async function readUserInteractions(userId, apiUrl, apiToken) {
    const key = `${USER_INTERACTIONS_PREFIX}${userId}`;
    try {
        const resp = await fetch(`${apiUrl}/get/${key}`, {
            headers: { 'Authorization': `Bearer ${apiToken}` }
        });
        if (!resp.ok) return { liked: [], retweeted: [] };
        const data = await resp.json();
        const unpacked = unwrapKV(data.result);
        if (unpacked && typeof unpacked === 'object') {
            return {
                liked: Array.isArray(unpacked.liked) ? unpacked.liked : [],
                retweeted: Array.isArray(unpacked.retweeted) ? unpacked.retweeted : []
            };
        }
        return { liked: [], retweeted: [] };
    } catch (e) {
        return { liked: [], retweeted: [] };
    }
}

// 写入指定用户的交互数据
async function writeUserInteractions(userId, interactions, apiUrl, apiToken) {
    const key = `${USER_INTERACTIONS_PREFIX}${userId}`;
    try {
        const resp = await fetch(`${apiUrl}/set/${key}`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${apiToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ value: interactions })
        });
        return resp.ok;
    } catch {
        return false;
    }
}

// 从 Upstash 读取帖子数据
async function readPosts(apiUrl, apiToken) {
    try {
        const resp = await fetch(`${apiUrl}/get/${SOCIAL_POSTS_KEY}`, {
            headers: { 'Authorization': `Bearer ${apiToken}` }
        });

        // 若 Upstash 请求非 2xx，则不要初始化，抛错以避免覆盖现有数据
        if (!resp.ok) {
            console.error('Upstash 读取失败，状态码:', resp.status);
            throw new Error(`Upstash GET failed: ${resp.status}`);
        }

        const data = await resp.json();
        const raw = data && data.result;

        // 仅当键不存在（result === null）时才进行一次性初始化
        if (raw === null || typeof raw === 'undefined') {
            console.log('首次初始化帖子数据（键不存在）');
            return await initializePosts(apiUrl, apiToken);
        }

        // 解包并规范化为数组，兼容历史多种存储格式
        let unpacked = unwrapKV(raw);
        let postsArr = null;

        // 工具函数：判断对象是否像帖子
        const looksLikePost = (v) => v && typeof v === 'object' && (
            'content' in v || 'userId' in v || 'user' in v || 'userName' in v
        );
        const tryParse = (s) => {
            if (typeof s !== 'string') return s;
            try { return JSON.parse(s); } catch { return s; }
        };
        const deepFindPosts = (node, depth = 0) => {
            if (depth > 5) return null;
            if (node == null) return null;
            // 直接是数组
            if (Array.isArray(node)) {
                // 尝试解析数组中的字符串元素
                const parsed = node.map(tryParse);
                if (parsed.some(looksLikePost)) return parsed;
                return null;
            }
            // 字符串：尝试解析后继续
            if (typeof node === 'string') {
                const parsed = tryParse(node);
                if (parsed !== node) return deepFindPosts(parsed, depth + 1);
                return null;
            }
            // 对象：
            if (typeof node === 'object') {
                const keys = Object.keys(node);
                // 数字键对象转数组
                const isNumericKeyObject = keys.length > 0 && keys.every(k => /^\d+$/.test(k));
                if (isNumericKeyObject) {
                    const arr = keys
                        .map(k => [Number(k), node[k]])
                        .sort((a, b) => a[0] - b[0])
                        .map(([, v]) => tryParse(v));
                    if (arr.some(looksLikePost)) return arr;
                }
                // 常见容器字段
                for (const k of ['posts', 'value', 'result', 'data']) {
                    if (k in node) {
                        const found = deepFindPosts(node[k], depth + 1);
                        if (Array.isArray(found)) return found;
                    }
                }
                // 遍历所有值
                for (const v of Object.values(node)) {
                    const found = deepFindPosts(v, depth + 1);
                    if (Array.isArray(found)) return found;
                }
            }
            return null;
        };

        // 1) 已是数组
        if (Array.isArray(unpacked)) {
            postsArr = unpacked;
        }
        // 2) 对象容器里包含 posts/value/result 等字段
        else if (unpacked && typeof unpacked === 'object') {
            if (Array.isArray(unpacked.posts)) postsArr = unpacked.posts;
            else if (Array.isArray(unpacked.value)) postsArr = unpacked.value;
            else if (Array.isArray(unpacked.result)) postsArr = unpacked.result;
        }
        // 3) 字符串（可能是数组的 JSON 字符串）
        else if (typeof unpacked === 'string') {
            try {
                const parsed = JSON.parse(unpacked);
                if (Array.isArray(parsed)) postsArr = parsed;
                else if (parsed && typeof parsed === 'object') {
                    if (Array.isArray(parsed.posts)) postsArr = parsed.posts;
                    else if (Array.isArray(parsed.value)) postsArr = parsed.value;
                    else if (Array.isArray(parsed.result)) postsArr = parsed.result;
                }
            } catch (e) {
                console.error('字符串化帖子数据二次解析失败:', e);
            }
        }

        if (!Array.isArray(postsArr)) {
            // 尝试从对象的任何键中查找数组
            if (unpacked && typeof unpacked === 'object') {
                for (const key of Object.keys(unpacked)) {
                    if (Array.isArray(unpacked[key])) {
                        return unpacked[key];
                    }
                }

                // 兼容数组被存成对象 {"0": {...}, "1": {...}}
                const keys = Object.keys(unpacked);
                const isNumericKeyObject = keys.length > 0 && keys.every(k => /^\d+$/.test(k));
                if (isNumericKeyObject) {
                    const arr = keys
                        .map(k => [Number(k), unpacked[k]])
                        .sort((a, b) => a[0] - b[0])
                        .map(([, v]) => v);
                    return arr;
                }

                // 兼容对象值为帖子对象的 map：取 values 作为数组（并对字符串元素尝试解析）
                const rawValues = Object.values(unpacked);
                if (rawValues.length > 0) {
                    const parsedValues = rawValues.map(v => tryParse(v));
                    const looksLikePosts = parsedValues.every(v => v && typeof v === 'object' && ('content' in v || 'userId' in v || 'user' in v || 'userName' in v));
                    if (looksLikePosts) {
                        return parsedValues;
                    }
                }

                // 递归深度查找：应对更复杂的嵌套/双重字符串化
                const deep = deepFindPosts(unpacked, 0);
                if (Array.isArray(deep)) return deep;
            }
            
            console.error('帖子数据格式无效，无法解析为数组');
            throw new Error(`Invalid posts format in KV - raw type: ${typeof raw}, unpacked type: ${typeof unpacked}`);
        }
        return postsArr;
    } catch (error) {
        // 不再在读取失败时初始化，避免误覆盖历史数据
        console.error('读取帖子数据失败（不进行初始化）:', error);
        throw error;
    }
}

// 写入帖子数据到 Upstash
async function writePosts(posts, apiUrl, apiToken) {
    try {
        const resp = await fetch(`${apiUrl}/set/${SOCIAL_POSTS_KEY}`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${apiToken}`,
                'Content-Type': 'application/json'
            },
            // Upstash KV requires the payload to be wrapped as { "value": ... }
            body: JSON.stringify({ value: posts })
        });
        
        if (!resp.ok) {
            console.error('写入帖子数据失败:', resp.status);
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('写入帖子数据异常:', error);
        return false;
    }
}


// 初始化帖子数据（默认不注入任何模拟数据）
async function initializePosts(apiUrl, apiToken) {
    const initialPosts = SEED_MOCK_POSTS ? [
        {
            id: 1,
            userId: 'user00001',
            userName: '陶先生',
            userAvatar: 'images/user00001.jpg',
            userVip: 'Pro会员',
            content: '刚刚发布了翰林桥的新功能！大家可以在这里分享学习心得和讨论学术问题了 🎓',
            timestamp: new Date(Date.now() - 3600000),
            likes: 24,
            retweets: 5,
            comments: 8,
            views: 156,
            liked: false,
            retweeted: false
        },
        {
            id: 2,
            userId: 'user00002',
            userName: '生物杨老师',
            userAvatar: 'images/user00002.jpg',
            userVip: 'Pro会员',
            content: '分享一个生物学习小技巧：记忆细胞结构时，可以把细胞比作一个城市，各个细胞器就像城市的不同功能区域。这样记忆会更加深刻！',
            timestamp: new Date(Date.now() - 7200000),
            likes: 18,
            retweets: 12,
            comments: 6,
            views: 89,
            liked: true,
            retweeted: false
        },
        {
            id: 3,
            userId: 'user00003',
            userName: '化学孙老师',
            userAvatar: 'images/user00003.jpg',
            userVip: 'Pro会员',
            content: '今天的化学实验太有趣了！看到学生们对化学反应的好奇眼神，感觉所有的努力都值得了 ⚗️✨',
            timestamp: new Date(Date.now() - 10800000),
            likes: 31,
            retweets: 3,
            comments: 11,
            views: 203,
            liked: false,
            retweeted: true
        },
        {
            id: 4,
            userId: 'user00005',
            userName: '邬学长',
            userAvatar: 'images/user00005.jpg',
            userVip: '普通会员',
            content: '备考期间，保持良好的心态很重要。每天给自己设定小目标，完成后给自己一点奖励。加油，所有正在努力的同学们！💪',
            timestamp: new Date(Date.now() - 14400000),
            likes: 45,
            retweets: 8,
            comments: 15,
            views: 287,
            liked: false,
            retweeted: false
        },
        {
            id: 5,
            userId: 'user00007',
            userName: '王学姐',
            userAvatar: 'images/user00007.jpg',
            userVip: '普通会员',
            content: '推荐一个学习方法：番茄工作法。25分钟专注学习+5分钟休息，效果真的很不错！特别适合注意力容易分散的同学。',
            timestamp: new Date(Date.now() - 18000000),
            likes: 22,
            retweets: 7,
            comments: 9,
            views: 145,
            liked: true,
            retweeted: false
        }
    ] : [];

    await writePosts(initialPosts, apiUrl, apiToken);
    return initialPosts;
}

export default async function handler(req, res) {
    // 设置CORS头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Username');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const apiUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const apiToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
    
    if (!apiUrl || !apiToken) {
        return res.status(500).json({ 
            error: 'KV_REST_API_URL/KV_REST_API_TOKEN or UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN not set',
            timestamp: new Date().toISOString()
        });
    }

    const { method } = req;
    // 优先从查询参数读取 postId，兼容 /api/social-posts?id=123
    // 同时保留对 /api/social-posts/123 这种路径形式的回退兼容
    const postId = (req.query && (req.query.id || req.query.postId)) || (() => {
        try {
            const pathname = new URL(req.url, 'http://localhost').pathname;
            const parts = pathname.split('/');
            const last = parts[parts.length - 1];
            return /^\d+$/.test(last) ? last : null;
        } catch {
            return null;
        }
    })();

    try {
        if (method === 'GET') {
            // 获取所有帖子
            const posts = await readPosts(apiUrl, apiToken);
            res.status(200).json(posts);
        } else if (method === 'POST') {
            // 创建新帖子
            const posts = await readPosts(apiUrl, apiToken);
            const newPost = req.body;
            
            // 基本校验
            if (!newPost || typeof newPost !== 'object') {
                return res.status(400).json({ error: 'Invalid post payload' });
            }
            
            // 规范化帖子格式：统一为扁平化格式
            if (newPost.user && typeof newPost.user === 'object') {
                // 前端发送的是 {user: {...}} 格式，转换为扁平化格式
                newPost.userId = newPost.user.username;
                newPost.userName = newPost.user.name;
                newPost.userAvatar = newPost.user.avatar;
                newPost.userVip = newPost.user.vip;
                delete newPost.user; // 删除嵌套的user对象
            }
            
            // 校验用户信息
            if (!newPost.userId || !newPost.userName) {
                return res.status(400).json({ error: 'Missing user info (userId/userName)' });
            }
            
            // 处理内容，保留 emoji，限制长度（按字符点截断，避免截断代理对）
            if (typeof newPost.content !== 'string') {
                newPost.content = newPost.content == null ? '' : String(newPost.content);
            }
            newPost.content = newPost.content.replace(/\r\n/g, '\n').trim();
            const CONTENT_CHAR_LIMIT = 2000;
            if (newPost.content.length > CONTENT_CHAR_LIMIT) {
                newPost.content = [...newPost.content].slice(0, CONTENT_CHAR_LIMIT).join('');
            }
            
            // 生成新ID
            const maxId = posts.reduce((max, p) => {
                const n = Number(p && p.id);
                return Number.isFinite(n) ? Math.max(max, n) : max;
            }, 0);
            newPost.id = maxId + 1;
            newPost.timestamp = new Date().toISOString();
            newPost.likes = 0;
            newPost.retweets = 0;
            newPost.comments = 0;
            newPost.views = 0;
            newPost.liked = false;
            newPost.retweeted = false;
            // 初始化交互数组，便于多用户持久化
            if (!Array.isArray(newPost.likedBy)) newPost.likedBy = [];
            if (!Array.isArray(newPost.retweetedBy)) newPost.retweetedBy = [];
            if (!Array.isArray(newPost.viewedBy)) newPost.viewedBy = [];
            
            posts.unshift(newPost);
            const success = await writePosts(posts, apiUrl, apiToken);
            
            if (success) {
                res.status(201).json(newPost);
            } else {
                res.status(500).json({ error: 'Failed to save post' });
            }
        } else if (method === 'PATCH') {
            // 更新帖子（点赞、转发等）
            const posts = await readPosts(apiUrl, apiToken);
            const incomingBody = req.body || {};
            // 调试日志：记录收到的 PATCH 请求
            try {
                console.log('PATCH /api/social-posts debug:', { url: req.url, postId, body: incomingBody });
            } catch {}
            const { userId } = incomingBody;
            const rawAction = incomingBody && typeof incomingBody.action !== 'undefined' ? incomingBody.action : undefined;
            const action = typeof rawAction === 'string' ? rawAction.trim().toLowerCase() : undefined;
            
            if (!postId) {
                return res.status(400).json({ error: 'Missing post id', debug: { url: req.url, body: incomingBody } });
            }
            const post = posts.find(p => p.id == postId);
            if (!post) {
                return res.status(404).json({ error: 'Post not found' });
            }
            
            switch (action) {
                case 'like': {
                    if (!userId) {
                        return res.status(400).json({ error: 'Missing userId for like action' });
                    }
                    if (!Array.isArray(post.likedBy)) post.likedBy = [];
                    const exists = post.likedBy.includes(userId);
                    if (exists) {
                        post.likedBy = post.likedBy.filter(id => id !== userId);
                        post.likes = Math.max(0, (post.likes || 0) - 1);
                        post.liked = false;
                    } else {
                        post.likedBy.push(userId);
                        post.likes = (post.likes || 0) + 1;
                        post.liked = true;
                    }
                    // 同步用户交互到 Upstash
                    try {
                        const ui = await readUserInteractions(userId, apiUrl, apiToken);
                        const likedSet = new Set(ui.liked || []);
                        const pid = Number(postId);
                        if (exists) {
                            likedSet.delete(pid);
                        } else {
                            likedSet.add(pid);
                        }
                        await writeUserInteractions(userId, { liked: Array.from(likedSet), retweeted: ui.retweeted || [] }, apiUrl, apiToken);
                    } catch {}
                    break;
                }
                case 'promote': {
                    if (!userId) {
                        return res.status(400).json({ error: 'Missing userId for promote action', debug: { receivedBody: incomingBody } });
                    }
                    // 验证超级管理员权限
                    if (userId !== 'taosir') {
                        return res.status(403).json({ error: 'Insufficient permissions for promote action' });
                    }
                    // 取消其他帖子的推荐状态
                    posts.forEach(p => {
                        if (p.promoted) p.promoted = false;
                    });
                    // 推荐当前帖子
                    post.promoted = true;
                    break;
                }
                case 'unpromote': {
                    if (!userId) {
                        return res.status(400).json({ error: 'Missing userId for unpromote action', debug: { receivedBody: incomingBody } });
                    }
                    // 验证超级管理员权限
                    if (userId !== 'taosir') {
                        return res.status(403).json({ error: 'Insufficient permissions for unpromote action' });
                    }
                    // 取消推荐
                    post.promoted = false;
                    break;
                }
                case 'retweet': {
                    if (!userId) {
                        return res.status(400).json({ error: 'Missing userId for retweet action' });
                    }
                    if (!Array.isArray(post.retweetedBy)) post.retweetedBy = [];
                    const exists = post.retweetedBy.includes(userId);
                    if (exists) {
                        post.retweetedBy = post.retweetedBy.filter(id => id !== userId);
                        post.retweets = Math.max(0, (post.retweets || 0) - 1);
                        post.retweeted = false;
                    } else {
                        post.retweetedBy.push(userId);
                        post.retweets = (post.retweets || 0) + 1;
                        post.retweeted = true;
                    }
                    // 同步用户交互到 Upstash
                    try {
                        const ui = await readUserInteractions(userId, apiUrl, apiToken);
                        const rtSet = new Set(ui.retweeted || []);
                        const pid = Number(postId);
                        if (exists) {
                            rtSet.delete(pid);
                        } else {
                            rtSet.add(pid);
                        }
                        await writeUserInteractions(userId, { liked: ui.liked || [], retweeted: Array.from(rtSet) }, apiUrl, apiToken);
                    } catch {}
                    break;
                }
                case 'view':
                    post.views += 1;
                    break;
                default:
                    return res.status(400).json({ error: 'Invalid action', debug: { receivedBody: incomingBody, rawAction, normalizedAction: action } });
            }
            
            const success = await writePosts(posts, apiUrl, apiToken);
            if (success) {
                res.status(200).json(post);
            } else {
                res.status(500).json({ error: 'Failed to update post' });
            }
        } else if (method === 'DELETE') {
            // 删除帖子（仅超级管理员）
            // 校验权限：优先使用口令校验，其次使用用户名白名单
            const authHeader = req.headers['authorization'] || req.headers['Authorization'];
            const bearer = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
            const requiredToken = process.env.SUPREME_DELETE_TOKEN;
            const adminUsername = req.headers['x-admin-username'] || req.headers['X-Admin-Username'];
            const allowedAdmins = (process.env.SUPREME_USERNAMES || 'taosir')
                .split(',')
                .map(s => s && s.trim())
                .filter(Boolean);

            if (requiredToken) {
                if (!bearer || bearer !== requiredToken) {
                    return res.status(403).json({ error: 'Forbidden: invalid admin token' });
                }
            } else {
                if (!adminUsername || !allowedAdmins.includes(adminUsername)) {
                    return res.status(403).json({ error: 'Forbidden: not allowed' });
                }
            }

            if (!postId) {
                return res.status(400).json({ error: 'Missing post id' });
            }

            const posts = await readPosts(apiUrl, apiToken);
            // 找到即将被删除的条目（可能是帖子，也可能是评论）
            const toDelete = posts.find(p => p.id == postId);
            if (!toDelete) {
                return res.status(404).json({ error: 'Post not found' });
            }

            let filteredPosts = posts.filter(p => p.id != postId);

            // 若删除的是主帖子（没有 postId 字段），则级联删除所有相关评论
            if (toDelete && !Object.prototype.hasOwnProperty.call(toDelete, 'postId')) {
                // 这是主帖子，删除所有相关评论
                filteredPosts = filteredPosts.filter(p => p.postId != postId);
            }
            // 若删除的是评论（具有 postId 字段），则尝试同步减少父帖子的 comments 计数
            else if (toDelete && Object.prototype.hasOwnProperty.call(toDelete, 'postId') && toDelete.postId != null) {
                const parentId = toDelete.postId;
                const parent = filteredPosts.find(p => p.id == parentId);
                if (parent) {
                    const current = Number(parent.comments) || 0;
                    parent.comments = Math.max(0, current - 1);
                }
            }

            const success = await writePosts(filteredPosts, apiUrl, apiToken);
            if (success) {
                res.status(200).json({ message: 'Post deleted successfully' });
            } else {
                res.status(500).json({ error: 'Failed to delete post' });
            }
            
        } else {
            res.setHeader('Allow', ['GET', 'POST', 'PATCH', 'DELETE']);
            res.status(405).end(`Method ${method} Not Allowed`);
        }
        
    } catch (error) {
        console.error('Social posts API error:', error);
        res.status(500).json({ error: 'Internal server error', detail: error.message });
    }
}
