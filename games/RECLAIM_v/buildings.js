class Building extends Entity {
    constructor(type, x, y, team) {
        const data = CONFIG.buildings[type];
        super(x, y, team, data.hp, data.width, data.height);
        this.type = type; this.name = data.name;
        this.canShoot = (type === 'bunker' || type === 'turret');
        this.damage = data.damage || 0; this.range = data.range || 0;
        this.fireRate = data.rate || 0; this.lastShot = 0;
        this.captureProgress = 0;
        this.antiAir = data.antiAir || false;
        this.stunTimer = 0;
    }

    takeDamage(amount) {
        if (this.type === 'bunker') {
            this.hp -= amount;
            if (this.hp <= 0) {
                this.team = 'neutral';
                this.hp = this.maxHp * 0.2;
                this.captureProgress = 0;
                if (game.selectedSpawn === this) game.selectSpawn(null);
            }
        } else {
            this.hp -= amount;
            if (this.hp <= 0) {
                this.dead = true;

                // [NEW] Trigger Total War on Enemy Turret Death
                if (this.type === 'turret' && this.team === 'enemy') {
                    if (game.triggerTotalWar) game.triggerTotalWar();
                }
            }
        }
    }

    update(enemies, players) {
        if (this.dead) return;

        if (this.type === 'bunker') {
            let pCount = 0, eCount = 0;
            players.forEach(u => { if (u && !u.dead && Math.abs(u.x - this.x) < 200 && u.stats && !u.stats.type.includes('air')) pCount++; });
            enemies.forEach(u => { if (u && !u.dead && Math.abs(u.x - this.x) < 200 && u.stats && !u.stats.type.includes('air')) eCount++; });

            if (pCount > eCount) this.captureProgress += 0.5;
            else if (eCount > pCount) this.captureProgress -= 0.5;

            if (pCount === 0 && eCount === 0 && this.team === 'neutral') {
                if (this.captureProgress > 0) this.captureProgress -= 0.1;
                if (this.captureProgress < 0) this.captureProgress += 0.1;
            }

            this.captureProgress = Math.max(-100, Math.min(100, this.captureProgress));

            if (this.captureProgress >= 100 && this.team !== 'player') {
                this.team = 'player'; this.hp = this.maxHp;
            } else if (this.captureProgress <= -100 && this.team !== 'enemy') {
                this.team = 'enemy'; this.hp = this.maxHp;
                if (game.selectedSpawn === this) game.selectSpawn(null);
            }
        }

        if (this.canShoot && this.team !== 'neutral') {
            const targets = this.team === 'player' ? enemies : players;
            let target = null;
            let minDist = this.range;

            if (this.type === 'turret') {
                const airTarget = targets.find(t => !t.dead && Math.abs(t.x - this.x) < this.range && t.stats && t.stats.type === 'air');
                if (airTarget) target = airTarget;
            }

            if (!target) {
                for (let t of targets) {
                    if (!t || t.dead) continue;
                    if (!this.antiAir && t.stats && t.stats.type === 'air') continue;
                    const dist = Math.abs(t.x - this.x);
                    if (dist < minDist) { minDist = dist; target = t; }
                }
            }

            if (target && game.frame - this.lastShot > this.fireRate) {
                if (this.team === 'enemy' && game.empTimer > 0) return;
                if (this.stunTimer > 0) return;

                // Fire Projectile
                // If Projectile class is loaded via projectiles.js, this works.
                game.projectiles.push(new Projectile(this.x, this.y - this.height / 2, target, this.damage, this.team, 'machinegun'));
                this.lastShot = game.frame;
            }
        }

        if (this.stunTimer > 0) {
            this.stunTimer--;
            if (game.frame % 20 === 0) game.createParticles(this.x, this.y, 1, '#60a5fa');
        }
    }

    draw(ctx) {
        if (this.dead) return;
        ctx.save(); ctx.translate(this.x, this.y);

        // [REMOVED] Bunker Spawn UI
        if (this.type.includes('hq')) {
            ctx.fillStyle = this.team === 'player' ? '#1e3a8a' : '#7f1d1d';
            ctx.fillRect(-this.width / 2, -this.height, this.width, this.height);
            ctx.fillStyle = this.team === 'player' ? '#3b82f6' : '#ef4444';
            ctx.fillRect(-this.width / 2 + 10, -this.height + 20, this.width - 20, 20);
            ctx.strokeStyle = '#64748b'; ctx.beginPath(); ctx.moveTo(0, -this.height); ctx.lineTo(0, -this.height - 40); ctx.stroke();
            if (game.frame % 60 < 30) { ctx.fillStyle = 'red'; ctx.beginPath(); ctx.arc(0, -this.height - 40, 2, 0, Math.PI * 2); ctx.fill(); }
        }
        else if (this.type === 'bunker') {
            ctx.fillStyle = '#334155'; ctx.fillRect(-40, -60, 80, 60);
            ctx.fillStyle = '#000'; ctx.fillRect(-40, -70, 80, 6);
            if (this.captureProgress > 0) { ctx.fillStyle = '#3b82f6'; ctx.fillRect(-40, -70, 80 * (this.captureProgress / 100), 6); }
            else { ctx.fillStyle = '#ef4444'; ctx.fillRect(40 + (80 * (this.captureProgress / 100)), -70, -80 * (this.captureProgress / 100), 6); }

            ctx.fillStyle = this.team === 'neutral' ? '#64748b' : (this.team === 'player' ? '#3b82f6' : '#ef4444');
            ctx.beginPath(); ctx.moveTo(-45, -60); ctx.lineTo(0, -80); ctx.lineTo(45, -60); ctx.fill();
            ctx.fillStyle = '#0f172a'; ctx.fillRect(-10, -40, 20, 10);
        }
        else if (this.type === 'turret') {
            ctx.fillStyle = '#334155'; ctx.fillRect(-20, -40, 40, 40);
            ctx.fillStyle = this.team === 'player' ? '#60a5fa' : '#f87171';
            ctx.beginPath(); ctx.arc(0, -45, 20, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.moveTo(0, -45); ctx.lineTo(this.team === 'player' ? 30 : -30, -55); ctx.stroke();
        }
        ctx.restore();
        this.drawHp(ctx);
    }
}
