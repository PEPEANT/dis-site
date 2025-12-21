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
        this.deployed = false; // [NEW] APC 하차 여부
        this.returnToBase = false;
        this.attackTarget = null; // [OPTIMIZATION] Sticky Targeting
    }

    takeDamage(damage) {
        if (this.dead) return;
        this.hp -= damage;

        // [NEW] APC 전투 하차 (첫 피격 시)
        if (this.stats.id === 'apc' && !this.deployed && this.hp < this.maxHp) {
            this.deployed = true;
            if (game && game.spawnUnitDirect) {
                for (let i = 0; i < 4; i++) game.spawnUnitDirect('infantry', this.x + (Math.random() * 40 - 20), game.groundY, this.team);
            }
            // game.showToast("장갑차 보병 하차! 전투 지속!");
        }

        if (this.hp <= 0) {
            this.dead = true;
            if (this.team === 'enemy') game.killCount++;
        }
    }

    update(enemies, buildings) {
        if (this.dead) return;

        // [NEW] 스턴 처리
        if (this.stunTimer > 0) {
            this.stunTimer--;
            // 스턴 상태 표시 (파란색 효과 등)
            if (game.frame % 20 === 0) game.createParticles(this.x, this.y, 1, '#60a5fa');
            return; // 행동 불가
        }

        if (this.stats.type === 'air') this.rotorAngle += 0.8;

        if (this.stats.id.startsWith('drone') || this.stats.id === 'tactical_drone' || this.stats.id === 'bomber_drone') {
            this.updateDrone(enemies, buildings);
            return;
        }

        // [NEW] Air Unit Recycling (Exit Map)
        if (this.stats.type === 'air' && !this.stats.id.startsWith('drone')) {
            const isOut = (this.team === 'player' && this.x > CONFIG.mapWidth + 100) || (this.team === 'enemy' && this.x < -100);
            if (isOut) {
                this.dead = true;
                if (this.team === 'player') {
                    game.playerStock[this.stats.id]++;
                    // game.showToast(`${this.stats.name} 귀환 완료! 재고 +1`);
                } else {
                    game.enemyStock[this.stats.id]++;
                }
                return;
            }
        }

        // [NEW] Strategic Bomber Logic
        if (this.stats.id === 'bomber') {
            const dir = this.team === 'player' ? 1 : -1;
            this.x += this.stats.speed * dir;
            // Carpet Bombing only if enemy below
            if (game.frame - this.lastBomb > 20) {
                if (this.x > 0 && this.x < CONFIG.mapWidth) {
                    // [FIX] Strict Bombing Logic: Only drop if target is directly below
                    // Check for targets below (+- 50px)
                    // Exclude Neutral from targets
                    const targets = this.team === 'player' ? enemies : buildings.filter(b => b.team !== 'neutral');
                    const hasTarget = targets.some(t => !t.dead && Math.abs(t.x - this.x) < 50);

                    if (hasTarget) {
                        game.projectiles.push(new Projectile(this.x, this.y, null, this.stats.damage, this.team, 'bomb'));
                        this.lastBomb = game.frame;
                    }
                }
            }
            return;
        }

        if (this.stats.id === 'fighter') {
            const dir = this.team === 'player' ? 1 : -1;
            this.x += this.stats.speed * dir;

            // 공중 유닛 및 대공전차 공격
            // [OPTIMIZATION] Sticky Targeting for Fighter
            if (this.attackTarget && (this.attackTarget.dead || Math.abs(this.attackTarget.x - this.x) > 550)) {
                this.attackTarget = null;
            }

            if (!this.attackTarget) {
                this.attackTarget = enemies.find(e =>
                    !e.dead &&
                    (e.stats.type === 'air' || e.stats.id === 'aa_tank') &&
                    e.stats.category !== 'drone' &&
                    Math.abs(e.x - this.x) < 500
                );
            }
            const target = this.attackTarget;

            if (target && game.frame - this.lastAttack > 10) {
                // [NEW] Height Advantage Logic (Air vs Air only)
                let dmg = this.stats.damage;
                if (target.stats.type === 'air' && this.stats.type === 'air') {
                    const heightDiff = target.y - this.y;
                    if (heightDiff > 10) {
                        const bonus = Math.min(0.5, heightDiff / 200);
                        dmg *= (1 + bonus);
                    }
                }

                // 대공전차 공격 시 데미지 반감 (지상 공격 페널티)
                if (target.stats.id === 'aa_tank') {
                    dmg *= 0.5;
                }

                game.projectiles.push(new Projectile(this.x, this.y, target, dmg, this.team, 'machinegun'));
                this.lastAttack = game.frame;
            }
            return;
        }

        // [OPTIMIZATION] Sticky Targeting for General Units
        if (this.attackTarget) {
            const dist = Math.abs(this.attackTarget.x - this.x);

            // [FIX] Check for stats before accessing stealth (Buildings have no stats)
            const isStealth = this.attackTarget.stats && this.attackTarget.stats.stealth;

            // Check validity (Dead, Out of Range, Friendly, Neutral, Stealth)
            if (this.attackTarget.dead ||
                dist > this.stats.range + 50 ||
                this.attackTarget.team === this.team ||
                this.attackTarget.team === 'neutral' || // [FIX] Stop attacking neutral
                (isStealth && dist > 100)) {
                this.attackTarget = null;
            }
        }

        if (!this.attackTarget) {
            // New Scan (expensive loop)
            let bestScore = Infinity;

            // Helper: Is Valid Target?
            const canHitAir = this.stats.antiAir || this.stats.type === 'air' || ['humvee', 'apc'].includes(this.stats.id);

            for (let e of enemies) {
                if (!e || e.dead || (e.stats && e.stats.stealth)) continue; // [Safety] e.stats check added just in case
                if (this.stats.id === 'humvee' && e.stats.id === 'fighter') continue;
                if (e.stats.type === 'air' && !canHitAir) continue;

                const dist = Math.abs(e.x - this.x);
                if (dist > this.stats.range) continue;

                let score = dist;
                if (this.stats.antiAir && e.stats.type === 'air') score -= 2000;
                else if (!this.stats.antiAir && e.stats.type === 'air') score += 2000;

                if (score < bestScore) { bestScore = score; this.attackTarget = e; }
            }

            // Check Buildings if no unit found
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
            let rate = 60; // Default 1s

            // [NERF] SPG 5-second cooldown
            if (this.stats.id === 'spg') rate = 300;
            else if (['humvee', 'apc', 'aa_tank', 'turret'].includes(this.stats.id)) rate = 15;

            if (game.frame - this.lastAttack > rate) {
                this.attack(target);
                this.lastAttack = game.frame;
            }
        } else {
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
                // [SAFETY] 배열 복사 및 자기 자신 제외, 개별 에러 캐치
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
        const id = this.stats.id;

        let dmg = this.stats.damage;

        if (id === 'humvee' && target.stats && target.stats.type === 'air') {
            dmg = Math.max(1, Math.floor(dmg * 0.2)); // 20% 데미지
        }

        // [FIX] 전차/자주포 등 대형무기는 스턴 걸린 상태에서 공격 불가 (update에서 막았지만 이중 체크)
        if (this.stunTimer > 0) return;

        let type = 'bullet';
        if (['spg'].includes(id)) type = 'artillery';
        else if (['mbt'].includes(id)) type = 'shell';
        else if (['apache', 'rpg'].includes(id)) type = 'rocket';
        else if (['aa_tank', 'turret'].includes(id)) type = 'aa_shell';
        else if (['humvee', 'apc'].includes(id)) type = 'machinegun';
        else if (['fighter'].includes(id)) type = 'machinegun'; // Fighter added

        // [New] SFX (Limit frequency or checks)
        // Only play SFX for visible units or near camera to avoid noise chaos? 
        // For now, just play simple short blip.
        if (typeof AudioSystem !== 'undefined' && Math.random() < 0.3) AudioSystem.playSFX('shoot');

        try {
            game.projectiles.push(new Projectile(this.x, this.y - this.height / 2, target, dmg, this.team, type));
        } catch (e) { }
    }

    draw(ctx) {
        if (this.dead) return;
        ctx.save();
        ctx.translate(this.x, this.y);

        // [NEW] 전술 드론 락온 박스 그리기
        if (this.stats.id === 'tactical_drone' && this.lockedTarget && !this.lockedTarget.dead) {
            ctx.save();
            ctx.translate(-this.x, -this.y); // 절대 좌표로 복귀
            const tx = this.lockedTarget.x;
            const ty = this.lockedTarget.y - (this.lockedTarget.height ? this.lockedTarget.height / 2 : 0);

            // 빨간 네모 박스
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 2]);
            const boxSize = 40;
            ctx.strokeRect(tx - boxSize / 2, ty - boxSize / 2, boxSize, boxSize);

            // LOCK ON 텍스트
            ctx.fillStyle = '#ef4444';
            ctx.font = 'bold 10px sans-serif';
            ctx.fillText("LOCK ON", tx - 22, ty - boxSize / 2 - 5);
            ctx.restore();
        }

        // [FIX] Flip Logic: Enemy OR Returning Player Unit
        let flip = (this.team === 'enemy');
        if (this.team === 'player' && this.returnToBase) flip = true;
        if (flip) ctx.scale(-1, 1);
        ctx.fillStyle = this.team === 'player' ? this.stats.color : '#991b1b';

        const id = this.stats.id;

        // ... (기존 그리기 코드들 - tactical_drone 추가)
        if (id === 'infantry') { ctx.fillRect(-6, -20, 12, 20); ctx.beginPath(); ctx.arc(0, -24, 5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#1e293b'; ctx.fillRect(2, -18, 10, 3); }
        else if (id === 'rpg') { ctx.fillRect(-5, -18, 10, 18); ctx.beginPath(); ctx.arc(0, -22, 4, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#334155'; ctx.fillRect(-2, -24, 12, 6); ctx.fillStyle = '#7f1d1d'; ctx.fillRect(8, -24, 4, 6); }
        else if (id === 'special_forces') {
            // [NEW] Special Forces Design
            ctx.fillStyle = '#171717'; ctx.fillRect(-7, -22, 14, 22); // Body
            ctx.fillStyle = '#1e293b'; ctx.fillRect(-7, -22, 14, 10); // Vest
            ctx.beginPath(); ctx.arc(0, -26, 5, 0, Math.PI * 2); ctx.fill(); // Head
            // Night Vision Googles
            ctx.fillStyle = '#10b981';
            ctx.beginPath(); ctx.arc(-2, -26, 1.5, 0, Math.PI * 2); ctx.arc(2, -26, 1.5, 0, Math.PI * 2); ctx.fill();
            // Gun
            ctx.fillStyle = '#000'; ctx.fillRect(4, -18, 12, 4);
        }
        else if (id === 'humvee') { ctx.fillStyle = this.team === 'player' ? '#14b8a6' : '#7f1d1d'; ctx.fillRect(-20, -15, 40, 15); ctx.fillStyle = '#0f766e'; ctx.beginPath(); ctx.moveTo(-10, -15); ctx.lineTo(-5, -25); ctx.lineTo(10, -25); ctx.lineTo(15, -15); ctx.fill(); ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(-12, 0, 6, 0, Math.PI * 2); ctx.arc(12, 0, 6, 0, Math.PI * 2); ctx.fill(); }
        else if (id === 'mbt') { ctx.fillRect(-25, -15, 50, 15); ctx.fillStyle = '#1e293b'; ctx.fillRect(-15, -25, 30, 10); ctx.fillRect(0, -23, 40, 4); ctx.fillStyle = '#000'; ctx.fillRect(-28, -5, 56, 5); }
        else if (id === 'spg') { ctx.fillRect(-25, -20, 50, 20); ctx.fillStyle = '#1e293b'; ctx.save(); ctx.translate(-10, -20); ctx.rotate(-Math.PI / 4); ctx.fillRect(0, -5, 45, 10); ctx.restore(); }
        else if (id === 'apache') { ctx.fillStyle = this.team === 'player' ? '#9333ea' : '#581c87'; ctx.beginPath(); ctx.ellipse(0, -10, 30, 10, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(-35, -12, 20, 4); ctx.fillStyle = '#000'; ctx.save(); ctx.translate(0, -20); ctx.scale(Math.sin(this.rotorAngle), 1); ctx.fillStyle = '#333'; ctx.fillRect(-40, -1, 80, 2); ctx.restore(); ctx.fillStyle = '#475569'; ctx.fillRect(5, -5, 10, 4); }
        else if (id === 'apc') { ctx.fillStyle = this.team === 'player' ? '#6366f1' : '#7f1d1d'; ctx.fillRect(-20, -16, 40, 16); ctx.fillStyle = '#4338ca'; ctx.fillRect(-15, -22, 30, 6); ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(-12, 0, 6, 0, Math.PI * 2); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.arc(12, 0, 6, 0, Math.PI * 2); ctx.fill(); }
        else if (id === 'aa_tank') { ctx.fillRect(-22, -14, 44, 14); ctx.fillStyle = '#1e293b'; ctx.fillRect(-12, -22, 24, 8); ctx.save(); ctx.translate(0, -22); ctx.rotate(-Math.PI / 3); ctx.fillRect(-2, -12, 4, 12); ctx.fillRect(4, -12, 4, 12); ctx.restore(); ctx.fillStyle = '#000'; ctx.fillRect(-24, -4, 48, 4); }
        else if (id === 'fighter') { ctx.fillStyle = this.team === 'player' ? '#0ea5e9' : '#075985'; ctx.beginPath(); ctx.moveTo(32, -8); ctx.lineTo(-16, -14); ctx.lineTo(-24, -8); ctx.lineTo(-16, -2); ctx.fill(); ctx.fillStyle = '#0284c7'; ctx.beginPath(); ctx.moveTo(4, -8); ctx.lineTo(-8, -18); ctx.lineTo(-16, -8); ctx.fill(); }
        else if (id === 'drone_suicide') { ctx.fillStyle = '#94a3b8'; ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-4, 5); ctx.lineTo(-2, 0); ctx.lineTo(-4, -5); ctx.fill(); }
        else if (id === 'drone_at') { ctx.fillStyle = '#facc15'; ctx.fillRect(-6, -4, 12, 8); ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fillStyle = '#ef4444'; ctx.fill(); }
        else if (id === 'tactical_drone') {
            ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-5, 6); ctx.lineTo(-2, 0); ctx.lineTo(-5, -6); ctx.fill();
        }
        else if (id === 'emp') {
            // [NEW] EMP Icon
            ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = '#3b82f6'; ctx.beginPath(); ctx.moveTo(-5, -8); ctx.lineTo(8, -2); ctx.lineTo(-2, 2); ctx.lineTo(6, 10); ctx.lineTo(-8, 4); ctx.lineTo(2, 0); ctx.fill();
        }
        else if (id === 'nuke') {
            // [NEW] Nuke Icon
            ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#000'; ctx.beginPath();
            ctx.moveTo(0, 0); ctx.arc(0, 0, 12, 0, Math.PI / 3); ctx.lineTo(0, 0);
            ctx.moveTo(0, 0); ctx.arc(0, 0, 12, 2 * Math.PI / 3, Math.PI); ctx.lineTo(0, 0);
            ctx.moveTo(0, 0); ctx.arc(0, 0, 12, 4 * Math.PI / 3, 5 * Math.PI / 3); ctx.lineTo(0, 0);
            ctx.fill();
            ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
        }
        else if (id === 'bomber_drone') {
            // [NEW] B-2 Spirit Style Delta Wing
            ctx.fillStyle = this.team === 'player' ? '#4c1d95' : '#581c87';
            ctx.beginPath();
            ctx.moveTo(12, 0); ctx.lineTo(-6, 12); ctx.lineTo(0, 2); ctx.lineTo(-6, -12);
            ctx.fill();
            // Details
            ctx.fillStyle = '#1e1b4b';
            ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(-4, 4); ctx.lineTo(-4, -4); ctx.fill();

            // [NEW] Bombing Target Marker ("X" on ground)
            if (this.targetX !== undefined && !this.returnToBase && this.team === 'player') {
                ctx.save();
                ctx.translate(-this.x + this.targetX, -this.y + (game.groundY - this.y)); // Project to ground
                ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 3;
                ctx.beginPath();
                const s = 15;
                ctx.moveTo(-s, -s); ctx.lineTo(s, s);
                ctx.moveTo(s, -s); ctx.lineTo(-s, s);
                ctx.stroke();
                ctx.restore();
            }
        }
        else if (id === 'bomber') {
            // [NEW] Strategic Bomber Visuals (Smaller)
            ctx.scale(0.6, 0.6);
            ctx.fillStyle = '#334155'; // Dark Grey Body
            // Fuselage
            ctx.beginPath(); ctx.ellipse(-10, 0, 40, 8, 0, 0, Math.PI * 2); ctx.fill();
            // Wings
            ctx.fillStyle = '#475569';
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-30, 40); ctx.lineTo(-10, 40); ctx.lineTo(10, 0); ctx.fill();
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-30, -40); ctx.lineTo(-10, -40); ctx.lineTo(10, 0); ctx.fill();
            // Engines
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(-35, 10, 4, 4); ctx.fillRect(-35, -14, 4, 4);
        }

        // [NEW] HP Bar Drawing
        if (!this.hideHp && this.hp < this.maxHp) { // Use instance hp/maxHp
            const hpPct = Math.max(0, this.hp / this.maxHp);
            const w = 24;
            const h = 4;
            const yOffset = -35;

            // Background
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(-w / 2, yOffset, w, h);

            // Foreground
            ctx.fillStyle = '#22c55e';
            ctx.fillRect(-w / 2, yOffset, w * hpPct, h);

            // Border
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(-w / 2, yOffset, w, h);
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