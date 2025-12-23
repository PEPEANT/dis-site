class Entity {
    constructor(x, y, team, hp, width, height) {
        this.x = x; this.y = y; this.team = team;
        this.maxHp = hp; this.hp = hp;
        this.width = width; this.height = height;
        this.dead = false;
        this.hideHp = false; // [NEW] Icon rendering flag
    }
    drawHp(ctx) {
        if (this.dead) return;
        if (this.hideHp) return;
        const w = this.width; const h = 3;
        const y = this.y - this.height - 8;
        ctx.fillStyle = '#1e293b'; ctx.fillRect(this.x - w / 2, y, w, h);
        const pct = Math.max(0, this.hp / this.maxHp);
        ctx.fillStyle = this.team === 'player' ? '#2563eb' : (this.team === 'enemy' ? '#dc2626' : (this.team === 'neutral' ? '#94a3b8' : '#eab308'));
        ctx.fillRect(this.x - w / 2, y, w * pct, h);
    }
}

// Building class moved to buildings.js

class Unit extends Entity {
    constructor(typeKey, x, groundY, team, lockedTarget = null) {
        // [FIX] Invalid Unit Type Safety
        if (!CONFIG.units[typeKey]) {
            console.error(`Unit type '${typeKey}' not found! Defaulting to 'infantry'`);
            typeKey = 'infantry';
        }

        const stats = CONFIG.units[typeKey];
        if (!stats) return; // double safety

        let startY = groundY;
        // [FIX] Bomber Drone Height adjustment (Higher than before)
        if (stats.id === 'bomber_drone') startY = groundY - 350 - Math.random() * 50;
        else if (stats.type === 'air') startY = groundY - 150 - Math.random() * 100;

        super(x, startY, team, stats.hp, stats.width, stats.height);
        this.stats = stats;
        this.lastAttack = 0;
        this.lastBomb = 0;
        this.rotorAngle = 0;
        this.lockedTarget = lockedTarget;
        this.stunTimer = 0;
        this.evasion = (stats.category === 'drone'); // [NEW] Drone Evasion Flag
        this.deployed = false; // [NEW] APC ?섏감 ?щ?
        this.returnToBase = false;
        this.attackTarget = null; // [OPTIMIZATION] Sticky Targeting
        this.flareUsed = false; // [NEW] Air units can flare once
        this.exiting = false; // [NEW] Transport exit state
        this.targetX = null;
        this.targetY = null;
    }

    takeDamage(damage) {
        if (this.dead) return;
        
        // [수정] 치누크와 블랙호크는 무적 상태여도 데미지를 받도록 예외 처리 (공중 요격 가능)
        if (this.stats && this.stats.invulnerable) {
            if (!['chinook', 'blackhawk'].includes(this.stats.id)) return;
        }

        const dmg = Number(damage) || 0;
        if (!Number.isFinite(this.hp)) this.hp = this.maxHp;
        this.hp -= dmg;
        if (this.hp < 0) this.hp = 0;

        // [APC] 전투 하차 (첫 피격 시)
        if (this.stats.id === 'apc' && !this.deployed && this.hp < this.maxHp) {
            this.deployed = true;
            if (game && game.spawnUnitDirect) {
                for (let i = 0; i < 4; i++) game.spawnUnitDirect('infantry', this.x + (Math.random() * 40 - 20), game.groundY, this.team);
            }
        }

        if (this.hp <= 0) {
            this.dead = true;
            if (this.team === 'enemy') game.killCount++;
        }
    }

    update(enemies, buildings) {
        if (this.dead) return;

        // 스턴 상태 (EMP 등)
        if (this.stunTimer > 0) {
            this.stunTimer--;
            if (game.frame % 20 === 0) game.createParticles(this.x, this.y, 1, '#60a5fa');
            return;
        }

        if (this.stats.type === 'air') this.rotorAngle += 0.8;

        // [수정] 플레어 로직 (드론이 멈추지 않고 지나가게 함)
        if (this.stats.type === 'air' && this.stats.category !== 'drone' && this.stats.id !== 'tactical_drone' && !this.flareUsed) {
            const flareRange = 150;
            const candidates = (this.team === 'player') ? game.enemies : game.players;
            let nearest = null;
            let bestD = flareRange + 1;
            
            for (const u of candidates) {
                if (!u || u.dead || !u.stats) continue;
                // 드론 카테고리이거나 id에 drone이 포함된 경우 (전술드론 제외)
                if ((u.stats.category === 'drone' || u.stats.id.includes('drone')) && u.stats.id !== 'tactical_drone') {
                    const d = Math.abs(u.x - this.x);
                    if (d < bestD) { bestD = d; nearest = u; }
                }
            }

            if (nearest) {
                this.flareUsed = true;
                
                // [수정] 드론을 멈추는게 아니라 타겟을 잃고 혼란 상태로 만듦 (그냥 지나감)
                nearest.lockedTarget = null;
                nearest.confusedTimer = 180; // 3초간 타겟팅 불가 (drones.js에서 처리)
                
                // [디자인] 플레어: 뒤에서 노란 불꽃이 뿜어져 나옴
                const dir = this.team === 'player' ? -1 : 1; // 뒤쪽 방향
                for(let i=0; i<8; i++) {
                    game.createParticles(this.x + (dir * 20), this.y, 1, '#facc15'); // 노랑
                    game.createParticles(this.x + (dir * 25), this.y + (Math.random()*20-10), 1, '#ffffff'); // 연기
                }
                
                if (typeof AudioSystem !== 'undefined') AudioSystem.playSFX('emp'); // 플레어 사운드 대용
            }
        }

        // 드론 업데이트
        if (this.stats.id.startsWith('drone') || this.stats.id === 'tactical_drone' || this.stats.id === 'bomber_drone') {
            this.updateDrone(enemies, buildings);
            return;
        }

        // 공중 유닛 맵 이탈 처리 (귀환)
        if (this.stats.type === 'air' && !this.stats.id.startsWith('drone') && !['blackhawk', 'chinook'].includes(this.stats.id)) {
            const isOut = (this.team === 'player' && this.x > CONFIG.mapWidth + 100) || (this.team === 'enemy' && this.x < -100);
            if (isOut) {
                this.dead = true;
                if (this.team === 'player') game.playerStock[this.stats.id]++;
                else game.enemyStock[this.stats.id]++;
                return;
            }
        }

        // [수정] 수송 헬기 로직 (블랙호크 버그 수정 포함)
        if (['blackhawk', 'chinook'].includes(this.stats.id)) {
            if (this.targetX === undefined || this.targetX === null) this.targetX = this.x;
            const deployY = game.groundY - 80;

            // 치누크: 이동 -> 투하 -> 상승 이탈
            if (this.stats.id === 'chinook') {
                if (this.exiting) {
                    this.y -= 2.0; // 수직 상승
                    if (this.y < -200) this.dead = true;
                } else if (this.deployed) {
                    this.exiting = true; 
                } else {
                    const dx = this.targetX - this.x;
                    const dy = deployY - this.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const speed = this.stats.speed || 2.5;

                    if (dist < 20) {
                        this.deployed = true;
                        if (game && game.spawnUnitDirect) {
                            for (let i = 0; i < 10; i++) {
                                setTimeout(() => {
                                    if (game.running) game.spawnUnitDirect('infantry', this.x + (Math.random() * 60 - 30), game.groundY, this.team);
                                }, i * 100);
                            }
                        }
                    } else {
                        this.x += (dx / dist) * speed;
                        this.y += (dy / dist) * (speed * 0.8);
                    }
                }
                return; // 치누크는 공격 안함
            }
            
            // [수정] 블랙호크: 이동 -> 투하 -> **전투 모드 전환**
            if (this.stats.id === 'blackhawk') {
                if (!this.deployed) {
                    const dx = this.targetX - this.x;
                    const dy = deployY - this.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const speed = this.stats.speed || 3.0;

                    if (dist < 20) {
                        this.deployed = true;
                        // 특수부대 투하
                        if (game && game.spawnUnitDirect) {
                            for (let i = 0; i < 4; i++) {
                                setTimeout(() => {
                                    if (game.running) game.spawnUnitDirect('special_forces', this.x + (Math.random() * 40 - 20), game.groundY, this.team);
                                }, i * 150);
                            }
                        }
                        // [중요] 투하 후 즉시 공격 타겟 찾도록 리셋
                        this.attackTarget = null; 
                    } else {
                        this.x += (dx / dist) * speed;
                        this.y += (dy / dist) * (speed * 0.8);
                        return; // 이동 중에는 공격 안함
                    }
                }
                // deployed === true면 아래 일반 전투 로직으로 넘어감 (공격 헬기로 변신)
            }
        }

        // 전략 폭격기
        if (this.stats.id === 'bomber') {
            const dir = this.team === 'player' ? 1 : -1;
            this.x += this.stats.speed * dir;
            if (game.frame - this.lastBomb > 20 && this.x > 0 && this.x < CONFIG.mapWidth) {
                const targets = [...enemies, ...buildings];
                const hasTarget = targets.some(t => t && !t.dead && t.team !== 'neutral' && !(t.stats && t.stats.invulnerable) && Math.abs(t.x - this.x) < 50);
                if (hasTarget) {
                    game.projectiles.push(new Projectile(this.x, this.y, null, this.stats.damage, this.team, 'bomb'));
                    this.lastBomb = game.frame;
                }
            }
            return;
        }

        // 전투기
        if (this.stats.id === 'fighter') {
            const dir = this.team === 'player' ? 1 : -1;
            this.x += this.stats.speed * dir;

            if (this.attackTarget && (this.attackTarget.dead || (this.attackTarget.stats && this.attackTarget.stats.invulnerable) || Math.abs(this.attackTarget.x - this.x) > 600)) {
                this.attackTarget = null;
            }
            if (!this.attackTarget) {
                this.attackTarget = enemies.find(e =>
                    !e.dead && e.stats && !e.stats.invulnerable &&
                    (e.stats.type === 'air' || e.stats.id === 'aa_tank') &&
                    e.stats.category !== 'drone' &&
                    Math.abs(e.x - this.x) < 550
                );
            }
            const target = this.attackTarget;
            if (target && game.frame - this.lastAttack > 10) {
                let dmg = this.stats.damage;
                // 고도 우위 보너스
                if (target.stats.type === 'air') {
                    const heightDiff = target.y - this.y;
                    if (heightDiff > 10) dmg *= (1 + Math.min(0.5, heightDiff / 200));
                }
                if (target.stats.id === 'aa_tank') dmg *= 0.5;

                game.projectiles.push(new Projectile(this.x, this.y, target, dmg, this.team, 'machinegun'));
                this.lastAttack = game.frame;
            }
            return;
        }

        // [일반 전투 로직] (지상 유닛, 아파치, **전개된 블랙호크**)
        if (this.attackTarget) {
            const dist = Math.abs(this.attackTarget.x - this.x);
            const isStealth = this.attackTarget.stats && this.attackTarget.stats.stealth;
            const isInvulnerable = this.attackTarget.stats && this.attackTarget.stats.invulnerable;

            if (this.attackTarget.dead ||
                dist > this.stats.range + 50 ||
                this.attackTarget.team === this.team ||
                this.attackTarget.team === 'neutral' ||
                isInvulnerable ||
                (isStealth && dist > 100)) {
                this.attackTarget = null;
            }
        }

        if (!this.attackTarget) {
            let bestScore = Infinity;
            const canHitAir = this.stats.antiAir || this.stats.type === 'air' || ['humvee', 'apc'].includes(this.stats.id);

            for (let e of enemies) {
                if (!e || e.dead || (e.stats && (e.stats.stealth || e.stats.invulnerable))) continue;
                if (this.stats.id === 'humvee' && e.stats.id === 'fighter') continue;
                if (e.stats.type === 'air' && !canHitAir) continue;

                const dist = Math.abs(e.x - this.x);
                if (dist > this.stats.range) continue;

                let score = dist;
                // 대공 유닛은 항공기 우선
                if (this.stats.antiAir && e.stats.type === 'air') score -= 2000;
                else if (!this.stats.antiAir && e.stats.type === 'air') score += 2000;

                if (score < bestScore) { bestScore = score; this.attackTarget = e; }
            }

            // 적 유닛 없으면 건물 타격
            if (!this.attackTarget) {
                for (let b of buildings) {
                    if (!b || b.dead || b.team === this.team || b.team === 'neutral') continue;
                    const dist = Math.abs(b.x - this.x);
                    if (dist > this.stats.range + b.width / 2) continue;
                    if (dist < bestScore) { bestScore = dist; this.attackTarget = b; }
                }
            }
        }

        const target = this.attackTarget;
        const isAttacking = (target !== null) && !(this.team === 'enemy' && game.empTimer > 0);

        if (isAttacking) {
            let rate = 60;
            // [수정] 블랙호크도 빠른 연사 (15프레임) 적용
            if (['humvee', 'apc', 'aa_tank', 'turret', 'blackhawk'].includes(this.stats.id)) rate = 15;
            else if (this.stats.id === 'spg') rate = 300;

            if (game.frame - this.lastAttack > rate) {
                this.attack(target);
                this.lastAttack = game.frame;
            }
        } else {
            // 공격 대상이 없으면 전진
            const moveDir = this.team === 'player' ? 1 : -1;
            this.x += this.stats.speed * moveDir;
        }
    }

    updateDrone(enemies, buildings) {
        if (typeof DroneBehavior !== 'undefined') {
            DroneBehavior.update(this, enemies, buildings);
        } else {
            this.dead = true;
        }
    }

    findNearestEnemy(enemies, buildings) {
        let t = null; let min = 9999;
        [...enemies, ...buildings].forEach(e => {
            if (e && !e.dead && e.team !== this.team && e.team !== 'neutral') {
                const d = Math.abs(e.x - this.x);
                if (d < min) { min = d; t = e; }
            }
        });
        return t;
    }

    explode(target) {
        if (this.dead || this.exploded) return;
        this.dead = true;
        this.exploded = true;
        try {
            // [OPTIMIZATION] Particle count reduced from 40 to 20 for performance
            if (game && game.createParticles) game.createParticles(this.x, this.y, 20, '#f59e0b');

            // [New] SFX
            if (typeof AudioSystem !== 'undefined') AudioSystem.playSFX('explode');

            if (target && !target.dead && typeof target.takeDamage === 'function') {
                target.takeDamage(this.stats.damage);
            }

            if (this.stats.splash) {
                // [SAFETY] 諛곗뿴 蹂듭궗 諛??먭린 ?먯떊 ?쒖쇅, 媛쒕퀎 ?먮윭 罹먯튂
                const targetsList = this.team === 'player' ? game.enemies : game.players;
                if (targetsList) {
                    [...targetsList].forEach(e => {
                        if (e && !e.dead && e !== this && Math.abs(e.x - this.x) < 150) {
                            try { e.takeDamage(150); } catch (err) { }
                        }
                    });
                }
            }
        } catch (e) { console.error("Explode error:", e); }
    }

    attack(target) {
        if (!game || !game.projectiles) return;
        if (target && target.stats && target.stats.invulnerable) return;
        const id = this.stats.id;
        let dmg = this.stats.damage;

        if (id === 'humvee' && target.stats && target.stats.type === 'air') {
            dmg = Math.max(1, Math.floor(dmg * 0.2));
        }
        if (['aa_tank', 'turret'].includes(id) && target.stats && target.stats.id === 'bomber') {
            dmg *= 1.6;
        }
        if (this.stunTimer > 0) return;

        // [수정] 발사체 타입 설정 (블랙호크 추가)
        let type = 'bullet';
        if (['spg'].includes(id)) type = 'artillery';
        else if (['mbt'].includes(id)) type = 'shell';
        else if (['apache', 'rpg'].includes(id)) type = 'rocket';
        else if (['aa_tank', 'turret'].includes(id)) type = 'aa_shell';
        else if (['humvee', 'apc', 'blackhawk', 'fighter'].includes(id)) type = 'machinegun'; 

        if (typeof AudioSystem !== 'undefined' && Math.random() < 0.3) AudioSystem.playSFX('shoot');

        try {
            game.projectiles.push(new Projectile(this.x, this.y - this.height / 2, target, dmg, this.team, type));
        } catch (e) { }
    }

    draw(ctx) {
        if (this.dead) return;
        ctx.save();
        ctx.translate(this.x, this.y);

        // ... (전술 드론 락온 박스 코드는 그대로 유지) ...
        if (this.stats.id === 'tactical_drone' && this.lockedTarget && !this.lockedTarget.dead) {
            ctx.save();
            ctx.translate(-this.x, -this.y);
            const tx = this.lockedTarget.x;
            const ty = this.lockedTarget.y - (this.lockedTarget.height ? this.lockedTarget.height / 2 : 0);
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 2]);
            ctx.strokeRect(tx - 20, ty - 20, 40, 40);
            ctx.fillStyle = '#ef4444';
            ctx.font = 'bold 10px sans-serif';
            ctx.fillText("LOCK ON", tx - 22, ty - 25);
            ctx.restore();
        }

        let flip = (this.team === 'enemy');
        if (this.team === 'player' && this.returnToBase) flip = true;
        if (flip) ctx.scale(-1, 1);
        ctx.fillStyle = this.team === 'player' ? this.stats.color : '#991b1b';

        const id = this.stats.id;

        // [기존 유닛 그리기 코드 유지, 블랙호크/치누크만 수정]
        if (id === 'infantry') { ctx.fillRect(-6, -20, 12, 20); ctx.beginPath(); ctx.arc(0, -24, 5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#1e293b'; ctx.fillRect(2, -18, 10, 3); }
        else if (id === 'rpg') { ctx.fillRect(-5, -18, 10, 18); ctx.beginPath(); ctx.arc(0, -22, 4, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#334155'; ctx.fillRect(-2, -24, 12, 6); ctx.fillStyle = '#7f1d1d'; ctx.fillRect(8, -24, 4, 6); }
        else if (id === 'special_forces') { ctx.fillStyle = '#171717'; ctx.fillRect(-7, -22, 14, 22); ctx.fillStyle = '#1e293b'; ctx.fillRect(-7, -22, 14, 10); ctx.beginPath(); ctx.arc(0, -26, 5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#10b981'; ctx.beginPath(); ctx.arc(-2, -26, 1.5, 0, Math.PI * 2); ctx.arc(2, -26, 1.5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#000'; ctx.fillRect(4, -18, 12, 4); }
        else if (id === 'humvee') { ctx.fillStyle = this.team === 'player' ? '#14b8a6' : '#7f1d1d'; ctx.fillRect(-20, -15, 40, 15); ctx.fillStyle = '#0f766e'; ctx.beginPath(); ctx.moveTo(-10, -15); ctx.lineTo(-5, -25); ctx.lineTo(10, -25); ctx.lineTo(15, -15); ctx.fill(); ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(-12, 0, 6, 0, Math.PI * 2); ctx.arc(12, 0, 6, 0, Math.PI * 2); ctx.fill(); }
        else if (id === 'mbt') { ctx.fillRect(-25, -15, 50, 15); ctx.fillStyle = '#1e293b'; ctx.fillRect(-15, -25, 30, 10); ctx.fillRect(0, -23, 40, 4); ctx.fillStyle = '#000'; ctx.fillRect(-28, -5, 56, 5); }
        else if (id === 'spg') { ctx.fillRect(-25, -20, 50, 20); ctx.fillStyle = '#1e293b'; ctx.save(); ctx.translate(-10, -20); ctx.rotate(-Math.PI / 4); ctx.fillRect(0, -5, 45, 10); ctx.restore(); }
        else if (id === 'apache') { ctx.fillStyle = this.team === 'player' ? '#9333ea' : '#581c87'; ctx.beginPath(); ctx.ellipse(0, -10, 30, 10, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(-35, -12, 20, 4); ctx.fillStyle = '#000'; ctx.save(); ctx.translate(0, -20); ctx.scale(Math.sin(this.rotorAngle), 1); ctx.fillStyle = '#333'; ctx.fillRect(-40, -1, 80, 2); ctx.restore(); ctx.fillStyle = '#475569'; ctx.fillRect(5, -5, 10, 4); }
        
        else if (id === 'blackhawk') {
            // [수정] 블랙호크: 프로펠러 일자 (ㅡ)
            ctx.fillStyle = '#111827';
            ctx.beginPath(); ctx.moveTo(15, -5); ctx.lineTo(-25, -5); ctx.lineTo(-35, -15); ctx.lineTo(-25, 5); ctx.lineTo(10, 10); ctx.lineTo(20, 5); ctx.fill();
            ctx.fillStyle = '#0f172a'; ctx.fillRect(-10, -5, 25, 12); // 콕핏
            
            // 메인 로터 (일자)
            ctx.fillStyle = '#000';
            ctx.save();
            ctx.translate(-5, -12);
            // 회전 효과: 너비가 줄어들었다 늘어났다 함
            const rotorScale = Math.abs(Math.sin(this.rotorAngle * 2));
            ctx.fillRect(-45, -2, 90, 4); 
            ctx.restore();
            
            // 꼬리 로터
            ctx.save();
            ctx.translate(-35, -15);
            ctx.rotate(this.rotorAngle * 3);
            ctx.fillStyle = '#333';
            ctx.fillRect(-1, -10, 2, 20);
            ctx.restore();
        }
        else if (id === 'chinook') {
            // [수정] 치누크: 프로펠러 일자 (ㅡ) 앞뒤 2개
            ctx.fillStyle = '#4b5563';
            ctx.beginPath(); ctx.moveTo(-30, -10); ctx.lineTo(30, -10); ctx.lineTo(35, -20); ctx.lineTo(35, 5); ctx.lineTo(-35, 5); ctx.lineTo(-35, -20); ctx.fill();
            ctx.fillStyle = '#1f2937'; ctx.fillRect(-25, 5, 8, 4); ctx.fillRect(15, 5, 8, 4);

            ctx.fillStyle = '#000';
            // 전방 로터
            ctx.save();
            ctx.translate(-35, -20);
            ctx.fillRect(-40, -2, 80, 4);
            ctx.restore();
            // 후방 로터
            ctx.save();
            ctx.translate(35, -20);
            // 약간의 위상차를 주어 자연스럽게
            ctx.scale(Math.cos(this.rotorAngle), 1);
            ctx.fillRect(-40, -2, 80, 4);
            ctx.restore();
        }
        else if (id === 'apc') { ctx.fillStyle = this.team === 'player' ? '#6366f1' : '#7f1d1d'; ctx.fillRect(-20, -16, 40, 16); ctx.fillStyle = '#4338ca'; ctx.fillRect(-15, -22, 30, 6); ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(-12, 0, 6, 0, Math.PI * 2); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.arc(12, 0, 6, 0, Math.PI * 2); ctx.fill(); }
        else if (id === 'aa_tank') { ctx.fillRect(-22, -14, 44, 14); ctx.fillStyle = '#1e293b'; ctx.fillRect(-12, -22, 24, 8); ctx.save(); ctx.translate(0, -22); ctx.rotate(-Math.PI / 3); ctx.fillRect(-2, -12, 4, 12); ctx.fillRect(4, -12, 4, 12); ctx.restore(); ctx.fillStyle = '#000'; ctx.fillRect(-24, -4, 48, 4); }
        else if (id === 'fighter') { ctx.fillStyle = this.team === 'player' ? '#0ea5e9' : '#075985'; ctx.beginPath(); ctx.moveTo(32, -8); ctx.lineTo(-16, -14); ctx.lineTo(-24, -8); ctx.lineTo(-16, -2); ctx.fill(); ctx.fillStyle = '#0284c7'; ctx.beginPath(); ctx.moveTo(4, -8); ctx.lineTo(-8, -18); ctx.lineTo(-16, -8); ctx.fill(); }
        else if (id === 'drone_suicide') { ctx.fillStyle = '#94a3b8'; ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-4, 5); ctx.lineTo(-2, 0); ctx.lineTo(-4, -5); ctx.fill(); }
        else if (id === 'drone_at') { ctx.fillStyle = '#facc15'; ctx.fillRect(-6, -4, 12, 8); ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fillStyle = '#ef4444'; ctx.fill(); }
        else if (id === 'tactical_drone') { ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-5, 6); ctx.lineTo(-2, 0); ctx.lineTo(-5, -6); ctx.fill(); }
        else if (id === 'emp') { ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = '#3b82f6'; ctx.beginPath(); ctx.moveTo(-5, -8); ctx.lineTo(8, -2); ctx.lineTo(-2, 2); ctx.lineTo(6, 10); ctx.lineTo(-8, 4); ctx.lineTo(2, 0); ctx.fill(); }
        else if (id === 'nuke') { ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#000'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 12, 0, Math.PI / 3); ctx.lineTo(0, 0); ctx.moveTo(0, 0); ctx.arc(0, 0, 12, 2 * Math.PI / 3, Math.PI); ctx.lineTo(0, 0); ctx.moveTo(0, 0); ctx.arc(0, 0, 12, 4 * Math.PI / 3, 5 * Math.PI / 3); ctx.lineTo(0, 0); ctx.fill(); ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill(); }
        else if (id === 'bomber_drone') { ctx.fillStyle = this.team === 'player' ? '#4c1d95' : '#581c87'; ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-6, 12); ctx.lineTo(0, 2); ctx.lineTo(-6, -12); ctx.fill(); ctx.fillStyle = '#1e1b4b'; ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(-4, 4); ctx.lineTo(-4, -4); ctx.fill(); if (this.targetX !== undefined && !this.returnToBase && this.team === 'player') { ctx.save(); ctx.translate(-this.x + this.targetX, -this.y + (game.groundY - this.y)); ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 3; ctx.beginPath(); const s = 15; ctx.moveTo(-s, -s); ctx.lineTo(s, s); ctx.moveTo(s, -s); ctx.lineTo(-s, s); ctx.stroke(); ctx.restore(); } }
        else if (id === 'bomber') { ctx.scale(0.6, 0.6); ctx.fillStyle = '#334155'; ctx.beginPath(); ctx.ellipse(-10, 0, 40, 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#475569'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-30, 40); ctx.lineTo(-10, 40); ctx.lineTo(10, 0); ctx.fill(); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-30, -40); ctx.lineTo(-10, -40); ctx.lineTo(10, 0); ctx.fill(); ctx.fillStyle = '#ef4444'; ctx.fillRect(-35, 10, 4, 4); ctx.fillRect(-35, -14, 4, 4); }

        if (!this.hideHp && this.hp < this.maxHp) {
            const hpPct = Math.max(0, this.hp / this.maxHp);
            const w = 24; const h = 4; const yOffset = -35;
            ctx.fillStyle = '#ef4444'; ctx.fillRect(-w / 2, yOffset, w, h);
            ctx.fillStyle = '#22c55e'; ctx.fillRect(-w / 2, yOffset, w * hpPct, h);
            ctx.strokeStyle = '#000'; ctx.lineWidth = 0.5; ctx.strokeRect(-w / 2, yOffset, w, h);
        }
        ctx.restore();
    }
}

// Projectile class moved to projectiles.js

class Particle {
    constructor(x, y, color) {
        this.x = x; this.y = y; this.color = color; this.life = 1.0;
        this.vx = (Math.random() - 0.5) * 8; this.vy = (Math.random() - 0.5) * 8;
    }
    update() { this.x += this.vx; this.y += this.vy; this.life -= 0.05; }
    draw(ctx) {
        ctx.globalAlpha = Math.max(0, this.life); ctx.fillStyle = this.color;
        ctx.beginPath(); ctx.arc(this.x, this.y, Math.random() * 4, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    }
}
