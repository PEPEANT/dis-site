class Projectile {
    constructor(x, y, target, damage, team, type) {
        this.x = x; this.y = y; this.target = target;
        this.damage = damage; this.team = team; this.type = type; this.dead = false;

        if (type === 'bomb') {
            this.targetX = x;
            this.targetY = game.groundY;
        } else {
            const isUnit = target && (target.stats !== undefined);
            const tY = target ? (isUnit ? target.y - 10 : target.y - target.height / 2) : y;
            this.targetX = target ? target.x : x + (team === 'player' ? 300 : -300);
            this.targetY = tY;
        }

        const dx = this.targetX - x; const dy = this.targetY - y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        if (!dist) dist = 0.001;

        if (type === 'artillery') { this.speed = 8; this.vx = dx / 80; this.vy = -14; this.grav = 0.35; }
        else if (type === 'bomb') { this.speed = 0; this.vx = 2 * (team === 'player' ? 1 : -1); this.vy = 5; this.grav = 0.5; }
        else if (type === 'nuke') { this.x = this.targetX; this.y = -500; this.vx = 0; this.vy = 20; }
        else {
            this.speed = type === 'machinegun' ? 22 : (type === 'aa_shell' ? 25 : 15);
            this.vx = (dx / dist) * this.speed; this.vy = (dy / dist) * this.speed;
        }

        // [New] Bomb Whistle SFX
        if (type === 'bomb' && typeof AudioSystem !== 'undefined') {
            AudioSystem.playSFX('bomb_drop');
        }
    }

    update() {
        if (this.dead) return;

        if (this.type === 'artillery' || this.type === 'bomb') {
            this.x += this.vx; this.y += this.vy; this.vy += this.grav;
            if (this.y > game.groundY) this.hit();
        } else if (this.type === 'nuke') {
            this.y += this.vy;
            if (this.y > game.groundY) this.hit();
        } else {
            // Homing Logic
            // [FIX] Target Validity Check
            if (this.target && !this.target.dead && this.target.stats) {
                this.targetX = this.target.x;
                this.targetY = this.target.y - (this.target.height ? this.target.height / 2 : 10);

                const dx = this.targetX - this.x;
                const dy = this.targetY - this.y;
                let dist = Math.sqrt(dx * dx + dy * dy);
                if (!dist) dist = 0.001;

                this.vx = (dx / dist) * this.speed;
                this.vy = (dy / dist) * this.speed;
            }

            this.x += this.vx; this.y += this.vy;
            if (Math.abs(this.x - this.targetX) < 30 && Math.abs(this.y - this.targetY) < 30) this.hit();
            if (this.x < 0 || this.x > CONFIG.mapWidth) this.dead = true;
        }
    }

    hit() {
        this.dead = true;
        if (this.type === 'nuke') {
            if (game.createParticles) game.createParticles(this.x, this.y, 100, '#ef4444');
            if (typeof AudioSystem !== 'undefined') AudioSystem.playSFX('explode');

            const allTargets = [...game.enemies, ...game.enemyBuildings];
            allTargets.forEach(t => { if (!t.dead && Math.abs(t.x - this.x) < 400 && !(t.stats && t.stats.invulnerable)) t.takeDamage(800); });
            return;
        }

        if (game.createParticles) game.createParticles(this.x, this.y, 5, this.type === 'rocket' ? '#ef4444' : '#fbbf24');
        // [Optimization] Conditional SFX
        if (Math.random() < 0.3 && typeof AudioSystem !== 'undefined') AudioSystem.playSFX('explode');

        const enemiesList = this.team === 'player' ? game.enemies : game.players;
        const enemyBldgs = this.team === 'player' ? game.enemyBuildings : game.playerBuildings;
        const bunkers = game.buildings.filter(b => b.type === 'bunker');

        const list = [...enemiesList, ...enemyBldgs, ...bunkers];
        const radius = this.type === 'artillery' || this.type === 'bomb' ? 120 : (this.type === 'rocket' ? 50 : 15);

        if (this.type === 'machinegun') {
            // Single target Logic
            let closest = null;
            let minD = radius + 999;

            list.forEach(u => {
                if (!u || u.dead || u.team === this.team) return;
                const isUnit = (u.stats !== undefined);
                const hitW = (!isUnit) ? u.width : (u.width ? u.width / 2 : 10);
                if (Math.abs(u.x - this.x) < radius + hitW && Math.abs(u.y - this.y) < 100) {
                    const d = Math.abs(u.x - this.x);
                    if (d < minD) { minD = d; closest = u; }
                }
            });

            if (closest) {
                // Evasion Logic
                let hitChance = 1.0;
                if (closest.evasion) {
                    // Machinegun vs Drone -> High Miss rate
                    hitChance = 0.3;
                }
                if (Math.random() < hitChance) {
                    if (!(closest.stats && closest.stats.invulnerable)) closest.takeDamage(this.damage);
                } else {
                    if (game.createParticles) game.createParticles(closest.x, closest.y - 10, 2, '#fff');
                }
            }

        } else {
            // Area Damage (Rocket/Bomb/Shell)
            list.forEach(u => {
                if (!u || u.dead) return;
                if (u.team === this.team) return;

                const isUnit = (u.stats !== undefined);
                if (isUnit && u.stats.type === 'air' && !['rocket', 'aa_shell'].includes(this.type)) return;

                const hitW = (!isUnit) ? u.width : (u.width ? u.width / 2 : 10);

                if (Math.abs(u.x - this.x) < radius + hitW && Math.abs(u.y - this.y) < 100) {
                    if (isUnit && u.stats && u.stats.invulnerable) return;
                    // Evasion check for AA vs Drone
                    let hitChance = 1.0;
                    if (isUnit && u.evasion && this.type === 'aa_shell') hitChance = 0.7; // 30% Miss

                    if (Math.random() < hitChance) u.takeDamage(this.damage);
                    else if (game.createParticles) game.createParticles(u.x, u.y - 10, 2, '#fff');
                }
            });
        }
    }

    draw(ctx) {
        if (this.dead) return;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        if (this.type === 'machinegun') { ctx.fillStyle = '#fbbf24'; ctx.fillRect(this.x, this.y, 4, 4); }
        else if (this.type === 'shell') { ctx.fillStyle = '#fbbf24'; ctx.arc(this.x, this.y, 3, 0, Math.PI * 2); ctx.fill(); }
        else if (this.type === 'aa_shell') { ctx.fillStyle = '#f472b6'; ctx.arc(this.x, this.y, 3, 0, Math.PI * 2); ctx.fill(); }
        else if (this.type === 'rocket') { ctx.fillStyle = '#f87171'; ctx.fillRect(this.x - 4, this.y - 2, 8, 4); }
        else if (this.type === 'bomb') {
            ctx.fillStyle = '#0f172a'; // Black/Slate
            ctx.beginPath(); ctx.arc(this.x, this.y, 8, 0, Math.PI * 2); ctx.fill(); // Bigger Bomb
            ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(this.x, this.y, 3, 0, Math.PI * 2); ctx.fill(); // Red Tip
        }
        else if (this.type === 'artillery') { ctx.fillStyle = '#f97316'; ctx.arc(this.x, this.y, 6, 0, Math.PI * 2); ctx.fill(); }
        else if (this.type === 'nuke') { ctx.fillStyle = '#ef4444'; ctx.arc(this.x, this.y, 10, 0, Math.PI * 2); ctx.fill(); }
    }
}
