(() => {
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  // ========= Small helpers =========
  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const dist = (a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const fmtMoney = (n)=>n.toLocaleString()+" 원";
  const pad2 = (n)=>String(n).padStart(2,"0");
  const mmss = (sec)=>`${pad2(Math.floor(sec/60))}:${pad2(sec%60)}`;

  // polyfill roundRect
  if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
      const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
      this.beginPath();
      this.moveTo(x + rr, y);
      this.lineTo(x + w - rr, y);
      this.quadraticCurveTo(x + w, y, x + w, y + rr);
      this.lineTo(x + w, y + h - rr);
      this.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
      this.lineTo(x + rr, y + h);
      this.quadraticCurveTo(x, y + h, x, y + h - rr);
      this.lineTo(x, y + rr);
      this.quadraticCurveTo(x, y, x + rr, y);
      this.closePath();
      return this;
    };
  }

  // ========= Config =========
  const CAR_W = 34;
  const CAR_H = 56;

  const MAP_W = 760;
  let MAP_H = 680;

  const SLOT_W = 54;
  const SLOT_H = 80;
  const PILLAR = 18;

  // physics
  const ACCEL = 0.22;
  const FRICTION = 0.08;
  const BRAKE_POWER = 0.34;
  const MAX_SPEED = 7.2;

  const STEER_MAX = 0.85;
  const STEER_SPEED = 0.10;
  const STEER_RESTORE = 0.06;

  // damage
  const DMG_WALL = 38000;
  const DMG_PILLAR = 85000;
  const DMG_CAR = 70000;

  const BANKRUPT = -1000000;

  // spawn
  const MAX_CARS = 7;
  const SPAWN_MIN = 3400;
  const SPAWN_MAX = 5200;

  // ========= Stage system (3분 단위) =========
  const STAGE_LEN_SEC = 180; // 3 minutes
  const STAGES = [
    {
      name: "1단계(일반)",
      duration: STAGE_LEN_SEC,
      // 일반차 위주
      typeWeights: { "경차": 4, "아반떼": 4, "소나타": 2, "제네시스": 0, "포르쉐": 0 },
      tipMultiplier: 1.0,
      goalCars: 5,
      goalProfit: 200000
    },
    {
      name: "2단계(고급)",
      duration: STAGE_LEN_SEC,
      // 고급차 등장 + 팁↑
      typeWeights: { "경차": 1, "아반떼": 2, "소나타": 3, "제네시스": 3, "포르쉐": 2 },
      tipMultiplier: 1.35,
      goalCars: 6,
      goalProfit: 320000
    }
  ];

  // ========= Cars (스킨+금액) =========
  const CAR_TYPES = [
    { name:"경차",     basePay: 18000, tipMin: 1000, tipMax: 3000,  body:"#f7fafc", stripe:"#94a3b8", glass:"#1f3b64" },
    { name:"아반떼",   basePay: 26000, tipMin: 1500, tipMax: 4500,  body:"#e53e3e", stripe:"#ffffff", glass:"#1f3b64" },
    { name:"소나타",   basePay: 36000, tipMin: 2000, tipMax: 7000,  body:"#3182ce", stripe:"#93c5fd", glass:"#0f2a52" },
    { name:"제네시스", basePay: 65000, tipMin: 3000, tipMax: 12000, body:"#111827", stripe:"#cbd5e1", glass:"#0b2a4a" },
    { name:"포르쉐",   basePay: 98000, tipMin: 6000, tipMax: 22000, body:"#ecc94b", stripe:"#0b1220", glass:"#0b2a4a" }
  ];
  const typeByName = Object.fromEntries(CAR_TYPES.map(t => [t.name, t]));

  // ========= Speech =========
  const SAY = {
    drop: ["키 여기요!", "부탁해요~", "차 조심!", "기둥 조심!", "잘 부탁!"],
    parkedGood: ["주차 깔끔!", "역시 프로!", "오케이!", "좋아요!"],
    pickup: ["차 빼주세요!", "출구로!", "저 급해요!", "어서요!", "빨리요!"],
    waitBad: ["늦으면 팁 없음!", "아직도요?", "저 시간 없어요!", "빨리!"],
    paid: ["수고했어요!", "팁 얹어드림!", "깔끔!", "다음에도!"]
  };

  // ========= UI refs =========
  const ui = {
    rankBadge: document.getElementById("rankBadge"),
    score: document.getElementById("scoreDisplay"),
    debt: document.getElementById("damageCost"),
    quotaText: document.getElementById("quotaText"),
    quotaBar: document.getElementById("quotaBar"),
    stageText: document.getElementById("stageText"),
    timeText: document.getElementById("timeText"),
    gearText: document.getElementById("gearText"),
    hint: document.getElementById("hint"),
    flash: document.getElementById("damageFlash"),
    startScreen: document.getElementById("startScreen"),
    endScreen: document.getElementById("endScreen"),
    endReason: document.getElementById("endReason"),
    finalScore: document.getElementById("finalScore"),
    btnMain: document.getElementById("btnMain"),
    btnSub: document.getElementById("btnSub"),
    walkControls: document.getElementById("walkControls"),
    driveControls: document.getElementById("driveControls"),
    steeringWheel: document.getElementById("steeringWheel")
  };

  // ========= Audio (lazy) =========
  let audioCtx = null;
  function ensureAudio(){
    if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if(audioCtx.state === "suspended") audioCtx.resume();
  }
  function playSound(type){
    if(!audioCtx) return;
    if(audioCtx.state === "suspended") audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    const now = audioCtx.currentTime;
    if(type==="crash"){
      osc.type="sawtooth";
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(28, now+0.28);
      gain.gain.setValueAtTime(0.26, now);
      gain.gain.linearRampToValueAtTime(0, now+0.28);
      osc.start(); osc.stop(now+0.28);
    } else if(type==="coin"){
      osc.type="sine";
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.setValueAtTime(1750, now+0.08);
      gain.gain.setValueAtTime(0.10, now);
      gain.gain.linearRampToValueAtTime(0, now+0.18);
      osc.start(); osc.stop(now+0.18);
    } else if(type==="honk"){
      osc.type="square";
      osc.frequency.setValueAtTime(420, now);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.linearRampToValueAtTime(0, now+0.10);
      osc.start(); osc.stop(now+0.10);
    }
  }

  // ========= World state =========
  let screenW=0, screenH=0;
  let camX=0, camY=0;
  let lastTime=0;
  let raf=null;

  let gameState="menu";

  let money=0;
  let debt=0;
  let servedCars=0; // payout count in current stage

  // stage
  let stageIndex=0;
  let stageTimeLeft=STAGES[0].duration;
  let stageGoalCars=STAGES[0].goalCars;
  let stageGoalProfit=STAGES[0].goalProfit;

  // gear + inputs
  const Gear = { P:"P", R:"R", N:"N", D:"D" };
  let gear = Gear.P;

  // "가스/브레이크"는 별도 입력으로 관리 (키/터치)
  let gasPressed=false;
  let brakePressed=false;

  const keys = { ArrowUp:false, ArrowDown:false, ArrowLeft:false, ArrowRight:false };

  // entities
  let player = { x:0, y:0, r:10, state:"walking", targetCar:null };
  let cars = [];
  let customers = [];
  let floatTexts = [];

  // map objects
  let slots = [];
  let pillars = [];
  let cones = [];
  let speedBumps = [];

  // zones
  let entrance, exitZ, booth;

  // ========= Geometry / collision =========
  function getAABB(e){
    return { x:e.x - e.w/2, y:e.y - e.h/2, w:e.w, h:e.h };
  }
  function aabbHit(a,b){
    return (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y);
  }
  function checkRect(entity, rect){
    return aabbHit(getAABB(entity), rect);
  }

  // ========= UI update =========
  function updateUI(){
    ui.score.textContent = fmtMoney(money);
    ui.debt.textContent = "-"+fmtMoney(debt).replace(" 원"," 원");

    const profit = money - debt;
    let rank="초보 발렛기사";
    if(profit >  80000) rank="숙련된 조교";
    if(profit > 200000) rank="베스트 드라이버";
    if(profit > 350000) rank="발렛의 신";
    ui.rankBadge.textContent = rank;

    ui.stageText.textContent = String(stageIndex+1);
    ui.timeText.textContent = mmss(Math.max(0, Math.ceil(stageTimeLeft)));

    ui.gearText.textContent = gear;

    const carRatio = stageGoalCars ? clamp(servedCars/stageGoalCars, 0, 1) : 0;
    const profRatio = stageGoalProfit ? clamp(profit/stageGoalProfit, 0, 1) : 0;
    const ratio = Math.min(carRatio, profRatio);
    ui.quotaText.textContent = `${servedCars}/${stageGoalCars}대 · 순수익 ${profit.toLocaleString()}원`;
    ui.quotaBar.style.width = (ratio*100).toFixed(0)+"%";

    if(gameState==="playing"){
      if(player.state==="walking"){
        ui.hint.textContent = "이동: 방향키/WASD · 타겟 차량 근처 Space로 탑승";
      } else {
        ui.hint.textContent = "운전: 핸들(←/A →/D) · W=가스 · S=브레이크 · 기어 1/2/3/4";
      }
    }
  }

  // ========= Float text / speech =========
  function addFloat(text, x, y, c){
    floatTexts.push({ text, x, y, c, life:1.0 });
  }
  function say(type, x, y){
    const arr = SAY[type] || ["..."];
    addFloat(arr[Math.floor(Math.random()*arr.length)], x, y, "#ffffff");
  }

  // ========= Map =========
  function initMap(){
    entrance = { x: 30, y: 150, w: 110, h: 120, label:"입구" };
    booth    = { x: MAP_W/2 - 60, y: 60, w: 120, h: 80, label:"부스" };
    exitZ    = { x: MAP_W - 140, y: 150, w: 110, h: 120, label:"출구" };

    slots = [];
    pillars = [];
    cones = [];
    speedBumps = [];

    // 1줄 주차라인
    const startX = 130;
    const gap = 30;
    const perRow = Math.floor((MAP_W - 230) / (SLOT_W + gap));
    const y = MAP_H - 165;

    for(let i=0;i<perRow;i++){
      const px = startX + i*(SLOT_W+gap);
      slots.push({ x:px, y:y, w:SLOT_W, h:SLOT_H, occupiedBy:null });

      pillars.push({ x:px + SLOT_W + 4, y:y + SLOT_H/2 - 4, w:PILLAR, h:PILLAR });
      if(i===0) pillars.push({ x:px - PILLAR - 4, y:y + SLOT_H/2 - 4, w:PILLAR, h:PILLAR });
    }

    for(let i=0;i<4;i++){
      cones.push({ x: 160 + i*140, y: entrance.y + entrance.h + 80, r: 10 });
    }
    for(let i=0;i<3;i++){
      speedBumps.push({ x: 210 + i*170, y: MAP_H - 240, w: 70, h: 10 });
    }
  }

  function resize(){
    screenW = window.innerWidth;
    screenH = window.innerHeight;

    canvas.width  = Math.floor(screenW * devicePixelRatio);
    canvas.height = Math.floor(screenH * devicePixelRatio);
    canvas.style.width = screenW+"px";
    canvas.style.height = screenH+"px";
    ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);

    MAP_H = Math.max(640, Math.min(760, screenH+20));
    if(gameState==="menu") initMap();
  }

  // ========= Stage control =========
  function applyStage(idx){
    stageIndex = idx;
    const st = STAGES[stageIndex];
    stageTimeLeft = st.duration;
    stageGoalCars = st.goalCars;
    stageGoalProfit = st.goalProfit;
    servedCars = 0; // 스테이지별로 초기화(단계별 깨는 느낌)
    addFloat(st.name, booth.x + booth.w/2, booth.y + booth.h + 40, "#f6e05e");
  }

  function nextStageOrEnd(){
    // 스테이지 성공 조건: 목표 차량 + 목표 수익 달성
    const profit = money - debt;
    const success = (servedCars >= stageGoalCars && profit >= stageGoalProfit);

    if(!success){
      endGame("시간 종료 (목표 미달성)");
      return;
    }

    if(stageIndex+1 >= STAGES.length){
      endGame("🎉 모든 단계 클리어!");
      return;
    }

    // 다음 스테이지로
    applyStage(stageIndex+1);

    // 다음 단계는 고급차 느낌을 위해 즉시 스폰 약간 더
    setTimeout(spawnCar, 600);
    setTimeout(spawnCar, 1200);
  }

  // ========= Car type picking by weight =========
  function pickTypeForStage(){
    const weights = STAGES[stageIndex].typeWeights;
    let sum = 0;
    for(const k in weights) sum += weights[k];
    if(sum <= 0) return CAR_TYPES[0];

    let r = Math.random()*sum;
    for(const name in weights){
      r -= weights[name];
      if(r <= 0) return typeByName[name] || CAR_TYPES[0];
    }
    return CAR_TYPES[0];
  }

  // ========= Spawning =========
  function spawnCar(){
    if(gameState!=="playing") return;

    const busy = cars.some(c => c.state==="arriving" || (c.x < entrance.x + 160 && c.y < entrance.y + 190));
    if(!busy && cars.length < MAX_CARS){
      const type = pickTypeForStage();
      const tipMul = STAGES[stageIndex].tipMultiplier;

      const baseTip = type.tipMin + Math.floor(Math.random()*(type.tipMax-type.tipMin+1));
      const tip = Math.floor(baseTip * tipMul);

      cars.push({
        x:-80, y: entrance.y + entrance.h/2,
        w:CAR_W, h:CAR_H,
        angle: Math.PI/2,
        speed:0, steerAngle:0,
        type,
        state:"arriving", // arriving -> waiting_valet -> parked -> retrieving -> exiting
        driver:"ai",
        slot:null,
        scratch:0,
        pay:type.basePay,
        tip,
        id:Math.random(),
        parkedAt:0
      });
    }

    setTimeout(spawnCar, SPAWN_MIN + Math.random()*(SPAWN_MAX - SPAWN_MIN));
  }

  // ========= Customers =========
  function spawnCustomerForCar(car){
    customers.push({
      x: car.x - 25, y: car.y,
      car,
      visible:true,
      phase:"drop_walk_booth",
      returnTime:0,
      impatienceAt:0
    });
  }

  function moveTo(e, tx, ty, spd){
    const dx = tx - e.x, dy = ty - e.y;
    const d = Math.hypot(dx,dy);
    if(d > spd){
      e.x += (dx/d)*spd;
      e.y += (dy/d)*spd;
    }
  }

  // ========= Gear + Driving model =========
  // 기어 규칙:
  // P: 완전 정지(가스/브레이크 무시, 속도 0으로 수렴)
  // N: 중립(가스 무시, 브레이크만 적용, 자연감속)
  // D: 전진(가스=전진 가속)
  // R: 후진(가스=후진 가속)
  function setGear(g){
    gear = g;
    document.querySelectorAll(".gearBtn").forEach(b=>{
      b.classList.toggle("active", b.getAttribute("data-gear")===gear);
    });
    updateUI();
  }

  // ========= Action =========
  function handleAction(){
    if(gameState!=="playing") return;

    if(player.state==="walking" && player.targetCar){
      enterCar(player.targetCar);
    } else if(player.state==="driving"){
      exitCar();
    }
  }

  function enterCar(car){
    player.state="driving";
    player.targetCar = car;
    car.driver="player";

    // 주차 슬롯 해제
    if(car.slot) car.slot.occupiedBy=null;

    ui.walkControls.style.display="none";
    ui.driveControls.style.display="flex";
    ui.btnMain.textContent="하차";
    ui.btnSub.textContent="Space";

    // 처음 탑승하면 기본 D로
    setGear(Gear.D);
  }

  function exitCar(){
    const car = player.targetCar;
    if(!car) { player.state="walking"; return; }

    car.speed = 0;
    car.driver = null;

    player.state = "walking";
    player.x = car.x - 30;
    player.y = car.y;

    ui.walkControls.style.display="block";
    ui.driveControls.style.display="none";
    ui.btnMain.textContent="탑승";
    ui.btnSub.textContent="Space";

    // 내리면 P로
    setGear(Gear.P);

    // 1) 주차 판정
    let parked=false;
    for(const s of slots){
      if(!s.occupiedBy){
        const cx = s.x + s.w/2, cy = s.y + s.h/2;
        if(dist(car,{x:cx,y:cy}) < 30){
          s.occupiedBy = car;
          car.slot = s;
          car.state = "parked";
          car.angle = Math.PI/2;
          car.steerAngle = 0;
          car.x = cx; car.y = cy;
          parked=true;

          car.parkedAt = Date.now();
          addFloat("주차 완료", car.x, car.y - 34, "#49d69d");
          say("parkedGood", car.x, car.y - 54);

          // ✅ 주차 완료해야 손님 귀환 타이머 시작
          const cust = customers.find(c => c.car===car && c.phase==="drop_done_waiting");
          if(cust){
            cust.phase="away";
            cust.returnTime = Date.now() + 7000 + Math.random()*12000;
          }
          break;
        }
      }
    }

    // 2) 출구 정산
    if(!parked && checkRect(car, exitZ)){
      const cust = customers.find(c => c.car===car && c.phase==="wait_at_exit");
      if(cust){
        const payment = car.pay + car.tip;
        money += payment;
        servedCars += 1;

        playSound("coin");
        addFloat(`정산 +${(payment/10000).toFixed(1)}만원`, car.x, car.y - 40, "gold");
        say("paid", car.x, car.y - 60);

        car.driver="ai";
        car.state="exiting";
        cust.visible=false;
        cust.phase="done";
      } else {
        addFloat("손님이 출구에 없음", car.x, car.y - 30, "white");
      }
    }
  }

  // ========= Damage =========
  function bounceCar(car){
    car.speed *= -0.5;
    car.x -= Math.cos(car.angle)*8;
    car.y -= Math.sin(car.angle)*8;
  }
  function addDamage(car, amt){
    if(car.scratch > 0 && Math.random() > 0.25) return;
    car.scratch += amt;
    debt += amt;
    playSound("crash");
    addFloat(`파손! -${(amt/10000).toFixed(0)}만원`, car.x, car.y, "#ff5a5a");
    ui.flash.style.opacity = 0.55;
    setTimeout(()=> ui.flash.style.opacity = 0, 110);

    if(money - debt < BANKRUPT) endGame("파산 (부채 과다)");
  }

  function checkCarCollisions(car){
    const A = getAABB(car);
    if(A.x < 0 || A.x + A.w > MAP_W || A.y < 0 || A.y + A.h > MAP_H){
      bounceCar(car);
      addDamage(car, DMG_WALL);
    }

    for(const p of pillars){
      if(aabbHit(A, p)){
        bounceCar(car);
        addDamage(car, DMG_PILLAR);
        addFloat("기둥 쿵!!", car.x, car.y - 40, "#ff5a5a");
        break;
      }
    }

    for(const c of cones){
      if(Math.hypot(car.x - c.x, car.y - c.y) < 18){
        bounceCar(car);
        addDamage(car, 12000);
        addFloat("콘 박음", car.x, car.y - 30, "white");
        break;
      }
    }

    for(const other of cars){
      if(car === other) continue;
      if(Math.abs(car.x - other.x) < 65 && Math.abs(car.y - other.y) < 65){
        if(dist(car, other) < 38){
          bounceCar(car);
          addDamage(car, DMG_CAR);
          addDamage(other, DMG_CAR);
          break;
        }
      }
    }
  }

  // ========= Core update =========
  function update(dt){
    dt = Math.min(dt, 40);
    const ts = dt / 16.66;

    // stage timer
    stageTimeLeft -= dt/1000;
    if(stageTimeLeft <= 0){
      stageTimeLeft = 0;
      nextStageOrEnd();
      // nextStageOrEnd에서 endGame될 수 있으니 return
      if(gameState !== "playing") return;
    }

    // camera follow
    let tx = player.x - screenW/2;
    let ty = player.y - screenH/2;
    tx = clamp(tx, 0, Math.max(0, MAP_W - screenW));
    ty = clamp(ty, 0, Math.max(0, MAP_H - screenH));
    camX += (tx - camX) * 0.12;
    camY += (ty - camY) * 0.12;

    // walking
    if(player.state==="walking"){
      let dx=0, dy=0;
      if(keys.ArrowUp) dy -= 1;
      if(keys.ArrowDown) dy += 1;
      if(keys.ArrowLeft) dx -= 1;
      if(keys.ArrowRight) dx += 1;

      if(dx!==0 || dy!==0){
        const len = Math.hypot(dx,dy);
        player.x += (dx/len)*5.2*ts;
        player.y += (dy/len)*5.2*ts;
      }
      player.x = clamp(player.x, 10, MAP_W-10);
      player.y = clamp(player.y, 10, MAP_H-10);

      // target car
      player.targetCar=null;
      let md=74;
      for(const c of cars){
        const d = Math.hypot(player.x - c.x, player.y - c.y);
        if(d < md && (c.state==="waiting_valet" || c.state==="parked" || c.state==="retrieving")){
          player.targetCar=c;
          md=d;
        }
      }
    }

    // driving
    if(player.state==="driving"){
      const car = player.targetCar;
      if(!car){ player.state="walking"; return; }

      // steering
      if(keys.ArrowLeft) car.steerAngle -= STEER_SPEED*ts;
      else if(keys.ArrowRight) car.steerAngle += STEER_SPEED*ts;
      else{
        if(car.steerAngle > 0) car.steerAngle = Math.max(0, car.steerAngle - STEER_RESTORE*ts);
        else if(car.steerAngle < 0) car.steerAngle = Math.min(0, car.steerAngle + STEER_RESTORE*ts);
      }
      car.steerAngle = clamp(car.steerAngle, -STEER_MAX, STEER_MAX);
      ui.steeringWheel.style.transform = `rotate(${car.steerAngle*85}deg)`;

      // pedals resolve (PC는 W/S를 gas/brake로 매핑했고, 모바일은 버튼이 gasPressed/brakePressed 세팅)
      const gas = gasPressed;
      const brake = brakePressed;

      // gear affects acceleration
      if(gear === Gear.P){
        // 강제 정지
        car.speed *= 0.70;
        if(Math.abs(car.speed) < 0.05) car.speed = 0;
      }
      else if(gear === Gear.N){
        // 가스 무시, 브레이크만
        if(brake) car.speed -= Math.sign(car.speed || 1) * BRAKE_POWER*ts; // 멈추기
        else{
          if(car.speed > 0) car.speed = Math.max(0, car.speed - FRICTION*ts);
          else if(car.speed < 0) car.speed = Math.min(0, car.speed + FRICTION*ts);
        }
      }
      else if(gear === Gear.D){
        if(gas) car.speed += ACCEL*ts;
        if(brake) car.speed -= BRAKE_POWER*ts;
        if(!gas && !brake){
          if(car.speed > 0) car.speed = Math.max(0, car.speed - FRICTION*ts);
          else if(car.speed < 0) car.speed = Math.min(0, car.speed + FRICTION*ts);
        }
      }
      else if(gear === Gear.R){
        // 후진: 가스가 음의 방향으로
        if(gas) car.speed -= ACCEL*ts;
        if(brake) car.speed += BRAKE_POWER*ts; // 후진에서 브레이크는 “후진 속도를 줄이는 방향”이라 여기선 +로, 아래 clamp가 정리됨
        if(!gas && !brake){
          if(car.speed > 0) car.speed = Math.max(0, car.speed - FRICTION*ts);
          else if(car.speed < 0) car.speed = Math.min(0, car.speed + FRICTION*ts);
        }
      }

      // speed clamp (R은 -MAX/1.5까지, D는 MAX까지)
      car.speed = clamp(car.speed, -MAX_SPEED/1.5, MAX_SPEED);

      // steering rotation only when moving
      if(Math.abs(car.speed) > 0.12){
        const dir = car.speed > 0 ? 1 : -1;
        car.angle += car.steerAngle * (Math.abs(car.speed)/45) * dir * ts;
      }

      car.x += Math.cos(car.angle)*car.speed*ts;
      car.y += Math.sin(car.angle)*car.speed*ts;

      player.x = car.x; player.y = car.y;

      checkCarCollisions(car);
    }

    // cars AI
    for(let i=cars.length-1;i>=0;i--){
      const c = cars[i];
      if(c.state==="arriving"){
        c.x += 3.0*ts;
        if(c.x > entrance.x + 35){
          c.state="waiting_valet";
          spawnCustomerForCar(c);
          playSound("honk");
          say("drop", c.x, c.y - 35);
        }
      } else if(c.state==="exiting"){
        c.x += 6.2*ts;
        if(c.x > MAP_W + 170){
          if(c.slot) c.slot.occupiedBy = null;
          cars.splice(i,1);
        }
      }
    }

    // customers
    for(const cust of customers){
      if(!cust.visible && cust.phase!=="done") continue;
      const car = cust.car;

      if(cust.phase==="drop_walk_booth"){
        moveTo(cust, booth.x + booth.w/2, booth.y + booth.h/2, 2.2*ts);
        if(dist(cust,{x:booth.x+booth.w/2,y:booth.y+booth.h/2}) < 10){
          say("drop", cust.x, cust.y - 26);
          cust.phase="drop_leave";
        }
      }
      else if(cust.phase==="drop_leave"){
        moveTo(cust, -60, booth.y + 10, 3.2*ts);
        if(cust.x < -30){
          cust.visible=false;
          cust.phase="drop_done_waiting"; // 주차 대기
          cust.impatienceAt = Date.now() + 12000 + Math.random()*12000;
        }
      }
      else if(cust.phase==="drop_done_waiting"){
        if(Date.now() > cust.impatienceAt && car.state !== "parked"){
          cust.impatienceAt = Date.now() + 12000 + Math.random()*12000;
          addFloat(SAY.waitBad[Math.floor(Math.random()*SAY.waitBad.length)], car.x, car.y - 60, "#ffffff");
          playSound("honk");
        }
      }
      else if(cust.phase==="away"){
        if(Date.now() > cust.returnTime){
          cust.visible=true;
          cust.x=-60; cust.y=booth.y + 12;
          cust.phase="pickup_walk_booth";
        }
      }
      else if(cust.phase==="pickup_walk_booth"){
        moveTo(cust, booth.x + booth.w/2, booth.y + booth.h/2, 3.0*ts);
        if(dist(cust,{x:booth.x+booth.w/2,y:booth.y+booth.h/2}) < 10){
          cust.phase="pickup_request";
          if(car.state==="parked") car.state="retrieving";
          say("pickup", cust.x, cust.y - 26);
        }
      }
      else if(cust.phase==="pickup_request"){
        moveTo(cust, exitZ.x + exitZ.w/2, exitZ.y + exitZ.h/2, 2.2*ts);
        if(dist(cust,{x:exitZ.x+exitZ.w/2,y:exitZ.y+exitZ.h/2}) < 14){
          cust.phase="wait_at_exit";
        }
      }
      else if(cust.phase==="wait_at_exit"){
        if(Math.random() < 0.0015){
          addFloat(SAY.pickup[Math.floor(Math.random()*SAY.pickup.length)], cust.x, cust.y - 26, "#f6e05e");
        }
      }
    }

    // float texts
    floatTexts = floatTexts.filter(f=>{
      f.y -= 0.6*ts;
      f.life -= 0.02*ts;
      return f.life > 0;
    });

    updateUI();
  }

  // ========= Draw =========
  function draw(){
    ctx.fillStyle="#050913";
    ctx.fillRect(0,0,screenW,screenH);

    ctx.save();
    ctx.translate(-Math.floor(camX), -Math.floor(camY));

    // asphalt
    const grad = ctx.createLinearGradient(0,0,0,MAP_H);
    grad.addColorStop(0,"#2a2f3a");
    grad.addColorStop(1,"#1e2430");
    ctx.fillStyle = grad;
    ctx.fillRect(0,0,MAP_W,MAP_H);

    // walls
    ctx.fillStyle="#151a25";
    ctx.fillRect(0,0,MAP_W,18);
    ctx.fillRect(0,MAP_H-18,MAP_W,18);
    ctx.fillRect(0,0,18,MAP_H);
    ctx.fillRect(MAP_W-18,0,18,MAP_H);

    // subtle marking
    ctx.globalAlpha=0.12;
    for(let x=90;x<MAP_W;x+=140){
      ctx.fillStyle="#ffffff";
      ctx.fillRect(x, 18, 2, MAP_H-36);
    }
    ctx.globalAlpha=1;

    // arrows
    ctx.globalAlpha=0.24;
    drawArrow(110, entrance.y + entrance.h + 42);
    drawArrow(MAP_W - 115, exitZ.y + exitZ.h + 42);
    ctx.globalAlpha=1;

    // zones
    drawZone(entrance, "#1d4ed8");
    drawZone(exitZ, "#16a34a");
    drawZone(booth, "#d97706");

    // bumps
    for(const b of speedBumps){
      ctx.fillStyle="rgba(255,255,255,0.18)";
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle="rgba(0,0,0,0.25)";
      ctx.fillRect(b.x, b.y + b.h, b.w, 4);
    }

    // slots (1줄)
    for(const s of slots){
      ctx.fillStyle="rgba(255,255,255,0.05)";
      ctx.fillRect(s.x, s.y, s.w, s.h);

      ctx.strokeStyle="rgba(255,255,255,0.34)";
      ctx.lineWidth=2;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x, s.y + s.h);
      ctx.moveTo(s.x + s.w, s.y);
      ctx.lineTo(s.x + s.w, s.y + s.h);
      ctx.moveTo(s.x, s.y + s.h);
      ctx.lineTo(s.x + s.w, s.y + s.h);
      ctx.stroke();

      ctx.fillStyle="rgba(255,255,255,0.26)";
      ctx.font='900 12px "Noto Sans KR"';
      ctx.textAlign="center";
      ctx.fillText("P", s.x + s.w/2, s.y + s.h/2 + 4);
    }

    // pillars
    for(const p of pillars){
      ctx.fillStyle="#7b8598";
      ctx.fillRect(p.x,p.y,p.w,p.h);
      ctx.fillStyle="#cbd5e0";
      ctx.fillRect(p.x,p.y-4,p.w,4);
      ctx.fillStyle="#4b5563";
      ctx.fillRect(p.x+p.w,p.y,2,p.h);
      ctx.fillStyle="#f6ad55";
      ctx.fillRect(p.x,p.y+p.h/2-2,p.w,4);
    }

    // cones
    for(const c of cones){
      ctx.fillStyle="#f97316";
      ctx.beginPath(); ctx.arc(c.x,c.y,c.r,0,Math.PI*2); ctx.fill();
      ctx.fillStyle="rgba(255,255,255,0.7)";
      ctx.beginPath(); ctx.arc(c.x,c.y-3,3,0,Math.PI*2); ctx.fill();
      ctx.fillStyle="rgba(0,0,0,0.3)";
      ctx.beginPath(); ctx.ellipse(c.x,c.y+9,10,4,0,0,Math.PI*2); ctx.fill();
    }

    // cars
    for(const c of cars) drawCar(c);

    // customers
    for(const cu of customers){
      if(!cu.visible) continue;
      ctx.fillStyle="#f6e05e";
      ctx.beginPath(); ctx.arc(cu.x, cu.y, 8, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle="#0b1220";
      ctx.font='900 10px "Noto Sans KR"';
      ctx.textAlign="center";
      const tag = (cu.phase.startsWith("drop")) ? "키" : (cu.phase.includes("exit") ? "대기" : "손님");
      ctx.fillText(tag, cu.x, cu.y-10);
    }

    // player
    if(player.state==="walking"){
      ctx.shadowColor="rgba(0,0,0,0.55)";
      ctx.shadowBlur=8;
      ctx.fillStyle="#60a5fa";
      ctx.beginPath(); ctx.arc(player.x,player.y,10,0,Math.PI*2); ctx.fill();
      ctx.shadowBlur=0;

      ctx.fillStyle="white";
      ctx.font='900 10px "Noto Sans KR"';
      ctx.textAlign="center";
      ctx.fillText("나", player.x, player.y-14);

      if(player.targetCar){
        ctx.strokeStyle="rgba(255,255,255,0.55)";
        ctx.lineWidth=2;
        ctx.beginPath(); ctx.arc(player.x,player.y,26,0,Math.PI*2); ctx.stroke();
      }
    }

    // float
    for(const f of floatTexts){
      ctx.fillStyle=f.c;
      ctx.font='900 16px "Noto Sans KR"';
      ctx.strokeStyle="rgba(0,0,0,0.65)";
      ctx.lineWidth=4;
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillText(f.text, f.x, f.y);
    }

    ctx.restore();
  }

  function drawArrow(x,y){
    ctx.save();
    ctx.translate(x,y);
    ctx.fillStyle="#ffffff";
    ctx.beginPath();
    ctx.moveTo(0,-14);
    ctx.lineTo(18,10);
    ctx.lineTo(6,10);
    ctx.lineTo(6,26);
    ctx.lineTo(-6,26);
    ctx.lineTo(-6,10);
    ctx.lineTo(-18,10);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawZone(z,color){
    ctx.fillStyle=color;
    ctx.globalAlpha=0.86;
    ctx.fillRect(z.x,z.y,z.w,z.h);
    ctx.globalAlpha=1;

    ctx.strokeStyle="rgba(255,255,255,0.50)";
    ctx.lineWidth=2;
    ctx.strokeRect(z.x,z.y,z.w,z.h);

    ctx.fillStyle="rgba(0,0,0,0.35)";
    ctx.fillRect(z.x,z.y,z.w,26);

    ctx.fillStyle="#ffffff";
    ctx.font='900 16px "Black Han Sans"';
    ctx.textAlign="center";
    ctx.fillText(z.label, z.x+z.w/2, z.y+20);
  }

  function drawCar(c){
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.angle + Math.PI/2);

    // shadow
    ctx.fillStyle="rgba(0,0,0,0.26)";
    ctx.fillRect(-c.w/2+4, -c.h/2+6, c.w, c.h);

    // wheels
    ctx.fillStyle="#0b1220";
    ctx.save(); ctx.translate(-c.w/2, -c.h/3); ctx.rotate(c.steerAngle); ctx.fillRect(-3,-6,6,12); ctx.restore();
    ctx.save(); ctx.translate( c.w/2, -c.h/3); ctx.rotate(c.steerAngle); ctx.fillRect(-3,-6,6,12); ctx.restore();
    ctx.fillRect(-c.w/2-3, c.h/3-6, 6,12);
    ctx.fillRect( c.w/2-3, c.h/3-6, 6,12);

    // body
    ctx.fillStyle=c.type.body;
    ctx.roundRect(-c.w/2, -c.h/2, c.w, c.h, 7); ctx.fill();

    // stripe
    ctx.fillStyle=c.type.stripe;
    ctx.globalAlpha=0.85;
    ctx.fillRect(-c.w/2, -c.h/2 + 10, c.w, 10);
    ctx.globalAlpha=1;

    // glass
    ctx.fillStyle=c.type.glass;
    ctx.globalAlpha=0.92;
    ctx.roundRect(-c.w/2+3, -c.h/4, c.w-6, c.h/4, 2); ctx.fill();
    ctx.roundRect(-c.w/2+3, c.h/7, c.w-6, c.h/5, 2); ctx.fill();
    ctx.globalAlpha=1;

    // headlights
    ctx.fillStyle = (Math.abs(c.speed)>0.1 || c.state==="waiting_valet" || c.driver==="player") ? "#fff07a" : "#4b5563";
    ctx.shadowColor="#fff07a";
    ctx.shadowBlur=(c.driver==="player")?10:0;
    ctx.fillRect(-c.w/2+2, -c.h/2, 6,4);
    ctx.fillRect( c.w/2-8, -c.h/2, 6,4);
    ctx.shadowBlur=0;

    // brake lights (브레이크 밟을 때만)
    if(brakePressed && c.driver==="player" && Math.abs(c.speed) > 0.1){
      ctx.fillStyle="#ff3b3b"; ctx.shadowColor="#ff3b3b"; ctx.shadowBlur=10;
    } else ctx.fillStyle="#4a0f0f";
    ctx.fillRect(-c.w/2+2, c.h/2-4, 6,4);
    ctx.fillRect( c.w/2-8, c.h/2-4, 6,4);
    ctx.shadowBlur=0;

    // scratch
    if(c.scratch>0){
      ctx.strokeStyle="rgba(255,255,255,0.92)";
      ctx.lineWidth=2;
      ctx.beginPath();
      ctx.moveTo(-10,-10); ctx.lineTo(10,10);
      ctx.moveTo(10,-10); ctx.lineTo(-10,10);
      ctx.stroke();
    }

    ctx.restore();

    if(c.state==="retrieving"){
      ctx.fillStyle="#ff5a5a";
      ctx.font="24px serif";
      ctx.textAlign="center";
      ctx.fillText("❗", c.x, c.y-35);
    }
  }

  // ========= Loop =========
  function loop(t){
    if(gameState!=="playing") return;
    const dt = t - lastTime;
    lastTime = t;
    update(dt);
    draw();
    raf = requestAnimationFrame(loop);
  }

  // ========= Game flow =========
  function resetGame(){
    money=0; debt=0;
    cars=[]; customers=[]; floatTexts=[];
    camX=0; camY=0;

    initMap();

    player.state="walking";
    player.targetCar=null;
    player.x = booth.x + booth.w/2;
    player.y = booth.y + booth.h + 28;

    setGear(Gear.P);
    applyStage(0);

    updateUI();
  }

  function startGame(){
    ensureAudio();
    gameState="playing";
    ui.startScreen.classList.add("hidden");
    ui.endScreen.classList.add("hidden");

    ui.walkControls.style.display="block";
    ui.driveControls.style.display="none";
    ui.btnMain.textContent="탑승";
    ui.btnSub.textContent="Space";

    resetGame();

    setTimeout(spawnCar, 900);

    lastTime = performance.now();
    if(raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function endGame(reason){
    gameState="over";
    if(raf) cancelAnimationFrame(raf);
    raf=null;

    ui.endScreen.classList.remove("hidden");
    ui.endReason.textContent = reason;
    ui.finalScore.textContent = fmtMoney(money - debt);
  }

  // ========= Controls (PC + Mobile) =========
  function clearKeys(){
    for(const k in keys) keys[k]=false;
    gasPressed=false; brakePressed=false;
    document.querySelectorAll(".active").forEach(el=>el.classList.remove("active"));
  }

  function bindDpadButtons(){
    const nodes = document.querySelectorAll(".d-btn, .steer-touch-left, .steer-touch-right");
    nodes.forEach(el=>{
      const k = el.getAttribute("data-key");
      const start = (e)=>{ e.preventDefault(); ensureAudio(); keys[k]=true; el.classList.add("active"); };
      const end = (e)=>{ e.preventDefault(); keys[k]=false; el.classList.remove("active"); };

      el.addEventListener("pointerdown", start, {passive:false});
      el.addEventListener("pointerup", end, {passive:false});
      el.addEventListener("pointercancel", end, {passive:false});
      el.addEventListener("pointerleave", end, {passive:false});
    });
  }

  function bindPedals(){
    const brakeBtn = document.getElementById("brakeBtn");
    const gasBtn = document.getElementById("gasBtn");

    const mk = (btn, setter) => {
      const start = (e)=>{ e.preventDefault(); ensureAudio(); setter(true); btn.classList.add("active"); };
      const end   = (e)=>{ e.preventDefault(); setter(false); btn.classList.remove("active"); };

      btn.addEventListener("pointerdown", start, {passive:false});
      btn.addEventListener("pointerup", end, {passive:false});
      btn.addEventListener("pointercancel", end, {passive:false});
      btn.addEventListener("pointerleave", end, {passive:false});
    };

    mk(brakeBtn, (v)=>{ brakePressed=v; });
    mk(gasBtn, (v)=>{ gasPressed=v; });
  }

  function bindGearButtons(){
    document.querySelectorAll(".gearBtn").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        ensureAudio();
        setGear(btn.getAttribute("data-gear"));
      });
    });
  }

  // PC 키보드 매핑:
  // 이동(걷기): WASD/방향키
  // 운전: A/D 핸들, W=가스, S=브레이크
  // 기어: 1=P, 2=R, 3=N, 4=D
  window.addEventListener("keydown", (e)=>{
    ensureAudio();
    const code = e.code;

    // prevent scroll
    if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space"].includes(code)) e.preventDefault();

    // gear hotkeys
    if(code==="Digit1") setGear(Gear.P);
    if(code==="Digit2") setGear(Gear.R);
    if(code==="Digit3") setGear(Gear.N);
    if(code==="Digit4") setGear(Gear.D);

    // walking/steering keys
    if(code==="ArrowUp" || code==="KeyW") keys.ArrowUp = true;
    if(code==="ArrowDown" || code==="KeyS") keys.ArrowDown = true;
    if(code==="ArrowLeft" || code==="KeyA") keys.ArrowLeft = true;
    if(code==="ArrowRight" || code==="KeyD") keys.ArrowRight = true;

    // pedals on PC:
    // W gas, S brake  (걷기에서는 그냥 이동키로 사용되지만 운전중엔 pedalPressed를 같이 봄)
    if(code==="KeyW") gasPressed = true;
    if(code==="KeyS") brakePressed = true;

    if(code==="Space") handleAction();
  }, {passive:false});

  window.addEventListener("keyup", (e)=>{
    const code = e.code;
    if(code==="ArrowUp" || code==="KeyW") keys.ArrowUp = false;
    if(code==="ArrowDown" || code==="KeyS") keys.ArrowDown = false;
    if(code==="ArrowLeft" || code==="KeyA") keys.ArrowLeft = false;
    if(code==="ArrowRight" || code==="KeyD
