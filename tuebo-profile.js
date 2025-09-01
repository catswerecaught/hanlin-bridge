// Tuebo Social Media Profile Page
document.addEventListener('DOMContentLoaded', function() {
    let currentUser = null;
    let allPosts = [];
    let userInteractions = {};
    let currentTab = 'posts';
    
    // DOM elements
    const profileHeaderTitle = document.getElementById('profileHeaderTitle');
    const profilePostCount = document.getElementById('profilePostCount');
    const profileMainAvatar = document.getElementById('profileMainAvatar');
    const profileDisplayName = document.getElementById('profileDisplayName');
    const profileUsername = document.getElementById('profileUsername');
    const followingCount = document.getElementById('followingCount');
    const followersCount = document.getElementById('followersCount');
    const profilePostsContainer = document.getElementById('profilePostsContainer');
    const backButton = document.getElementById('backButton');
    
    // Initialize
    initProfilePage();
    
    // Event listeners
    backButton.addEventListener('click', () => {
        window.location.href = 'socialmedia.html';
    });
    
    // Tab switching
    document.querySelectorAll('.profile-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabType = tab.dataset.tab;
            switchTab(tabType);
        });
    });
    
    // Navigation handlers
    initNavListeners();
    
    // Set active navigation state for profile page
    updateNavActiveState('个人资料');
    
    async function initProfilePage() {
        // Get current user
        try {
            currentUser = JSON.parse(localStorage.getItem('loginUser'));
        } catch (e) {
            currentUser = null;
        }
        
        if (!currentUser) {
            window.location.href = 'socialmedia.html';
            return;
        }
        
        // Load data and render
        await loadProfileData();
        renderProfileInfo();
        renderCurrentTab();
        
        // Initialize right sidebar
        maybeInitRightSidebar();
    }
    
    async function loadProfileData() {
        try {
            // Load posts from API
            const postsResponse = await fetch('/api/social-posts');
            if (postsResponse.ok) {
                allPosts = await postsResponse.json();
            } else {
                // Fallback to local data
                try {
                    const fallbackResponse = await fetch('/data/social-posts.json');
                    if (fallbackResponse.ok) {
                        allPosts = await fallbackResponse.json();
                    }
                } catch {
                    allPosts = [];
                }
            }
            
            // Load user interactions from API
            try {
                const interactionsResponse = await fetch(`/api/user-interactions?userId=${currentUser.username}`);
                if (interactionsResponse.ok) {
                    userInteractions = await interactionsResponse.json();
                } else {
                    userInteractions = getUserInteractions(currentUser.username);
                }
            } catch {
                userInteractions = getUserInteractions(currentUser.username);
            }
            
            // Ensure interactions have required arrays
            if (!userInteractions.liked) userInteractions.liked = [];
            if (!userInteractions.retweeted) userInteractions.retweeted = [];
            if (!userInteractions.followings) userInteractions.followings = [];
            
        } catch (error) {
            console.error('Error loading profile data:', error);
            allPosts = [];
            userInteractions = { liked: [], retweeted: [], followings: [] };
        }
    }
    
    function renderProfileInfo() {
        // Update header
        profileHeaderTitle.textContent = currentUser.name || currentUser.username;
        
        // Count user's posts
        const userPosts = allPosts.filter(post => 
            (post.userId === currentUser.username) || 
            (post.user && post.user.username === currentUser.username)
        );
        profilePostCount.textContent = `${userPosts.length} 帖子`;
        
        // Update profile info
        profileMainAvatar.src = currentUser.avatar || 'images/login-default.png';
        // 显示认证徽章（与主Feed一致，且加入特定用户自定义）
        const nameText = currentUser.name || currentUser.username;
        const showBadge = currentUser.vip === 'Pro会员' || currentUser.vip === '普通会员';
        if (showBadge) {
            let badgeSrc = 'images/smverified.png';
            // Tuebo Social 使用官方徽章
            if (currentUser.username === 'user00007' || currentUser.name === 'Tuebo Social') {
                badgeSrc = 'images/verifiedoffi.png';
            }
            let headerBadges = `<img class="vip-badge" src="${badgeSrc}" alt="认证用户">`;
            // Oliver Tao 追加矩形角标
            if (currentUser.username === 'taosir' || currentUser.name === 'Oliver Tao') {
                headerBadges += ` <img class="vip-badge vip-badge-rect" src="images/tuebooffi.jpg" alt="Tuebo 官方">`;
            }
            profileDisplayName.innerHTML = `${nameText} ${headerBadges}`;
        } else {
            profileDisplayName.textContent = nameText;
        }
        profileUsername.textContent = `@${currentUser.username}`;
        
        // Update stats
        followingCount.textContent = userInteractions.followings ? userInteractions.followings.length : 0;
        
        // Calculate followers count
        calculateFollowersCount();
    }
    
    async function calculateFollowersCount() {
        let followersTotal = 0;
        
        try {
            // Check all users to see who follows current user
            for (const user of users) {
                if (user.username === currentUser.username) continue;
                
                try {
                    const response = await fetch(`/api/user-interactions?userId=${user.username}`);
                    if (response.ok) {
                        const interactions = await response.json();
                        if (interactions.followings && interactions.followings.includes(currentUser.username)) {
                            followersTotal++;
                        }
                    }
                } catch (e) {
                    // Fallback to localStorage
                    const localInteractions = getUserInteractions(user.username);
                    if (localInteractions.followings && localInteractions.followings.includes(currentUser.username)) {
                        followersTotal++;
                    }
                }
            }
        } catch (error) {
            console.error('Error calculating followers:', error);
        }
        
        followersCount.textContent = followersTotal;
    }
    
    function switchTab(tabType) {
        currentTab = tabType;
        
        // Update tab UI
        document.querySelectorAll('.profile-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabType}"]`).classList.add('active');
        
        // Render content for selected tab
        renderCurrentTab();
    }
    
    function renderCurrentTab() {
        let postsToShow = [];
        
        switch (currentTab) {
            case 'posts':
                // Show user's own posts (excluding replies)
                postsToShow = allPosts.filter(post => 
                    !post.postId && (
                        (post.userId === currentUser.username) || 
                        (post.user && post.user.username === currentUser.username)
                    )
                );
                break;
                
            case 'replies':
                // Show posts that are replies (have postId field) by this user
                postsToShow = allPosts.filter(post => 
                    post.postId && (
                        (post.userId === currentUser.username) || 
                        (post.user && post.user.username === currentUser.username)
                    )
                );
                break;
                
            case 'likes':
                // Show posts liked by this user
                postsToShow = allPosts.filter(post => 
                    userInteractions.liked && userInteractions.liked.includes(post.id)
                );
                break;
        }
        
        renderPosts(postsToShow);
    }
    
    function renderPosts(posts) {
        if (!posts || posts.length === 0) {
            const tabLabels = {
                'posts': '还没有发布任何帖子',
                'replies': '还没有发布任何回复', 
                'likes': '还没有点赞任何帖子'
            };
            profilePostsContainer.innerHTML = `
                <div class="no-posts-message">${tabLabels[currentTab]}</div>
            `;
            return;
        }
        
        // Sort posts by timestamp (newest first)
        const sortedPosts = posts.sort((a, b) => {
            const timeA = new Date(a.timestamp || 0);
            const timeB = new Date(b.timestamp || 0);
            return timeB - timeA;
        });
        
        // Generate HTML for posts - always use fallback to ensure consistency
        const postsHTML = sortedPosts.map(post => {
            return createFallbackPostHTML(post);
        }).join('');
        
        profilePostsContainer.innerHTML = postsHTML;
        
        // Add event listeners to posts
        if (typeof window.addPostEventListeners === 'function') {
            window.addPostEventListeners();
        }
    }
    
    // 格式化数字显示（与主Feed完全一致）
    function formatCount(count) {
        if (typeof count !== 'number' || isNaN(count)) return '0';
        // < 10,000: comma separated
        if (count < 10000) return count.toLocaleString('en-US');
        // 10,000–999,999: thousands, rounded down, no decimals
        if (count < 1000000) return Math.floor(count / 1000) + 'K';
        // 1,000,000–999,999,999: millions with 1 decimal, trim trailing .0
        if (count < 1000000000) {
            const m = (count / 1000000).toFixed(1);
            return (m.endsWith('.0') ? m.slice(0, -2) : m) + 'M';
        }
        // >= 1,000,000,000: billions with 1 decimal, trim trailing .0
        const b = (count / 1000000000).toFixed(1);
        return (b.endsWith('.0') ? b.slice(0, -2) : b) + 'B';
    }

    function createFallbackPostHTML(post) {
        // Use the exact same format as socialmedia.js createPostHTML
        const timeAgo = getTimeAgo(post.timestamp);
        
        // 处理用户信息 - 兼容两种数据格式
        const user = post.user || {
            name: post.userName,
            username: post.userId,
            avatar: post.userAvatar,
            vip: post.userVip
        };
        
        // 与主Feed一致的徽章渲染逻辑（包含特定用户）
        let verifiedBadge = '';
        if (user.vip === 'Pro会员' || user.vip === '普通会员') {
            let badgeSrc = 'images/smverified.png';
            if (user.username === 'user00007' || user.name === 'Tuebo Social') {
                badgeSrc = 'images/verifiedoffi.png';
            }
            verifiedBadge = `<img class="vip-badge" src="${badgeSrc}" alt="认证用户">`;
            if (user.username === 'taosir' || user.name === 'Oliver Tao') {
                verifiedBadge += ` <img class="vip-badge vip-badge-rect" src="images/tuebooffi.jpg" alt="Tuebo 官方">`;
            }
        }
        const isSupreme = currentUser && currentUser.supreme === true;
        
        const isLiked = userInteractions.liked && userInteractions.liked.includes(post.id);
        const isRetweeted = userInteractions.retweeted && userInteractions.retweeted.includes(post.id);
        
        // 高亮hashtags（与主Feed一致）
        const highlightedContent = highlightHashtags(post.content);
        
        return `
            <article class="post-item" data-post-id="${post.id}">
                <div class="post-header">
                    <div class="post-avatar">
                        <img src="${user.avatar}" alt="${user.name}">
                    </div>
                    ${isSupreme ? `
                    <div class="post-menu">
                        <svg viewBox="0 0 24 24">
                            <path d="M3 12c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zm9 2c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm7 0c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z"></path>
                        </svg>
                        <div class="post-menu-dropdown">
                            <div class="post-menu-item" data-action="delete">删除帖子</div>
                            <div class="post-menu-item" data-action="promote">推荐贴文</div>
                        </div>
                    </div>
                    ` : ''}
                    <div class="post-user-info">
                        <span class="post-user-name">${user.name}</span>
                        ${verifiedBadge}
                        <span class="post-username">@${user.username}</span>
                        <span class="post-time">·</span>
                        <span class="post-time">${timeAgo}</span>
                    </div>
                </div>
                <div class="post-content">${highlightedContent}</div>
                <div class="post-actions">
                    <div class="post-action" data-action="comment">
                        <svg viewBox="0 0 24 24">
                            <path d="M1.751 10c0-4.42 3.584-8.003 8.005-8.003h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01zm8.005-6.003c-3.317 0-6.005 2.69-6.005 6.003 0 3.37 2.77 6.1 6.138 6.01l.351-.01h1.761v2.3l5.087-2.81c1.951-1.08 3.163-3.13 3.163-5.36 0-3.39-2.744-6.13-6.129-6.13H9.756z"/>
                        </svg>
                        <span data-count="comments">${formatCount(post.comments || 0)}</span>
                    </div>
                    <div class="post-action ${isRetweeted ? 'retweeted' : ''}" data-action="retweet">
                        <svg viewBox="0 0 24 24">
                            <path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.791-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.791 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46L18.5 16V8c0-1.1-.896-2-2-2z"/>
                        </svg>
                        <span>${formatCount(post.retweets || 0)}</span>
                    </div>
                    <div class="post-action ${isLiked ? 'liked' : ''}" data-action="like">
                        <svg viewBox="0 0 24 24">
                            ${isLiked ? 
                                '<path d="M12 21.638h-.014C9.403 21.59 1.95 14.856 1.95 8.478c0-3.064 2.525-5.754 5.403-5.754 2.29 0 3.83 1.58 4.646 2.73.814-1.148 2.354-2.73 4.645-2.73 2.88 0 5.404 2.690 5.404 5.755 0 6.376-7.454 13.11-10.037 13.157H12z"/>' :
                                '<path d="M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91zm4.187 7.69c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z"/>'
                            }
                        </svg>
                        <span>${formatCount(post.likes || 0)}</span>
                    </div>
                    <div class="post-action" data-action="view">
                        <svg viewBox="0 0 24 24">
                            <path d="M8.75 21V3h2v18h-2zM18 21V8.5h2V21h-2zM4 21l.004-10H6v10H4zm9.248 0v-7h2v7h-2z"/>
                        </svg>
                        <span>${formatCount(post.views || 0)}</span>
                    </div>
                </div>
            </article>
        `;
    }
    
    function getTimeAgo(timestamp) {
        if (!timestamp) return '';
        
        const now = new Date();
        const postTime = new Date(timestamp);
        const diffMs = now - postTime;
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffMinutes < 1) return '刚刚';
        if (diffMinutes < 60) return `${diffMinutes}分钟前`;
        if (diffHours < 24) return `${diffHours}小时前`;
        if (diffDays < 7) return `${diffDays}天前`;
        
        return postTime.toLocaleDateString('zh-CN');
    }
    
    // Navigation handlers
    function initNavListeners() {
        document.querySelectorAll('.social-nav-item').forEach(item => {
            const span = item.querySelector('span');
            if (span) {
                item.addEventListener('click', function() {
                    const navText = span.textContent.trim();
                    // 先更新激活状态以获得即时的颜色/背景反馈（本页禁用下划线样式以避免闪烁）
                    document.querySelectorAll('.social-nav-item').forEach(i => i.classList.remove('active'));
                    this.classList.add('active');
                    
                    if (navText === '主页') {
                        window.location.href = 'socialmedia.html';
                    } else if (navText === '搜索') {
                        window.location.href = 'socialmedia.html#search';
                    } else if (navText === '书签') {
                        // 书签功能暂未实现，不跳转
                    } else if (navText === '个人资料') {
                        // Already on profile page
                    }
                });
            }
        });
    }
    
    // Right sidebar initialization (reuse from socialmedia.js)
    function maybeInitRightSidebar() {
        if (typeof window.initRightSidebar === 'function') {
            window.initRightSidebar();
        } else {
            // Fallback initialization
            initFallbackRightSidebar();
        }
    }
    
    function initFallbackRightSidebar() {
        // Initialize suggestions
        const suggestionsList = document.getElementById('suggestionsList');
        if (suggestionsList) {
            const suggestions = users.filter(user => 
                user.username !== currentUser.username &&
                (!userInteractions.followings || !userInteractions.followings.includes(user.username))
            ).slice(0, 3);
            
            suggestionsList.innerHTML = suggestions.map(user => `
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
            
            // Add follow button listeners
            suggestionsList.querySelectorAll('.follow-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const username = btn.dataset.username;
                    await followUser(username);
                    btn.textContent = '已关注';
                    btn.disabled = true;
                    
                    // Update following count
                    userInteractions.followings.push(username);
                    followingCount.textContent = userInteractions.followings.length;
                });
            });
        }
        
        // Initialize trends
        const trendsList = document.getElementById('trendsList');
        if (trendsList) {
            const trends = [
                { topic: '翰林桥新功能', posts: '1,234 帖子' },
                { topic: '学习方法分享', posts: '856 帖子' },
                { topic: '考试经验', posts: '642 帖子' }
            ];
            
            trendsList.innerHTML = trends.map(trend => `
                <div class="trend-item">
                    <div class="trend-topic">${trend.topic}</div>
                    <div class="trend-count">${trend.posts}</div>
                </div>
            `).join('');
        }
    }
    
    async function followUser(username) {
        try {
            const response = await fetch('/api/user-interactions', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userId: currentUser.username,
                    action: 'follow',
                    target: username
                })
            });
            
            if (response.ok) {
                const updatedInteractions = await response.json();
                userInteractions = updatedInteractions;
            }
        } catch (error) {
            console.error('Error following user:', error);
            // Fallback to localStorage
            if (!userInteractions.followings.includes(username)) {
                userInteractions.followings.push(username);
                saveUserInteractions(currentUser.username, userInteractions);
            }
        }
    }
    
    // Utility functions from socialmedia.js
    function getUserInteractions(userId) {
        try {
            const stored = localStorage.getItem(`userInteractions_${userId}`);
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (e) {
            console.error('Error loading user interactions from localStorage:', e);
        }
        return { liked: [], retweeted: [], followings: [] };
    }
    
    function saveUserInteractions(userId, interactions) {
        try {
            localStorage.setItem(`userInteractions_${userId}`, JSON.stringify(interactions));
        } catch (e) {
            console.error('Error saving user interactions to localStorage:', e);
        }
    }
    
    // Update navigation active state function
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
    
    // 高亮显示hashtag（与主Feed一致）
    function highlightHashtags(text) {
        if (!text) return text;
        // 匹配中文和英文的#号和内容
        return text.replace(/([#＃])([\u4e00-\u9fa5\w]+)/g, '<span class="post-hashtag" data-hashtag="$2">$1$2</span>');
    }

    // Make functions available globally for potential reuse
    window.TueboProfile = {
        switchTab,
        renderCurrentTab,
        loadProfileData
    };
});
