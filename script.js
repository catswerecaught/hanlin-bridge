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
            name: '王学长',
            subject: '历史·头部助学人',
            avatar: 'images/tutor4.jpg',
            score: '高考A+',
            format: 'both',
            price: '¥300/2小时',
            description: '究天人之际，通古今之变，知应试之要。',
            isPremium: true
        },
        {
            name: '翁学姐',
            subject: '数学',
            avatar: 'images/tutor5.jpg',
            score: '一模129，二模121',
            format: 'both',
            price: '¥240/2小时',
            description: '还在担心老师的高深思维不易理解？我们的同龄将是相近思路的基础，能为您传递更易听懂的解法和思维过程。拒绝仅仅死板解题步骤的呈现。',
            isPremium: false // 头部助学人
        },
        {
            name: '邬学长',
            subject: '地理',
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
            subject: '数学',
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

        // Make sure the element is visible from the start
        gsap.set(highlight, { opacity: 1 });

        if (lastPos) {
            // If we have a stored position, animate from it
            const fromPos = JSON.parse(lastPos);
            
            gsap.fromTo(highlight, 
                { // from
                    left: fromPos.left,
                    top: fromPos.top,
                    width: fromPos.width,
                    height: fromPos.height
                }, 
                { // to
                    duration: 0.5,
                    ease: 'power3.out',
                    left: targetLi.offsetLeft,
                    top: targetLi.offsetTop,
                    width: targetLi.offsetWidth,
                    height: targetLi.offsetHeight
                }
            );
            sessionStorage.removeItem('navHighlightPos');
        } else {
            // Otherwise, just set it instantly without animation
            gsap.set(highlight, {
                left: targetLi.offsetLeft,
                top: targetLi.offsetTop,
                width: targetLi.offsetWidth,
                height: targetLi.offsetHeight
            });
        }
    }

    // Before leaving the page, store the current highlight position
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');
            // Only store for valid, internal page links
            if (href && href !== '#' && !href.startsWith('javascript:') && !link.classList.contains('active')) {
                const currentActiveLi = document.querySelector('.main-nav ul li a.active').parentElement;
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
});
