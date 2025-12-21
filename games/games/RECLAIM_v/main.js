const game = {
    canvas: document.getElementById('game-canvas'),
    ctx: null, width: 0, height: 0, groundY: 0,
    frame: 0, running: false, cameraX: 0,
    
    players: [], enemies: [], projectiles: [], particles: [], buildings: [],
    supply: CONFIG.startSupply, enemySupply: CONFIG.startSupply,
    cooldowns: {}, playerStock: {}, enemyStock: {}, enemyCooldowns: {},
    skillCharges: { emp: 5, nuke: 1 },
    empTimer: 0, targetingType: null, killCount: 0,
    playerBuildings: [], enemyBuildings: [],

    holdTimer: null, holdCount: 0, holdKey: null,
    
    // [NEW] 분류 및 스폰 관련 변수
    currentCategory: 'infantry',
    selectedSpawn: null, // null이면 HQ, 아니면 Bunker 객체

    init() {
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.setupInputs();
        this.initGameObjects(); 
        this.renderUnitButtons(); // 초기 버튼 렌더링
    },

    resize() {
        this.width = window.innerWidth; this.height = window.innerHeight;
        this.canvas.width = this.width; this.canvas.height = this.height;
        this.groundY = this.height - CONFIG.groundHeight;
    },

    initGameObjects() {
        for(let k in CONFIG.units) {
            this.cooldowns[k] = 0; this.enemyCooldowns[k] = 0;
            this.playerStock[k] = CONFIG.units[k].maxCount;
            this.enemyStock[k] = Math.ceil(CONFIG.units[k].maxCount * 1.5);
        }
    },

    start() {
        document.getElementById('start-screen').classList.add('hidden');
        document.getElementById('end-screen').classList.add('hidden');
        this.players = []; this.enemies = []; this.projectiles = []; this.particles = [];
        this.buildings = [];
        this.supply = CONFIG.startSupply; this.enemySupply = CONFIG.startSupply;
        this.empTimer = 0; 
        this.skillCharges = { emp: 5, nuke: 1 }; 
        this.initGameObjects();
        this.running = true;
        this.cameraX = 0; 
        this.selectSpawn(null); // 시작 시 HQ 선택

        this.buildings.push(new Building('hq_player', 150, this.groundY, 'player'));
        this.buildings.push(new Building('turret', 250, this.groundY, 'player'));
        this.buildings.push(new Building('hq_enemy', CONFIG.mapWidth - 150, this.groundY, 'enemy'));
        this.buildings.push(new Building('turret', CONFIG.mapWidth - 250, this.groundY, 'enemy'));
        this.buildings.push(new Building('bunker', CONFIG.mapWidth * 0.3, this.groundY, 'neutral'));
        this.buildings.push(new Building('bunker', CONFIG.mapWidth * 0.5, this.groundY, 'neutral'));
        this.buildings.push(new Building('bunker', CONFIG.mapWidth * 0.7, this.groundY, 'neutral'));

        this.loop();
    },

    setupInputs() {
        let dragging = false, lastX = 0;
        const startDrag = (x) => { if (!this.targetingMode) { dragging = true; lastX = x; } };
        const moveDrag = (x) => {
            if (this.targetingMode) return;
            if (dragging) {
                this.cameraX -= (x - lastX);
                this.cameraX = Math.max(0, Math.min(this.cameraX, CONFIG.mapWidth - this.width));
                lastX = x;
            }
        };
        const endDrag = () => dragging = false;
        
        const click = (x, y) => { 
            if (this.targetingMode) {
                this.handleTargeting(x + this.cameraX, y); 
            } else {
                // [NEW] 맵 클릭 시 벙커 선택 로직
                this.checkBuildingClick(x + this.cameraX, y);
            }
        };

        this.canvas.addEventListener('mousedown', e => { startDrag(e.clientX); click(e.clientX, e.clientY); });
        window.addEventListener('mousemove', e => moveDrag(e.clientX));
        window.addEventListener('mouseup', endDrag);
        
        this.canvas.addEventListener('touchstart', e => { startDrag(e.touches[0].clientX); click(e.touches[0].clientX, e.touches[0].clientY); }, {passive:false});
        window.addEventListener('touchmove', e => moveDrag(e.touches[0].clientX), {passive:false});
        window.addEventListener('touchend', endDrag);
    },

    // [NEW] 건물 클릭 확인
    checkBuildingClick(wx, wy) {
        // 벙커를 클릭했는지 확인
        const clickedBunker = this.buildings.find(b => 
            b.type === 'bunker' && 
            b.team === 'player' && // 아군 벙커만
            Math.abs(b.x - wx) < b.width/2 + 20 &&
            wy > b.y - b.height && wy < b.y
        );

        if (clickedBunker) {
            this.selectSpawn(clickedBunker);
        } else {
            // 빈공간 클릭 시 HQ로 복귀 (선택 사항)
            // this.selectSpawn(null); 
        }
    },

    // [NEW] 스폰 포인트 선택
    selectSpawn(bunker) {
        this.selectedSpawn = bunker;
        const indicator = document.getElementById('spawn-indicator');
        
        if (bunker) {
            indicator.classList.remove('hidden');
            this.setCategory('infantry'); // 벙커는 보병부터 시작
        } else {
            indicator.classList.add('hidden');
            this.setCategory('infantry'); // HQ는 보병부터 시작
        }
        this.renderUnitButtons();
    },

    // [NEW] 카테고리 변경
    setCategory(cat) {
        // 벙커 모드일 때 기갑/공중/특수 탭 접근 금지
        if (this.selectedSpawn && !['infantry', 'drone'].includes(cat)) {
            this.showToast("전진 기지에서는 보병과 드론만 생산 가능합니다.");
            return;
        }

        this.currentCategory = cat;
        
        // 탭 스타일 업데이트
        document.querySelectorAll('.btn-category').forEach(btn => btn.classList.remove('active'));
        const tab = document.getElementById(`tab-${cat}`);
        if(tab) tab.classList.add('active');

        this.renderUnitButtons();
    },

    // [NEW] 유닛 버튼 동적 렌더링
    renderUnitButtons() {
        const container = document.getElementById('unit-list-container');
        container.innerHTML = ''; // 초기화

        const list = Object.keys(CONFIG.units).filter(k => CONFIG.units[k].category === this.currentCategory);

        list.forEach(k => {
            const u = CONFIG.units[k];
            const btn = document.createElement('button');
            btn.id = `btn-${k}`;
            btn.className = 'btn-unit relative w-16 h-14 md:w-20 md:h-16 rounded overflow-hidden shadow-lg flex flex-col items-center justify-center pt-1 shrink-0';
            
            // 아이콘 결정
            let iconClass = 'fa-solid fa-question';
            if (k === 'infantry') iconClass = 'fa-person-rifle';
            else if (k === 'rpg') iconClass = 'fa-person-military-pointing';
            else if (k === 'humvee') iconClass = 'fa-truck-pickup';
            else if (k === 'apc') iconClass = 'fa-bus';
            else if (k === 'aa_tank') iconClass = 'fa-truck-field';
            else if (k === 'mbt') iconClass = 'fa-truck-monster';
            else if (k === 'spg') iconClass = 'fa-bullseye';
            else if (k === 'fighter') iconClass = 'fa-jet-fighter';
            else if (k === 'apache') iconClass = 'fa-helicopter';
            else if (k.includes('drone')) iconClass = 'fa-ghost';

            // 버튼 내부 HTML
            btn.innerHTML = `
                <i class="${iconClass} text-${u.color.replace('#','')} mb-1 text-xs" style="color:${u.color}"></i>
                <span class="font-bold text-[10px] z-10">${u.name}</span>
                <span id="info-${k}" class="count-text z-10">--</span>
                <div id="cd-${k}" class="cooldown-overlay absolute bottom-0 left-0 w-full bg-black/60 z-20 h-0"></div>
                <div class="absolute bottom-0 w-full h-1" style="background-color:${u.color}"></div>
            `;

            // 이벤트 바인딩 (PC/Mobile)
            btn.onmousedown = (e) => { e.stopPropagation(); this.startHold(k); };
            btn.onmouseup = (e) => { e.stopPropagation(); this.endHold(k); };
            btn.onmouseleave = () => this.endHold(k);
            btn.ontouchstart = (e) => { e.stopPropagation(); e.preventDefault(); this.startHold(k); };
            btn.ontouchend = (e) => { e.stopPropagation(); e.preventDefault(); this.endHold(k); };

            container.appendChild(btn);
        });
        
        this.updateUI(); // 상태 즉시 업데이트
    },

    startHold(key) {
        if (!this.running || this.holdTimer) return;
        this.holdKey = key;
        this.holdCount = 1;
        this.showToast(`${CONFIG.units[key].name} 생산 대기: 1`);
        
        this.holdTimer = setInterval(() => {
            if (this.holdCount < 10) {
                this.holdCount++;
                this.showToast(`${CONFIG.units[this.holdKey].name} 생산 대기: ${this.holdCount}`);
            }
        }, 150);
    },

    endHold(key) {
        if (this.holdKey !== key) return;
        if (this.holdTimer) {
            clearInterval(this.holdTimer);
            this.holdTimer = null;
        }
        
        if (key.startsWith('drone') || key === 'tactical_drone') {
            this.prepareDrone(key);
        } else {
            for(let i=0; i<this.holdCount; i++) {
                this.spawnUnit(key);
            }
        }
        this.holdKey = null;
        this.holdCount = 0;
    },

    loop() {
        if (!this.running) return;
        try {
            this.update();
            this.draw();
        } catch (e) {
            console.error("Game Loop Error:", e);
        }
        requestAnimationFrame(() => this.loop());
    },

    update() {
        this.frame++;
        if (this.supply < CONFIG.maxSupply) this.supply += CONFIG.supplyRate;
        if (this.enemySupply < CONFIG.maxSupply) this.enemySupply += CONFIG.supplyRate;
        
        if (this.empTimer > 0) {
            this.empTimer--;
            document.getElementById('emp-flash').classList.toggle('active', this.empTimer > 0);
        } else {
            document.getElementById('emp-flash').classList.remove('active');
        }

        for(let k in this.cooldowns) if(this.cooldowns[k] > 0) this.cooldowns[k]--;
        for(let k in this.enemyCooldowns) if(this.enemyCooldowns[k] > 0) this.enemyCooldowns[k]--;

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

        if (this.frame % 120 === 0) this.enemyAI();
        this.updateUI();
    },

    enemyAI() {
        const wave = Math.floor(this.frame / 600);
        const r = Math.random();
        
        const enemyHQ = this.buildings.find(b => b.type === 'hq_enemy');
        if (enemyHQ) {
            const danger = this.players.some(p => Math.abs(p.x - enemyHQ.x) < 800);
            if (danger && Math.random() < 0.7) { this.spawnEnemy('mbt'); return; }
        }

        if (wave > 2 && r < 0.15) this.spawnEnemy('fighter');
        else if (wave > 1 && r < 0.3) this.spawnEnemy('aa_tank');
        else if (r < 0.5) this.spawnEnemy('infantry');
        else if (r < 0.7) this.spawnEnemy('apc');
        else if (r < 0.85) this.spawnEnemy('mbt');
        else this.spawnEnemy('humvee');
    },

    draw() {
        const ctx = this.ctx;
        const grad = ctx.createLinearGradient(0, 0, 0, this.height);
        grad.addColorStop(0, '#bae6fd'); grad.addColorStop(1, '#e0f2fe'); 
        ctx.fillStyle = grad; ctx.fillRect(0, 0, this.width, this.height);

        ctx.save();
        ctx.translate(-Math.floor(this.cameraX), 0);
        
        ctx.fillStyle = '#86efac'; 
        ctx.fillRect(0, this.groundY, CONFIG.mapWidth, CONFIG.groundHeight);
        ctx.strokeStyle = '#4ade80';
        ctx.beginPath();
        for(let i=0; i<CONFIG.mapWidth; i+=200) { ctx.moveTo(i, this.groundY); ctx.lineTo(i, this.height); }
        ctx.stroke();

        this.buildings.forEach(b => b.draw(ctx));
        this.enemies.forEach(u => u.draw(ctx));
        this.players.forEach(u => u.draw(ctx));
        this.projectiles.forEach(p => p.draw(ctx));
        this.particles.forEach(p => p.draw(ctx));
        
        ctx.restore();
        if (!document.getElementById('map-modal').classList.contains('hidden')) this.drawMinimap();
    },

    spawnUnit(key) {
        if (!this.running) return;
        const u = CONFIG.units[key];
        if (this.supply < u.cost || this.cooldowns[key] > 0 || this.playerStock[key] <= 0) return;
        
        // [UPDATE] 스폰 위치 결정
        let spawnX, spawnY;
        if (this.selectedSpawn) {
            spawnX = this.selectedSpawn.x;
            spawnY = this.selectedSpawn.y;
        } else {
            const hq = this.buildings.find(b => b.type === 'hq_player');
            if (!hq) { this.showToast("본부가 파괴되어 생산 불가!"); return; }
            spawnX = hq.x + 50;
            spawnY = this.groundY;
        }

        this.supply -= u.cost;
        this.cooldowns[key] = u.cooldown;
        this.playerStock[key]--;
        this.spawnUnitDirect(key, spawnX, this.groundY, 'player');
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

    prepareDrone(key) {
        if (this.supply < CONFIG.units[key].cost || this.playerStock[key] <= 0) return;
        this.targetingMode = key;
        document.getElementById('targeting-overlay').classList.remove('hidden');
        document.getElementById('target-msg').innerText = key==='tactical_drone' ? "전술드론 락온 대상 선택" : "드론 목표 지점/대상 선택";
    },

    useSkill(type) {
        if (this.skillCharges[type] <= 0) { this.showToast("사용 횟수 초과"); return; }
        if (type === 'emp') {
            this.skillCharges.emp--;
            this.empTimer = 450; 
            this.showToast("EMP 발동! 적 시스템 마비!");
        } else if (type === 'nuke') {
            this.targetingMode = 'nuke';
            document.getElementById('targeting-overlay').classList.remove('hidden');
            document.getElementById('target-msg').innerText = "전술핵 타격 좌표 지정";
        }
    },

    handleTargeting(x, y) {
        if (this.targetingMode === 'nuke') {
            this.skillCharges.nuke--;
            const nuke = new Projectile(x, -500, null, 1000, 'player', 'nuke');
            nuke.targetX = x; nuke.targetY = this.groundY;
            this.projectiles.push(nuke);
            this.showToast("전술핵 발사 감지!");
        } else {
            const u = CONFIG.units[this.targetingMode];
            
            // [UPDATE] 타겟팅 로직 (전술 드론은 적 유닛 우선)
            let target = null;
            let minDist = 300;
            
            [...this.enemies, ...this.enemyBuildings].forEach(e => {
                // 클릭한 좌표 근처인지 확인
                const dy = e.y - (e.height ? e.height/2 : 0) - y;
                const dx = e.x - x;
                const d = Math.sqrt(dx*dx + dy*dy);
                if(d < minDist) { minDist = d; target = e; }
            });

            // 전술드론은 타겟 필수
            if (this.targetingMode === 'tactical_drone' && !target) {
                this.showToast("타겟을 찾을 수 없습니다!");
                return;
            }

            this.supply -= u.cost;
            this.cooldowns[this.targetingMode] = u.cooldown;
            this.playerStock[this.targetingMode]--;

            const drone = new Unit(this.targetingMode, 150, this.groundY, 'player', target);
            if(!target) { drone.x = x; drone.y = y; }
            this.players.push(drone);
            this.showToast(this.targetingMode==='tactical_drone' ? "전술드론 락온!" : "드론 출격!");
        }
        this.cancelTargeting();
    },

    cancelTargeting() {
        this.targetingMode = null;
        document.getElementById('targeting-overlay').classList.add('hidden');
    },

    showToast(msg) {
        const t = document.getElementById('toast-msg');
        if(!t) return;
        t.innerText = msg; t.classList.remove('hidden'); t.style.opacity = 1;
        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => { t.style.opacity = 0; setTimeout(() => t.classList.add('hidden'), 500); }, 3000);
    },

    createParticles(x, y, count, color) {
        for(let i=0; i<count; i++) this.particles.push(new Particle(x, y, color));
    },

    updateUI() {
        // [UPDATE] 버튼 상태만 업데이트 (생성은 renderUnitButtons에서 함)
        for(let k in CONFIG.units) {
            const btn = document.getElementById(`btn-${k}`);
            if(!btn) continue;
            
            const cd = document.getElementById(`cd-${k}`);
            const info = document.getElementById(`info-${k}`);
            const u = CONFIG.units[k];
            
            if(info) info.innerText = this.playerStock[k];
            
            const ratio = this.cooldowns[k] / u.cooldown;
            if(cd) cd.style.height = `${ratio * 100}%`;
            
            if (this.supply < u.cost || this.playerStock[k] <= 0) btn.classList.add('btn-disabled');
            else btn.classList.remove('btn-disabled');
        }

        const empBtn = document.getElementById('btn-emp');
        if (empBtn) {
            document.getElementById('cnt-emp').innerText = this.skillCharges.emp + "발";
            if (this.skillCharges.emp <= 0) empBtn.classList.add('used');
        }
        const nukeBtn = document.getElementById('btn-nuke');
        if (nukeBtn) {
            document.getElementById('cnt-nuke').innerText = this.skillCharges.nuke + "발";
            if (this.skillCharges.nuke <= 0) nukeBtn.classList.add('used');
        }
    },

    toggleMap() {
        document.getElementById('map-modal').classList.toggle('hidden');
        document.getElementById('scope-modal').classList.add('hidden');
    },
    
    toggleScope() {
        const modal = document.getElementById('scope-modal');
        modal.classList.toggle('hidden');
        document.getElementById('map-modal').classList.add('hidden');

        if (!modal.classList.contains('hidden')) {
            const tbody = document.getElementById('enemy-status-tbody');
            tbody.innerHTML = '';
            for (let k in this.enemyStock) {
                const count = this.enemyStock[k];
                const data = CONFIG.units[k];
                if (!data) continue; 
                let statusClass = 'text-green-400';
                let statusText = '양호';
                if (count <= 0) { statusClass = 'text-red-500 font-bold'; statusText = '전멸'; } 
                else if (count < 3) { statusClass = 'text-yellow-400'; statusText = '위험'; }
                tbody.innerHTML += `<tr><td>${data.name}</td><td class="text-right ${count<=0?'text-gray-600 line-through':''}">${count}</td><td class="text-right ${statusClass}">${statusText}</td></tr>`;
            }
        }
    },

    drawMinimap() {
        const cvs = document.getElementById('map-canvas');
        const ctx = cvs.getContext('2d');
        if (cvs.width !== cvs.clientWidth) { cvs.width = cvs.clientWidth; cvs.height = cvs.clientHeight; }
        
        ctx.fillStyle = '#020617'; ctx.fillRect(0, 0, cvs.width, cvs.height);
        const scale = cvs.width / CONFIG.mapWidth;
        const groundY = cvs.height * 0.7;
        
        ctx.strokeStyle = '#475569'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, groundY); ctx.lineTo(cvs.width, groundY); ctx.stroke();
        
        this.buildings.forEach(b => {
            ctx.fillStyle = b.team==='player'?'#3b82f6':(b.team==='enemy'?'#ef4444':'#eab308');
            const w = Math.max(4, b.width * scale);
            ctx.fillRect(b.x * scale - w/2, groundY - 6, w, 6);
        });

        ctx.fillStyle = '#60a5fa'; this.players.forEach(u => ctx.fillRect(u.x*scale, groundY-4, 4, 4));
        ctx.fillStyle = '#f87171'; this.enemies.forEach(u => ctx.fillRect(u.x*scale, groundY-4, 4, 4));

        const cw = (this.width / CONFIG.mapWidth) * cvs.width;
        const cx = (this.cameraX / CONFIG.mapWidth) * cvs.width;
        ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 1; ctx.strokeRect(cx, 2, cw, cvs.height-4);
    },

    endGame(result, title, desc) {
        this.running = false;
        const s = document.getElementById('end-screen');
        s.classList.remove('hidden'); s.style.display = 'flex';
        document.getElementById('end-title').innerText = title;
        document.getElementById('end-title').className = `text-5xl font-bold mb-4 ${result==='win'?'text-blue-500':'text-red-500'}`;
        document.getElementById('end-desc').innerText = desc;
    }
};

window.onload = () => game.init();