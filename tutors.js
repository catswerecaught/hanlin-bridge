document.addEventListener('DOMContentLoaded', function() {
    // 完整的助学人数据 - 按照排序后的顺序重新分配头像
    const tutors = [
        {
            name: '杜学姐',
            subject: '语文·头部助学人',
            avatar: 'images/tutor1.jpg',
            score: '春考120，二模125',
            format: 'both',
            price: '¥???/2小时',
            description: '语文静安高二下区统考88/100区一，高三上第一次月考130/150年一，高三二模125/150年一，三模129/150年一，春考语文120/150',
            isPremium: true // 头部助学人
        },
        {
            name: '顾学长',
            subject: '生物助学人',
            avatar: 'images/tutor2.jpg',
            score: '高考A',
            format: 'online',
            price: '¥???/2小时',
            description: '没有躺赢的奇迹，只有厚积薄发的传奇。',
            isPremium: false
        },
        {
            name: '李学长',
            subject: '数学·头部助学人',
            avatar: 'images/tutor3.jpg',
            score: '春考131，二模138',
            format: 'both',
            price: '¥???/2小时',
            description: '拒绝"刷题化"单一教学模式，结合学生该学科学习情况提供针对性资源，分享自身学习过程中的心得、技巧、易错点，培养活跃性思维。',
            isPremium: true // 头部助学人
        },
        {
            name: '王学长',
            subject: '历史·头部助学人',
            avatar: 'images/tutor4.jpg',
            score: '高考A+',
            format: 'both',
            price: '¥???/2小时',
            description: '究天人之际，通古今之变，知应试之要。',
            isPremium: true
        },
        {
            name: '翁学姐',
            subject: '数学助学人',
            avatar: 'images/tutor5.jpg',
            score: '一模129，二模121',
            format: 'both',
            price: '¥???/2小时',
            description: '还在担心老师的高深思维不易理解？我们的同龄将是相近思路的基础，能为您传递更易听懂的解法和思维过程。拒绝仅仅死板解题步骤的呈现。',
            isPremium: false // 头部助学人
        },
        {
            name: '邬学长',
            subject: '地理助学人',
            avatar: 'images/tutor6.jpg',
            score: '高考A',
            format: 'both',
            price: '¥???/2小时',
            description: '暂无',
            isPremium: false // 头部助学人
        },
        {
            name: '包学长',
            subject: '生物·头部助学人',
            avatar: 'images/tutor7.jpg',
            score: '高考A+',
            format: 'both',
            price: '¥???/2小时',
            description: '高考生物A+，用我的经验为你们导航，用知识为你们赋能，让我们一起追逐梦想，创造属于我们的辉煌！',
            isPremium: true // 头部助学人
        },
        {
            name: '徐学姐',
            subject: '数学助学人',
            avatar: 'images/tutor8.jpg',
            score: '一模117，二模124',
            format: 'both',
            price: '¥???/2小时',
            description: '找到数学的乐趣，挖掘数学的潜能。',
            isPremium: false
        },
        {
            name: '李学长',
            subject: '英语',
            avatar: 'images/tutor9.jpg',
            score: '高考134',
            format: 'both',
            price: '¥???/2小时',
            description: 'Keep looking, don\'t settle.',
            isPremium: false
        }
    ];

    // 按姓氏拼音首字母排序（确保排序功能）
    function sortTutorsByName(tutorList) {
        return tutorList.sort((a, b) => {
            const nameA = a.name.charAt(0);
            const nameB = b.name.charAt(0);
            return nameA.localeCompare(nameB, 'zh-CN');
        });
    }

    function createTutorCard(tutor) {
        let formatText, formatClass;
        if (tutor.format === 'online') {
            formatText = '线上';
            formatClass = 'online';
        } else if (tutor.format === 'offline') {
            formatText = '线下';
            formatClass = 'offline';
        } else if (tutor.format === 'both') {
            formatText = '线上/线下均可';
            formatClass = 'both';
        }
        
        const avatarClass = tutor.isPremium ? 'tutor-avatar premium' : 'tutor-avatar';
        const verificationBadge = tutor.isPremium ? '<div class="verification-badge"></div>' : '';
        
        return `
            <div class="tutor-card-full">
                <div class="tutor-header">
                    <div style="position: relative;">
                        <img src="${tutor.avatar}" alt="${tutor.name}" class="${avatarClass}" onerror="this.src='images/tutor1.jpg'">
                        ${verificationBadge}
                    </div>
                    <div class="tutor-basic-info">
                        <h3>${tutor.name}</h3>
                        <p class="tutor-subject">${tutor.subject}</p>
                    </div>
                </div>
                <div class="tutor-details">
                    <div class="tutor-detail-item">
                        <span class="detail-label">学科成绩</span>
                        <span class="detail-value tutor-score">${tutor.score}</span>
                    </div>
                    <div class="tutor-detail-item">
                        <span class="detail-label">助学形式</span>
                        <span class="detail-value tutor-format ${formatClass}">${formatText}</span>
                    </div>
                    <div class="tutor-detail-item">
                        <span class="detail-label">参考报价</span>
                        <span class="detail-value tutor-price">${tutor.price}</span>
                    </div>
                </div>
                <div class="tutor-description">
                    <p>${tutor.description}</p>
                </div>
                <div class="tutor-contact">
                    <button class="contact-btn js-contact-btn">
                        联系助学人
                    </button>
                </div>
            </div>
        `;
    }

    function displayAllTutors() {
        const tutorsGrid = document.getElementById('tutorsGrid');
        if (!tutorsGrid) return;
        const sortedTutors = sortTutorsByName(tutors);
        tutorsGrid.innerHTML = '';
        sortedTutors.forEach(tutor => {
            tutorsGrid.innerHTML += createTutorCard(tutor);
        });
    }

    // 更新助学人信息的函数（供外部调用）
    window.updateTutorInfo = function(tutorIndex, newInfo) {
        if (tutorIndex >= 0 && tutorIndex < tutors.length) {
            // 更新指定助学人的信息
            tutors[tutorIndex] = { ...tutors[tutorIndex], ...newInfo };
            // 重新显示（会自动按姓氏排序）
            displayAllTutors();
        }
    };

    // 添加新助学人的函数（供外部调用）
    window.addNewTutor = function(newTutor) {
        tutors.push(newTutor);
        // 重新显示（会自动按姓氏排序）
        displayAllTutors();
    };

    // 全局联系方式弹窗的逻辑
    const contactModal = document.getElementById('contactModal');
    const closeModalBtn = document.querySelector('.close-modal-btn');

    if (contactModal && closeModalBtn) {
        // 通过事件委托来处理所有联系按钮的点击
        document.getElementById('tutorsGrid').addEventListener('click', function(event) {
            if (event.target.classList.contains('js-contact-btn')) {
                contactModal.style.display = 'flex';
            }
        });

        // 关闭按钮的逻辑
        closeModalBtn.addEventListener('click', function() {
            contactModal.style.display = 'none';
        });

        // 点击弹窗外部（遮罩）关闭弹窗
        window.addEventListener('click', function(event) {
            if (event.target === contactModal) {
                contactModal.style.display = 'none';
            }
        });
    }

    // 新增：高亮指定的助学人
    function highlightTutorFromURL() {
        const params = new URLSearchParams(window.location.search);
        const tutorNameToHighlight = params.get('highlight');

        if (tutorNameToHighlight) {
            // 需要等卡片都渲染完毕
            setTimeout(() => {
                const allTutorCards = document.querySelectorAll('.tutor-card-full');
                allTutorCards.forEach(card => {
                    const h3 = card.querySelector('.tutor-basic-info h3');
                    // 解码URL中的名字并进行比较
                    if (h3 && h3.textContent === decodeURIComponent(tutorNameToHighlight)) {
                        card.classList.add('is-highlighted');
                        card.scrollIntoView({ behavior: 'smooth', block: 'center' });

                        // 使用一个精确的、与CSS动画总时长匹配的 setTimeout 来移除class
                        // 确保动画能完整播放3次 (2.5s * 3 = 7.5s)
                        setTimeout(() => {
                            card.classList.remove('is-highlighted');
                        }, 7500);
                    }
                });
            }, 100);
        }
    }

    displayAllTutors();
    highlightTutorFromURL();
    initContactModal();
}); 