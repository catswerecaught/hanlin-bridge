// 社交媒体帖子 API - 使用 Upstash 存储
const SOCIAL_POSTS_KEY = 'social-posts';
const SOCIAL_POST_PREFIX = 'social-post-';
const USER_INTERACTIONS_PREFIX = 'user-interactions:';

function unwrapKV(result) {
  try {
    console.log('原始数据:', typeof result === 'string' ? result : JSON.stringify(result));
    
    // 首次解析（处理字符串或对象）
    let data = typeof result === 'string' ? 
      JSON.parse(result.replace(/\\"/g, '"')) : 
      result;
    
    // 解包嵌套的value结构
    while (data && typeof data === 'object' && data.value) {
      data = data.value;
    }
    
    // 处理可能存在的二次字符串化情况
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch (e) {
        console.error('二级JSON解析失败:', e);
      }
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
        
        if (!resp.ok) {
            console.log('未找到帖子数据，初始化新数据');
            return await initializePosts(apiUrl, apiToken);
        }
        
        const data = await resp.json();
        const posts = unwrapKV(data.result);
        
        if (!posts || !Array.isArray(posts)) {
            console.log('帖子数据格式无效，重新初始化');
            return await initializePosts(apiUrl, apiToken);
        }
        
        return posts;
    } catch (error) {
        console.error('读取帖子数据失败:', error);
        return await initializePosts(apiUrl, apiToken);
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


// 初始化帖子数据
async function initializePosts(apiUrl, apiToken) {
    const initialPosts = [
        {
            id: 1,
            userId: 'user00001',
            userName: '陶先生',
            userAvatar: 'images/user00001.jpg',
            userVip: 'Pro会员',
            content: '刚刚发布了翰林桥的新功能！大家可以在这里分享学习心得和讨论学术问题了 🎓',
            timestamp: new Date(Date.now() - 3600000), // 1小时前
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
            timestamp: new Date(Date.now() - 7200000), // 2小时前
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
            timestamp: new Date(Date.now() - 10800000), // 3小时前
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
            timestamp: new Date(Date.now() - 14400000), // 4小时前
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
            timestamp: new Date(Date.now() - 18000000), // 5小时前
            likes: 22,
            retweets: 7,
            comments: 9,
            views: 145,
            liked: true,
            retweeted: false
        }
    ];

    // 写入初始数据到 Upstash
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
            
            // 生成新ID
            newPost.id = Math.max(...posts.map(p => p.id), 0) + 1;
            newPost.timestamp = new Date();
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
            const { action, userId } = req.body;
            
            if (!postId) {
                return res.status(400).json({ error: 'Missing post id' });
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
                    return res.status(400).json({ error: 'Invalid action' });
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
            const filteredPosts = posts.filter(p => p.id != postId);
            
            if (filteredPosts.length === posts.length) {
                return res.status(404).json({ error: 'Post not found' });
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
