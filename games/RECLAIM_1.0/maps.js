const Maps = {
    types: {
        'plain': { name: '평원 (Plains)', sky: '#87CEEB', ground: '#4ade80', groundDark: '#16a34a' },
        'city': { name: '도시 (City)', sky: '#cbd5e1', ground: '#475569', groundDark: '#334155' },
        'mountain': { name: '산악 (Mountain)', sky: '#bae6fd', ground: '#a8a29e', groundDark: '#78716c' },
        'village': { name: '마을 (Village)', sky: '#f0f9ff', ground: '#d97706', groundDark: '#b45309' }
    },

    currentMap: 'plain',

    drawBackground(ctx, width, height, groundY, cameraX = 0) {
        const theme = this.types[this.currentMap] || this.types['plain'];

        const grad = ctx.createLinearGradient(0, 0, 0, height);
        grad.addColorStop(0, theme.sky);
        grad.addColorStop(0.5, '#ffffff');
        grad.addColorStop(1, theme.ground);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        ctx.save();
        ctx.translate(-cameraX, 0);
        ctx.fillStyle = theme.ground;
        ctx.fillRect(cameraX, groundY, width, 500);
        ctx.restore();

        ctx.save();
        const buffer = 200;

        if (this.currentMap === 'plain') {
            ctx.translate(-cameraX, 0);
            this.drawTrees(ctx, cameraX - buffer, cameraX + width + buffer, groundY);
        } else if (this.currentMap === 'city') {
            const pX = cameraX * 0.5;
            ctx.translate(-pX, 0);
            this.drawCitySkyline(ctx, pX - buffer, pX + width + buffer, groundY);
        } else if (this.currentMap === 'mountain') {
            const pX = cameraX * 0.3;
            ctx.translate(-pX, 0);
            this.drawMountains(ctx, pX - buffer, pX + width + buffer, groundY);
        } else if (this.currentMap === 'village') {
            ctx.translate(-cameraX, 0);
            this.drawVillage(ctx, cameraX - buffer, cameraX + width + buffer, groundY);
        }
        ctx.restore();
    },

    drawTrees(ctx, startX, endX, groundY) {
        const interval = 80;
        const start = Math.floor(startX / interval) * interval;

        for (let i = start; i < endX; i += interval) {
            const seed = Math.abs(Math.sin(i * 12.34));
            const seed2 = Math.abs(Math.cos(i * 56.78));

            const scaleX = 0.7 + (seed * 0.6);
            const scaleY = 0.6 + (seed2 * 1.2);

            ctx.save();
            ctx.translate(i, groundY);
            ctx.scale(scaleX, scaleY);

            ctx.fillStyle = seed > 0.5 ? '#15803d' : '#166534';
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(20, -60);
            ctx.lineTo(40, 0);
            ctx.fill();

            ctx.fillStyle = '#3f6212';
            ctx.fillRect(15, -10, 10, 10);
            ctx.restore();
        }
    },

    drawCitySkyline(ctx, startX, endX, groundY) {
        ctx.fillStyle = '#64748b';
        const interval = 80;
        const start = Math.floor(startX / interval) * interval;

        for (let i = start; i < endX; i += interval) {
            const fixedH = ((i * 123) % 150) + 50;
            ctx.fillRect(i, groundY - fixedH, 60, fixedH);

            ctx.fillStyle = '#fef08a';
            for (let j = 0; j < 3; j++) {
                if ((i * j * 7) % 2 === 0) ctx.fillRect(i + 10, groundY - fixedH + 10 + j * 15, 10, 10);
            }
            ctx.fillStyle = '#64748b';
        }
    },

    drawMountains(ctx, startX, endX, groundY) {
        ctx.fillStyle = '#57534e';
        ctx.beginPath();
        ctx.moveTo(startX, groundY);

        let currentX = 0;

        while (currentX < endX + 200) {
            // [SHRUNK] Smaller Mountains
            const baseWidth = 100 + Math.abs(Math.sin(currentX) * 100);
            const height = 50 + Math.abs(Math.cos(currentX * 0.5) * 100);
            const peakX = currentX + (baseWidth / 2);

            if (currentX + baseWidth > startX) {
                ctx.lineTo(peakX, groundY - height);
                ctx.lineTo(currentX + baseWidth, groundY);
            } else {
                ctx.moveTo(currentX + baseWidth, groundY);
            }
            currentX += baseWidth;
        }

        ctx.lineTo(endX, groundY + 100);
        ctx.lineTo(startX, groundY + 100);
        ctx.fill();
    },

    drawVillage(ctx, startX, endX, groundY) {
        const interval = 120;
        const start = Math.floor(startX / interval) * interval;

        for (let i = start; i < endX; i += interval) {
            const offset = Math.sin(i) * 20;
            const x = i + offset;

            // House Body
            ctx.fillStyle = '#fef3c7';
            ctx.fillRect(x, groundY - 30, 40, 30);

            // Roof
            ctx.fillStyle = '#991b1b';
            ctx.beginPath();
            ctx.moveTo(x - 5, groundY - 30);
            ctx.lineTo(x + 20, groundY - 50);
            ctx.lineTo(x + 45, groundY - 30);
            ctx.fill();

            // Door/Window
            ctx.fillStyle = '#451a03';
            ctx.fillRect(x + 15, groundY - 15, 10, 15);
            ctx.fillStyle = '#93c5fd';
            ctx.fillRect(x + 5, groundY - 25, 8, 8);
        }
    }
};
