// casino.js
// - 기존 디자인/렌더 유지
// - 환전소(Exchange) 오브젝트 + 모달 추가
// - Space 상호작용: 환전소 -> 환전 / 슬롯 -> 슬롯
// - 돈/칩은 App API만 사용 (직접 수정 금지)

(() => {
  // ---------- DOM ----------
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  const elMoney = document.getElementById("money-display");
  const elLoc = document.getElementById("location-text");
  const elPrompt = document.getElementById("interaction-prompt");

  const slotModal = document.getElementById("slot-modal");
  const slotBackdrop = document.getElementById("slot-backdrop");
  const slotCloseBtn = document.getElementById("slot-close-btn");
  const exBackdrop = document.getElementById("exchange-backdrop");
  const exCloseBtn = document.getElementById("exchange-close-btn");

  const mobileActionBtn = document.getElementById("mobile-action");
  const isMobile = window.matchMedia && window.matchMedia("(max-width: 768px)").matches;

  // ---------- Utils ----------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------- Game State ----------
  const MAP_W = 2000;
  const MAP_H = 1400;

  const state = {
    player: { x: 360, y: 360, r: 14, speed: 6, color: "#3b82f6" },
    camera: { x: 0, y: 0 },
    keys: {},
    objects: [],
    joystick: null,
    ui: { slotOpen: false, exchangeOpen: false },
    nearest: null, // {obj, type}
  };

  // ---------- App Init (돈 로직) ----------
  if (!window.App) {
    console.error("money.js(App) missing");
    return;
  }
  App.init({ moneyEl: elMoney });

  // ---------- Modules ----------
  let slotGame = null;
  let exchangeUI = null;

  function ensureModules() {
    if (!slotGame && window.SlotMachine) {
      slotGame = new SlotMachine({ canvasId: "slotCanvas", app: App });
      slotGame.setActive(false);
    }
    if (!exchangeUI && window.ExchangeBoothUI) {
      exchangeUI = new ExchangeBoothUI({
        app: App,
        modalId: "exchange-modal",
        backdropId: "exchange-backdrop",
        closeBtnId: "exchange-close-btn",
        cashElId: "exchangeCash",
        chipsElId: "exchangeChips",
        msgElId: "exchangeMsg",
      });
    }
  }

  // ---------- Map / Objects ----------
  const ASSETS = {
    slot: { w: 60, h: 40 },
    card: { w: 120, h: 70 },
    roulette: { r: 40 },
    exchange: { w: 360, h: 220 },
  };

  function generateCasino() {
    state.objects.length = 0;

    // 슬롯 구역 (좌상)
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 10; c++) {
        state.objects.push({
          type: "slot",
          x: 180 + c * 90,
          y: 220 + r * 110,
          w: ASSETS.slot.w,
          h: ASSETS.slot.h,
        });
      }
    }

    // 카드 테이블 (좌하)
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 3; c++) {
        state.objects.push({
          type: "card",
          x: 260 + c * 260,
          y: 900 + r * 200,
          w: ASSETS.card.w,
          h: ASSETS.card.h,
        });
      }
    }

    // 룰렛 (중앙)
    for (let i = 0; i < 3; i++) {
      state.objects.push({
        type: "roulette",
        x: 1250,
        y: 360 + i * 240,
        r: ASSETS.roulette.r,
      });
    }

    // 환전소 (우하 쪽)
    state.objects.push({
      type: "exchange",
      x: 1500,
      y: 1020,
      w: ASSETS.exchange.w,
      h: ASSETS.exchange.h,
    });

    // 벽(장식)
    state.objects.push({ type: "wall", x: 0, y: 0, w: MAP_W, h: 20 });
    state.objects.push({ type: "wall", x: 0, y: MAP_H - 20, w: MAP_W, h: 20 });
    state.objects.push({ type: "wall", x: 0, y: 0, w: 20, h: MAP_H });
    state.objects.push({ type: "wall", x: MAP_W - 20, y: 0, w: 20, h: MAP_H });
  }

  // ---------- Slot Modal ----------
  function openSlot() {
    if (state.ui.slotOpen) return;
    ensureModules();

    // 동시에 열리지 않게
    closeExchange();

    state.ui.slotOpen = true;

    slotModal.classList.remove("hidden");
    slotModal.setAttribute("aria-hidden", "false");

    if (slotGame) {
      slotGame.setActive(true);
      slotGame.refreshCredit();
      slotGame.setMessage("레버를 당겨주세요!");
    }
  }

  function closeSlot() {
    if (!state.ui.slotOpen) return;
    state.ui.slotOpen = false;

    slotModal.classList.add("hidden");
    slotModal.setAttribute("aria-hidden", "true");
    state.nearest = null;

    if (slotGame) slotGame.setActive(false);
  }

  // ---------- Exchange Modal ----------
  function openExchange() {
    ensureModules();
    if (!exchangeUI) return;
    if (state.ui.exchangeOpen) return;

    // 동시에 열리지 않게
    closeSlot();

    state.ui.exchangeOpen = true;
    state.keys = {};
    state.joystick = null;
    state.nearest = null;
    exchangeUI.open();
  }

  function closeExchange() {
    if (!state.ui.exchangeOpen) return;
    state.ui.exchangeOpen = false;

    if (exchangeUI) exchangeUI.close();
    state.keys = {};
    state.joystick = null;
    state.nearest = null;
    elPrompt.style.display = "none";
  }

  // ---------- Input ----------
  function bindInput() {
    window.addEventListener("keydown", (e) => {
      state.keys[e.code] = true;

      if (e.code === "Escape") {
        closeSlot();
        closeExchange();
        state.keys = {};
      }

      if (e.code === "Space") {
        if (!state.ui.slotOpen && !state.ui.exchangeOpen && state.nearest) {
          if (state.nearest.type === "slot") openSlot();
          if (state.nearest.type === "exchange") openExchange();
        }
        e.preventDefault();
      }
    });

    window.addEventListener("keyup", (e) => {
      state.keys[e.code] = false;
    });

    slotBackdrop.addEventListener("click", closeSlot);
    slotCloseBtn.addEventListener("click", closeSlot);

    if (exBackdrop) exBackdrop.addEventListener("click", closeExchange);
    if (exCloseBtn) exCloseBtn.addEventListener("click", closeExchange);

    if (mobileActionBtn) {
      mobileActionBtn.addEventListener("click", () => {
        if (state.ui.slotOpen || state.ui.exchangeOpen) return;
        if (!state.nearest) return;
        if (state.nearest.type === "slot") openSlot();
        if (state.nearest.type === "exchange") openExchange();
      });
    }

    // Mobile joystick
    setupTouchControls();
  }

  function setupTouchControls() {
    const zone = document.getElementById("joystick-zone");
    const knob = document.getElementById("joystick-knob");
    if (!zone || !knob) return;
    let startX = 0, startY = 0;

    if (isMobile) {
      zone.style.display = "block";

      zone.addEventListener("touchstart", (e) => {
        if (state.ui.slotOpen || state.ui.exchangeOpen) return;
        e.preventDefault();
        const t = e.touches[0];
        startX = t.clientX;
        startY = t.clientY;
        state.joystick = { x: 0, y: 0 };
      }, { passive: false });

      zone.addEventListener("touchmove", (e) => {
        if (state.ui.slotOpen || state.ui.exchangeOpen) return;
        if (!state.joystick) return;
        e.preventDefault();
        const t = e.touches[0];
        const dx = t.clientX - startX;
        const dy = t.clientY - startY;
        const dist = Math.min(50, Math.sqrt(dx * dx + dy * dy));
        const ang = Math.atan2(dy, dx);

        const mx = Math.cos(ang) * dist;
        const my = Math.sin(ang) * dist;

        knob.style.transform = `translate(calc(-50% + ${mx}px), calc(-50% + ${my}px))`;

        state.joystick.x = mx / 50;
        state.joystick.y = my / 50;
      }, { passive: false });

      zone.addEventListener("touchend", () => {
        state.joystick = null;
        knob.style.transform = "translate(-50%, -50%)";
      });

      return;
    }

    let dynStartX = 0, dynStartY = 0;

    document.addEventListener("touchstart", (e) => {
      if (state.ui.slotOpen || state.ui.exchangeOpen) return;
      if (e.target !== canvas) return;

      zone.style.display = "block";
      zone.style.left = (e.touches[0].clientX - 60) + "px";
      zone.style.top = (e.touches[0].clientY - 60) + "px";

      dynStartX = e.touches[0].clientX;
      dynStartY = e.touches[0].clientY;
      state.joystick = { x: 0, y: 0 };
    }, { passive: false });

    document.addEventListener("touchmove", (e) => {
      if (state.ui.slotOpen || state.ui.exchangeOpen) return;
      if (!state.joystick || e.target !== canvas) return;

      e.preventDefault();
      const t = e.touches[0];
      const dx = t.clientX - dynStartX;
      const dy = t.clientY - dynStartY;
      const dist = Math.min(50, Math.sqrt(dx * dx + dy * dy));
      const ang = Math.atan2(dy, dx);

      const mx = Math.cos(ang) * dist;
      const my = Math.sin(ang) * dist;

      knob.style.transform = `translate(calc(-50% + ${mx}px), calc(-50% + ${my}px))`;

      state.joystick.x = mx / 50;
      state.joystick.y = my / 50;
    }, { passive: false });

    document.addEventListener("touchend", () => {
      zone.style.display = "none";
      state.joystick = null;
      knob.style.transform = "translate(-50%, -50%)";
    });
  }

  // ---------- Update ----------
  function update() {
    if (!state.ui.slotOpen && !state.ui.exchangeOpen) {
      updatePlayer();
      updateInteraction();
    } else {
      elPrompt.style.display = "none";
    }

    updateCamera();
    updateLocationText();
  }

  function updatePlayer() {
    let dx = 0, dy = 0;

    if (state.keys["ArrowUp"] || state.keys["KeyW"]) dy -= 1;
    if (state.keys["ArrowDown"] || state.keys["KeyS"]) dy += 1;
    if (state.keys["ArrowLeft"] || state.keys["KeyA"]) dx -= 1;
    if (state.keys["ArrowRight"] || state.keys["KeyD"]) dx += 1;

    if (state.joystick && (state.joystick.x !== 0 || state.joystick.y !== 0)) {
      dx = state.joystick.x;
      dy = state.joystick.y;
    }

    if (dx !== 0 || dy !== 0) {
      const len = Math.sqrt(dx * dx + dy * dy);
      dx /= len; dy /= len;
      state.player.x += dx * state.player.speed;
      state.player.y += dy * state.player.speed;
    }

    state.player.x = clamp(state.player.x, state.player.r, MAP_W - state.player.r);
    state.player.y = clamp(state.player.y, state.player.r, MAP_H - state.player.r);
  }

  function updateCamera() {
    state.camera.x = clamp(state.player.x - canvas.width / 2, 0, Math.max(0, MAP_W - canvas.width));
    state.camera.y = clamp(state.player.y - canvas.height / 2, 0, Math.max(0, MAP_H - canvas.height));
  }

  function updateInteraction() {
    const px = state.player.x;
    const py = state.player.y;

    let best = null;
    let bestD2 = Infinity;

    for (const o of state.objects) {
      if (o.type !== "slot" && o.type !== "exchange") continue;

      let cx, cy;
      if (o.type === "slot") {
        cx = o.x + o.w / 2;
        cy = o.y + o.h / 2;
      } else {
        cx = o.x + o.w / 2;
        cy = o.y + o.h / 2;
      }

      const dx = cx - px;
      const dy = cy - py;
      const d2 = dx * dx + dy * dy;

      if (d2 < bestD2) {
        bestD2 = d2;
        best = o;
      }
    }

    // 타입별 상호작용 거리
    const radius = best?.type === "exchange" ? 85 : 65;

    if (best && bestD2 <= radius * radius) {
      state.nearest = best;
      elPrompt.style.display = "block";
      elPrompt.textContent = best.type === "exchange"
        ? "SPACE를 눌러 환전소"
        : "SPACE를 눌러 슬롯머신";
    } else {
      state.nearest = null;
      elPrompt.style.display = "none";
    }
  }

  function updateLocationText() {
    const p = state.player;

    // 환전소 근처면 우선 표시
    const booth = state.objects.find(o => o.type === "exchange");
    if (booth) {
      const cx = booth.x + booth.w / 2;
      const cy = booth.y + booth.h / 2;
      const dx = cx - p.x;
      const dy = cy - p.y;
      if ((dx * dx + dy * dy) <= 140 * 140) {
        elLoc.textContent = "환전소";
        elLoc.style.color = "#fbbf24";
        return;
      }
    }

    if (p.x < 1100 && p.y < 750) {
      elLoc.textContent = "슬롯 머신 구역";
      elLoc.style.color = "#fbbf24";
    } else if (p.x < 1100 && p.y >= 750) {
      elLoc.textContent = "카드 테이블 구역";
      elLoc.style.color = "#f87171";
    } else {
      elLoc.textContent = "카지노 로비";
      elLoc.style.color = "#ffffff";
    }
  }

  // ---------- Draw ----------
  function draw() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(-state.camera.x, -state.camera.y);

    drawFloor();
    drawObjects();
    drawPlayer();

    ctx.restore();
  }

  function drawFloor() {
    // 카페트 (번쩍 없음)
    ctx.fillStyle = "#24101b";
    ctx.fillRect(0, 0, MAP_W, MAP_H);

    // 패턴(정적)
    const size = 110;
    ctx.strokeStyle = "#331524";
    ctx.lineWidth = 2;
    for (let x = 0; x <= MAP_W; x += size) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, MAP_H);
      ctx.stroke();
    }
    for (let y = 0; y <= MAP_H; y += size) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(MAP_W, y);
      ctx.stroke();
    }
  }

  function drawObjects() {
    for (const o of state.objects) {
      if (o.type === "slot") {
        ctx.fillStyle = "#4a0404";
        ctx.fillRect(o.x, o.y, o.w, o.h);

        ctx.fillStyle = "#0b0b0b";
        ctx.fillRect(o.x + 10, o.y + 10, o.w - 20, 15);

        ctx.strokeStyle = "#b8912f";
        ctx.lineWidth = 2;
        ctx.strokeRect(o.x, o.y, o.w, o.h);

      } else if (o.type === "exchange") {
        // 환전소: 기존 톤 유지(검정/골드 테두리)
        // ===== Exchange Booth (top-down concept) =====
        const colors = {
          exchangeFloor: "#3e2723",
          counterTop: "#5d4037",
          counterTrim: "#d4af37",
          glass: "rgba(173,216,230,0.28)",
          safe: "#7f8c8d",
          money: "#85bb65",
          chipRed: "#c0392b",
          chipBlue: "#2980b9",
          chipBlack: "#2c3e50",
        };

        const bx = o.x, by = o.y, bw = o.w, bh = o.h;

        // 1) Booth floor
        ctx.fillStyle = colors.exchangeFloor;
        ctx.fillRect(bx, by, bw, bh);

        // 2) Gold trim inset
        ctx.strokeStyle = colors.counterTrim;
        ctx.lineWidth = 4;
        ctx.strokeRect(bx + 10, by + 10, bw - 20, bh - 20);

        // 3) Back wall + safes
        ctx.fillStyle = "#111";
        ctx.fillRect(bx, by, bw, 36);
        drawSafe(ctx, bx + 24, by + 6, colors.safe);
        drawSafe(ctx, bx + bw - 84, by + 6, colors.safe);

        // 4) Counter (bottom)
        const counterDepth = 56;
        const cy = by + bh - counterDepth;
        ctx.fillStyle = colors.counterTop;
        ctx.fillRect(bx - 10, cy, bw + 20, counterDepth);

        ctx.strokeStyle = colors.counterTrim;
        ctx.lineWidth = 5;
        ctx.strokeRect(bx - 10, cy, bw + 20, counterDepth);

        // 5) Security glass
        ctx.fillStyle = colors.glass;
        ctx.fillRect(bx - 10, cy - 10, bw + 20, 10);

        // 6) Glass frame + service trays
        for (let i = 0; i <= 4; i++) {
          const xPos = (bx - 10) + (i * ((bw + 20) / 4));
          ctx.fillStyle = "#95a5a6";
          ctx.fillRect(xPos - 4, cy - 14, 8, 18);

          if (i < 4) {
            ctx.fillStyle = "rgba(0,0,0,0.25)";
            ctx.fillRect(xPos + 40, cy + 18, 44, 10);
          }
        }

        // 7) Interior details
        drawMoneyStack(ctx, bx + 120, by + 70, colors.money);
        drawMoneyStack(ctx, bx + 150, by + 86, colors.money);
        drawMoneyStack(ctx, bx + 132, by + 58, colors.money);
        drawChipTray(ctx, bx + bw - 150, by + 64, colors);
        drawStaff(ctx, bx + 90, by + 118);
        drawStaff(ctx, bx + bw - 90, by + 118);

        // 8) Booth sign
        ctx.save();
        ctx.fillStyle = colors.counterTrim;
        ctx.font = "bold 14px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.shadowColor = "rgba(0,0,0,0.6)";
        ctx.shadowBlur = 6;
        ctx.fillText("EXCHANGE", bx + bw / 2, by + bh / 2);
        ctx.restore();

        // 9) Subtle spotlight
        const g = ctx.createRadialGradient(
          bx + bw / 2, by + bh, 40,
          bx + bw / 2, by + bh, 260
        );
        g.addColorStop(0, "rgba(255,215,0,0.10)");
        g.addColorStop(1, "rgba(0,0,0,0.00)");
        ctx.fillStyle = g;
        ctx.fillRect(bx, by, bw, bh);

      } else if (o.type === "card") {
        ctx.fillStyle = "#064e3b";
        roundRect(ctx, o.x, o.y, o.w, o.h, 12);
        ctx.fill();

        ctx.strokeStyle = "#633917";
        ctx.lineWidth = 4;
        roundRect(ctx, o.x, o.y, o.w, o.h, 12);
        ctx.stroke();

      } else if (o.type === "roulette") {
        ctx.fillStyle = "#2e2e2e";
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#5c1919";
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r * 0.72, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        ctx.translate(o.x, o.y);
        ctx.rotate(Date.now() / 1600);
        ctx.fillStyle = "#caa23a";
        ctx.fillRect(-2, -14, 4, 28);
        ctx.fillRect(-14, -2, 28, 4);
        ctx.restore();

      } else if (o.type === "wall") {
        ctx.fillStyle = "#0b0b0b";
        ctx.fillRect(o.x, o.y, o.w, o.h);
      }
    }
  }

  function drawSafe(c, x, y, fill) {
    c.fillStyle = fill;
    c.fillRect(x, y, 60, 26);
    c.strokeStyle = "#2c3e50";
    c.lineWidth = 2;
    c.strokeRect(x, y, 60, 26);

    c.beginPath();
    c.arc(x + 48, y + 13, 7, 0, Math.PI * 2);
    c.fillStyle = "#bdc3c7";
    c.fill();
    c.stroke();
  }

  function drawMoneyStack(c, x, y, fill) {
    c.fillStyle = fill;
    c.fillRect(x, y, 32, 16);
    c.strokeStyle = "#27ae60";
    c.lineWidth = 1;
    c.strokeRect(x, y, 32, 16);

    c.fillStyle = "#fff";
    c.fillRect(x + 11, y, 10, 16);
  }

  function drawChipTray(c, x, y, colors) {
    c.fillStyle = "#222";
    c.fillRect(x, y, 92, 56);

    const chipSize = 10;
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 7; col++) {
        c.beginPath();
        c.arc(x + 10 + (col * 12), y + 10 + (row * 11), chipSize / 2, 0, Math.PI * 2);

        if (row === 0) c.fillStyle = colors.chipRed;
        else if (row === 1) c.fillStyle = colors.chipBlue;
        else c.fillStyle = colors.chipBlack;

        c.fill();
      }
    }
  }

  function drawStaff(c, x, y) {
    c.fillStyle = "black";
    c.beginPath();
    c.ellipse(x, y + 10, 24, 14, 0, 0, Math.PI * 2);
    c.fill();

    c.fillStyle = "#f1c27d";
    c.beginPath();
    c.arc(x, y, 12, 0, Math.PI * 2);
    c.fill();
  }

  function drawPlayer() {
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.arc(state.player.x, state.player.y + 5, state.player.r, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = state.player.color;
    ctx.beginPath();
    ctx.arc(state.player.x, state.player.y, state.player.r, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("나", state.player.x, state.player.y - 22);
  }

  function roundRect(c, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + rr, y);
    c.arcTo(x + w, y, x + w, y + h, rr);
    c.arcTo(x + w, y + h, x, y + h, rr);
    c.arcTo(x, y + h, x, y, rr);
    c.arcTo(x, y, x + w, y, rr);
    c.closePath();
  }

  // ---------- Resize ----------
  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  // ---------- Main Loop ----------
  function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
  }

  // ---------- Init ----------
  function init() {
    resize();
    window.addEventListener("resize", resize);

    generateCasino();
    bindInput();
    ensureModules();

    requestAnimationFrame(loop);
  }

  init();
})();
