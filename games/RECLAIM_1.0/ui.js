const ui = {
    toastTimer: null,
    elementCache: {}, // [OPTIMIZATION] DOM 요소 캐싱
    lastValues: {},   // [OPTIMIZATION] 이전 프레임 데이터 저장 (값 변경 감지용)

    init() {
        // 초기화 로직
    },

    showToast(msg) {
        const t = document.getElementById('toast-msg');
        if (!t) return;
        t.innerText = msg; t.classList.remove('hidden'); t.style.opacity = 1;
        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => { t.style.opacity = 0; setTimeout(() => t.classList.add('hidden'), 500); }, 3000);
    },

    toggleBriefing() {
        document.getElementById('briefing-detail').classList.toggle('show');
    },

    // [OPTIMIZATION] 초기 1회 실행: 모든 유닛 버튼 생성 및 캐싱
    initUnitButtons(currentCategory) {
        const container = document.getElementById('unit-list-container');
        container.innerHTML = ''; // 초기화
        this.elementCache = {};
        this.lastValues = {};

        Object.keys(CONFIG.units).forEach(key => {
            const u = CONFIG.units[key];

            // 버튼 DOM 생성
            const btn = document.createElement('div');
            btn.id = `btn-${key}`;
            btn.className = 'btn-unit relative w-16 h-14 md:w-20 md:h-16 rounded overflow-hidden shadow-lg shrink-0 cursor-pointer select-none';
            btn.style.display = u.category === currentCategory ? 'flex' : 'none'; // 초기 카테고리 설정

            // 캔버스 아이콘 (한 번만 그림)
            const iconCvs = document.createElement('canvas');
            iconCvs.width = 60; iconCvs.height = 40;
            const ctx = iconCvs.getContext('2d');

            ctx.save();
            ctx.translate(30, 25);
            const dummy = new Unit(key, 0, 0, 'player');
            dummy.hideHp = true;
            if (dummy.stats.type === 'air') dummy.y = 0;
            if (u.width > 50) ctx.scale(0.6, 0.6); else ctx.scale(0.8, 0.8);
            dummy.draw(ctx);
            ctx.restore();

            btn.appendChild(iconCvs);

            // 텍스트 및 오버레이 생성
            const nameSpan = document.createElement('span');
            nameSpan.className = 'font-bold text-[10px] z-10 absolute top-0 w-full text-center bg-black/30 text-white';
            // [Localization]
            nameSpan.setAttribute('data-lang', `unit_${key}_name`);
            nameSpan.innerText = (typeof Lang !== 'undefined') ? Lang.getText(`unit_${key}_name`) : u.name;
            btn.appendChild(nameSpan);

            const countSpan = document.createElement('span');
            countSpan.className = 'count-text z-50 absolute bottom-1 right-1';
            countSpan.innerText = '--';
            btn.appendChild(countSpan);

            const cdDiv = document.createElement('div');
            cdDiv.className = 'cooldown-overlay h-0';
            btn.appendChild(cdDiv);

            const qBadge = document.createElement('div');
            qBadge.className = 'queue-badge hidden';
            qBadge.innerText = '0';
            btn.appendChild(qBadge);

            const colorBar = document.createElement('div');
            colorBar.className = 'absolute bottom-0 w-full h-1 z-10';
            colorBar.style.backgroundColor = u.color;
            btn.appendChild(colorBar);

            // 캐시에 저장 (매 프레임 검색 방지)
            this.elementCache[key] = { btn, countSpan, cdDiv, qBadge };
            this.lastValues[key] = { stock: -1, cdRatio: -1, queue: -1, active: null };

            // 이벤트 바인딩
            this.bindButtonEvents(btn, key);
            container.appendChild(btn);
        });
    },

    bindButtonEvents(btn, key) {
        btn.addEventListener('mouseenter', (e) => this.showUnitInfo(key, e));
        btn.addEventListener('mouseleave', () => this.hideUnitInfo());

        const startAction = (e) => { e.preventDefault(); game.startHold(key); };
        const endAction = (e) => { e.preventDefault(); game.endHold(key); };

        btn.addEventListener('mousedown', startAction);
        btn.addEventListener('mouseup', endAction);
        btn.addEventListener('mouseleave', endAction);
        btn.addEventListener('touchstart', startAction, { passive: false });
        btn.addEventListener('touchend', endAction, { passive: false });
        btn.addEventListener('touchcancel', endAction, { passive: false }); // [Mobile] Safety
    },

    // [OPTIMIZATION] 매 프레임 호출: 값이 변했을 때만 DOM 수정
    showExitConfirmation() {
        document.getElementById('exit-modal').classList.remove('hidden');
    },

    confirmExit(yes) {
        document.getElementById('exit-modal').classList.add('hidden');
        if (yes) {
            if (game.running) {
                game.backToLobby();
                // Replace state to lobby to keep history clean?
                // Actually backToLobby is enough, but we might want to pop state if it was pushed?
                // Logic: 
                // 1. User pressed Back -> Popstate Event -> Pushed History + Show Modal
                // 2. User Click Yes -> Go Lobby. (History state is now "Game" (top) -> "Lobby")
                // We should probably go back or replace state.
                history.replaceState({ page: 'lobby' }, "Lobby", "#lobby");
            } else {
                // In Lobby -> Exit?
                // Browser can't resize/close usually.
                // Just reload or do nothing?
                // User asked for "Exit?" window. If Yes -> maybe go to google.com or close window
                try {
                    window.close();
                } catch (e) {
                    location.href = 'about:blank';
                }
            }
        } else {
            // Cancel -> Stay.
            // If we pushed state in popstate event, we are effectively "forward" again?
            // If user pressed Back (Popped) -> We Pushed (Returned to state).
            // So we are fine.
        }
    },

    updateUnitButtons(cat, stock, cooldowns, supply, queue) {
        Object.keys(CONFIG.units).forEach(key => {
            const cache = this.elementCache[key];
            if (!cache) return;

            const u = CONFIG.units[key];
            const isVisible = u.category === cat;

            // 1. 카테고리 표시/숨김 최적화
            if (cache.btn.style.display !== (isVisible ? 'flex' : 'none')) {
                cache.btn.style.display = isVisible ? 'flex' : 'none';
            }
            if (!isVisible) return; // 안 보이면 업데이트 생략

            const last = this.lastValues[key];

            // 2. 재고/스킬 횟수 업데이트
            let currentCount;
            if (u.isSkill) currentCount = game.skillCharges[u.chargeKey];
            else currentCount = stock[key];

            if (last.stock !== currentCount) {
                cache.countSpan.innerText = u.isSkill ? currentCount + '발' : currentCount;
                last.stock = currentCount;
            }

            // 3. 쿨타임 업데이트
            const currentRatio = cooldowns[key] / u.cooldown;
            // 쿨타임이 0이거나 완료된 상태에서 불필요한 스타일 변경 방지
            if (Math.abs(last.cdRatio - currentRatio) > 0.01) {
                cache.cdDiv.style.height = `${currentRatio * 100}%`;
                last.cdRatio = currentRatio;
            }

            // 4. 대기열 뱃지
            const currentQ = queue ? queue[key] : 0;
            if (last.queue !== currentQ) {
                if (currentQ > 0) {
                    cache.qBadge.innerText = `+${currentQ}`;
                    cache.qBadge.classList.remove('hidden');
                } else {
                    cache.qBadge.classList.add('hidden');
                }
                last.queue = currentQ;
            }

            // 5. 버튼 활성/비활성 상태
            let isActive = true;
            if (u.isSkill) {
                if (game.skillCharges[u.chargeKey] <= 0) isActive = false;
            } else {
                if (supply < u.cost || stock[key] <= 0) isActive = false;
            }

            if (last.active !== isActive) {
                if (isActive) cache.btn.classList.remove('btn-disabled');
                else cache.btn.classList.add('btn-disabled');
                last.active = isActive;
            }
        });
    },

    showUnitInfo(key) {
        const u = CONFIG.units[key];
        const panel = document.getElementById('unit-info-panel');
        if (!panel) return;
        if (!panel) return;

        let name = u.name;
        let desc = u.description || '...';

        // [Localization]
        if (typeof Lang !== 'undefined') {
            name = Lang.getText(`unit_${key}_name`);
            desc = Lang.getText(`unit_${key}_desc`);
        }

        document.getElementById('info-name').innerText = name;
        document.getElementById('info-name').style.color = u.color;
        document.getElementById('info-role').innerText = u.role || '유닛';
        document.getElementById('info-desc').innerText = desc;
        panel.classList.add('visible');
    },

    hideUnitInfo() {
        const panel = document.getElementById('unit-info-panel');
        if (panel) panel.classList.remove('visible');
    },

    updateCategoryTab(currentCategory) {
        document.querySelectorAll('.btn-category').forEach(btn => btn.classList.remove('active'));
        const tab = document.getElementById(`tab-${currentCategory}`);
        if (tab) tab.classList.add('active');
        // 카테고리가 바뀌면 즉시 버튼 갱신 트리거
        this.updateUnitButtons(currentCategory, game.playerStock, game.cooldowns, game.supply, game.spawnQueue);
    },

    updateEnemyStatus(enemyStock) {
        const tbody = document.getElementById('enemy-status-tbody');
        if (!tbody) return;
        tbody.innerHTML = ''; // 여기는 자주 열지 않으므로 innerHTML 유지
        for (let k in enemyStock) {
            const count = enemyStock[k];
            const data = CONFIG.units[k];
            if (!data) continue;
            let statusClass = 'text-green-400';
            let statusText = '양호';
            if (count <= 0) { statusClass = 'text-red-500 font-bold'; statusText = '전멸'; }
            else if (count < 3) { statusClass = 'text-yellow-400'; statusText = '위험'; }
            tbody.innerHTML += `<tr><td>${data.name}</td><td class="text-right ${count <= 0 ? 'text-gray-600 line-through' : ''}">${count}</td><td class="text-right ${statusClass}">${statusText}</td></tr>`;
        }
    },

    setSkillCount(type, count) {
        const el = document.getElementById(`cnt-${type}`);
        if (el) el.innerText = count + "발";
        const btn = document.getElementById(`btn-${type}`);
        if (btn) {
            if (count <= 0) btn.classList.add('used');
            else btn.classList.remove('used');
        }
    },

    // [New] Options Modal Logic
    openOptions() {
        document.getElementById('option-modal').classList.add('active');
        // Update slider values
        if (typeof AudioSystem !== 'undefined') {
            document.getElementById('vol-master-val').innerText = parseInt(AudioSystem.volume.master * 100) + '%';
            document.querySelector("input[oninput*='master']").value = AudioSystem.volume.master * 100;

            document.getElementById('vol-bgm-val').innerText = parseInt(AudioSystem.volume.bgm * 100) + '%';
            document.querySelector("input[oninput*='bgm']").value = AudioSystem.volume.bgm * 100;

            document.getElementById('vol-sfx-val').innerText = parseInt(AudioSystem.volume.sfx * 100) + '%';
            document.querySelector("input[oninput*='sfx']").value = AudioSystem.volume.sfx * 100;
        }

        // Sync Speed Buttons
        if (typeof game !== 'undefined') this.updateSpeedBtns(game.speed);
    },

    closeOptions() {
        document.getElementById('option-modal').classList.remove('active');
    },

    setVolume(type, val) {
        const v = val / 100;
        if (typeof AudioSystem !== 'undefined') {
            if (type === 'bgm') AudioSystem.setBGMVolume(v);
            else AudioSystem.setVolume(type, v);
        }
        document.getElementById(`vol-${type}-val`).innerText = val + '%';
    },

    changeBGM(val) {
        if (typeof AudioSystem !== 'undefined') AudioSystem.playMP3(val);
    },

    updateDiffBtn(btn) {
        const allBtns = document.querySelectorAll('.btn-diff');

        // 1. Reset ALL buttons to "Dimmed" state
        allBtns.forEach(b => {
            // Remove ALL color/active classes
            b.classList.remove(
                'active', 'scale-105', 'scale-110', 'opacity-100', 'z-10', 'ring-2', 'ring-4', 'ring-offset-2', 'ring-offset-slate-950',
                'border-green-500', 'border-blue-500', 'border-red-500',
                'ring-green-500', 'ring-blue-500', 'ring-red-500',
                'bg-green-900', 'bg-blue-900', 'bg-red-900'
            );

            // Add "Inactive" styling
            b.classList.add('border-slate-800', 'bg-slate-900', 'opacity-40', 'scale-95');

            // Reset text/icons to gray
            const icon = b.querySelector('i');
            const text = b.querySelector('span[data-lang]');
            if (icon) icon.className = icon.className.replace(/text-\w+-\d+/g, 'text-gray-600');
            if (text) { text.classList.remove('text-white'); text.classList.add('text-gray-600'); }
        });

        // 2. Highlight SELECTED button
        const diff = btn.getAttribute('data-diff');
        btn.classList.remove('border-slate-800', 'bg-slate-900', 'opacity-40', 'scale-95');
        btn.classList.add('active', 'bg-slate-800', 'scale-110', 'opacity-100', 'z-10', 'ring-4', 'ring-offset-2', 'ring-offset-slate-950');

        const icon = btn.querySelector('i');
        const text = btn.querySelector('span[data-lang]');
        const statusEl = document.getElementById('diff-status-text');

        let diffName = "";
        let colorClass = "";

        if (diff === 'recruit') {
            btn.classList.add('border-green-500', 'ring-green-500');
            if (icon) { icon.classList.remove('text-gray-600'); icon.classList.add('text-green-500'); }
            diffName = "RECRUIT (EASY)";
            colorClass = "text-green-400";
        } else if (diff === 'veteran') {
            btn.classList.add('border-blue-500', 'ring-blue-500');
            if (icon) { icon.classList.remove('text-gray-600'); icon.classList.add('text-blue-500'); }
            diffName = "VETERAN (NORMAL)";
            colorClass = "text-blue-400";
        } else if (diff === 'elite') {
            btn.classList.add('border-red-500', 'ring-red-500');
            if (icon) { icon.classList.remove('text-gray-600'); icon.classList.add('text-red-500'); }
            diffName = "ELITE (HARD)";
            colorClass = "text-red-500";
        }

        if (text) { text.classList.remove('text-gray-600'); text.classList.add('text-white'); }

        // [REMOVED] Status Text update as per request
    },

    updateSpeedBtns(s) {
        // 1. HUD Buttons
        document.querySelectorAll('.btn-speed').forEach(b => {
            b.classList.remove('bg-blue-600', 'text-white', 'border-blue-400');
            b.classList.add('bg-slate-800', 'text-gray-400', 'border-slate-600');
        });
        const activeBtn = document.getElementById(`btn-speed-${s}`);
        if (activeBtn) {
            activeBtn.classList.remove('bg-slate-800', 'text-gray-400', 'border-slate-600');
            activeBtn.classList.add('bg-blue-600', 'text-white', 'border-blue-400');
        }

        // 2. Option Modal Buttons
        document.querySelectorAll('.btn-speed-opt').forEach(b => {
            b.classList.remove('bg-blue-600', 'text-white', 'border-blue-400');
            b.classList.add('bg-slate-800', 'text-gray-400', 'border-slate-600');
        });
        const activeOptBtn = document.getElementById(`btn-speed-opt-${s}`);
        if (activeOptBtn) {
            activeOptBtn.classList.remove('bg-slate-800', 'text-gray-400', 'border-slate-600');
            activeOptBtn.classList.add('bg-blue-600', 'text-white', 'border-blue-400');
        }
    }
};
