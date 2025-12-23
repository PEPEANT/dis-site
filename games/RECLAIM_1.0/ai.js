const AI = {
    difficulty: 'veteran', // recruit, veteran, elite
    lastSpawn: 0,
    checkInterval: 60, // Analysis interval

    // Config: Spawn Rates (frames between spawns) & Resource Multipliers
    settings: {
        recruit: { rate: 200, supplyMult: 1.0, smart: false },
        veteran: { rate: 120, supplyMult: 2.0, smart: true },
        elite: { rate: 90, supplyMult: 3.0, smart: 'very' }
    },

    setDifficulty(diff) {
        this.difficulty = diff || 'veteran';
        const s = this.settings[this.difficulty];
        // Apply global game setting if needed, but mainly used internally
        if (typeof game !== 'undefined') {
            game.enemySupplyRate = CONFIG.supplyRate * s.supplyMult;
        }
        console.log(`AI Set to ${this.difficulty}`);
    },

    update(frame) {
        if (!game || !game.running) return;

        // [NEW] Dynamic Spawn Rate Logic
        let currentRate = this.settings[this.difficulty].rate;

        const playerUnitCount = game.players.length;
        if (playerUnitCount > 10) {
            const reduction = Math.min(currentRate * 0.5, (playerUnitCount - 10) * 2);
            currentRate -= reduction;
        }

        if (frame - this.lastSpawn > currentRate) {
            this.decideSpawn();
            this.lastSpawn = frame;
        }
    },

    analyze() {
        const players = game.players || [];
        const analysis = {
            air: 0,
            tank: 0,
            infantry: 0,
            total: players.length,
            hasBunker: game.buildings.some(b => b.type === 'bunker' && b.team === 'player')
        };

        players.forEach(u => {
            if (u.dead) return;
            if (u.stats.type === 'air') analysis.air++;
            else if (u.stats.category === 'armored') analysis.tank++;
            else analysis.infantry++;
        });

        return analysis;
    },

    decideSpawn() {
        if (game.enemySupply < 50) return;

        const info = this.analyze();
        const diff = this.difficulty;
        let choice = 'infantry';

        if (diff === 'recruit') {
            const r = Math.random();
            if (r < 0.5) choice = 'infantry';
            else if (r < 0.8) choice = 'rpg';
            else choice = 'humvee';
        }
        else if (diff === 'veteran') {
            choice = this.getCounterUnit(info, false);
        }
        else if (diff === 'elite') {
            choice = this.getCounterUnit(info, true);

            if (Math.random() < 0.05 && game.enemySupply > 1000) {
                this.useSpecial(info);
            }
        }

        // [NEW] Aggressive Spending
        const enemyUnitCount = game.enemies.length;

        if (game.enemySupply > 300) {
            game.spawnEnemy(choice);

            if (info.total > enemyUnitCount + 5 || game.enemySupply > 1000) {
                const support = Math.random() < 0.5 ? 'infantry' : 'rpg';
                setTimeout(() => game.spawnEnemy(support), 200);

                if (diff === 'elite' && game.enemySupply > 500) {
                    setTimeout(() => game.spawnEnemy(choice), 400);
                }
            }
        } else {
            game.spawnEnemy(choice);
        }
    },

    getCounterUnit(info, isElite) {
        const r = Math.random();

        // [NEW] Priority 0: Bomber (High Resources or High Value Targets)
        if (isElite && (info.hasBunker || info.total > 10) && game.enemySupply >= 200) {
            if (Math.random() < 0.2) return 'bomber';
        }

        // 1. Counter Air Force
        if (info.air > 3) {
            if (isElite) return r < 0.6 ? 'aa_tank' : 'fighter';
            return r < 0.6 ? 'rpg' : 'aa_tank';
        }

        // 2. Counter Tanks (Relaxed condition)
        if (info.tank > 2) {
            if (isElite) return r < 0.5 ? 'bomber' : (r < 0.8 ? 'drone_at' : 'mbt');
            return r < 0.5 ? 'rpg' : 'mbt';
        }

        // 3. Counter Infantry Swarm
        if (info.infantry > 8) {
            if (isElite) return r < 0.5 ? 'apache' : 'humvee';
            return 'humvee';
        }

        // 4. Bunker Breaker
        if (info.hasBunker) {
            if (isElite) return r < 0.4 ? 'bomber_drone' : 'spg';
            return 'spg';
        }

        // 5. Default Aggression
        if (isElite) {
            const pool = ['mbt', 'apache', 'tactical_drone', 'special_forces'];
            return pool[Math.floor(Math.random() * pool.length)];
        } else {
            const pool = ['infantry', 'rpg', 'mbt', 'humvee'];
            return pool[Math.floor(Math.random() * pool.length)];
        }
    },

    useSpecial(info) {
        // Elite AI capability
        // 1. Drone Swarm (Cheap & annoying)
        if (Math.random() < 0.5) {
            // Spawn 3 suicide drones
            for (let i = 0; i < 3; i++) setTimeout(() => game.spawnEnemy('drone_suicide'), i * 500);
            // game.showToast("적군 드론 스웜 감지!");
        }
        // 2. Tactical Bomber
        else {
            game.spawnEnemy('bomber');
            // game.showToast("적 전략 폭격기 접근 중!");
        }
        // EMP/Nuke logic is usually Unit-based skills, harder for AI to trigger via spawnEnemy. 
        // Unless we implement AI skill usage API in game.js. 
        // For now, unit spawning is the main interaction.
    }
};
