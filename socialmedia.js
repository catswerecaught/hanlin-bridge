// 社媒页面功能
document.addEventListener('DOMContentLoaded', function() {
    // 社媒数据存储
    let socialData = {
        posts: [],
        currentUser: null,
        suggestions: [],
        trends: [],
        userInteractions: null,
        searchState: {
            isSearching: false,
            query: '',
            results: { users: [], posts: [] },
            activeTab: '热门',
            showingTrends: true
        }
    };
    // 防止重复绑定全局事件
    let documentClickBound = false;

    // DOM 元素
    const postContent = document.getElementById('postContent');
    const charCount = document.getElementById('charCount');
    const submitPost = document.getElementById('submitPost');
    const postsContainer = document.getElementById('postsContainer');
    const suggestionsList = document.getElementById('suggestionsList');
    const trendsList = document.getElementById('trendsList');
    const composeAvatar = document.getElementById('composeAvatar');
    const searchInput = document.getElementById('searchInput');
    const searchIcon = document.querySelector('.search-icon');
    const subscribeBtn = document.querySelector('.subscribe-btn');

    // 初始化
    init();

    async function init() {
        // 检查用户登录状态
        checkLoginStatus();
        
        // 初始化事件监听器
        initEventListeners();
        
        // 加载初始数据
        await loadInitialData();

        // 加载用户交互（从后端）
        if (socialData.currentUser) {
            await loadUserInteractions(socialData.currentUser.username);
        }
        
        // 渲染页面内容
        renderPosts();
        renderSuggestions();
        renderTrends();
        // 更新订阅按钮文案
        updateSubscribeButton();
    }

    function checkLoginStatus() {
        const currentUser = getCurrentUser();
        if (currentUser) {
            socialData.currentUser = currentUser;
            updateUserAvatar();
        }
    }

    function getCurrentUser() {
        // 统一优先读取 script.js 设置的 loginUser
        let storedUser = localStorage.getItem('loginUser');
        if (!storedUser) storedUser = localStorage.getItem('currentUser');
        if (!storedUser) storedUser = localStorage.getItem('loggedInUser');
        if (!storedUser) storedUser = sessionStorage.getItem('currentUser');

        if (storedUser) {
            try {
                const userData = JSON.parse(storedUser);
                console.log('找到存储的用户数据:', userData);
                // 从users数组中找到完整的用户信息，找不到则直接返回存储对象
                const foundUser = users.find(user => user.username === userData.username || user.name === userData.username) || userData;
                console.log('匹配到的用户:', foundUser);
                return foundUser;
            } catch (e) {
                console.error('解析用户数据失败:', e);
                // 如果是字符串格式，尝试直接匹配
                const foundUser = users.find(user => user.username === storedUser || user.name === storedUser);
                return foundUser || null;
            }
        }

        // 检查是否有其他登录标识
        const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
        if (isLoggedIn) {
            console.log('检测到登录状态但无用户数据，使用默认用户');
            return users[0];
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

    // 根据会员身份更新右侧订阅按钮文案
    function updateSubscribeButton() {
        if (!subscribeBtn) return;
        const isVip = socialData.currentUser && (socialData.currentUser.vip === '普通会员' || socialData.currentUser.vip === 'Pro会员');
        subscribeBtn.textContent = isVip ? '已订阅' : '订阅';
    }

    function initEventListeners() {
        // 发帖内容输入监听
        if (postContent) {
            postContent.addEventListener('input', function() {
                const length = this.value.length;
                charCount.textContent = length;
                
                // 启用/禁用发帖按钮
                submitPost.disabled = length === 0 || length > 1000;
                
                // 字符计数颜色
                if (length > 900) {
                    charCount.style.color = length > 1000 ? '#f91880' : '#ffd400';
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

        // 搜索功能 - 键盘回车触发
        if (searchInput) {
            searchInput.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSearch();
                }
            });
        }
        
        // 搜索功能 - 点击搜索图标触发
        if (searchIcon) {
            searchIcon.addEventListener('click', function(e) {
                e.preventDefault();
                handleSearch();
            });
        }

        // Tab切换
        document.querySelectorAll('.feed-tab').forEach(tab => {
            tab.addEventListener('click', function() {
                document.querySelectorAll('.feed-tab').forEach(t => t.classList.remove('active'));
                this.classList.add('active');
                
                // 根据tab类型渲染内容
                const tabType = this.dataset.tab;
                if (tabType === 'recommend') {
                    renderPosts();
                } else if (tabType === 'following') {
                    renderFollowingPosts();
                }
            });
        });
        
        // 导航按钮事件监听
        const navItems = document.querySelectorAll('.social-nav-item');
        navItems.forEach(item => {
            const span = item.querySelector('span');
            if (span) {
                item.addEventListener('click', function() {
                    // 更新导航激活状态
                    updateNavActiveState(span.textContent.trim());
                    
                    // 处理特定导航行为
                    if (span.textContent === '主页') {
                        if (socialData.searchState.isSearching) {
                            exitSearchMode();
                        }
                        // 重置分页状态
                        if (socialData.pagination) {
                            socialData.pagination.currentPage = 1;
                        }
                    } else if (span.textContent === '搜索') {
                        enterSearchMode();
                    }
                });
            }
        });
    }

    // 更新导航激活状态
    function updateNavActiveState(activeNavText) {
        const navItems = document.querySelectorAll('.social-nav-item');
        navItems.forEach(item => {
            const span = item.querySelector('span');
            if (span) {
                if (span.textContent.trim() === activeNavText) {
                    // 激活当前导航项
                    item.classList.add('active');
                    span.style.fontWeight = 'bold';
                } else {
                    // 取消其他导航项的激活状态
                    item.classList.remove('active');
                    span.style.fontWeight = 'normal';
                }
            }
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

            // 基于已加载的数据重新计算每个主帖的评论数
            recalculateCommentCounts();

            // 生成推荐关注和趋势数据
            socialData.suggestions = generateSuggestions();
            socialData.trends = generateTrends();
        } catch (error) {
            console.log('API调用失败，使用模拟数据:', error);
            socialData.posts = generateMockPosts();
            // 回退时同样重新计算评论数
            recalculateCommentCounts();
            socialData.suggestions = generateSuggestions();
            socialData.trends = generateTrends();
        }
    }

    // 从后端读取当前用户的交互（点赞/转发/关注）并保存到内存与本地缓存（供离线回退）
    async function loadUserInteractions(userId) {
        try {
            const resp = await fetch(`/api/user-interactions?userId=${encodeURIComponent(userId)}`);
            if (resp.ok) {
                const ui = await resp.json();
                const serverLiked = Array.isArray(ui.liked) ? ui.liked : [];
                const serverRetweeted = Array.isArray(ui.retweeted) ? ui.retweeted : [];
                const serverFollowings = Array.isArray(ui.followings) ? ui.followings : [];

                // 合并本地关注与服务端关注，避免丢失本地数据
                const localFollowings = getFollowedUsers(userId);
                const mergedFollowings = Array.from(new Set([...(serverFollowings || []), ...(localFollowings || [])]));

                socialData.userInteractions = {
                    liked: serverLiked,
                    retweeted: serverRetweeted,
                    followings: mergedFollowings
                };

                // 同步到本地缓存作为回退
                const local = getUserInteractions(userId);
                setUserInteractions(userId, { liked: serverLiked, retweeted: serverRetweeted, viewed: local.viewed || [] });
                // 同步关注到本地followedUsers缓存
                setFollowedUsers(userId, mergedFollowings);

                // 如果本地与服务端有差异，尝试回写合并结果（忽略错误）
                if (mergedFollowings.length !== serverFollowings.length) {
                    try {
                        fetch('/api/user-interactions', {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ userId, action: 'sync', followings: mergedFollowings })
                        });
                    } catch {}
                }
            }
        } catch (e) {
            // 忽略错误，回退到本地缓存
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
                likedBy: [], // 初始化追踪数组
                retweetedBy: [],
                viewedBy: []
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
                likedBy: [], // 初始化追踪数组
                retweetedBy: [],
                viewedBy: []
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
                likedBy: [],
                retweetedBy: [],
                viewedBy: []
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
                likedBy: [],
                retweetedBy: [],
                viewedBy: []
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
                likedBy: [],
                retweetedBy: [],
                viewedBy: []
            }
        ];
        
        return mockPosts;
    }

    function generateSuggestions() {
        // 固定推荐三个账号：Oliver Tao、Tuebo Social、翰林桥官方
        const fixedSuggestions = ['taosir', 'user00007', 'user00010'];
        const suggestedUsers = [];
        
        fixedSuggestions.forEach(username => {
            const user = users.find(u => u.username === username);
            if (user && (!socialData.currentUser || user.username !== socialData.currentUser.username)) {
                suggestedUsers.push({
                    ...user,
                    followers: Math.floor(Math.random() * 1000) + 100
                });
            }
        });
        
        return suggestedUsers;
    }

    function generateTrends() {
        return [
            {
                category: '教育 · 趋势',
                topic: 'Tuebo Social',
                count: '201.3万 贴子'
            },
            {
                category: '教育 · 趋势',
                topic: 'Hanlin Bridge',
                count: '92.3万 贴子'
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

    // 重新计算每个主帖的评论数，基于 socialData.posts 中带有 postId 的评论项
    function recalculateCommentCounts() {
        if (!Array.isArray(socialData.posts) || socialData.posts.length === 0) return;

        const counts = {};
        for (const item of socialData.posts) {
            const isComment = item && item.postId != null;
            // 只要存在 postId 即视为评论（后端/本地都会带 postId）
            if (isComment) {
                const pid = item.postId;
                counts[pid] = (counts[pid] || 0) + 1;
            }
        }

        // 将统计结果写回到主贴对象
        socialData.posts.forEach(p => {
            if (!p.postId) {
                p.comments = counts[p.id] || 0;
            }
        });
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
        // 过滤掉评论类型的帖子，只显示主帖子
        // 评论有postId字段，主帖子没有
        let postsToShow = socialData.posts.filter(p => !p.postId);
        
        // 根据tab过滤帖子
        if (filter === 'following' && socialData.currentUser) {
            const currentUserId = socialData.currentUser.username;
            const followedUsers = getFollowedUsers(currentUserId);
            postsToShow = postsToShow.filter(p => {
                const uname = (p.user && p.user.username) || p.userId || '';
                return followedUsers.includes(uname);
            });
        }
        
        // 按推荐状态和时间排序 - 推荐帖子优先
        postsToShow.sort((a, b) => {
            // 推荐帖子优先
            if (a.promoted && !b.promoted) return -1;
            if (!a.promoted && b.promoted) return 1;
            // 同等推荐状态下按时间排序
            return new Date(b.timestamp) - new Date(a.timestamp);
        });
        
        console.log('准备渲染的帖子数量:', postsToShow.length);
        
        // 初始化分页数据
        if (!socialData.pagination) {
            socialData.pagination = {
                currentPage: 1,
                postsPerPage: 5,
                allPosts: postsToShow
            };
        } else {
            socialData.pagination.allPosts = postsToShow;
        }
        
        // 计算要显示的帖子
        const startIndex = 0;
        const endIndex = socialData.pagination.currentPage * socialData.pagination.postsPerPage;
        const paginatedPosts = postsToShow.slice(startIndex, endIndex);
        
        if (postsToShow.length === 0) {
            const emptyText = filter === 'following' ? '这里目前没有帖文。' : '暂无帖子';
            postsContainer.innerHTML = `<div style="padding: 40px; text-align: center; color: var(--secondary-text-color);">${emptyText}</div>`;
        } else {
            postsContainer.innerHTML = paginatedPosts.map(post => createPostHTML(post)).join('');
            
            // 添加加载更多提示（如果还有更多帖子）
            if (endIndex < postsToShow.length) {
                postsContainer.innerHTML += '<div class="load-more-indicator" style="padding: 20px; text-align: center; color: var(--secondary-text-color);">向下滚动加载更多...</div>';
            }
        }
        
        // 添加帖子交互事件
        addPostEventListeners();
        
        // 添加hashtag点击事件
        addHashtagEventListeners();
        
        // 添加滚动加载监听器
        addScrollLoadListener();
    }

    function renderFollowingPosts() {
        renderPosts('following');
    }

    // 滚动加载更多帖子
    function addScrollLoadListener() {
        // 移除之前的监听器避免重复绑定
        window.removeEventListener('scroll', handleScroll);
        window.addEventListener('scroll', handleScroll);
    }

    function handleScroll() {
        // 只在非搜索模式下启用滚动加载
        if (socialData.searchState.isSearching) return;
        
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight;
        
        // 当滚动到距离底部100px时加载更多
        if (scrollTop + windowHeight >= documentHeight - 100) {
            loadMorePosts();
        }
    }

    function loadMorePosts() {
        if (!socialData.pagination || !socialData.pagination.allPosts) return;
        
        const { currentPage, postsPerPage, allPosts } = socialData.pagination;
        const maxPages = Math.ceil(allPosts.length / postsPerPage);
        
        // 如果已经加载完所有帖子，则不再加载
        if (currentPage >= maxPages) return;
        
        // 增加页数
        socialData.pagination.currentPage++;
        
        // 重新渲染帖子（会显示更多帖子）
        renderPosts(getCurrentTabFilter());
    }

    function getCurrentTabFilter() {
        // 获取当前激活的tab
        const activeTab = document.querySelector('.tab.active');
        return activeTab ? activeTab.textContent.trim() === '关注' ? 'following' : 'recommend' : 'recommend';
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
            `<img class="vip-badge" src="images/smverified.png" alt="认证用户">` : '';
        const isSupreme = socialData.currentUser && socialData.currentUser.supreme === true;
        // 视图追踪唯一ID（登录用户或匿名设备）
        const viewerId = getViewerId();
        
        // 检查当前用户的交互状态
        const currentUserId = socialData.currentUser ? socialData.currentUser.username : null;
        let userLiked = false;
        let userRetweeted = false;
        
        if (currentUserId) {
            // 优先使用后端的用户交互KV；其次使用帖子上的数组；最后回退到本地缓存
            if (socialData.userInteractions && Array.isArray(socialData.userInteractions.liked)) {
                userLiked = socialData.userInteractions.liked.includes(post.id);
            } else if (Array.isArray(post.likedBy)) {
                userLiked = post.likedBy.includes(currentUserId);
            } else {
                const userInteractions = getUserInteractions(currentUserId);
                userLiked = userInteractions.liked.includes(post.id);
            }
            if (socialData.userInteractions && Array.isArray(socialData.userInteractions.retweeted)) {
                userRetweeted = socialData.userInteractions.retweeted.includes(post.id);
            } else if (Array.isArray(post.retweetedBy)) {
                userRetweeted = post.retweetedBy.includes(currentUserId);
            } else {
                const userInteractions = getUserInteractions(currentUserId);
                userRetweeted = userInteractions.retweeted.includes(post.id);
            }
            
            // 更新post对象中的数组（如果尚未包含）
            if (!post.likedBy) post.likedBy = [];
            if (!post.retweetedBy) post.retweetedBy = [];
            if (!post.viewedBy) post.viewedBy = [];
            
            if (userLiked && !post.likedBy.includes(currentUserId)) {
                post.likedBy.push(currentUserId);
            }
            if (userRetweeted && !post.retweetedBy.includes(currentUserId)) {
                post.retweetedBy.push(currentUserId);
            }
        }

        // 每次渲染时增加阅读量（每个“查看者”每个帖子只增加一次，包含匿名设备）
        if (!post.viewedBy) post.viewedBy = [];
        const interactionsForView = getUserInteractions(viewerId);
        if (!interactionsForView.viewed.includes(post.id)) {
            if (!post.viewedBy.includes(viewerId)) {
                post.viewedBy.push(viewerId);
            }
            post.views += 1;
            interactionsForView.viewed.push(post.id);
            setUserInteractions(viewerId, interactionsForView);
            // 同步到后端（如果可用）
            try {
                fetch(`/api/social-posts?id=${post.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'view' })
                });
            } catch (e) {
                // 忽略错误
            }
        }

        return `
            <article class="post-item" data-post-id="${post.id}">
                <div class="post-header">
                    <div class="post-avatar">
                        <img src="${user.avatar}" alt="${user.name}">
                    </div>
                    ${post.promoted ? `
                    <div class="post-promoted-indicator">
                        <img src="images/recommend.png" alt="推荐" class="promoted-icon" />
                        <span>推荐</span>
                    </div>
                    ` : ''}
                    <div class="post-menu">
                        <svg viewBox="0 0 24 24">
                            <path d="M3 12c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zm9 2c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm7 0c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z"/>
                        </svg>
                        ${isSupreme ? `
                        <div class="post-menu-dropdown" data-dropdown>
                            <div class="post-menu-item" data-action="delete">删除帖子</div>
                            <div class="post-menu-item" data-action="${post.promoted ? 'unpromote' : 'promote'}">${post.promoted ? '取消推荐' : '推荐贴文'}</div>
                        </div>
                        ` : ''}
                    </div>
                    <div class="post-user-info">
                        <span class="post-user-name">${user.name}</span>
                        ${verifiedBadge}
                        <span class="post-username">@${user.username}</span>
                        <span class="post-time">·</span>
                        <span class="post-time">${timeAgo}</span>
                    </div>
                </div>
                <div class="post-content">${highlightHashtags(post.content)}</div>
                <div class="post-actions">
                    <div class="post-action" data-action="comment">
                        <svg viewBox="0 0 24 24">
                            <path d="M1.751 10c0-4.42 3.584-8.003 8.005-8.003h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01zm8.005-6.003c-3.317 0-6.005 2.69-6.005 6.003 0 3.37 2.77 6.1 6.138 6.01l.351-.01h1.761v2.3l5.087-2.81c1.951-1.08 3.163-3.13 3.163-5.36 0-3.39-2.744-6.13-6.129-6.13H9.756z"/>
                        </svg>
                        <span data-count="comments">${formatCount(post.comments)}</span>
                    </div>
                    <div class="post-action ${userRetweeted ? 'retweeted' : ''}" data-action="retweet">
                        <svg viewBox="0 0 24 24">
                            <path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.791-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.791 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46L18.5 16V8c0-1.1-.896-2-2-2z"/>
                        </svg>
                        <span>${formatCount(post.retweets)}</span>
                    </div>
                    <div class="post-action ${userLiked ? 'liked' : ''}" data-action="like">
                        <svg viewBox="0 0 24 24">
                            ${userLiked ? 
                                '<path d="M12 21.638h-.014C9.403 21.59 1.95 14.856 1.95 8.478c0-3.064 2.525-5.754 5.403-5.754 2.29 0 3.83 1.58 4.646 2.73.814-1.148 2.354-2.73 4.645-2.73 2.88 0 5.404 2.690 5.404 5.755 0 6.376-7.454 13.11-10.037 13.157H12z"/>' :
                                '<path d="M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91zm4.187 7.69c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z"/>'
                            }
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
                <div class="post-comments-section" style="display: none;" data-post-id="${post.id}">
                    <div class="comment-composer">
                        <img class="comment-avatar" src="${socialData.currentUser ? socialData.currentUser.avatar : 'images/default-avatar.jpg'}" alt="Your Avatar">
                        <div class="comment-input-container">
                            <textarea class="comment-input" placeholder="发布你的回复" maxlength="280"></textarea>
                            <div class="comment-actions">
                                <span class="comment-char-count">0/1000</span>
                                <button class="comment-submit-btn" disabled>回复</button>
                            </div>
                        </div>
                    </div>
                    <div class="comments-list" data-post-id="${post.id}"></div>
                </div>
            </article>
        `;
    }

    function addPostEventListeners() {
        // 帖子交互事件（点赞/转发/评论/浏览）
        document.querySelectorAll('.post-action').forEach(action => {
            action.addEventListener('click', function(e) {
                e.stopPropagation();
                const actionType = this.dataset.action;
                const postId = parseInt(this.closest('.post-item').dataset.postId);
                
                if (actionType === 'comment') {
                    toggleCommentSection(postId);
                } else {
                    handlePostAction(actionType, postId, this);
                }
            });
        });
        
        // 评论输入事件
        addCommentEventListeners();

        // 三点菜单开关
        document.querySelectorAll('.post-menu').forEach(menu => {
            menu.addEventListener('click', function(e) {
                e.stopPropagation();
                const dropdown = this.querySelector('[data-dropdown]');
                if (!dropdown) return;
                // 关闭其他下拉
                document.querySelectorAll('.post-menu-dropdown.show').forEach(d => {
                    if (d !== dropdown) d.classList.remove('show');
                });
                dropdown.classList.toggle('show');
            });
        });

        // 菜单项点击
        document.querySelectorAll('.post-menu-item').forEach(item => {
            item.addEventListener('click', function(e) {
                e.stopPropagation();
                const actionType = this.dataset.action;
                const postId = parseInt(this.closest('.post-item').dataset.postId);
                handlePostAction(actionType, postId, this);
                // 关闭菜单
                const dropdown = this.closest('.post-menu-dropdown');
                if (dropdown) dropdown.classList.remove('show');
            });
        });

        // 点击外部关闭所有菜单（只绑定一次）
        if (!documentClickBound) {
            document.addEventListener('click', function closeAllMenus() {
                document.querySelectorAll('.post-menu-dropdown.show').forEach(d => d.classList.remove('show'));
            });
            documentClickBound = true;
        }
    }

    // 切换评论区显示/隐藏
    function toggleCommentSection(postId) {
        const commentSection = document.querySelector(`[data-post-id="${postId}"].post-comments-section`);
        if (!commentSection) return;

        if (commentSection.style.display === 'none') {
            commentSection.style.display = 'block';
            loadComments(postId);
        } else {
            commentSection.style.display = 'none';
        }
    }

    // 添加评论相关事件监听器
    function addCommentEventListeners() {
        // 评论输入字数统计 + 自动高度
        document.querySelectorAll('.comment-input').forEach(input => {
            // 移除旧的事件监听器避免重复绑定
            input.removeEventListener('input', handleCommentInput);
            input.addEventListener('input', handleCommentInput);
            // 初始化高度（根据内容自适应）
            input.style.height = 'auto';
            input.style.height = input.scrollHeight + 'px';
        });

        // 评论提交
        document.querySelectorAll('.comment-submit-btn').forEach(btn => {
            // 移除旧的事件监听器避免重复绑定
            btn.removeEventListener('click', handleCommentSubmit);
            btn.addEventListener('click', handleCommentSubmit);
        });
    }
    
    function handleCommentInput() {
        const container = this.closest('.comment-input-container');
        const charCount = container.querySelector('.comment-char-count');
        const submitBtn = container.querySelector('.comment-submit-btn');
        
        if (charCount && submitBtn) {
            const length = this.value.length;
            charCount.textContent = `${length}/1000`;
            submitBtn.disabled = length === 0 || length > 280;
        }

        // 文本域自动高度
        this.style.height = 'auto';
        this.style.height = this.scrollHeight + 'px';
    }
    
    function handleCommentSubmit(e) {
        e.preventDefault();
        const commentSection = this.closest('.post-comments-section');
        const postId = parseInt(commentSection.dataset.postId);
        const input = commentSection.querySelector('.comment-input');
        const content = input.value.trim();

        if (content && socialData.currentUser) {
            submitComment(postId, content, input);
        }
    }

    // 提交评论
    async function submitComment(postId, content, inputElement) {
        if (!socialData.currentUser) {
            showToast('请先登录');
            return;
        }

        const newComment = {
            id: Date.now(),
            postId: postId,
            content: content,
            user: socialData.currentUser,
            timestamp: new Date(),
            likes: 0,
            views: Math.floor(Math.random() * 50) + 1,
            liked: false
        };

        try {
            // 尝试保存到后端（但不添加到主推流）
            const response = await fetch('/api/social-posts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...newComment,
                    type: 'comment', // 标记为评论类型
                    isComment: true // 另外标记不显示在主推流
                })
            });

            if (response.ok) {
                const savedComment = await response.json();
                Object.assign(newComment, savedComment);
            }
        } catch (error) {
            console.log('API不可用，使用本地存储');
        }

        // 添加到评论数据
        if (!socialData.comments) {
            socialData.comments = [];
        }
        socialData.comments.push(newComment);

        // 更新帖子评论数
        const post = socialData.posts.find(p => p.id === postId);
        if (post) {
            post.comments = (post.comments || 0) + 1;
            // 更稳健地更新DOM中的评论数显示（限定在对应的post元素内）
            const postEl = document.querySelector(`.post-item[data-post-id="${postId}"]`);
            if (postEl) {
                const commentCountSpan = postEl.querySelector(`.post-action[data-action="comment"] span[data-count="comments"]`) 
                    || postEl.querySelector(`.post-action[data-action="comment"] span`);
                if (commentCountSpan) {
                    commentCountSpan.textContent = formatCount(post.comments);
                }
            }
        }

        // 清空输入框
        inputElement.value = '';
        const charCount = inputElement.parentNode.querySelector('.comment-char-count');
        const submitBtn = inputElement.parentNode.querySelector('.comment-submit-btn');
        if (charCount) charCount.textContent = '0/1000';
        if (submitBtn) submitBtn.disabled = true;

        // 重新加载评论列表
        loadComments(postId);
        showToast('评论成功！');
    }

    // 加载评论列表
    function loadComments(postId) {
        const commentsList = document.querySelector(`[data-post-id="${postId}"].comments-list`);
        if (!commentsList) return;

        // 合并本地评论和数据库评论
        const localComments = (socialData.comments || []).filter(c => c.postId === postId);
        const dbComments = (socialData.posts || []).filter(p => p.postId === postId && (p.type === 'comment' || p.isComment));
        
        // 合并两个数组，去除重复（根据id）
        const allComments = [...localComments];
        dbComments.forEach(dbComment => {
            if (!allComments.find(c => c.id === dbComment.id)) {
                allComments.push(dbComment);
            }
        });
        
        if (allComments.length === 0) {
            commentsList.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--secondary-text-color);">暂无评论</div>';
            // 同步为 0
            const post = socialData.posts.find(p => p.id === postId);
            if (post) {
                post.comments = 0;
                const postEl = document.querySelector(`.post-item[data-post-id="${postId}"]`);
                if (postEl) {
                    const commentCountSpan = postEl.querySelector(`.post-action[data-action="comment"] span[data-count="comments"]`) 
                        || postEl.querySelector(`.post-action[data-action="comment"] span`);
                    if (commentCountSpan) {
                        commentCountSpan.textContent = '0';
                    }
                }
            }
            return;
        }

        // 按时间倒序排列
        allComments.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        commentsList.innerHTML = allComments.map(comment => createCommentHTML(comment)).join('');
        
        // 同步该帖的评论计数到UI与内存（避免后端计数滞后）
        const actualCount = allComments.length;
        const post = socialData.posts.find(p => p.id === postId);
        if (post) {
            post.comments = actualCount;
            const postEl = document.querySelector(`.post-item[data-post-id="${postId}"]`);
            if (postEl) {
                const commentCountSpan = postEl.querySelector(`.post-action[data-action="comment"] span[data-count="comments"]`) 
                    || postEl.querySelector(`.post-action[data-action="comment"] span`);
                if (commentCountSpan) {
                    commentCountSpan.textContent = formatCount(actualCount);
                }
            }
        }

        // 添加评论交互事件
        addCommentActionListeners();
    }

    // 创建评论 HTML
    function createCommentHTML(comment) {
        const timeAgo = getTimeAgo(comment.timestamp);
        
        // 处理用户信息 - 兼容两种数据格式
        const user = comment.user || {
            name: comment.userName,
            username: comment.userId,
            avatar: comment.userAvatar,
            vip: comment.userVip
        };
        
        const verifiedBadge = (user.vip === 'Pro会员' || user.vip === '普通会员') ? 
            `<img class="vip-badge" src="images/smverified.png" alt="认证用户">` : '';

        return `
            <div class="comment-item" data-comment-id="${comment.id}">
                <img class="comment-avatar" src="${user.avatar}" alt="${user.name}">
                <div class="comment-content">
                    <div class="comment-user-info">
                        <span class="comment-user-name">${user.name}</span>
                        ${verifiedBadge}
                        <span class="comment-username">@${user.username}</span>
                        <span class="comment-time">·</span>
                        <span class="comment-time">${timeAgo}</span>
                    </div>
                    <div class="comment-text">${highlightHashtags(comment.content)}</div>
                    <div class="comment-actions-bar">
                        ${socialData.currentUser && socialData.currentUser.supreme === true ? `
                        <div class="comment-action" data-action="delete" title="删除评论">
                            <svg viewBox="0 0 24 24">
                                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zm9.5-9h1v9h-1v-9zm-4 0h1v9h-1v-9zM15.5 4l-1-1h-5l-1 1H5v2h14V4z"/>
                            </svg>
                            <span>删除</span>
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    // 添加评论操作事件监听器
    function addCommentActionListeners() {
        document.querySelectorAll('.comment-action').forEach(action => {
            action.addEventListener('click', function(e) {
                e.stopPropagation();
                const actionType = this.dataset.action;
                const commentId = parseInt(this.closest('.comment-item').dataset.commentId);
                handleCommentAction(actionType, commentId, this);
            });
        });
    }

    // 处理评论操作（删除）
    async function handleCommentAction(action, commentId, element) {
        // 从本地或从 posts 集合中查找对应评论
        const comment = (socialData.comments || []).find(c => c.id === commentId) 
            || (socialData.posts || []).find(p => p.id === commentId && (p.postId != null));
        if (!comment) return;

        if (action === 'delete') {
            // 仅管理员可删除
            if (!socialData.currentUser || socialData.currentUser.supreme !== true) {
                alert('无权限删除评论');
                return;
            }
            if (!confirm('确定删除该评论？此操作不可撤销。')) return;

            try {
                const headers = { 'X-Admin-Username': socialData.currentUser.username };
                const token = sessionStorage.getItem('supremeDeleteToken');
                if (token) headers['Authorization'] = `Bearer ${token}`;

                let resp = await fetch(`/api/social-posts?id=${commentId}`, {
                    method: 'DELETE',
                    headers
                });

                if (resp.status === 403 && !token) {
                    const input = prompt('请输入管理员令牌以删除评论：');
                    if (input && input.trim()) {
                        sessionStorage.setItem('supremeDeleteToken', input.trim());
                        headers['Authorization'] = `Bearer ${input.trim()}`;
                        resp = await fetch(`/api/social-posts?id=${commentId}`, {
                            method: 'DELETE',
                            headers
                        });
                    }
                }

                if (resp.ok) {
                    // 从内存中移除评论
                    if (Array.isArray(socialData.comments)) {
                        socialData.comments = socialData.comments.filter(c => c.id !== commentId);
                    }
                    if (Array.isArray(socialData.posts)) {
                        socialData.posts = socialData.posts.filter(p => p.id !== commentId);
                    }

                    // 更新所属帖子的评论计数并更新UI
                    const parentPostId = comment.postId;
                    if (parentPostId != null) {
                        const parentPost = (socialData.posts || []).find(p => p.id === parentPostId);
                        if (parentPost) {
                            const commentsListEl = document.querySelector(`[data-post-id="${parentPostId}"].comments-list`);
                            let remainingCount = 0;
                            if (commentsListEl) {
                                // 直接根据 DOM 中剩余元素数来计算，或使用数据源重新加载
                                remainingCount = Math.max(0, commentsListEl.querySelectorAll('.comment-item').length - 1);
                            }
                            parentPost.comments = remainingCount;

                            const postEl = document.querySelector(`.post-item[data-post-id="${parentPostId}"]`);
                            if (postEl) {
                                const countSpan = postEl.querySelector(`.post-action[data-action="comment"] span[data-count="comments"]`) 
                                    || postEl.querySelector(`.post-action[data-action="comment"] span`);
                                if (countSpan) countSpan.textContent = formatCount(remainingCount);
                            }
                        }
                    }

                    // 从DOM移除该评论
                    const itemEl = document.querySelector(`.comment-item[data-comment-id="${commentId}"]`);
                    if (itemEl && itemEl.parentElement) {
                        itemEl.parentElement.removeChild(itemEl);
                        // 若无剩余评论，显示占位提示
                        if (itemEl.parentElement.querySelectorAll('.comment-item').length === 0) {
                            itemEl.parentElement.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--secondary-text-color);">暂无评论</div>';
                        }
                    }

                    showToast('评论已删除');
                } else {
                    const err = await resp.json().catch(() => ({}));
                    showToast(err.error || '删除失败');
                }
            } catch (e) {
                showToast('删除失败');
            }
            return; // 删除无需后续PATCH
        }
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

        if (action === 'delete') {
            if (!socialData.currentUser || socialData.currentUser.supreme !== true) {
                alert('无权限删除帖子');
                return;
            }
            if (!confirm('确定删除该帖子？此操作不可撤销。')) return;
            try {
                const headers = { 'X-Admin-Username': socialData.currentUser.username };
                const token = sessionStorage.getItem('supremeDeleteToken');
                if (token) headers['Authorization'] = `Bearer ${token}`;

                let resp = await fetch(`/api/social-posts?id=${postId}`, {
                    method: 'DELETE',
                    headers
                });

                // 如果需要令牌且未提供，允许用户输入令牌后重试
                if (resp.status === 403 && !token) {
                    const input = prompt('请输入管理员令牌以删除帖子：');
                    if (input && input.trim()) {
                        sessionStorage.setItem('supremeDeleteToken', input.trim());
                        headers['Authorization'] = `Bearer ${input.trim()}`;
                        resp = await fetch(`/api/social-posts?id=${postId}`, {
                            method: 'DELETE',
                            headers
                        });
                    }
                }

                if (resp.ok) {
                    socialData.posts = socialData.posts.filter(p => p.id !== postId);
                    renderPosts();
                    showToast('帖子已删除');
                } else {
                    const err = await resp.json().catch(() => ({}));
                    showToast(err.error || '删除失败');
                }
            } catch (e) {
                showToast('删除失败');
            }
            return; // 删除无需执行后续PATCH同步
        }

        if (action === 'promote' || action === 'unpromote') {
            if (!socialData.currentUser || socialData.currentUser.supreme !== true) {
                alert('无权限操作推荐');
                return;
            }

            try {
                console.log('Attempting promote toggle:', { postId, action, user: socialData.currentUser && socialData.currentUser.username });
                const response = await fetch(`/api/social-posts?id=${postId}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        action: action,
                        userId: socialData.currentUser.username
                    })
                });

                if (response.ok) {
                    // 更新本地数据
                    if (action === 'promote') {
                        // 取消其他帖子的推荐状态
                        socialData.posts.forEach(p => {
                            if (p.promoted) p.promoted = false;
                        });
                        // 推荐当前帖子
                        post.promoted = true;
                        showToast('帖子已推荐');
                    } else {
                        // 取消推荐
                        post.promoted = false;
                        showToast('已取消推荐');
                    }

                    // 重新渲染帖子列表
                    renderPosts();
                } else {
                    let errText = '操作失败';
                    try {
                        const e = await response.json();
                        if (e && (e.error || e.message)) {
                            errText = `操作失败: ${e.error || e.message}`;
                            if (e.debug) console.warn('Promote API debug:', e.debug);
                        }
                    } catch {}
                    showToast(errText);
                }
            } catch (error) {
                console.error('推荐操作失败:', error);
                showToast('操作失败');
            }
            return;
        }

        switch (action) {
            case 'like':
                const wasLikedByUser = currentUserId && post.likedBy && post.likedBy.includes(currentUserId);
                if (currentUserId) {
                    const userInteractions = getUserInteractions(currentUserId);
                    if (!wasLikedByUser) {
                        post.likedBy.push(currentUserId);
                        post.likes += 1;
                        element.classList.add('liked');
                        userInteractions.liked.push(post.id);
                        
                        // 更新心形图标为实心版本
                        const svg = element.querySelector('svg');
                        svg.innerHTML = '<path d="M12 21.638h-.014C9.403 21.59 1.95 14.856 1.95 8.478c0-3.064 2.525-5.754 5.403-5.754 2.29 0 3.83 1.58 4.646 2.73.814-1.148 2.354-2.73 4.645-2.73 2.88 0 5.404 2.690 5.404 5.755 0 6.376-7.454 13.11-10.037 13.157H12z"/>';
                    } else {
                        post.likedBy = post.likedBy.filter(id => id !== currentUserId);
                        post.likes -= 1;
                        element.classList.remove('liked');
                        userInteractions.liked = userInteractions.liked.filter(id => id !== post.id);
                        
                        // 更新心形图标为空心版本
                        const svg = element.querySelector('svg');
                        svg.innerHTML = '<path d="M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91zm4.187 7.69c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z"/>';
                    }
                    setUserInteractions(currentUserId, userInteractions);
                    element.querySelector('span').textContent = formatCount(post.likes);
                    // 同步内存中的用户交互
                    if (!socialData.userInteractions) socialData.userInteractions = { liked: [], retweeted: [] };
                    if (!wasLikedByUser) {
                        if (!socialData.userInteractions.liked.includes(post.id)) socialData.userInteractions.liked.push(post.id);
                    } else {
                        socialData.userInteractions.liked = socialData.userInteractions.liked.filter(id => id !== post.id);
                    }
                }
                break;
                
            case 'retweet':
                const wasRetweetedByUser = currentUserId && post.retweetedBy && post.retweetedBy.includes(currentUserId);
                if (currentUserId) {
                    const userInteractions = getUserInteractions(currentUserId);
                    if (!wasRetweetedByUser) {
                        post.retweetedBy.push(currentUserId);
                        post.retweets += 1;
                        element.classList.add('retweeted');
                        userInteractions.retweeted.push(post.id);
                    } else {
                        post.retweetedBy = post.retweetedBy.filter(id => id !== currentUserId);
                        post.retweets -= 1;
                        element.classList.remove('retweeted');
                        userInteractions.retweeted = userInteractions.retweeted.filter(id => id !== post.id);
                    }
                    setUserInteractions(currentUserId, userInteractions);
                    element.querySelector('span').textContent = formatCount(post.retweets);
                    // 同步内存中的用户交互
                    if (!socialData.userInteractions) socialData.userInteractions = { liked: [], retweeted: [] };
                    if (!wasRetweetedByUser) {
                        if (!socialData.userInteractions.retweeted.includes(post.id)) socialData.userInteractions.retweeted.push(post.id);
                    } else {
                        socialData.userInteractions.retweeted = socialData.userInteractions.retweeted.filter(id => id !== post.id);
                    }
                }
                break;
                
            case 'comment':
                // 这里可以实现评论功能
                showToast('评论功能开发中...');
                break;
                
            case 'view':
                // 阅读量现在在渲染时自动增加，不需要点击处理
                break;
        }

        // 尝试同步到后端
        try {
            const payload = (action === 'like' || action === 'retweet') && currentUserId ? { action, userId: currentUserId } : { action };
            const resp = await fetch(`/api/social-posts?id=${postId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (resp.ok) {
                const updated = await resp.json().catch(() => null);
                if (updated && typeof updated === 'object') {
                    if (action === 'like') {
                        post.likes = updated.likes ?? post.likes;
                        if (Array.isArray(updated.likedBy)) post.likedBy = updated.likedBy;
                        const serverLiked = Array.isArray(post.likedBy) && currentUserId ? post.likedBy.includes(currentUserId) : false;
                        if (serverLiked) element.classList.add('liked'); else element.classList.remove('liked');
                        element.querySelector('span').textContent = formatCount(post.likes);
                    } else if (action === 'retweet') {
                        post.retweets = updated.retweets ?? post.retweets;
                        if (Array.isArray(updated.retweetedBy)) post.retweetedBy = updated.retweetedBy;
                        const serverRetweeted = Array.isArray(post.retweetedBy) && currentUserId ? post.retweetedBy.includes(currentUserId) : false;
                        if (serverRetweeted) element.classList.add('retweeted'); else element.classList.remove('retweeted');
                        element.querySelector('span').textContent = formatCount(post.retweets);
                    }
                }
            }
        } catch (error) {
            // API不可用时忽略错误
        }
    }

    function renderSuggestions() {
        // 获取当前用户的关注列表
        const currentUserId = socialData.currentUser ? socialData.currentUser.username : null;
        const followedUsers = currentUserId ? getFollowedUsers(currentUserId) : [];
        
        suggestionsList.innerHTML = socialData.suggestions.map(user => {
            const isFollowing = followedUsers.includes(user.username);
            const verifiedBadge = (user.vip === 'Pro会员' || user.vip === '普通会员') ? 
                `<img class="vip-badge" src="images/smverified.png" alt="认证用户" style="width: 16px; height: 16px; margin-left: 4px;">` : '';
            return `
                <div class="suggestion-item">
                    <div class="suggestion-avatar">
                        <img src="${user.avatar}" alt="${user.name}">
                    </div>
                    <div class="suggestion-info">
                        <div class="suggestion-name">
                            ${user.name}
                            ${verifiedBadge}
                        </div>
                        <div class="suggestion-username">@${user.username}</div>
                    </div>
                    <button class="follow-btn ${isFollowing ? 'following' : ''}" data-username="${user.username}">
                        ${isFollowing ? '正在关注' : '关注'}
                    </button>
                </div>
            `;
        }).join('');

        // 添加关注按钮事件
        document.querySelectorAll('.follow-btn').forEach(btn => {
            btn.addEventListener('click', handleFollowClick);
        });
    }

    function getFollowedUsers(userId) {
        const key = `followedUsers_${userId}`;
        const stored = localStorage.getItem(key);
        if (stored) return JSON.parse(stored);
        // 回退到内存中的用户交互（如果可用）
        if (socialData.userInteractions && Array.isArray(socialData.userInteractions.followings)) {
            return socialData.userInteractions.followings;
        }
        return [];
    }

    function setFollowedUsers(userId, followedUsers) {
        const key = `followedUsers_${userId}`;
        localStorage.setItem(key, JSON.stringify(followedUsers));
    }

    function getUserInteractions(userId) {
        const key = `userInteractions_${userId}`;
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : { liked: [], retweeted: [], viewed: [] };
    }

    function setUserInteractions(userId, interactions) {
        const key = `userInteractions_${userId}`;
        localStorage.setItem(key, JSON.stringify(interactions));
    }

    // 生成或获取匿名设备ID，用于未登录用户的浏览量去重
    function getDeviceId() {
        const key = 'deviceId';
        let id = localStorage.getItem(key);
        if (!id) {
            id = 'dev_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
            localStorage.setItem(key, id);
        }
        return id;
    }

    // 获取当前查看者ID（优先使用登录用户名，否则使用匿名设备ID）
    function getViewerId() {
        return socialData.currentUser ? socialData.currentUser.username : `anon_${getDeviceId()}`;
    }

    async function handleFollowClick() {
        if (!socialData.currentUser) {
            alert('请先登录');
            return;
        }

        const username = this.dataset.username;
        const currentUserId = socialData.currentUser.username;
        const followedUsers = getFollowedUsers(currentUserId);
        const isFollowing = followedUsers.includes(username);

        const btn = this;
        // 乐观更新 UI + 本地缓存
        let newFollowings;
        if (isFollowing) {
            newFollowings = followedUsers.filter(u => u !== username);
            btn.textContent = '关注';
            btn.classList.remove('following');
            showToast('已取消关注');
        } else {
            newFollowings = [...followedUsers, username];
            btn.textContent = '正在关注';
            btn.classList.add('following');
            showToast('关注成功！');
        }
        setFollowedUsers(currentUserId, newFollowings);
        if (!socialData.userInteractions) socialData.userInteractions = { liked: [], retweeted: [], followings: [] };
        socialData.userInteractions.followings = newFollowings;

        // 尝试持久化到后端
        try {
            const resp = await fetch('/api/user-interactions', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: currentUserId, action: isFollowing ? 'unfollow' : 'follow', target: username })
            });
            if (resp.ok) {
                const data = await resp.json().catch(() => null);
                if (data && Array.isArray(data.followings)) {
                    setFollowedUsers(currentUserId, data.followings);
                    socialData.userInteractions.followings = data.followings;
                }
                // 重新渲染当前tab（如果在“关注”页会立即生效）
                const activeTab = document.querySelector('.feed-tab.active');
                const tabType = activeTab ? activeTab.dataset.tab : 'recommend';
                renderPosts(tabType);
            } else {
                // 保留本地状态，提示稍后同步
                showToast('已在本地保存，将在网络恢复后同步');
                const activeTab = document.querySelector('.feed-tab.active');
                const tabType = activeTab ? activeTab.dataset.tab : 'recommend';
                renderPosts(tabType);
            }
        } catch (e) {
            // 网络错误：保留本地状态，提示稍后同步
            showToast('网络异常，已在本地保存，将在恢复后同步');
            const activeTab = document.querySelector('.feed-tab.active');
            const tabType = activeTab ? activeTab.dataset.tab : 'recommend';
            renderPosts(tabType);
        }
    }

    function renderTrends() {
        const trendingHashtags = getTrendingHashtags();
        if (trendingHashtags.length === 0) {
            trendsList.innerHTML = '<div style="padding: 16px; color: var(--secondary-text-color); text-align: center;">暂无趋势内容</div>';
            return;
        }
        
        // 随机排序显示趋势
        const shuffledTrends = [...trendingHashtags].sort(() => Math.random() - 0.5);
        const trendsToShow = shuffledTrends.slice(0, 3); // 只显示3个
        
        trendsList.innerHTML = trendsToShow.map(trend => `
            <div class="trend-item" data-hashtag="${trend.hashtag}" style="cursor: pointer;">
                <div class="trend-category">Tuebo · 趋势</div>
                <div class="trend-topic">${trend.hashtag}</div>
                <div class="trend-count">${trend.count} 贴子</div>
            </div>
        `).join('');
        
        // 添加“显示更多”按钮（如果有足够的趋势）
        if (trendingHashtags.length > 3) {
            trendsList.innerHTML += '<div class="show-more-trends-btn">显示更多</div>';
        }
        
        // 添加趋势点击事件
        document.querySelectorAll('.trend-item').forEach(item => {
            item.addEventListener('click', function() {
                const hashtag = this.dataset.hashtag;
                if (hashtag) {
                    socialData.searchState.isSearching = true;
                    socialData.searchState.showingTrends = false;
                    socialData.searchState.query = hashtag;
                    performSearch(hashtag);
                }
            });
        });
        
        // 添加"显示更多"按钮点击事件
        const showMoreBtn = document.querySelector('.show-more-trends-btn');
        if (showMoreBtn) {
            showMoreBtn.addEventListener('click', function() {
                enterSearchMode();
            });
        }
    }
    
    // 提取帖子中的hashtag
    function extractHashtags(text) {
        if (!text) return [];
        // 匹配中文和英文的#号
        const hashtagRegex = /[#＃]([\u4e00-\u9fa5\w]+)/g;
        const matches = [...text.matchAll(hashtagRegex)];
        // 去除重复，同一篇帖子中相同的hashtag只算一次
        const uniqueHashtags = [...new Set(matches.map(match => match[1]))];
        return uniqueHashtags;
    }
    
    // 获取热门趋势
    function getTrendingHashtags() {
        const hashtagCounts = {};
        
        socialData.posts.forEach(post => {
            if (post && post.content) {
                const hashtags = extractHashtags(post.content);
                hashtags.forEach(hashtag => {
                    if (hashtagCounts[hashtag]) {
                        hashtagCounts[hashtag]++;
                    } else {
                        hashtagCounts[hashtag] = 1;
                    }
                });
            }
        });
        
        // 按数量排序，返回前10个
        return Object.entries(hashtagCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .map(([hashtag, count]) => ({ hashtag, count }));
    }
    
    // 高亮显示hashtag
    function highlightHashtags(text) {
        if (!text) return text;
        // 匹配中文和英文的#号和内容
        return text.replace(/([#＃])([\u4e00-\u9fa5\w]+)/g, '<span class="post-hashtag" data-hashtag="$2">$1$2</span>');
    }
    
    // 添加hashtag点击事件监听
    function addHashtagEventListeners() {
        document.querySelectorAll('.post-hashtag').forEach(hashtag => {
            hashtag.addEventListener('click', function(e) {
                e.stopPropagation();
                const hashtagText = this.dataset.hashtag;
                if (hashtagText) {
                    // 进入搜索模式并搜索hashtag
                    socialData.searchState.isSearching = true;
                    socialData.searchState.showingTrends = false;
                    socialData.searchState.query = hashtagText;
                    performSearch(hashtagText);
                }
            });
        });
    }

    function performSearch(query) {
        console.log('正在搜索:', query);
        
        if (!query || query.trim().length < 2) return;
        
        socialData.searchState.isSearching = true;
        socialData.searchState.query = query; // 保持原始查询不进行大小写转换
        socialData.searchState.showingTrends = false; // 搜索后不再显示趋势
        
        const searchQuery = query.toLowerCase(); // 用于搜索的小写版本
        
        // 搜索用户
        const userResults = users.filter(user =>
            user.name.toLowerCase().includes(searchQuery) ||
            user.username.toLowerCase().includes(searchQuery) ||
            (user.description && user.description.toLowerCase().includes(searchQuery))
        );

        // 搜索帖子
        const postResults = socialData.posts.filter(post => {
            if (!post || !post.content) return false;
            
            const content = post.content.toLowerCase();
            const userName = (post.user && post.user.name) ? post.user.name.toLowerCase() : '';
            const userUsername = (post.user && post.user.username) ? post.user.username.toLowerCase() : '';
            
            return content.includes(searchQuery) || 
                   userName.includes(searchQuery) || 
                   userUsername.includes(searchQuery);
        });

        socialData.searchState.results = {
            users: userResults,
            posts: postResults
        };

        console.log('搜索结果:', userResults.length + ' 个用户,', postResults.length + ' 个帖子');

        // 始终默认显示热门tab
        socialData.searchState.activeTab = '热门';
        
        renderSearchResults();
    }

    function handleSearch() {
        if (!searchInput) return;
        
        const query = searchInput.value.trim().toLowerCase();
        console.log('执行搜索，查询:', query);
        
        if (query.length < 1) {
            exitSearchMode();
            return;
        }

        performSearch(query);
    }

    // 进入搜索模式（显示趋势）
    function enterSearchMode() {
        socialData.searchState.isSearching = true;
        socialData.searchState.showingTrends = true;
        socialData.searchState.query = '';
        socialData.searchState.activeTab = '热门';
        
        renderSearchResults();
    }

    function exitSearchMode() {
        socialData.searchState.isSearching = false;
        socialData.searchState.query = '';
        socialData.searchState.results = { users: [], posts: [] };
        socialData.searchState.showingTrends = false;
        if (searchInput) searchInput.value = '';
        
        // 显示主页组件
        const feedHeader = document.querySelector('.feed-header');
        const postComposer = document.getElementById('postComposer');
        if (feedHeader) feedHeader.style.display = 'flex';
        if (postComposer) postComposer.style.display = 'block';
        
        renderPosts();
    }

    function renderSearchResults() {
        if (!socialData.searchState.isSearching) return;
        
        // 隐藏主页组件
        const feedHeader = document.querySelector('.feed-header');
        const postComposer = document.getElementById('postComposer');
        if (feedHeader) feedHeader.style.display = 'none';
        if (postComposer) postComposer.style.display = 'none';
        
        const { users, posts } = socialData.searchState.results;
        const { query, activeTab, showingTrends } = socialData.searchState;
        
        // 创建搜索结果页面结构
        const searchHeader = `
            <div class="search-results-header">
                <div class="search-query-display">
                    <svg viewBox="0 0 24 24" class="search-back-btn" title="返回">
                        <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"></path>
                    </svg>
                    <div class="search-query-pill">
                        <svg viewBox="0 0 24 24" class="search-query-icon">
                            <path d="M10.25 3.75c-3.59 0-6.5 2.91-6.5 6.5s2.91 6.5 6.5 6.5c1.795 0 3.419-.726 4.596-1.904 1.178-1.177 1.904-2.801 1.904-4.596 0-3.59-2.91-6.5-6.5-6.5zm-8.5 6.5c0-4.694 3.806-8.5 8.5-8.5s8.5 3.806 8.5 8.5c0 1.986-.682 3.815-1.824 5.262l4.781 4.781-1.414 1.414-4.781-4.781c-1.447 1.142-3.276 1.824-5.262 1.824-4.694 0-8.5-3.806-8.5-8.5z"></path>
                        </svg>
                        <input type="text" class="search-query-input" value="${query}" placeholder="搜索">
                    </div>
                </div>
                ${!showingTrends ? `<div class="search-tabs">
                    <button class="search-tab ${activeTab === '热门' ? 'active' : ''}" data-tab="热门">热门</button>
                    <button class="search-tab ${activeTab === '最新' ? 'active' : ''}" data-tab="最新">最新</button>
                    <button class="search-tab ${activeTab === '用户' ? 'active' : ''}" data-tab="用户">用户</button>
                    <button class="search-tab ${activeTab === '媒体' ? 'active' : ''}" data-tab="媒体">媒体</button>
                    <button class="search-tab ${activeTab === '列表' ? 'active' : ''}" data-tab="列表">列表</button>
                </div>` : ''}
            </div>
        `;
        
        let content = '';
        
        // 如果是显示趋势模式
        if (showingTrends) {
            const trendingHashtags = getTrendingHashtags();
            if (trendingHashtags.length > 0) {
                content = `
                    <div class="trending-section">
                        <div class="trending-header">当前趋势</div>
                        <div class="trending-list">
                            ${trendingHashtags.map((trend, index) => `
                                <div class="trending-item" data-hashtag="${trend.hashtag}" style="cursor: pointer;">
                                    <div class="trending-location">${index + 1}·Tuebo 的趋势</div>
                                    <div class="trending-topic">${trend.hashtag}</div>
                                    <div class="trending-count">${trend.count} 条帖子</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            } else {
                content = '<div class="no-search-results">暂无趋势内容。</div>';
            }
        } else if (activeTab === '用户') {
            if (users.length > 0) {
                content = `
                    <div class="search-user-results">
                        ${users.map(user => createSearchUserHTML(user)).join('')}
                    </div>
                    ${users.length > 3 ? '<div class="show-more-results">查看全部</div>' : ''}
                `;
            } else {
                content = '<div class="no-search-results">目前没有搜索到相关用户。</div>';
            }
        } else if (activeTab === '热门' || activeTab === '最新') {
            let contentParts = [];
            
            // 先显示用户结果（如果有）
            if (users.length > 0) {
                contentParts.push(`
                    <div class="search-section-header">用户</div>
                    <div class="search-user-results">
                        ${users.map(user => createSearchUserHTML(user)).join('')}
                    </div>
                `);
            }
            
            // 再显示帖子结果
            if (posts.length > 0) {
                const sortedPosts = activeTab === '最新' 
                    ? posts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                    : posts.sort((a, b) => (b.likes + b.retweets) - (a.likes + a.retweets));
                
                contentParts.push(sortedPosts.map(post => createPostHTML(post)).join(''));
            } else if (users.length === 0) {
                contentParts.push('<div class="no-search-results">目前没有搜索到相关内容。</div>');
            } else {
                contentParts.push('<div class="no-search-results">目前没有搜索到相关贴文。</div>');
            }
            
            content = contentParts.join('');
        } else {
            content = '<div class="no-search-results">目前没有搜索到相关内容。</div>';
        }
        
        postsContainer.innerHTML = searchHeader + content;
        
        // 添加返回按钮事件监听
        const backBtn = document.querySelector('.search-back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', exitSearchMode);
        }
        
        // 添加搜索输入框事件监听
        const searchQueryInput = document.querySelector('.search-query-input');
        if (searchQueryInput) {
            searchQueryInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const newQuery = this.value.trim();
                    if (newQuery.length >= 2) {
                        socialData.searchState.query = newQuery;
                        performSearch(newQuery);
                    }
                }
            });
            
            searchQueryInput.addEventListener('input', function(e) {
                socialData.searchState.query = this.value;
            });
        }
        
        // 添加搜索tab事件监听
        document.querySelectorAll('.search-tab').forEach(tab => {
            tab.addEventListener('click', function() {
                document.querySelectorAll('.search-tab').forEach(t => t.classList.remove('active'));
                this.classList.add('active');
                socialData.searchState.activeTab = this.dataset.tab;
                renderSearchResults();
            });
        });
        
        // 添加用户关注按钮事件
        document.querySelectorAll('.search-follow-btn').forEach(btn => {
            btn.addEventListener('click', handleFollowClick);
        });
        
        // 添加帖子交互事件
        addPostEventListeners();
        
        // 添加hashtag点击事件
        addHashtagEventListeners();
        
        // 添加趋势项目点击事件（在搜索结果中）
        document.querySelectorAll('.trending-item[data-hashtag]').forEach(item => {
            item.addEventListener('click', function() {
                const hashtag = this.dataset.hashtag;
                if (hashtag) {
                    performSearch(hashtag);
                }
            });
        });
    }

    function createSearchUserHTML(user) {
        const currentUserId = socialData.currentUser ? socialData.currentUser.username : null;
        const followedUsers = currentUserId ? getFollowedUsers(currentUserId) : [];
        const isFollowing = followedUsers.includes(user.username);
        const verifiedBadge = (user.vip === 'Pro会员' || user.vip === '普通会员') ? 
            `<img class="vip-badge" src="images/smverified.png" alt="认证用户">` : '';
        
        // 如果是当前用户自己，不显示关注按钮
        const isSelf = currentUserId === user.username;
        const followButton = isSelf ? '' : `
            <button class="search-follow-btn ${isFollowing ? 'following' : ''}" data-username="${user.username}">
                ${isFollowing ? '正在关注' : '关注'}
            </button>
        `;
        
        return `
            <div class="search-user-item">
                <div class="search-user-avatar">
                    <img src="${user.avatar}" alt="${user.name}">
                </div>
                <div class="search-user-info">
                    <div class="search-user-name">
                        ${user.name}
                        ${verifiedBadge}
                    </div>
                    <div class="search-user-username">@${user.username}</div>
                </div>
                ${followButton}
            </div>
        `;
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
