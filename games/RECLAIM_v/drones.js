const DroneBehavior = {
    update(drone, enemies, buildings) {
        if (drone.dead) return;

        // [SAFETY] NaN Check
        if (isNaN(drone.x) || isNaN(drone.y)) {
            drone.dead = true;
            return;
        }

        try {
            // 1. Bomber Drone Logic
            if (drone.stats.id === 'bomber_drone') {
                this.updateBomber(drone, enemies, buildings);
                return;
            }

            // 2. Tactical/Suicide Drone Logic (Homing)
            this.updateHoming(drone, enemies, buildings);

        } catch (e) {
            console.error("Drone Error:", e);
            drone.dead = true;
        }
    },

    updateBomber(drone, enemies, buildings) {
        if (drone.returnToBase) {
            // 복귀 모드
            const destX = drone.team === 'player' ? -50 : CONFIG.mapWidth + 50;
            const dx = destX - drone.x;
            const dir = dx > 0 ? 1 : -1;
            drone.x += drone.stats.speed * dir;

            const isHome = (drone.team === 'player' && drone.x < 0) || (drone.team === 'enemy' && drone.x > CONFIG.mapWidth);
            if (isHome) {
                drone.dead = true;
                if (drone.team === 'player' && game && game.playerStock) {
                    game.playerStock['bomber_drone']++;
                    game.showToast("폭격드론 복귀! 재고 회복 +1");
                } else if (game && game.enemyStock) {
                    game.enemyStock['bomber_drone']++;
                }
            }
        } else {
            // [FIX] Find target for bombing if not set
            if (drone.targetX === undefined) {
                // Scan for enemies below
                const targets = drone.team === 'player' ? enemies : buildings; // Simplification
                // Find nearest below
                let bestT = null; let minD = 999;
                // Use simple loop
                for (let t of targets) {
                    if (!t || t.dead) continue;
                    if (Math.abs(t.x - drone.x) < 200) {
                        const d = Math.abs(t.x - drone.x);
                        if (d < minD) { minD = d; bestT = t; }
                    }
                }
                if (bestT) drone.targetX = bestT.x;
            }

            if (drone.targetX !== undefined) {
                const dx = drone.targetX - drone.x;
                if (Math.abs(dx) < drone.stats.speed + 15) { // Radius
                    game.projectiles.push(new Projectile(drone.x, drone.y, null, drone.stats.damage, drone.team, 'bomb'));
                    drone.returnToBase = true;
                } else {
                    const dir = dx > 0 ? 1 : -1;
                    drone.x += drone.stats.speed * dir;
                }
            } else {
                // Fly Forward searching
                drone.x += (drone.team === 'player' ? 1 : -1) * drone.stats.speed;
                if (drone.x < -100 || drone.x > CONFIG.mapWidth + 100) drone.dead = true;

                // Active Scan every 10 frames
                if (game && game.frame % 10 === 0) {
                    const targets = drone.team === 'player' ? enemies : buildings;
                    const hasTarget = targets.some(t => !t.dead && Math.abs(t.x - drone.x) < 50);
                    if (hasTarget) drone.targetX = drone.x; // Set target to current loc (drop bomb here)
                }
            }
        }
    },

    updateHoming(drone, enemies, buildings) {
        // [New] Swarm Move Logic
        if (drone.swarmTarget) {
            const dx = drone.swarmTarget.x - drone.x;
            const dy = drone.swarmTarget.y - drone.y;
            const distSq = dx * dx + dy * dy;

            if (distSq < 400) { // Arrived (20px radius)
                drone.swarmTarget = null; // Switch to Hunt Mode
            } else {
                const angle = Math.atan2(dy, dx);
                drone.x += Math.cos(angle) * drone.stats.speed;
                drone.y += Math.sin(angle) * drone.stats.speed;
                return; // Skip targeting while moving to swarm point
            }
        }

        // 타겟 유효성 체크
        if (drone.lockedTarget && drone.lockedTarget.dead) {
            drone.lockedTarget = null;
        }

        if (drone.lockedTarget) {
            const tx = drone.lockedTarget.x;
            const tH = drone.lockedTarget.height || 20;
            const ty = drone.lockedTarget.y - tH / 2;

            const dx = tx - drone.x;
            const dy = ty - drone.y;
            const distSq = dx * dx + dy * dy;

            if (distSq < 900) {
                drone.explode(drone.lockedTarget);
                return;
            }

            const angle = Math.atan2(dy, dx);
            drone.x += Math.cos(angle) * drone.stats.speed;
            drone.y += Math.sin(angle) * drone.stats.speed;
        } else {
            // 새 타겟 찾기
            const newTarget = this.findNearestEnemy(drone, enemies, buildings);
            if (newTarget) {
                drone.lockedTarget = newTarget;
            } else {
                drone.x += (drone.team === 'player' ? 1 : -1) * drone.stats.speed * 0.5; // Patrol speed slower?
                if (drone.x < -100 || drone.x > CONFIG.mapWidth + 100) drone.dead = true;
            }
        }
    },

    findNearestEnemy(drone, enemies, buildings) {
        let t = null;
        let minSq = 999999999;
        const x = drone.x;

        // [OPTIMIZATION] Avoid creating new arrays every frame
        // Use standard loops instead of forEach
        const scan = (arr) => {
            for (let i = 0; i < arr.length; i++) {
                const e = arr[i];
                if (!e || e.dead || e.team === drone.team || e.team === 'neutral') continue;

                const dx = e.x - x;
                const dSq = dx * dx;

                if (dSq < minSq) {
                    minSq = dSq;
                    t = e;
                }
            }
        };

        scan(enemies);
        // scan(buildings); // [UPDATE] 드론 자동 탐색 시 건물 무시 (요청 사항)
        return t;
    }
};
