(() => {
  "use strict";

  // ============================================================
  //  발렛의 전설 (Simple)
  //  - 텍스트 최소화 / 오류 제거 / 시작 안정화
  // ============================================================

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d", { alpha: false });

  // DOM
  const elStart = document.getElementById("startScreen");
  const elEnd = document.getElementById("endScreen");
  const btnStart = document.getElementById("btnStart");
  const btnRetry = document.getElementById("btnRetry");
  const elTime = document.getElementById("timeText");
  const elStage = document.getElementById("stageText");
  const elMoney = document.getElementById("scoreDisplay");
  const elQuotaText = document.getElementById("quotaText");
  const elQuotaBar = document.getElementById("quotaBar");
  const elHint = document.getElementById("hint");
  const elFinal = document.getElementById("finalScore");
  const elReason = document.getElementById("endReason");
  const elDamageCost = document.getElementById("damageCost");

  const elWalk = document.getElementById("walkControls");
  const elDrive = document.getElementById("driveControls");
  const elJoystick = document.getElementById("joystick");
  const elStick = elJoystick.querySelector(".stick");
  const elWheel = document.getElementById("steeringWheel");
  const elGas = document.getElementById("gasBtn");
  const elBrake = document.getElementById("brakeBtn");
  const elGearText = document.getElementById("gearText");
  const elAction = document.getElementById("actionBtn");
  const gearBtns = Array.from(document.querySelectorAll(".gearBtn"));

  // helpers
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const fmtMoney = (n) => `${Math.max(0, Math.floor(n)).toLocaleString()} 원`;
  const pad2 = (n) => String(n).padStart(2, "0");
  const mmss = (sec) => `${pad2(Math.floor(sec / 60))}:${pad2(sec % 60)}`;

  // canvas resize (HiDPI)
  let W = 0, H = 0, DPR = 1;
  function resize() {
    const rect = canvas.getBoundingClientRect();
    DPR = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    W = Math.max(1, Math.floor(rect.width * DPR));
    H = Math.max(1, Math.floor(rect.height * DPR));
    canvas.width = W;
    canvas.height = H;
  }
  window.addEventListener("resize", resize, { passive: true });
  resize();

  function cssW() { return canvas.getBoundingClientRect().width; }
  function cssH() { return canvas.getBoundingClientRect().height; }

  // ============================================================
  // Game State
  // ============================================================
  const Gear = { P: "P", R: "R", N: "N", D: "D" };

  const CarTypes = [
    { key: "COMPACT", label: "경차", w: 28, h: 46, base: 9000, tip: 0.10 },
    { key: "SEDAN", label: "세단", w: 30, h: 50, base: 12000, tip: 0.12 },
    { key: "SUV", label: "SUV", w: 34, h: 56, base: 15000, tip: 0.14 },
    { key: "LUX", label: "고급차", w: 32, h: 54, base: 20000, tip: 0.20 },
  ];

  const CustomerLines = [
    "조심히 부탁해요!",
    "급해요! 빨리요!",
    "깨끗하게만 해줘요~",
    "고급차라 신경좀!",
    "여기 주차 가능?",
    "팁 드릴게요 😉",
  ];

  let running = false;
  let ended = false;

  // time: 6 minutes total; stage switch at 3 minutes
  const TOTAL_TIME = 6 * 60;
  const STAGE_TIME = 3 * 60;

  const StageTargets = [
    { stage: 1, target: 60000 },
    { stage: 2, target: 120000 },
  ];

  const state = {
    t: 0,
    timeLeft: TOTAL_TIME,
    stage: 1,
    money: 0,
    damageCost: 0,
    stageStartMoney: 0,
    stageTarget: StageTargets[0].target,
    currentJob: null,
    cars: [],
  };

  // Player
  const player = {
    x: 120, y: 220,
    r: 10,
    speed: 140,
    inCarId: null,
  };

  function buildLot() {
    const w = cssW(), h = cssH();
    const margin = 18;
    const lot = {
      x: margin,
      y: 64,
      w: w - margin * 2,
      h: h - 64 - 110,
      drop: { x: margin + 18, y: 96, w: 92, h: 80 },
      pickup: { x: margin + 18, y: 200, w: 92, h: 80 },
      exit: { x: w - margin - 110, y: 96, w: 92, h: 80 },
      obstacles: [],
      spots: [],
    };

    // one-row spots
    const rowY = lot.y + lot.h - 110;
    const spotCount = Math.max(4, Math.min(7, Math.floor((lot.w - 40) / 90)));
    const gap = 10;
    const spotW = 70;
    const spotH = 100;
    const total = spotCount * spotW + (spotCount - 1) * gap;
    const startX = lot.x + (lot.w - total) / 2;
    for (let i = 0; i < spotCount; i++) {
      lot.spots.push({
        id: i,
        x: startX + i * (spotW + gap),
        y: rowY,
        w: spotW,
        h: spotH,
        occupiedBy: null,
        pickupRequested: false,
      });
    }

    lot.obstacles.push({ x: lot.x + lot.w * 0.45, y: lot.y + lot.h * 0.55, w: 20, h: 20 });
    lot.obstacles.push({ x: lot.x + lot.w * 0.58, y: lot.y + lot.h * 0.40, w: 20, h: 20 });

    return lot;
  }

  let lot = buildLot();
  window.addEventListener("resize", () => { lot = buildLot(); }, { passive: true });

  // ============================================================
  // Controls
  // ============================================================
  const keys = { up: false, down: false, left: false, right: false };
  let gasPressed = false;
  let brakePressed = false;

  const joy = { x: 0, y: 0, active: false, pid: null, baseX: 0, baseY: 0 };
  const wheel = { v: 0, active: false, pid: null, startAngle: 0, startV: 0 };

  function showControls() {
    const driving = player.inCarId !== null;
    elDrive.style.opacity = driving ? "1" : "0.25";
    elWalk.style.opacity = driving ? "0.25" : "1";
  }

  function setHint(msg, holdMs = 1200) {
    elHint.textContent = msg;
    if (holdMs > 0) {
      clearTimeout(setHint._t);
      setHint._t = setTimeout(() => {
        elHint.textContent = running ? contextHint() : "[영업 시작]을 눌러 시작";
      }, holdMs);
    }
  }

  function contextHint() {
    if (!running) return "[영업 시작]을 눌러 시작";
    if (player.inCarId === null) {
      const near = nearestInteractable();
      if (near?.kind === "carDrop") return "SPACE: 차 맡기기(탑승)";
      if (near?.kind === "carPickup") return "SPACE: 픽업 차량 탑승";
      return "SPACE: 상호작용";
    }
    const car = getCar(player.inCarId);
    if (!car) return "SPACE: 상호작용";
    if (car.state === "DRIVING") return "빈 주차칸에 넣고 SPACE: 주차";
    if (car.state === "PARKED" && car.pickupRequested) return "SPACE: 픽업(운전 시작)";
    return "SPACE: 상호작용";
  }

  function bindHoldButton(btn, onDown, onUp) {
    const start = (e) => { e.preventDefault(); onDown(); };
    const end = (e) => { e.preventDefault(); onUp(); };
    btn.addEventListener("pointerdown", start, { passive: false });
    btn.addEventListener("pointerup", end, { passive: false });
    btn.addEventListener("pointercancel", end, { passive: false });
    btn.addEventListener("pointerleave", end, { passive: false });
  }

  bindHoldButton(elGas, () => { gasPressed = true; }, () => { gasPressed = false; });
  bindHoldButton(elBrake, () => { brakePressed = true; }, () => { brakePressed = false; });

  elAction.addEventListener("pointerdown", (e) => { e.preventDefault(); handleAction(); }, { passive: false });

  function joyCenter() {
    const r = elJoystick.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, rad: r.width / 2 };
  }
  elJoystick.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    joy.active = true;
    joy.pid = e.pointerId;
    elJoystick.setPointerCapture(e.pointerId);
    updateJoy(e.clientX, e.clientY);
  }, { passive: false });

  elJoystick.addEventListener("pointermove", (e) => {
    if (!joy.active || e.pointerId !== joy.pid) return;
    e.preventDefault();
    updateJoy(e.clientX, e.clientY);
  }, { passive: false });

  elJoystick.addEventListener("pointerup", (e) => {
    if (e.pointerId !== joy.pid) return;
    e.preventDefault();
    joy.active = false;
    joy.pid = null;
    joy.x = 0; joy.y = 0;
    elStick.style.transform = `translate(-50%,-50%)`;
  }, { passive: false });

  function updateJoy(px, py) {
    const c = joyCenter();
    const dx = px - c.x;
    const dy = py - c.y;
    const max = c.rad - 24;
    const len = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, max / len);
    const sx = dx * k;
    const sy = dy * k;
    joy.x = clamp(sx / max, -1, 1);
    joy.y = clamp(sy / max, -1, 1);
    elStick.style.transform = `translate(calc(-50% + ${sx}px), calc(-50% + ${sy}px))`;
  }

  function wheelCenter() {
    const r = elWheel.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  elWheel.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    const c = wheelCenter();
    wheel.active = true;
    wheel.pid = e.pointerId;
    wheel.startV = wheel.v;
    wheel.startAngle = Math.atan2(e.clientY - c.y, e.clientX - c.x);
    elWheel.setPointerCapture(e.pointerId);
  }, { passive: false });

  elWheel.addEventListener("pointermove", (e) => {
    if (!wheel.active || e.pointerId !== wheel.pid) return;
    e.preventDefault();
    const c = wheelCenter();
    const ang = Math.atan2(e.clientY - c.y, e.clientX - c.x);
    let d = ang - wheel.startAngle;
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    const v = clamp(wheel.startV + d / (Math.PI / 1.4), -1, 1);
    wheel.v = v;
  }, { passive: false });

  elWheel.addEventListener("pointerup", (e) => {
    if (e.pointerId !== wheel.pid) return;
    e.preventDefault();
    wheel.active = false;
    wheel.pid = null;
  }, { passive: false });

  window.addEventListener("keydown", (e) => {
    const c = e.code;
    if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space"].includes(c)) e.preventDefault();

    if (c === "KeyW" || c === "ArrowUp") keys.up = true;
    if (c === "KeyS" || c === "ArrowDown") keys.down = true;
    if (c === "KeyA" || c === "ArrowLeft") keys.left = true;
    if (c === "KeyD" || c === "ArrowRight") keys.right = true;

    if (c === "KeyW") gasPressed = true;
    if (c === "KeyS") brakePressed = true;

    if (c === "Space") handleAction();

    if (c === "Digit1") setGear(Gear.P);
    if (c === "Digit2") setGear(Gear.R);
    if (c === "Digit3") setGear(Gear.N);
    if (c === "Digit4") setGear(Gear.D);
  }, { passive: false });

  window.addEventListener("keyup", (e) => {
    const c = e.code;
    if (c === "KeyW" || c === "ArrowUp") keys.up = false;
    if (c === "KeyS" || c === "ArrowDown") keys.down = false;
    if (c === "KeyA" || c === "ArrowLeft") keys.left = false;
    if (c === "KeyD" || c === "ArrowRight") keys.right = false;

    if (c === "KeyW") gasPressed = false;
    if (c === "KeyS") brakePressed = false;
  }, { passive: true });

  gearBtns.forEach((b) => b.addEventListener("click", () => setGear(b.getAttribute("data-gear"))));

  let currentGear = Gear.D;
  function setGear(g) {
    currentGear = g;
    elGearText.textContent = g;
    gearBtns.forEach((b) => b.classList.toggle("on", b.getAttribute("data-gear") === g));
    setHint(`기어 ${g}`, 700);
  }

  // ============================================================
  // Entities
  // ============================================================
  let _carId = 1;
  function randCustomerLine() { return CustomerLines[Math.floor(Math.random() * CustomerLines.length)]; }
  function randCarColor() {
    const colors = ["#60A5FA","#34D399","#FBBF24","#A78BFA","#FB7185","#22D3EE"];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  function spawnJobCar(stage) {
    const pool = stage === 1 ? CarTypes.slice(0, 3) : CarTypes;
    const type = pool[Math.floor(Math.random() * pool.length)];
    const id = _carId++;

    state.cars.push({
      id,
      typeKey: type.key,
      w: type.w,
      h: type.h,
      x: lot.drop.x + lot.drop.w / 2,
      y: lot.drop.y + lot.drop.h / 2,
      a: 0,
      vx: 0, vy: 0,
      speed: 0,
      state: "WAIT_DROP",
      spotId: null,
      pickupReadyAt: null,
      pickupRequested: false,
      damaged: 0,
      bubble: randCustomerLine(),
      color: randCarColor(),
    });

    setHint(`${type.label} 도착! (SPACE로 탑승)`, 1400);
  }

  function getCar(id) { return state.cars.find(c => c.id === id) || null; }

  // ============================================================
  // Action / Interaction
  // ============================================================
  function nearestInteractable() {
    const px = player.x, py = player.y;
    for (const c of state.cars) {
      const d = Math.hypot(px - c.x, py - c.y);
      if (d < 28) {
        if (c.state === "WAIT_DROP") return { kind: "carDrop", car: c };
        if (c.state === "PARKED" && c.pickupRequested) return { kind: "carPickup", car: c };
      }
    }
    return null;
  }

  function handleAction() {
    if (!running || ended) return;

    if (player.inCarId !== null) {
      const car = getCar(player.inCarId);
      if (!car) return;

      if (car.state === "PICKUP") {
        if (rectContains(lot.pickup, car.x, car.y)) {
          deliverCar(car);
          return;
        }
      }

      if (car.state === "DRIVING") {
        const spot = findSpotUnderCar(car);
        if (spot && isCarAligned(car) && Math.abs(car.speed) < 20) {
          parkCar(car, spot);
        } else {
          setHint("주차칸 안에서 천천히! (직각/저속)", 900);
        }
        return;
      }

      if (car.state === "PARKED" && car.pickupRequested) {
        startPickup(car);
        return;
      }

      exitCar(car);
      return;
    }

    const near = nearestInteractable();
    if (!near) { setHint("근처에 상호작용 대상이 없음", 700); return; }
    const car = near.car;

    if (near.kind === "carDrop") { enterCar(car); return; }
    if (near.kind === "carPickup") { enterCar(car); startPickup(car); return; }
  }

  function enterCar(car) {
    player.inCarId = car.id;
    if (car.state === "WAIT_DROP") car.state = "DRIVING";
    setHint("운전 시작", 700);
    showControls();
  }

  function exitCar(car) {
    player.inCarId = null;
    player.x = car.x + Math.cos(car.a + Math.PI / 2) * 18;
    player.y = car.y + Math.sin(car.a + Math.PI / 2) * 18;
    setHint("하차", 600);
    showControls();
  }

  function findSpotUnderCar(car) {
    for (const s of lot.spots) {
      if (s.occupiedBy !== null) continue;
      if (rectContains(s, car.x, car.y)) return s;
    }
    return null;
  }

  function isCarAligned(car) {
    let a = ((car.a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const d = Math.min(Math.abs(a - 0), Math.abs(a - Math.PI * 2));
    return d < (Math.PI / 10);
  }

  function parkCar(car, spot) {
    car.state = "PARKED";
    car.spotId = spot.id;
    spot.occupiedBy = car.id;

    car.x = spot.x + spot.w / 2;
    car.y = spot.y + spot.h / 2;
    car.a = 0;
    car.speed = 0;
    car.vx = 0; car.vy = 0;

    exitCar(car);

    car.pickupReadyAt = state.t + (5 + Math.random() * 8);
    car.pickupRequested = false;

    setHint("주차 완료! (잠시 후 픽업 요청)", 1400);
  }

  function startPickup(car) {
    car.state = "PICKUP";
    setHint("픽업! 픽업존에서 SPACE로 인도", 1400);
  }

  function deliverCar(car) {
    const type = CarTypes.find(t => t.key === car.typeKey) || CarTypes[0];
    const stageBonus = state.stage === 2 ? 1.2 : 1.0;

    const base = type.base;
    const tip = Math.floor(base * type.tip * stageBonus * (0.6 + Math.random() * 0.8));
    const earned = base + tip;

    const penalty = Math.min(earned, car.damaged);
    state.damageCost += penalty;
    const net = earned - penalty;
    state.money += net;

    if (car.spotId !== null) {
      const s = lot.spots[car.spotId];
      if (s && s.occupiedBy === car.id) s.occupiedBy = null;
    }

    state.cars = state.cars.filter(c => c.id !== car.id);
    player.inCarId = null;
    showControls();

    setHint(`인도 완료 +${fmtMoney(net)} (팁 ${fmtMoney(tip)} / 파손 -${fmtMoney(penalty)})`, 1600);

    spawnJobCar(state.stage);
  }

  function rectContains(r, x, y) {
    return x >= r.x && x <= (r.x + r.w) && y >= r.y && y <= (r.y + r.h);
  }

  // ============================================================
  // Damage / Collision
  // ============================================================
  function aabb(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  function carAABB(car) {
    const m = Math.max(car.w, car.h) * 0.6;
    return { x: car.x - m, y: car.y - m, w: m * 2, h: m * 2 };
  }

  function damage(car, amount) {
    car.damaged += amount;
    setHint(`파손! -${fmtMoney(amount)}`, 600);
  }

  // ============================================================
  // Update Loop
  // ============================================================
  let last = performance.now();

  function startGame() {
    resetGame();
    elStart.classList.add("hidden");
    elEnd.classList.add("hidden");
    running = true;
    ended = false;
    spawnJobCar(1);
    showControls();
    last = performance.now();
    requestAnimationFrame(loop);
  }

  function resetGame() {
    state.t = 0;
    state.timeLeft = TOTAL_TIME;
    state.stage = 1;
    state.money = 0;
    state.damageCost = 0;
    state.stageStartMoney = 0;
    state.stageTarget = StageTargets[0].target;
    state.cars = [];
    _carId = 1;

    player.x = lot.drop.x + lot.drop.w + 40;
    player.y = lot.drop.y + lot.drop.h / 2;
    player.inCarId = null;

    setGear(Gear.D);
  }

  function endGame(reason) {
    running = false;
    ended = true;
    elReason.textContent = reason;
    elFinal.textContent = fmtMoney(state.money);
    elEnd.classList.remove("hidden");
    setHint("영업 종료", 0);
  }

  btnStart.addEventListener("click", startGame);
  btnRetry.addEventListener("click", () => {
    elEnd.classList.add("hidden");
    elStart.classList.remove("hidden");
    setHint("[영업 시작]을 눌러 시작", 0);
  });

  function loop(now) {
    if (!running) return;
    const dt = clamp((now - last) / 1000, 0, 0.033);
    last = now;

    update(dt);
    render();

    requestAnimationFrame(loop);
  }

  function update(dt) {
    state.t += dt;
    state.timeLeft = Math.max(0, TOTAL_TIME - state.t);

    const newStage = (state.t < STAGE_TIME) ? 1 : 2;
    if (newStage !== state.stage) {
      state.stage = newStage;
      state.stageStartMoney = state.money;
      state.stageTarget = StageTargets[newStage - 1].target;
      setHint(`STAGE ${newStage}! 고급차/팁 ↑`, 1400);
    }

    if (state.timeLeft <= 0.0001) { endGame("시간 종료"); return; }

    for (const c of state.cars) {
      if (c.state === "PARKED" && !c.pickupRequested && c.pickupReadyAt !== null && state.t >= c.pickupReadyAt) {
        c.pickupRequested = true;
        setHint("픽업 요청 발생! (주차칸으로 가서 SPACE)", 1400);
      }
    }

    if (player.inCarId === null) {
      const dx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      const dy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
      const mx = clamp(dx + joy.x, -1, 1);
      const my = clamp(dy + joy.y, -1, 1);
      const len = Math.hypot(mx, my) || 1;

      player.x += (mx / len) * player.speed * dt;
      player.y += (my / len) * player.speed * dt;

      player.x = clamp(player.x, lot.x + player.r, lot.x + lot.w - player.r);
      player.y = clamp(player.y, lot.y + player.r, lot.y + lot.h - player.r);
    } else {
      const car = getCar(player.inCarId);
      if (car) updateCar(car, dt);
    }

    updateHUD();
  }

  function updateHUD() {
    elTime.textContent = `⏱ ${mmss(Math.floor(state.timeLeft))}`;
    elStage.textContent = `STAGE ${state.stage}`;
    elMoney.textContent = fmtMoney(state.money);
    elDamageCost.textContent = `${Math.floor(state.damageCost).toLocaleString()}`;

    const progress = clamp((state.money - state.stageStartMoney) / state.stageTarget, 0, 1);
    elQuotaText.textContent = `목표 ${fmtMoney(state.money - state.stageStartMoney)} / ${fmtMoney(state.stageTarget)}`;
    elQuotaBar.style.width = `${Math.floor(progress * 100)}%`;
  }

  function updateCar(car, dt) {
    const steerKey = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    const steer = clamp(steerKey + wheel.v, -1, 1);

    const accel = 420;
    const maxSpeed = 240;
    const brakePower = 720;

    let driveDir = 0;
    if (currentGear === Gear.D) driveDir = 1;
    if (currentGear === Gear.R) driveDir = -1;

    if (gasPressed && (currentGear === Gear.D || currentGear === Gear.R)) {
      car.speed = clamp(car.speed + accel * dt, -maxSpeed, maxSpeed);
      car.speed = Math.sign(driveDir) * Math.abs(car.speed);
    } else {
      car.speed = lerp(car.speed, 0, 0.8 * dt);
    }

    if (brakePressed) {
      car.speed = lerp(car.speed, 0, clamp(brakePower * dt / maxSpeed, 0, 1));
    }

    if (currentGear === Gear.P) car.speed = 0;

    const turnRate = 2.2;
    const spdNorm = clamp(Math.abs(car.speed) / maxSpeed, 0, 1);
    car.a += steer * turnRate * spdNorm * dt;

    const fx = Math.sin(car.a);
    const fy = -Math.cos(car.a);

    car.vx = fx * car.speed;
    car.vy = fy * car.speed;

    car.x += car.vx * dt;
    car.y += car.vy * dt;

    const pad = 12;
    let hit = false;
    if (car.x < lot.x + pad) { car.x = lot.x + pad; hit = true; }
    if (car.x > lot.x + lot.w - pad) { car.x = lot.x + lot.w - pad; hit = true; }
    if (car.y < lot.y + pad) { car.y = lot.y + pad; hit = true; }
    if (car.y > lot.y + lot.h - pad) { car.y = lot.y + lot.h - pad; hit = true; }

    const cb = carAABB(car);
    for (const o of lot.obstacles) {
      if (aabb(cb.x, cb.y, cb.w, cb.h, o.x, o.y, o.w, o.h)) {
        car.x -= car.vx * dt * 1.2;
        car.y -= car.vy * dt * 1.2;
        hit = true;
      }
    }

    if (hit) {
      car._hitCooldown = (car._hitCooldown || 0) - dt;
      if (car._hitCooldown <= 0) {
        car._hitCooldown = 0.4;
        damage(car, 1200 + Math.random() * 800);
      }
      car.speed *= 0.25;
    }
  }

  // ============================================================
  // Render
  // ============================================================
  function render() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#0a0f1c";
    ctx.fillRect(0, 0, W, H);

    const scale = DPR;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);

    drawLot();
    drawEntities();
  }

  function drawLot() {
    ctx.fillStyle = "#0c1426";
    roundRect(ctx, lot.x, lot.y, lot.w, lot.h, 18);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,.12)";
    ctx.lineWidth = 2;
    roundRect(ctx, lot.x, lot.y, lot.w, lot.h, 18);
    ctx.stroke();

    zoneBox(lot.drop, "DROP");
    zoneBox(lot.pickup, "PICKUP");
    zoneBox(lot.exit, "EXIT");

    for (const s of lot.spots) {
      ctx.strokeStyle = "rgba(255,255,255,.18)";
      ctx.lineWidth = 2;
      ctx.strokeRect(s.x, s.y, s.w, s.h);

      ctx.strokeStyle = "rgba(255,255,255,.10)";
      ctx.beginPath();
      ctx.moveTo(s.x, s.y + s.h * 0.55);
      ctx.lineTo(s.x + s.w, s.y + s.h * 0.55);
      ctx.stroke();

      if (s.occupiedBy !== null) {
        ctx.fillStyle = "rgba(255,255,255,.04)";
        ctx.fillRect(s.x, s.y, s.w, s.h);
      }
    }

    for (const o of lot.obstacles) {
      ctx.fillStyle = "rgba(255,255,255,.08)";
      ctx.fillRect(o.x, o.y, o.w, o.h);
      ctx.strokeStyle = "rgba(255,255,255,.14)";
      ctx.strokeRect(o.x, o.y, o.w, o.h);
    }
  }

  function zoneBox(z, label) {
    ctx.save();
    ctx.strokeStyle = "rgba(96,165,250,.18)";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.strokeRect(z.x, z.y, z.w, z.h);
    ctx.setLineDash([]);

    ctx.fillStyle = "rgba(255,255,255,.55)";
    ctx.font = "12px system-ui, -apple-system, Noto Sans KR, sans-serif";
    ctx.fillText(label, z.x + 8, z.y + 16);
    ctx.restore();
  }

  function drawEntities() {
    for (const c of state.cars) {
      drawCar(c);
      if (c.state === "WAIT_DROP") drawBubble(c.x, c.y - 38, c.bubble);
      if (c.state === "PARKED" && c.pickupRequested) drawBubble(c.x, c.y - 38, "픽업!");
      if (c.state === "PICKUP" && player.inCarId === c.id) drawBubble(c.x, c.y - 38, "픽업존!");
    }

    if (player.inCarId === null) {
      ctx.fillStyle = "rgba(255,255,255,.88)";
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(96,165,250,.95)";
      ctx.beginPath();
      ctx.arc(player.x + 6, player.y - 6, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawCar(c) {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.a);

    ctx.fillStyle = c.color;
    roundRect(ctx, -c.w / 2, -c.h / 2, c.w, c.h, 8);
    ctx.fill();

    ctx.fillStyle = "rgba(0,0,0,.35)";
    roundRect(ctx, -c.w / 2 + 4, -c.h / 2 + 6, c.w - 8, 14, 6);
    ctx.fill();

    ctx.fillStyle = "rgba(0,0,0,.22)";
    roundRect(ctx, -c.w / 2 + 4, c.h / 2 - 20, c.w - 8, 14, 6);
    ctx.fill();

    if (player.inCarId === c.id) {
      ctx.strokeStyle = "rgba(255,255,255,.85)";
      ctx.lineWidth = 2;
      roundRect(ctx, -c.w / 2 - 2, -c.h / 2 - 2, c.w + 4, c.h + 4, 10);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawBubble(x, y, text) {
    ctx.save();
    ctx.font = "12px system-ui, -apple-system, Noto Sans KR, sans-serif";
    const pad = 8;
    const w = ctx.measureText(text).width + pad * 2;
    const h = 22;

    ctx.fillStyle = "rgba(18,25,40,.85)";
    ctx.strokeStyle = "rgba(255,255,255,.12)";
    roundRect(ctx, x - w / 2, y - h, w, h, 10);
    ctx.fill();
    roundRect(ctx, x - w / 2, y - h, w, h, 10);
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,.88)";
    ctx.fillText(text, x - w / 2 + pad, y - 7);
    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
  }

  setHint("[영업 시작]을 눌러 시작", 0);
  showControls();
})();
