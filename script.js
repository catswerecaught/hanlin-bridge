document.addEventListener('DOMContentLoaded', function() {
    // 完整的助学人数据 - 与tutors.js保持一致
    const tutors = [
        {
            name: '杜学姐',
            subject: '语文·头部助学人',
            avatar: 'images/tutor1.jpg',
            score: '春考120，二模125',
            format: 'both',
            price: '¥3??/2小时',
            description: '语文静安高二下区统考88/100区一，高三上第一次月考130/150年一，高三二模125/150年一，三模129/150年一，春考语文120/150',
            isPremium: true // 头部助学人
        },
        {
            name: '顾学长',
            subject: '生物助学人',
            avatar: 'images/tutor2.jpg',
            score: '高考A',
            format: 'offline',
            price: '¥240/2小时',
            description: '没有躺赢的奇迹，只有厚积薄发的传奇。',
            isPremium: false
        },
        {
            name: '李学长',
            subject: '数学·头部助学人',
            avatar: 'images/tutor3.jpg',
            score: '春考131，二模138',
            format: 'both',
            price: '¥300/2小时',
            description: '拒绝"刷题化"单一教学模式，结合学生该学科学习情况提供针对性资源，分享自身学习过程中的心得、技巧、易错点，培养活跃性思维。',
            isPremium: true // 头部助学人
        },
        {
            name: '正在招募中',
            subject: '历史·头部助学人',
            avatar: 'images/tutor4.jpg',
            score: '高考A+',
            format: 'both',
            price: '¥300/2小时',
            description: '究天人之际，通古今之变，知应试之要。',
            isPremium: false
        },
        {
            name: '翁学姐',
            subject: '数学助学人',
            avatar: 'images/tutor5.jpg',
            score: '一模129，二模121',
            format: 'both',
            price: '¥240/2小时',
            description: '还在担心老师的高深思维不易理解？我们的同龄将是相近思路的基础，能为您传递更易听懂的解法和思维过程。拒绝仅仅死板解题步骤的呈现。',
            isPremium: false // 头部助学人
        },
        {
            name: '邬学长',
            subject: '地理助学人',
            avatar: 'images/tutor6.jpg',
            score: '高考A',
            format: 'both',
            price: '¥240/2小时',
            description: '暂无',
            isPremium: false // 头部助学人
        },
        {
            name: '包学长',
            subject: '生物·头部助学人',
            avatar: 'images/tutor7.jpg',
            score: '高考A+',
            format: 'both',
            price: '¥300/2小时',
            description: '高考生物A+，用我的经验为你们导航，用知识为你们赋能，让我们一起追逐梦想，创造属于我们的辉煌！',
            isPremium: true // 头部助学人
        },
        {
            name: '徐学姐',
            subject: '数学助学人',
            avatar: 'images/tutor8.jpg',
            score: '一模117，二模124',
            format: 'both',
            price: '¥240/2小时',
            description: '找到数学的乐趣，挖掘数学的潜能。',
            isPremium: false
        },
        {
            name: '正在招募中',
            subject: '未知',
            avatar: 'images/tutor9.jpg',
            score: '未知',
            format: 'both',
            price: '¥？/2小时',
            description: '暂无',
            isPremium: false
        }
    ];

    const tutorContainer = document.querySelector('.tutor-card-container');
    
    if (tutorContainer) {
        function getRandomTutors(tutorList, count) {
            // 过滤掉"正在招募中"
            const filtered = tutorList.filter(t => t.name !== '正在招募中');
            // 先分组
            const premium = filtered.filter(t => t.isPremium);
            const normal = filtered.filter(t => !t.isPremium);
            // 打乱各自顺序
            const shuffle = arr => arr.sort(() => 0.5 - Math.random());
            const premiumShuffled = shuffle(premium);
            const normalShuffled = shuffle(normal);
            // 先取最多2个头部助学人
            const premiumCount = Math.min(2, premiumShuffled.length);
            const selectedPremium = premiumShuffled.slice(0, premiumCount);
            // 再补足普通助学人
            const normalCount = count - selectedPremium.length;
            const selectedNormal = normalShuffled.slice(0, normalCount);
            // 头部助学人在前
            return selectedPremium.concat(selectedNormal);
        }

        function displayTutors() {
            tutorContainer.innerHTML = '';
            const randomTutors = getRandomTutors(tutors, 4);

            randomTutors.forEach(tutor => {
                const tutorCardLink = document.createElement('a');
                tutorCardLink.className = 'tutor-card';
                if (tutor.isPremium) {
                    tutorCardLink.classList.add('premium');
                }
                
                tutorCardLink.href = `tutors.html?highlight=${encodeURIComponent(tutor.name)}`;
                
                tutorCardLink.innerHTML = `
                    <img src="${tutor.avatar}" alt="${tutor.name}" onerror="this.src='images/tutor1.jpg'">
                    <div class="tutor-info">
                        <h4>${tutor.name}</h4>
                        <p>${tutor.subject}</p>
                    </div>
                `;
                
                tutorContainer.appendChild(tutorCardLink);
            });
        }

        displayTutors();

        // 换一换按钮功能
        const shuffleBtn = document.querySelector('.shuffle-tutors-btn');
        if (shuffleBtn) {
            shuffleBtn.addEventListener('click', function() {
                displayTutors();
            });
        }
    }

    // Activity Card Expand/Collapse Logic
    const activityWrappers = document.querySelectorAll('.activity-wrapper');

    activityWrappers.forEach(activityWrapper => {
        const activityCard = activityWrapper.querySelector('.activity-card');
        const closeActivityBtn = activityWrapper.querySelector('.close-activity-btn');

        if (activityCard && closeActivityBtn) {
            activityCard.addEventListener('click', () => {
                // Close any other expanded card first
                activityWrappers.forEach(otherWrapper => {
                    if (otherWrapper !== activityWrapper) {
                        otherWrapper.classList.remove('is-expanded');
                    }
                });
                // Then expand the clicked one
                activityWrapper.classList.add('is-expanded');
            });

            closeActivityBtn.addEventListener('click', (event) => {
                event.stopPropagation(); // 防止事件冒泡到activityCard上
                activityWrapper.classList.remove('is-expanded');
            });
        }
    });

    // --- SMOOTH NAVIGATION HIGHLIGHT LOGIC ---

    const navList = document.querySelector('.main-nav ul');
    const navLinks = document.querySelectorAll('.main-nav ul li a');
    const highlight = document.querySelector('.nav-highlight');
    const activeLink = document.querySelector('.main-nav ul li a.active');

    // On page load, move the highlight
    if (activeLink && highlight) {
        const lastPos = sessionStorage.getItem('navHighlightPos');
        const targetLi = activeLink.parentElement;

        const hasGsap = typeof window !== 'undefined' && typeof window.gsap !== 'undefined';
        // Make sure the element is visible from the start
        if (hasGsap) {
            gsap.set(highlight, { opacity: 1 });
        } else {
            highlight.style.opacity = '1';
        }

        if (lastPos) {
            const fromPos = JSON.parse(lastPos);
            if (hasGsap) {
                gsap.fromTo(highlight,
                    { left: fromPos.left, top: fromPos.top, width: fromPos.width, height: fromPos.height },
                    { duration: 0.5, ease: 'power3.out', left: targetLi.offsetLeft, top: targetLi.offsetTop, width: targetLi.offsetWidth, height: targetLi.offsetHeight }
                );
            } else {
                // Fallback: set directly to target
                highlight.style.left = targetLi.offsetLeft + 'px';
                highlight.style.top = targetLi.offsetTop + 'px';
                highlight.style.width = targetLi.offsetWidth + 'px';
                highlight.style.height = targetLi.offsetHeight + 'px';
            }
            sessionStorage.removeItem('navHighlightPos');
        } else {
            if (hasGsap) {
                gsap.set(highlight, { left: targetLi.offsetLeft, top: targetLi.offsetTop, width: targetLi.offsetWidth, height: targetLi.offsetHeight });
            } else {
                highlight.style.left = targetLi.offsetLeft + 'px';
                highlight.style.top = targetLi.offsetTop + 'px';
                highlight.style.width = targetLi.offsetWidth + 'px';
                highlight.style.height = targetLi.offsetHeight + 'px';
            }
        }
    }

    // Before leaving the page, store the current highlight position
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');
            // Only store for valid, internal page links
            if (href && href !== '#' && !href.startsWith('javascript:') && !link.classList.contains('active')) {
                const activeLink = document.querySelector('.main-nav ul li a.active');
                const currentActiveLi = activeLink ? activeLink.parentElement : null;
                if (currentActiveLi) {
                    const pos = {
                        left: currentActiveLi.offsetLeft,
                        top: currentActiveLi.offsetTop,
                        width: currentActiveLi.offsetWidth,
                        height: currentActiveLi.offsetHeight
                    };
                    sessionStorage.setItem('navHighlightPos', JSON.stringify(pos));
                }
            }
        });
    });

    // --- END OF SMOOTH NAVIGATION LOGIC ---

    // 用户模拟数据
    function getInitial(name) {
        if (!name) return '';
        // 取第一个汉字的拼音首字母大写
        const zh = name[0];
        // 简单处理：用英文首字母或直接大写
        return zh.charAt(0).toUpperCase();
    }

    function showLoginModal(show) {
        const modal = document.getElementById('loginModal');
        if (show) {
            modal.classList.add('show');
        } else {
            modal.classList.remove('show');
            document.getElementById('loginError').textContent = '';
            document.getElementById('loginForm').reset();
        }
    }

    function setUserAvatar(user) {
        const avatar = document.getElementById('userAvatar');
        avatar.innerHTML = '';
        if (user) {
            avatar.classList.add('logged-in');
            // 登录后显示自定义头像图片
            const img = document.createElement('img');
            img.src = user.avatar || 'images/user00001.jpg';
            img.alt = user.name;
            img.className = 'user-avatar-img';
            avatar.appendChild(img);
            // 会员认证标识
            const badge = document.createElement('img');
            badge.className = 'vip-badge';
            if (user.vip === 'Pro会员') {
                badge.src = 'images/vip-pro.png';
                badge.alt = 'Pro会员';
            } else {
                badge.src = 'images/vip-normal.png';
                badge.alt = '普通会员';
            }
            avatar.appendChild(badge);
            // 添加登出弹窗
            const logout = document.createElement('div');
            logout.className = 'logout-popover';
            logout.textContent = '登出';
            logout.onclick = function(e) {
                e.stopPropagation();
                setLoginUser(null);
                setUserAvatar(null);
                window.location.href = 'index.html'; // 登出后跳转首页
            };
            avatar.appendChild(logout);
        } else {
            avatar.classList.remove('logged-in');
            // 未登录显示默认图片
            const img = document.createElement('img');
            img.src = 'images/login-default.png';
            img.alt = '登录';
            img.id = 'avatarImg';
            avatar.appendChild(img);
        }
        // 移除弹窗状态
        avatar.classList.remove('show-logout');
    }

    function getLoginUser() {
        try {
            return JSON.parse(localStorage.getItem('loginUser'));
        } catch { return null; }
    }
    function setLoginUser(user) {
        if (user) {
            localStorage.setItem('loginUser', JSON.stringify(user));
        } else {
            localStorage.removeItem('loginUser');
        }
    }

    // 入口交互
    const avatar = document.getElementById('userAvatar');
    const loginModal = document.getElementById('loginModal');
    const closeBtn = document.getElementById('loginCloseBtn');
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');

    // 只在有登录入口的页面挂载
    if (avatar && loginModal && closeBtn && loginForm && loginError) {
        setUserAvatar(getLoginUser());
        avatar.onclick = function(e) {
            const user = getLoginUser();
            const isProfile = window.location.pathname.endsWith('profile.html');
            if (user) {
                if (!isProfile) {
                    // 跳转到个人主页并带参数，要求弹出登出按钮
                    window.location.href = 'profile.html?showLogout=1';
                } else {
                    // 已在个人主页，直接弹出登出按钮
                    e.stopPropagation();
                    avatar.classList.add('show-logout');
                }
            } else {
                showLoginModal(true);
            }
        };
        // 点击页面其他地方关闭登出弹窗
        document.addEventListener('click', function(e) {
            if (avatar.classList.contains('show-logout')) {
                avatar.classList.remove('show-logout');
            }
        });
        closeBtn.onclick = function() { showLoginModal(false); };
        loginModal.onclick = function(e) {
            if (e.target === loginModal) showLoginModal(false);
        };
        loginForm.onsubmit = function(e) {
            e.preventDefault();
            const username = document.getElementById('loginUsername').value.trim();
            const password = document.getElementById('loginPassword').value;
            const user = users.find(u => (u.username === username) && u.password === password);
            if (user) {
                setLoginUser(user);
                setUserAvatar(user);
                // 登录触发重定向处理
                try {
                    const params = new URLSearchParams(window.location.search);
                    const redirectParam = params.get('redirect');
                    const sessionRedirect = sessionStorage.getItem('postLoginRedirect');
                    const target = redirectParam || sessionRedirect;
                    if (target) {
                        sessionStorage.removeItem('postLoginRedirect');
                        showLoginModal(false);
                        window.location.href = target;
                        return;
                    }
                } catch {}
                showLoginModal(false);
            } else {
                loginError.textContent = '用户名或密码错误';
            }
        };
        // 若通过 URL ?login=1 进入且未登录，自动弹出登录框
        try {
            const params = new URLSearchParams(window.location.search);
            if (params.get('login') === '1' && !getLoginUser()) {
                showLoginModal(true);
            }
        } catch {}
    }

    // ======= 封禁拦截（Upstash） =======
    async function isUserBanned() {
        const u = getLoginUser();
        if (!u) return false;
        try {
            const res = await fetch(`/api/user-interactions?username=${encodeURIComponent(u.username)}`);
            if (!res.ok) return false;
            const data = await res.json();
            return !!data.banned;
        } catch { return false; }
    }
    function showFreezeNotice() {
        const msg = '因违反相关规定，您的账户已被冻结。';
        // toast 优先，否则 alert
        let toast = document.getElementById('freezeToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'freezeToast';
            toast.style.position = 'fixed';
            toast.style.left = '50%';
            toast.style.top = '90px';
            toast.style.transform = 'translateX(-50%)';
            toast.style.background = 'rgba(34,34,34,0.96)';
            toast.style.color = '#fff';
            toast.style.fontSize = '16px';
            toast.style.padding = '12px 22px';
            toast.style.borderRadius = '12px';
            toast.style.zIndex = '4000';
            toast.style.boxShadow = '0 4px 18px rgba(0,0,0,0.18)';
            toast.style.opacity = '0';
            toast.style.transition = 'opacity .25s';
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.style.opacity = '1';
        setTimeout(()=> toast.style.opacity = '0', 1500);
    }
    async function setupBanInterceptors() {
        const banned = await isUserBanned();
        if (!banned) return;
        const restrictedPaths = ['trend.html','lingning.html','customize.html','cooperation.html','socialmedia.html','email.html'];
        const restrictedNames = ['趋势','灵凝','定制','新闻','社媒','邮件'];
        // 1) 导航拦截
        const navList = document.querySelectorAll('.main-nav ul li a');
        navList.forEach(a => {
            const href = a.getAttribute('href') || '';
            const text = a.textContent.trim();
            const hit = restrictedPaths.some(p => href.endsWith(p)) || restrictedNames.includes(text);
            if (hit) {
                a.addEventListener('click', function(e){
                    e.preventDefault();
                    showFreezeNotice();
                });
            }
        });
        // 2) 直接访问 URL 拦截（当前页即受限）
        const nowPath = window.location.pathname;
        if (restrictedPaths.some(p => nowPath.endsWith(p))) {
            showFreezeNotice();
            setTimeout(()=>{ window.location.href = 'index.html'; }, 900);
        }
    }
    setupBanInterceptors();

    // 权限拦截：只有Pro会员可进入趋势页面（保留原有逻辑）
    function setupTrendAccessControl() {
        // 只在非 trend.html 页面拦截
        if (window.location.pathname.endsWith('trend.html')) return;
        var navLinks = document.querySelectorAll('.main-nav ul li a');
        var trendLink = Array.from(navLinks).find(a => a.textContent.trim() === '趋势');
        if (!trendLink) return;
        trendLink.addEventListener('click', function(e) {
            var user = getLoginUser();
            if (!user || user.vip !== 'Pro会员') {
                e.preventDefault();
                var modal = document.getElementById('proOnlyModal');
                if (modal) {
                    modal.classList.add('show');
                    setTimeout(function() {
                        modal.classList.remove('show');
                    }, 1500);
                } else {
                    alert('该功能仅向Pro用户开放');
                }
            }
        });
    }
    setupTrendAccessControl();

    // 灵凝页面访问控制：普通会员和Pro会员都可以访问
    function setupLingningAccessControl() {
        // 只在非 lingning.html 页面拦截
        if (window.location.pathname.endsWith('lingning.html')) return;
        var navLinks = document.querySelectorAll('.main-nav ul li a');
        var lingningLink = Array.from(navLinks).find(a => a.textContent.trim() === '灵凝');
        if (!lingningLink) return;
        lingningLink.addEventListener('click', function(e) {
            var user = getLoginUser();
            if (!user || (user.vip !== '普通会员' && user.vip !== 'Pro会员')) {
                e.preventDefault();
                alert('请先登录成为会员');
            }
        });
    }
    setupLingningAccessControl();

    // 社媒页面访问控制：必须登录
    function setupSocialmediaAccessControl() {
        var navLinks = document.querySelectorAll('.main-nav ul li a');
        var smLink = Array.from(navLinks).find(a => ((a.getAttribute('href') || '').endsWith('socialmedia.html')) || a.textContent.trim() === '社媒');
        if (!smLink) return;
        smLink.addEventListener('click', function(e) {
            var user = getLoginUser();
            if (!user) {
                e.preventDefault();
                try { sessionStorage.setItem('postLoginRedirect', 'socialmedia.html'); } catch {}
                var modal = document.getElementById('loginModal');
                if (modal) {
                    showLoginModal(true);
                } else {
                    window.location.href = 'index.html?login=1&redirect=socialmedia.html';
                }
            }
        });
    }
    setupSocialmediaAccessControl();
});
