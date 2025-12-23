const LOGICAL_HEIGHT = 720;

const game = {
    canvas: document.getElementById('game-canvas'),
    ctx: null, width: 0, height: 0, groundY: 0,
    frame: 0, running: false, cameraX: 0,

    scaleRatio: 1,
    logicalWidth: 1280, // Note: This might be less relevant if we calc width dynamically, but keeping for legacy refs or init
    logicalHeight: LOGICAL_HEIGHT,

    // [NEW] Total War Trigger Flag
    totalWarTriggered: false,

    players: [], enemies: [], projectiles: [], particles: [], buildings: [],
    supply: CONFIG.startSupply, enemySupply: CONFIG.startSupply,
    cooldowns: {}, playerStock: {}, enemyStock: {}, enemyCooldowns: {},
    skillCharges: { emp: 5, nuke: 1 },
    empTimer: 0, targetingType: null, killCount: 0,
    playerBuildings: [], enemyBuildings: [],

    // [Queue System]
    spawnQueue: {},
    holdTimer: null, holdKey: null,

    // [Category & Spawn]
    currentCategory: 'infantry',

    // Toast Wrapper
    showToast(msg) { ui.showToast(msg); },

    init() {
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize()); // 회전 시 즉시 반응

        this.setupInputs();
        this.initGameObjects();

        // UI 초기화
        ui.init();
        ui.initUnitButtons(this.currentCategory);
        if (typeof Lang !== 'undefined') Lang.updateDOM();

        // [ADD][APP] 저장된 설정/스키마를 로드해서 게임에 적용
        if (typeof app !== 'undefined') {
            app.loadIntoGame();      // speed/difficulty/lastMapId 등 반영
            app.commit('init');      // UI 1회 정렬 + 저장 포맷 정리
        }

        // [NEW] History API Handle for Back Button
        window.addEventListener('popstate', (event) => {
            if (this.running) {
                history.pushState({ page: 'game' }, "Game", "#game");
                ui.showExitConfirmation();
            } else if (!document.getElementById('map-select-screen').classList.contains('hidden')) {
                this.backToLobby();
            } else {
                history.pushState({ page: 'lobby' }, "Lobby", "#lobby"); // Keep in page
                ui.showExitConfirmation();
            }
        });

        // Push initial state
        history.replaceState({ page: 'lobby' }, "Lobby", "#lobby");

        // Loading Sim
        this.simulateLoading();

        // Minimap Inputs
        const miniCvs = document.getElementById('hud-minimap');
        if (miniCvs) {
            const handleMinimap = (mx, my) => {
                const rect = miniCvs.getBoundingClientRect();
                const x = mx - rect.left;
                const ratio = x / rect.width;
                this.cameraX = (ratio * CONFIG.mapWidth) - (this.width / 2);
                this.cameraX = Math.max(0, Math.min(this.cameraX, CONFIG.mapWidth - this.width));
            };
            let miniDrag = false;
            miniCvs.addEventListener('mousedown', e => { miniDrag = true; handleMinimap(e.clientX, e.clientY); });
            window.addEventListener('mousemove', e => { if (miniDrag) handleMinimap(e.clientX, e.clientY); });
            window.addEventListener('mouseup', () => miniDrag = false);
        }

        // Visibility / Freeze Prevention
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                if (typeof AudioSystem !== 'undefined' && AudioSystem.ctx) AudioSystem.ctx.suspend();
                this.running = false;
                if (this.loopId) {
                    cancelAnimationFrame(this.loopId);
                    this.loopId = null;
                }
            } else {
                if (typeof AudioSystem !== 'undefined' && AudioSystem.ctx) AudioSystem.ctx.resume();
                // Resume if game was active
                if (!document.getElementById('lobby-screen').classList.contains('hidden') === false) {
                    if (this.players.length > 0 || this.buildings.length > 0) {
                        this.running = true;
                        this.loop();
                    }
                }
            }
        });
    },

    simulateLoading() {
        const bar = document.getElementById('loading-bar');
        const text = document.getElementById('loading-text');
        const btn = document.getElementById('btn-start-game');
        let progress = 0;

        const interval = setInterval(() => {
            progress += Math.random() * 5;
            if (progress > 100) progress = 100;
            if (bar) bar.style.width = `${progress}%`;

            if (progress < 30) { if (text) text.innerText = (typeof Lang !== 'undefined') ? Lang.getText('loading_system') : "System Initializing..."; }
            else if (progress < 80) { if (text) text.innerText = (typeof Lang !== 'undefined') ? Lang.getText('loading_assets') : "Loading Data..."; }
            else { if (text) text.innerText = (typeof Lang !== 'undefined') ? Lang.getText('loading_complete') : "Ready."; }

            if (progress >= 100) {
                clearInterval(interval);
                // [변경] 로딩 끝나면 바로 시작 버튼 표시
                if (btn) btn.classList.remove('hidden');
                if (text) text.classList.remove('animate-pulse');
            }
        }, 30);
    },

    completeLoading() {
        document.getElementById('loading-screen').classList.add('hidden');
        document.getElementById('lobby-screen').classList.remove('hidden');

        // [New] Play Lobby BGM (BGM 1)
        if (typeof AudioSystem !== 'undefined') {
            AudioSystem.init();
            AudioSystem.playMP3(1);
        }
    },

    openMapSelect(mode) {
        if (mode === 'online') {
            ui.showToast(Lang.getText('online_desc'));
            return;
        }
        document.getElementById('lobby-screen').classList.add('hidden');
        document.getElementById('map-select-screen').classList.remove('hidden');
    },

    showMapSelect() {
        // [FIX] Proper transition from loading to map selection
        document.getElementById('loading-screen').classList.add('hidden');
        document.getElementById('map-select-screen').classList.remove('hidden');

        // Initialize audio on first user interaction
        if (typeof AudioSystem !== 'undefined') {
            AudioSystem.init();
            AudioSystem.playMP3(1); // Play lobby BGM
        }
    },

    backToLobby() {
        this.running = false;
        if (this.loopId) cancelAnimationFrame(this.loopId);

        document.getElementById('end-screen').classList.add('hidden');
        document.getElementById('hud-minimap-container').classList.add('hidden');
        document.getElementById('hud-option-btn').classList.add('hidden');

        // [FIX] Show map selection instead of lobby (simplified flow)
        document.getElementById('map-select-screen').classList.remove('hidden');

        // Switch back to Lobby BGM
        if (typeof AudioSystem !== 'undefined') AudioSystem.playMP3(1);
    },

    startGame(mapType) {
        document.getElementById('map-select-screen').classList.add('hidden');
        Maps.currentMap = mapType || 'plain';
        this.start();
    },

    // [핵심] 흔들림 없는 리사이즈 로직
    resize() {
        const wrapper = document.getElementById('game-wrapper');
        const winW = window.innerWidth;
        const winH = window.innerHeight;

        // 1. 배율 계산 (세로 높이를 720px에 맞춤)
        // 화면이 작으면 알아서 축소(Zoom Out)되고, 크면 확대됩니다.
        this.scaleRatio = winH / LOGICAL_HEIGHT;

        // 2. 가로 길이 계산 (화면 비율에 따라 유동적으로 넓어짐)
        // 예: 가로 모드면 width가 1400px 이상으로 늘어나서 PC처럼 보임
        this.width = winW / this.scaleRatio;
        this.height = LOGICAL_HEIGHT; // 높이는 무조건 720 고정!

        // 3. 캔버스 크기 적용
        this.canvas.width = this.width;
        this.canvas.height = this.height;

        // 4. 땅 높이 고정 (절대 변하지 않음)
        // 화면을 돌려도 groundY는 항상 470px (720 - 250) 입니다.
        this.groundY = this.height - CONFIG.groundHeight;

        // 5. CSS 스타일 적용 (화면 꽉 채우기)
        if (wrapper) {
            wrapper.style.width = `${winW}px`;
            wrapper.style.height = `${winH}px`;
            // wrapper 자체를 scale로 줄이거나 늘려서 딱 맞춤
            // transform 대신 캔버스 내부 해상도를 조절했으므로 여기선 크기만 맞춤
            wrapper.style.transform = 'none';

            // 캔버스 스타일 강제 지정 (중요)
            this.canvas.style.width = '100%';
            this.canvas.style.height = '100%';
        }
    },

    initGameObjects() {
        // [NEW] Difficulty Stock Logic
        let stockMult = 1.0;
        let diff = 'veteran';
        if (typeof AI !== 'undefined' && AI.difficulty) diff = AI.difficulty;

        if (diff === 'recruit') {
            stockMult = 1.2; // 120%
        } else if (diff === 'elite') {
            stockMult = 0.6; // 60%
            console.log("Elite Difficulty: Player Stock Reduced to 60%");
        }

        for (let k in CONFIG.units) {
            this.cooldowns[k] = 0; this.enemyCooldowns[k] = 0;

            // Apply Multiplier
            let finalCount = Math.ceil(CONFIG.units[k].maxCount * stockMult);

            // [BUFF] Elite 난이도: 아군 드론 재고 보정
            if (diff === 'elite' && CONFIG.units[k].category === 'drone') {
                finalCount = Math.max(finalCount, Math.ceil(CONFIG.units[k].maxCount * 1.0) + 1);
            }

            // [NERF] Elite SPG Cap
            if (diff === 'elite' && k === 'spg') {
                finalCount = Math.min(finalCount, 3); // Max 3 SPGs on Elite
            }

            this.playerStock[k] = finalCount;
            this.enemyStock[k] = Math.ceil(CONFIG.units[k].maxCount * 1.5);
            this.spawnQueue[k] = 0;
        }

        this.totalWarTriggered = false; // Reset Total War
    },

    // [NEW] 적군 총력전 (Total War) 트리거
    triggerTotalWar() {
        if (this.totalWarTriggered || !this.running) return;
        this.totalWarTriggered = true;

        let delayCount = 0;
        const enemyHQ = this.buildings.find(b => b.type === 'hq_enemy');
        const spawnX = enemyHQ ? enemyHQ.x : CONFIG.mapWidth;

        for (let key in this.enemyStock) {
            const count = this.enemyStock[key];
            for (let i = 0; i < count; i++) {
                setTimeout(() => {
                    if (this.running) {
                        this.spawnUnitDirect(key, spawnX - 50 + (Math.random() * 60 - 30), this.groundY, 'enemy');
                    }
                }, delayCount * 150);
                delayCount++;
            }
            this.enemyStock[key] = 0;
        }
    },

    start() {
        // [FIX] ID 수정: start-screen은 존재하지 않으므로 loading-screen을 숨김
        document.getElementById('loading-screen')?.classList.add('hidden');
        document.getElementById('lobby-screen')?.classList.add('hidden');
        document.getElementById('end-screen').classList.add('hidden');

        // [New] Push history state when game starts
        history.pushState({ page: 'game' }, "Game", "#game");

        this.players = []; this.enemies = []; this.projectiles = []; this.particles = [];
        this.buildings = [];
        this.supply = CONFIG.startSupply; this.enemySupply = CONFIG.startSupply;
        this.empTimer = 0;
        this.skillCharges = { emp: 5, nuke: 1 };
        this.killCount = 0;

        // Recalculate groundY fresh to be sure
        this.resize();

        // [Safety] Ensure Map is selected
        if (typeof Maps !== 'undefined' && !Maps.currentMap) Maps.currentMap = 'plain';

        this.initGameObjects();
        this.running = true;
        this.cameraX = 0;

        // HUD
        document.getElementById('hud-minimap-container').classList.remove('hidden');
        document.getElementById('hud-option-btn').classList.remove('hidden');

        // [New] Play Game BGM (BGM 2)
        if (typeof AudioSystem !== 'undefined') {
            if (AudioSystem.ctx.state === 'suspended') AudioSystem.ctx.resume();
            AudioSystem.playMP3(2);
        }

        // AI
        if (typeof AI !== 'undefined') AI.lastSpawn = 0;

        // Map Setup
        this.buildings.push(new Building('hq_player', 150, this.groundY, 'player'));
        this.buildings.push(new Building('turret', 250, this.groundY, 'player'));
        this.buildings.push(new Building('hq_enemy', CONFIG.mapWidth - 150, this.groundY, 'enemy'));
        this.buildings.push(new Building('turret', CONFIG.mapWidth - 250, this.groundY, 'enemy'));

        // Neutral Bunkers
        [0.3, 0.5, 0.7].forEach(ratio => {
            this.buildings.push(new Building('bunker', CONFIG.mapWidth * ratio, this.groundY, 'neutral'));
        });

        this.loop();
    },

    setupInputs() {
        // [COORDINATE FIX] Universal Scaled Position Calculator
        const getScaledPos = (clientX, clientY) => {
            const wrapper = document.getElementById('game-wrapper');
            const rect = wrapper.getBoundingClientRect();

            // Works for both PC (rect.left=0, scale=1) and Mobile (Letterbox)
            return {
                x: (clientX - rect.left) / this.scaleRatio,
                y: (clientY - rect.top) / this.scaleRatio
            };
        };

        let dragging = false, lastX = 0;

        const startDrag = (x) => {
            if (!this.targetingType) {
                dragging = true;
                // We need to account for scale here too for accurate delta
                // But startDrag usually takes raw X? No, previously it took raw X.
                // Let's standardise: lastX should be in LOGICAL coordinates.
                // But x passed here is CLIENT X.

                // Get logical X for start point
                const wrapper = document.getElementById('game-wrapper');
                const rect = wrapper.getBoundingClientRect();
                lastX = (x - rect.left) / this.scaleRatio;
            }
        };

        const moveDrag = (clientX) => {
            if (this.targetingType) return;
            if (dragging) {
                const wrapper = document.getElementById('game-wrapper');
                const rect = wrapper.getBoundingClientRect();
                const currentX = (clientX - rect.left) / this.scaleRatio;

                this.cameraX -= (currentX - lastX);
                this.cameraX = Math.max(0, Math.min(this.cameraX, CONFIG.mapWidth - this.width));
                lastX = currentX;
            }
        };
        const endDrag = () => dragging = false;

        const click = (clientX, clientY) => {
            const p = getScaledPos(clientX, clientY);
            if (p.x < 0 || p.x > this.width || p.y < 0 || p.y > this.height) return; // Ignore outside clicks

            if (this.targetingType) {
                this.handleTargeting(p.x + this.cameraX, p.y);
            }
            if (this.checkBuildingClick) this.checkBuildingClick(p.x + this.cameraX, p.y);
        };

        // Events
        this.canvas.addEventListener('mousedown', e => { startDrag(e.clientX); click(e.clientX, e.clientY); });
        window.addEventListener('mousemove', e => moveDrag(e.clientX));
        window.addEventListener('mouseup', endDrag);

        this.canvas.addEventListener('touchstart', e => {
            startDrag(e.touches[0].clientX);
            click(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: false });
        window.addEventListener('touchmove', e => moveDrag(e.touches[0].clientX), { passive: false });
        window.addEventListener('touchend', endDrag);

        this.canvas.addEventListener('contextmenu', e => {
            e.preventDefault();
            const p = getScaledPos(e.clientX, e.clientY);
            this.commandDrones(p.x + this.cameraX, p.y);
        });
    },

    setCategory(cat) {
        this.currentCategory = cat;
        if (typeof ui !== 'undefined') {
            ui.updateCategoryTab(cat);
            ui.updateUnitButtons(cat, this.playerStock, this.cooldowns, this.supply, this.spawnQueue);
        }
    },

    // [FIX] Bunker Spawn Selection Stub (Prevent Crash)
    selectSpawn(bunker) {
        // Feature removed, but keeping method to prevent buildings.js crash
        this.selectedSpawn = bunker;
    },

    spawnUnitExecution(key) {
        const hq = this.buildings.find(b => b.type === 'hq_player');
        if (!hq) return;
        this.spawnUnitDirect(key, hq.x + 50, this.groundY, 'player');
    },

    prepareTargeting(key) {
        if (this.targetingType) return;
        const u = CONFIG.units[key];
        if (u.isSkill) {
            if (this.skillCharges[u.chargeKey] <= 0) { ui.showToast("사용 가능 횟수 부족!"); return; }
        } else {
            if (this.supply < u.cost || this.playerStock[key] <= 0) { ui.showToast("자원 또는 재고 부족!"); return; }
        }
        this.targetingType = key;
        document.getElementById('targeting-overlay').classList.remove('hidden');
        document.getElementById('target-msg').innerText = key === 'nuke' ? "전술핵 투하 지점 선택" : (key === 'emp' ? "EMP 투하 지점 선택" : `${u.name} 목표 지정`);
    },

    handleTargeting(x, y) {
        if (!this.targetingType) return;
        const key = this.targetingType;
        const u = CONFIG.units[key];

        if (key === 'nuke') {
            if (this.skillCharges.nuke > 0) {
                this.skillCharges.nuke--;
                const nuke = new Projectile(x, -500, null, 1000, 'player', 'nuke');
                nuke.targetX = x; nuke.targetY = this.groundY;
                this.projectiles.push(nuke);
                ui.showToast("전술핵 발사 감지!");
            }
        } else if (key === 'emp') {
            if (this.skillCharges.emp > 0) {
                this.skillCharges.emp--;
                ui.showToast("EMP 충격파 발생!");
                const targets = [...this.enemies, ...this.enemyBuildings];
                targets.forEach(e => { if (!e.dead && Math.abs(e.x - x) < 300 && (e.stats.type === 'mech' || e.stats.type === 'building')) e.stunTimer = 600; });
                this.createParticles(x, y, 20, '#ffffff');
            }
        } else {
            let target = null;
            let minDist = 300;
            const validTargets = [...this.enemies, ...this.enemyBuildings];
            validTargets.forEach(e => {
                const dy = e.y - (e.height ? e.height / 2 : 0) - y;
                const dx = e.x - x;
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d < minDist) { minDist = d; target = e; }
            });

            if (u.lockOn && !target) { ui.showToast("타겟을 찾을 수 없습니다!"); return; }

            this.supply -= u.cost;
            this.cooldowns[key] = u.cooldown;
            this.playerStock[key]--;

            const drone = new Unit(key, 50, this.groundY, 'player', target);
            if (key === 'blackhawk' || key === 'chinook') {
                drone.x = 40;
                drone.y = this.groundY - 190;
                drone.targetX = x;
                drone.targetY = this.groundY - 190;
            } else if (key === 'bomber_drone') {
                drone.x = 50;
                drone.y = this.groundY - 200;
                drone.targetX = x;
            } else if (!target) {
                drone.x = x; drone.y = y;
            }
            this.players.push(drone);
            ui.showToast(`${u.name} 출격!`);
        }
        this.cancelTargeting();
    },

    cancelTargeting() {
        this.targetingType = null;
        document.getElementById('targeting-overlay').classList.add('hidden');
    },

    commandDrones(x, y) {
        let count = 0;
        this.players.forEach(u => {
            if (u.stats.category === 'drone' || u.stats.id.startsWith('drone')) {
                if (['drone_suicide', 'drone_at'].includes(u.stats.id)) {
                    u.swarmTarget = { x: x, y: y };
                    u.lockedTarget = null;
                    count++;
                }
            }
        });
        if (count > 0) {
            ui.showToast(`드론 ${count}기 이동 명령!`);
            this.createParticles(x, y, 10, '#facc15');
        }
    },

    createParticles(x, y, count, color) {
        if (this.particles.length > 200) this.particles.splice(0, count);
        for (let i = 0; i < count; i++) this.particles.push(new Particle(x, y, color));
    },

    // Queue System
    startHold(key) {
        if (!this.running || this.holdTimer) return;
        this.holdKey = key;
        this.queueUnit(key);
        this.holdTimer = setInterval(() => { this.queueUnit(key); }, 150);
    },

    endHold(key) {
        if (this.holdKey !== key) return;
        if (this.holdTimer) { clearInterval(this.holdTimer); this.holdTimer = null; }
        this.holdKey = null;
    },

    queueUnit(key) {
        const u = CONFIG.units[key];

        // Special logic for targeting
        const needsTargeting = ['tactical_drone', 'bomber_drone', 'blackhawk', 'chinook', 'emp', 'nuke'].includes(key);
        if (needsTargeting) {
            // [FIX] Clear holdTimer value so startHold can run again.
            if (this.holdTimer) {
                clearInterval(this.holdTimer);
                this.holdTimer = null;
            }
            this.holdKey = null;

            this.prepareTargeting(key);
            return;
        }

        if (this.supply >= u.cost && this.playerStock[key] > 0) {
            this.supply -= u.cost;
            this.playerStock[key]--;
            this.spawnQueue[key]++;
        }
    },

    processQueue() {
        for (let key in this.spawnQueue) {
            if (this.spawnQueue[key] > 0) {
                if (this.cooldowns[key] <= 0) {
                    this.spawnUnitExecution(key);
                    this.spawnQueue[key]--;
                    this.cooldowns[key] = CONFIG.units[key].cooldown;
                }
            }
        }
    },

    spawnUnitDirect(key, x, y, team) {
        const unit = new Unit(key, x, y, team);
        if (team === 'player') this.players.push(unit);
        else this.enemies.push(unit);
    },

    spawnEnemy(key) {
        const u = CONFIG.units[key];
        if (this.enemySupply < u.cost || this.enemyCooldowns[key] > 0 || this.enemyStock[key] <= 0) return;
        const hq = this.buildings.find(b => b.type === 'hq_enemy');
        if (!hq) return;

        this.enemySupply -= u.cost;
        this.enemyCooldowns[key] = u.cooldown;
        this.enemyStock[key]--;
        this.spawnUnitDirect(key, hq.x - 50, this.groundY, 'enemy');
    },

    // [New] Speed Control
    speed: 1,

    setSpeed(s) {
        this.speed = s;
        ui.updateSpeedBtns(s);
    },

    loop() {
        if (!this.running) return;

        // [New] Speed Logic
        // 1x: Update once
        // 2x: Update twice
        // 0.5x: Update every other frame

        // [FIX] Use engineFrame to prevent freeze (game.frame only updates inside this.update)
        this.engineFrame = (this.engineFrame || 0) + 1;

        let updates = 1;
        if (this.speed === 2) updates = 2;
        else if (this.speed === 0.5 && this.engineFrame % 2 !== 0) updates = 0;

        try {
            for (let i = 0; i < updates; i++) {
                this.update();
            }
            this.draw();
        } catch (e) {
            console.error("Game Loop Error (Recovered):", e);
        }

        this.loopId = requestAnimationFrame(() => this.loop());
    },

    update() {
        this.frame++; // Always increment frame internally? No, frame should track logic ticks.
        // Actually, if we skip update, frame doesn't increment.
        // If we double update, frame increments twice.
        // This is correct for game logic time.

        if (this.supply < CONFIG.maxSupply) this.supply += CONFIG.supplyRate;
        if (this.enemySupply < CONFIG.maxSupply) this.enemySupply += CONFIG.supplyRate;

        this.processQueue();

        for (let k in this.cooldowns) if (this.cooldowns[k] > 0) this.cooldowns[k]--;
        for (let k in this.enemyCooldowns) if (this.enemyCooldowns[k] > 0) this.enemyCooldowns[k]--;
        if (this.empTimer > 0) {
            this.empTimer--;
            document.getElementById('emp-flash').classList.toggle('active', this.empTimer > 0);
        } else {
            document.getElementById('emp-flash').classList.remove('active');
        }

        this.buildings = this.buildings.filter(b => !b.dead);
        this.playerBuildings = this.buildings.filter(b => b.team === 'player');
        this.enemyBuildings = this.buildings.filter(b => b.team === 'enemy');

        const playerHQ = this.buildings.find(b => b.type === 'hq_player');
        const enemyHQ = this.buildings.find(b => b.type === 'hq_enemy');
        if (!playerHQ) this.endGame('lose', '작전 실패', '아군 본부가 파괴되었습니다.');
        else if (!enemyHQ) this.endGame('win', '작전 성공', '적군 본부를 파괴하고 지역을 장악했습니다.');

        this.players.forEach(u => u.update(this.enemies, this.enemyBuildings));
        this.enemies.forEach(u => u.update(this.players, this.playerBuildings));
        this.buildings.forEach(b => b.update(this.enemies, this.players));
        this.projectiles.forEach(p => p.update());
        this.particles.forEach(p => p.update());

        this.players = this.players.filter(u => !u.dead);
        this.enemies = this.enemies.filter(u => !u.dead);
        this.projectiles = this.projectiles.filter(p => !p.dead);
        this.particles = this.particles.filter(p => p.life > 0);

        if (typeof AI !== 'undefined') AI.update(this.frame);

        if (this.frame % 5 === 0) {
            this.renderUI();
            this.drawHUDMinimap();
        }
    },

    renderUI() {
        // [CHANGE][APP] UI 갱신 경로 단일화
        // - 기존: ui.updateUnitButtons(), ui.setSkillCount() ... 분산 호출
        // - 변경: app.commit() 한 번에서만 UI + 저장 처리
        if (typeof app !== 'undefined') app.commit('tick');
    },

    draw() {
        const ctx = this.ctx;
        if (typeof Maps !== 'undefined') {
            // [FIX] Pass this.cameraX to enable Parallax Scrolling
            Maps.drawBackground(ctx, this.width, this.height, this.groundY, this.cameraX);
        } else {
            ctx.fillStyle = '#bae6fd'; ctx.fillRect(0, 0, this.width, this.height);
        }

        ctx.save();
        ctx.translate(-Math.floor(this.cameraX), 0);
        this.buildings.forEach(b => b.draw(ctx));
        this.enemies.forEach(u => u.draw(ctx));
        this.players.forEach(u => u.draw(ctx));
        this.projectiles.forEach(p => p.draw(ctx));
        this.particles.forEach(p => p.draw(ctx));
        ctx.restore();


        if (!document.getElementById('map-modal').classList.contains('hidden')) this.drawHUDMinimap(); // Legacy support
    },

    toggleScope() {
        const modal = document.getElementById('scope-modal');
        modal.classList.toggle('hidden');
        ui.updateEnemyStatus(this.enemyStock);
    },

    toggleMap() {
        // Replaced by HUD
    },

    drawHUD() {
        const ctx = this.ctx;
        // 모바일 가로 모드인지 체크
        const isMobileLandscape = window.innerHeight < 600 && window.innerWidth > window.innerHeight;

        const fontSize = (this.width < 800) ? 16 : 24;
        const padding = (this.width < 800) ? 10 : 20;

        ctx.save();
        ctx.font = `bold ${fontSize}px "Orbitron", sans-serif`;
        ctx.textBaseline = 'top';
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 4;

        // [변경] 자원(SUPPLY) 표시 위치
        // 모바일 가로 모드면 -> 왼쪽 하단 (Bottom Left)
        // 그 외(PC/세로) -> 왼쪽 상단 (Top Left)
        let supplyX = padding;
        let supplyY = padding;

        if (isMobileLandscape) {
            supplyX = padding;
            supplyY = this.height - padding - 40; // 바닥에서 조금 위
        }

        // 1. Supply Text
        ctx.fillStyle = '#fbbf24';
        ctx.textAlign = 'left';
        ctx.fillText(`SUPPLY: ${Math.floor(this.supply)}`, supplyX, supplyY);

        // Supply Bar (Text 아래에)
        const barW = (this.width < 800) ? 100 : 150;
        const barH = (this.width < 800) ? 4 : 6;
        const ratio = Math.min(1, this.supply / CONFIG.maxSupply);

        ctx.fillStyle = '#4b5563';
        ctx.fillRect(supplyX, supplyY + fontSize + 5, barW, barH);
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(supplyX, supplyY + fontSize + 5, barW * ratio, barH);

        // 2. Kill Count (오른쪽 상단 유지)
        ctx.textAlign = 'right';
        ctx.fillStyle = '#ef4444';
        ctx.fillText(`KILLS: ${this.killCount || 0}`, this.width - padding, padding);

        // 3. Time (중앙 상단 유지)
        ctx.textAlign = 'center';
        ctx.fillStyle = 'white';
        const time = Math.floor(this.frame / 60);
        const min = Math.floor(time / 60).toString().padStart(2, '0');
        const sec = (time % 60).toString().padStart(2, '0');
        ctx.fillText(`${min}:${sec}`, this.width / 2, padding);

        ctx.restore();
    },

    drawHUDMinimap() {
        const cvs = document.getElementById('hud-minimap');
        if (!cvs) return;
        const ctx = cvs.getContext('2d');
        if (cvs.width !== cvs.clientWidth) { cvs.width = cvs.clientWidth; cvs.height = cvs.clientHeight; }

        ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, cvs.width, cvs.height);
        const scale = cvs.width / CONFIG.mapWidth;
        const groundY = cvs.height * 0.7;

        ctx.strokeStyle = '#334155'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, groundY); ctx.lineTo(cvs.width, groundY); ctx.stroke();

        this.buildings.forEach(b => {
            ctx.fillStyle = b.team === 'player' ? '#3b82f6' : (b.team === 'enemy' ? '#ef4444' : '#eab308');
            const w = Math.max(2, b.width * scale);
            const h = Math.max(2, b.height * scale);
            ctx.fillRect(b.x * scale - w / 2, groundY - h, w, h);
        });

        ctx.fillStyle = '#60a5fa'; this.players.forEach(u => ctx.fillRect(u.x * scale, groundY - 2, 2, 2));
        ctx.fillStyle = '#f87171'; this.enemies.forEach(u => ctx.fillRect(u.x * scale, groundY - 2, 2, 2));

        const cw = (this.width / CONFIG.mapWidth) * cvs.width;
        const cx = (this.cameraX / CONFIG.mapWidth) * cvs.width;
        ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 1; ctx.strokeRect(cx, 0, cw, cvs.height);
    },

    endGame(result, title, desc) {
        this.running = false;
        const s = document.getElementById('end-screen');
        s.classList.remove('hidden'); s.style.display = 'flex';
        document.getElementById('end-title').innerText = title;
        document.getElementById('end-title').className = `text-5xl font-bold mb-4 ${result === 'win' ? 'text-blue-500' : 'text-red-500'}`;
        document.getElementById('end-desc').innerText = desc;
    }
};

// ================================
// [ADD][APP] Minimal App Layer
// - commit() = 단일 갱신(저장 + UI)
// - migrate() = 스키마 고정 + 자동 보정
// - API = 앞으로 상태 변경은 app.* 로만 통과시키는 "확증형 슬롯"
// ================================
const app = {
    STORAGE_KEY: 'CT_STATE_V1',
    SCHEMA_VERSION: 1,

    _dirty: true,
    _lastSaveAt: 0,

    // ---- (1) 스냅샷 생성 (최소: 설정/통계만) ----
    _makeState() {
        const diff = (typeof AI !== 'undefined' && AI.difficulty) ? AI.difficulty : 'veteran';
        // lastMapId는 현재 코드에 "선택한 맵 id" 변수가 있으면 연결하고, 없으면 null
        const lastMapId = game.currentMapId || null;

        return {
            version: this.SCHEMA_VERSION,
            settings: {
                speed: Number(game.speed) || 1,
                difficulty: String(diff || 'veteran'),
                lastMapId: lastMapId ? String(lastMapId) : null,
            },
            stats: {
                killCount: Number(game.killCount) || 0,
            }
        };
    },

    // ---- (2) 마이그레이션(자동 보정) ----
    migrate(raw) {
        // raw가 null/undefined면 새로 생성
        if (!raw || typeof raw !== 'object') raw = { version: 0 };

        const v = Number(raw.version) || 0;

        // v0 -> v1 보정
        if (v < 1) {
            raw.version = 1;
            raw.settings = raw.settings || {};
            raw.stats = raw.stats || {};
        }

        // 타입/누락 보정
        if (!raw.settings || typeof raw.settings !== 'object') raw.settings = {};
        if (!raw.stats || typeof raw.stats !== 'object') raw.stats = {};

        const sp = Number(raw.settings.speed);
        raw.settings.speed = Number.isFinite(sp) ? sp : 1;

        raw.settings.difficulty = (typeof raw.settings.difficulty === 'string' && raw.settings.difficulty)
            ? raw.settings.difficulty
            : 'veteran';

        raw.settings.lastMapId = (raw.settings.lastMapId == null)
            ? null
            : String(raw.settings.lastMapId);

        const kc = Number(raw.stats.killCount);
        raw.stats.killCount = Number.isFinite(kc) ? kc : 0;

        raw.version = 1;
        return raw;
    },

    // ---- (3) 로드/세이브 ----
    load() {
        try {
            const s = localStorage.getItem(this.STORAGE_KEY);
            if (!s) return this.migrate(null);
            const parsed = JSON.parse(s);
            return this.migrate(parsed);
        } catch (e) {
            // 깨진 저장이면 초기화
            return this.migrate(null);
        }
    },

    saveNow() {
        try {
            const state = this._makeState();
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
            this._lastSaveAt = performance.now ? performance.now() : Date.now();
        } catch (e) {
            // localStorage 불가 환경이면 조용히 무시
        }
    },

    // ---- (4) 게임에 적용(최소: speed/difficulty/lastMapId) ----
    loadIntoGame() {
        const st = this.load();

        // speed 적용
        if (st.settings && Number.isFinite(st.settings.speed)) {
            game.setSpeed(st.settings.speed); // 내부에서 ui 버튼도 갱신됨
        }

        // difficulty는 AI가 가지고 있으면 반영
        if (typeof AI !== 'undefined' && st.settings && typeof st.settings.difficulty === 'string') {
            AI.difficulty = st.settings.difficulty;
        }

        // lastMapId(있으면) 보관만 해둠 (현재 코드에서 map선택 로직이 있으면 연결 가능)
        if (st.settings && st.settings.lastMapId) {
            game.currentMapId = st.settings.lastMapId;
        }

        this._dirty = true;
    },

    // ---- (5) Dirty + 단일 갱신(commit) ----
    markDirty() { this._dirty = true; },

    commit(reason = '') {
        // Always refresh UI; only save when state is dirty.
        const wasDirty = this._dirty;
        this._dirty = false;

        // UI refresh
        ui.updateUnitButtons(game.currentCategory, game.playerStock, game.cooldowns, game.supply, game.spawnQueue);
        ui.setSkillCount('emp', game.skillCharges.emp);
        ui.setSkillCount('nuke', game.skillCharges.nuke);

        if (!wasDirty) return;

        // Save state at most once per second
        const now = performance.now ? performance.now() : Date.now();
        if (now - this._lastSaveAt > 1000) this.saveNow();
    },

    // ---- (6) 확증형 슬롯(App API) 최소 제공 ----
    setSpeed(s) {
        game.setSpeed(s);
        this.markDirty();
    },
    addSupply(n) {
        const v = Number(n) || 0;
        game.supply = Math.max(0, (Number(game.supply) || 0) + v);
        this.markDirty();
    },
    spendSupply(n) {
        const v = Number(n) || 0;
        game.supply = Math.max(0, (Number(game.supply) || 0) - v);
        this.markDirty();
    },
    spawnUnitDirect(key, x, team) {
        // 앞으로는 game.spawnUnitDirect 직접 호출 대신 이걸로 통과시키면 됨
        game.spawnUnitDirect(key, x, game.groundY, team);
        this.markDirty();
    }
};

window.onload = () => game.init();
