// 社媒页面功能
document.addEventListener('DOMContentLoaded', function() {
    // 社媒数据存储
    let socialData = {
        posts: [],
        currentUser: null,
        suggestions: [],
        trends: []
    };

    // DOM 元素
    const postContent = document.getElementById('postContent');
    const charCount = document.getElementById('charCount');
    const submitPost = document.getElementById('submitPost');
    const postsContainer = document.getElementById('postsContainer');
    const suggestionsList = document.getElementById('suggestionsList');
    const trendsList = document.getElementById('trendsList');
    const composeAvatar = document.getElementById('composeAvatar');
    const searchInput = document.getElementById('searchInput');

    // 初始化
    init();

    async function init() {
        // 检查用户登录状态
        checkLoginStatus();
        
        // 初始化事件监听器
        initEventListeners();
        
        // 加载初始数据
        await loadInitialData();
        
        // 渲染页面内容
        renderPosts();
        renderSuggestions();
        renderTrends();
    }

    function checkLoginStatus() {
        const currentUser = getCurrentUser();
        if (currentUser) {
            socialData.currentUser = currentUser;
            updateUserAvatar();
        }
    }

    function getCurrentUser() {
        // 检查多种可能的登录状态存储方式
        let storedUser = localStorage.getItem('currentUser');
        if (!storedUser) {
            storedUser = localStorage.getItem('loggedInUser');
        }
        if (!storedUser) {
            storedUser = sessionStorage.getItem('currentUser');
        }
        
        if (storedUser) {
            try {
                const userData = JSON.parse(storedUser);
                console.log('找到存储的用户数据:', userData);
                // 从users数组中找到完整的用户信息
                const foundUser = users.find(user => 
                    user.username === userData.username || 
                    user.username === userData.name ||
                    user.name === userData.username
                );
                console.log('匹配到的用户:', foundUser);
                return foundUser;
            } catch (e) {
                console.error('解析用户数据失败:', e);
                // 如果是字符串格式，尝试直接匹配
                const foundUser = users.find(user => 
                    user.username === storedUser || user.name === storedUser
                );
                return foundUser;
            }
        }
        
        // 检查是否有其他登录标识
        const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
        if (isLoggedIn) {
            // 如果有登录标识但没有用户数据，返回第一个用户作为默认
            console.log('检测到登录状态但无用户数据，使用默认用户');
            return users[0]; // 返回陶先生作为默认登录用户
        }
        
        return null;
    }

    function updateUserAvatar() {
        if (socialData.currentUser && composeAvatar) {
            composeAvatar.src = socialData.currentUser.avatar || 'images/login-default.png';
            console.log('更新发帖头像:', socialData.currentUser.avatar);
        } else {
            console.log('更新头像失败 - 当前用户:', socialData.currentUser, '头像元素:', composeAvatar);
        }
    }

    function initEventListeners() {
        // 发帖内容输入监听
        if (postContent) {
            postContent.addEventListener('input', function() {
                const length = this.value.length;
                charCount.textContent = length;
                
                // 启用/禁用发帖按钮
                submitPost.disabled = length === 0 || length > 280;
                
                // 字符计数颜色
                if (length > 260) {
                    charCount.style.color = length > 280 ? '#f91880' : '#ffd400';
                } else {
                    charCount.style.color = 'var(--secondary-text-color)';
                }
                
                // 自动调整高度
                this.style.height = 'auto';
                this.style.height = Math.min(this.scrollHeight, 200) + 'px';
            });
        }

        // 提交发帖
        if (submitPost) {
            submitPost.addEventListener('click', handleSubmitPost);
        }

        // 搜索功能
        if (searchInput) {
            searchInput.addEventListener('input', handleSearch);
        }

        // Tab切换
        document.querySelectorAll('.feed-tab').forEach(tab => {
            tab.addEventListener('click', function() {
                document.querySelectorAll('.feed-tab').forEach(t => t.classList.remove('active'));
                this.classList.add('active');
                
                const tabType = this.dataset.tab;
                renderPosts(tabType);
            });
        });
    }

    async function loadInitialData() {
        try {
            console.log('开始加载初始数据...');
            // 加载帖子数据
            const postsResponse = await fetch('/api/social-posts');
            if (postsResponse.ok) {
                socialData.posts = await postsResponse.json();
                console.log('从API加载了', socialData.posts.length, '条帖子');
            } else {
                // 如果API不存在，使用模拟数据
                socialData.posts = generateMockPosts();
                console.log('API不可用，使用模拟数据，生成了', socialData.posts.length, '条帖子');
            }

            // 生成推荐关注和趋势数据
            socialData.suggestions = generateSuggestions();
            socialData.trends = generateTrends();
        } catch (error) {
            console.log('API调用失败，使用模拟数据:', error);
            socialData.posts = generateMockPosts();
            socialData.suggestions = generateSuggestions();
            socialData.trends = generateTrends();
        }
    }

    function generateMockPosts() {
        const mockPosts = [
            {
                id: 1,
                user: users[0], // 陶先生
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
                user: users[1], // 生物杨老师
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
                user: users[2], // 化学孙老师
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
                user: users[4], // 邬学长
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
                user: users[6], // 王学姐
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
        
        return mockPosts;
    }

    function generateSuggestions() {
        // 随机选择一些用户作为推荐关注
        const availableUsers = users.filter(user => 
            !socialData.currentUser || user.username !== socialData.currentUser.username
        );
        
        return availableUsers.slice(0, 4).map(user => ({
            ...user,
            followers: Math.floor(Math.random() * 1000) + 100
        }));
    }

    function generateTrends() {
        return [
            {
                category: '韩语音乐 · 趋势',
                topic: 'Jungkook',
                count: '20.3万 贴子'
            },
            {
                category: '韩语音乐 · 趋势',
                topic: 'TAEKOOK',
                count: '149万 贴子'
            },
            {
                category: '美国 · 趋势',
                topic: '$TIRTLE',
                count: '8,893 贴子'
            },
            {
                category: '美食 · 趋势',
                topic: 'Celsius',
                count: '2,453 贴子'
            },
            {
                category: '教育 · 趋势',
                topic: '翰林桥',
                count: '1,234 贴子'
            }
        ];
    }

    async function handleSubmitPost() {
        if (!socialData.currentUser) {
            alert('请先登录');
            return;
        }

        const content = postContent.value.trim();
        if (!content) return;

        const newPost = {
            id: Date.now(),
            user: socialData.currentUser,
            content: content,
            timestamp: new Date(),
            likes: 0,
            retweets: 0,
            comments: 0,
            views: 0,
            liked: false,
            retweeted: false
        };

        try {
            // 尝试发送到后端API
            const response = await fetch('/api/social-posts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(newPost)
            });

            if (response.ok) {
                const savedPost = await response.json();
                socialData.posts.unshift(savedPost);
            } else {
                // 如果API不可用，添加到本地数据
                socialData.posts.unshift(newPost);
            }
        } catch (error) {
            // API不可用时的fallback
            socialData.posts.unshift(newPost);
        }

        // 清空输入框
        postContent.value = '';
        charCount.textContent = '0';
        submitPost.disabled = true;
        postContent.style.height = 'auto';

        // 重新渲染帖子列表
        renderPosts();
        
        // 显示成功提示
        showToast('发帖成功！');
    }

    function renderPosts(filter = 'recommend') {
        console.log('开始渲染帖子，当前数据:', socialData.posts);
        let postsToShow = [...socialData.posts];
        
        // 根据tab过滤帖子
        if (filter === 'following' && socialData.currentUser) {
            // 这里可以实现关注逻辑，暂时显示所有帖子
            postsToShow = socialData.posts;
        }
        
        // 按时间排序
        postsToShow.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        console.log('准备渲染的帖子数量:', postsToShow.length);
        
        if (postsToShow.length === 0) {
            postsContainer.innerHTML = '<div style="padding: 40px; text-align: center; color: var(--secondary-text-color);">暂无帖子</div>';
        } else {
            postsContainer.innerHTML = postsToShow.map(post => createPostHTML(post)).join('');
        }
        
        // 添加帖子交互事件
        addPostEventListeners();
    }

    function createPostHTML(post) {
        console.log('渲染帖子:', post);
        const timeAgo = getTimeAgo(post.timestamp);
        
        // 处理用户信息 - 兼容两种数据格式
        const user = post.user || {
            name: post.userName,
            username: post.userId,
            avatar: post.userAvatar,
            vip: post.userVip
        };
        
        const verifiedBadge = (user.vip === 'Pro会员' || user.vip === '普通会员') ? 
            `<img class="vip-badge" src="images/smverified.png" alt="认证用户" style="width: 16px; height: 16px; margin-left: 4px;">` : '';

        return `
            <article class="post-item" data-post-id="${post.id}">
                <div class="post-header">
                    <div class="post-avatar">
                        <img src="${user.avatar}" alt="${user.name}">
                    </div>
                    <div class="post-user-info">
                        <span class="post-user-name">${user.name}</span>
                        <span class="post-username">@${user.username}</span>
                        <span class="post-time">·</span>
                        <span class="post-time">${timeAgo}</span>
                        ${verifiedBadge}
                    </div>
                    <div class="post-menu">
                        <svg viewBox="0 0 24 24">
                            <path d="M3 12c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zm9 2c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm7 0c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z"/>
                        </svg>
                    </div>
                </div>
                <div class="post-content">${post.content}</div>
                <div class="post-actions">
                    <div class="post-action" data-action="comment">
                        <svg viewBox="0 0 24 24">
                            <path d="M1.751 10c0-4.42 3.584-8.003 8.005-8.003h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01zm8.005-6.003c-3.317 0-6.005 2.69-6.005 6.003 0 3.37 2.77 6.1 6.138 6.01l.351-.01h1.761v2.3l5.087-2.81c1.951-1.08 3.163-3.13 3.163-5.36 0-3.39-2.744-6.13-6.129-6.13H9.756z"/>
                        </svg>
                        <span>${formatCount(post.comments)}</span>
                    </div>
                    <div class="post-action ${post.retweeted ? 'retweeted' : ''}" data-action="retweet">
                        <svg viewBox="0 0 24 24">
                            <path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.791-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.791 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46L18.5 16V8c0-1.1-.896-2-2-2z"/>
                        </svg>
                        <span>${formatCount(post.retweets)}</span>
                    </div>
                    <div class="post-action ${post.liked ? 'liked' : ''}" data-action="like">
                        <svg viewBox="0 0 24 24">
                            <path d="M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91zm4.187 7.69c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z"/>
                        </svg>
                        <span>${formatCount(post.likes)}</span>
                    </div>
                    <div class="post-action" data-action="view">
                        <svg viewBox="0 0 24 24">
                            <path d="M8.75 21V3h2v18h-2zM18 21V8.5h2V21h-2zM4 21l.004-10H6v10H4zm9.248 0v-7h2v7h-2z"/>
                        </svg>
                        <span>${formatCount(post.views)}</span>
                    </div>
                </div>
            </article>
        `;
    }

    function addPostEventListeners() {
        // 帖子交互事件
        document.querySelectorAll('.post-action').forEach(action => {
            action.addEventListener('click', function(e) {
                e.stopPropagation();
                const actionType = this.dataset.action;
                const postId = parseInt(this.closest('.post-item').dataset.postId);
                handlePostAction(actionType, postId, this);
            });
        });
    }

    async function handlePostAction(action, postId, element) {
        if (!socialData.currentUser && (action === 'like' || action === 'retweet' || action === 'comment')) {
            alert('请先登录');
            return;
        }

        const post = socialData.posts.find(p => p.id === postId);
        if (!post) return;

        const currentUserId = socialData.currentUser ? socialData.currentUser.username : null;
        if (currentUserId) {
            // 初始化数组如果不存在
            if (!post.likedBy) post.likedBy = [];
            if (!post.retweetedBy) post.retweetedBy = [];
        }

        switch (action) {
            case 'like':
                post.liked = !post.liked;
                post.likes += post.liked ? 1 : -1;
                if (currentUserId) {
                    if (post.liked && !post.likedBy.includes(currentUserId)) {
                        post.likedBy.push(currentUserId);
                    } else if (!post.liked && post.likedBy.includes(currentUserId)) {
                        post.likedBy = post.likedBy.filter(id => id !== currentUserId);
                    }
                }
                element.classList.toggle('liked', post.liked);
                element.querySelector('span').textContent = formatCount(post.likes);
                break;
                
            case 'retweet':
                post.retweeted = !post.retweeted;
                post.retweets += post.retweeted ? 1 : -1;
                if (currentUserId) {
                    if (post.retweeted && !post.retweetedBy.includes(currentUserId)) {
                        post.retweetedBy.push(currentUserId);
                    } else if (!post.retweeted && post.retweetedBy.includes(currentUserId)) {
                        post.retweetedBy = post.retweetedBy.filter(id => id !== currentUserId);
                    }
                }
                element.classList.toggle('retweeted', post.retweeted);
                element.querySelector('span').textContent = formatCount(post.retweets);
                break;
                
            case 'comment':
                // 这里可以实现评论功能
                showToast('评论功能开发中...');
                break;
                
            case 'view':
                post.views += 1;
                element.querySelector('span').textContent = formatCount(post.views);
                break;
        }

        // 尝试同步到后端
        try {
            await fetch(`/api/social-posts/${postId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    likes: post.likes,
                    retweets: post.retweets,
                    comments: post.comments,
                    views: post.views,
                    liked: post.liked,
                    retweeted: post.retweeted
                })
            });
        } catch (error) {
            // API不可用时忽略错误
        }
    }

    function renderSuggestions() {
        suggestionsList.innerHTML = socialData.suggestions.map(user => `
            <div class="suggestion-item">
                <div class="suggestion-avatar">
                    <img src="${user.avatar}" alt="${user.name}">
                </div>
                <div class="suggestion-info">
                    <div class="suggestion-name">${user.name}</div>
                    <div class="suggestion-username">@${user.username}</div>
                </div>
                <button class="follow-btn" data-username="${user.username}">关注</button>
            </div>
        `).join('');

        // 添加关注按钮事件
        document.querySelectorAll('.follow-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                this.textContent = '已关注';
                this.style.background = 'transparent';
                this.style.color = 'var(--text-color)';
                this.style.border = '1px solid var(--border-color)';
                showToast('关注成功！');
            });
        });
    }

    function renderTrends() {
        trendsList.innerHTML = socialData.trends.map(trend => `
            <div class="trend-item">
                <div class="trend-category">${trend.category}</div>
                <div class="trend-topic">${trend.topic}</div>
                <div class="trend-count">${trend.count}</div>
            </div>
        `).join('');
    }

    function handleSearch() {
        const query = searchInput.value.toLowerCase();
        if (query.length < 2) {
            renderPosts();
            return;
        }

        const filteredPosts = socialData.posts.filter(post =>
            post.content.toLowerCase().includes(query) ||
            post.user.name.toLowerCase().includes(query) ||
            post.user.username.toLowerCase().includes(query)
        );

        postsContainer.innerHTML = filteredPosts.map(post => createPostHTML(post)).join('');
        addPostEventListeners();
    }

    // 工具函数
    function getTimeAgo(timestamp) {
        const now = new Date();
        const postTime = new Date(timestamp);
        const diffInMinutes = Math.floor((now - postTime) / (1000 * 60));
        
        if (diffInMinutes < 1) return '刚刚';
        if (diffInMinutes < 60) return `${diffInMinutes}分钟`;
        
        const diffInHours = Math.floor(diffInMinutes / 60);
        if (diffInHours < 24) return `${diffInHours}小时`;
        
        const diffInDays = Math.floor(diffInHours / 24);
        if (diffInDays < 7) return `${diffInDays}天`;
        
        return postTime.toLocaleDateString('zh-CN');
    }

    function formatCount(count) {
        if (count < 1000) return count.toString();
        if (count < 10000) return (count / 1000).toFixed(1) + 'K';
        if (count < 1000000) return Math.floor(count / 1000) + 'K';
        return (count / 1000000).toFixed(1) + 'M';
    }

    function showToast(message) {
        // 创建toast提示
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 100px;
            left: 50%;
            transform: translateX(-50%);
            background: var(--text-color);
            color: white;
            padding: 12px 24px;
            border-radius: 20px;
            font-size: 14px;
            z-index: 1000;
            opacity: 0;
            transition: opacity 0.3s;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);

        // 显示动画
        setTimeout(() => toast.style.opacity = '1', 100);
        
        // 自动隐藏
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => document.body.removeChild(toast), 300);
        }, 2000);
    }
});
