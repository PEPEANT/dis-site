// slotMachine.js
// 슬롯 게임 전용 (돈/칩은 App API로만 변경)
// 주의: bet 버튼은 "#slot-modal .bet-btn" 로만 스코프해서 환전 버튼과 충돌 방지

(() => {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const SYMBOLS = [
    { id: "dice",   char: "🎲", payout: 50 },
    { id: "dia",    char: "💎", payout: 30 },
    { id: "bell",   char: "🔔", payout: 15 },
    { id: "grape",  char: "🍇", payout: 10 },
    { id: "cherry", char: "🍒", payout: 2 }
  ];

  class SlotMachine {
    constructor(opts) {
      this.app = opts.app;
      this.canvas = document.getElementById(opts.canvasId);
      if (!this.canvas) return;

      this.ctx = this.canvas.getContext("2d");
      this.active = false;

      this.bet = 100; // chips
      this.state = "IDLE";
      this.lever = { angle: 0, isDragging: false, dragStartY: 0 };

      this.reels = [
        { symbol: SYMBOLS[0], speed: 0, offset: 0 },
        { symbol: SYMBOLS[0], speed: 0, offset: 0 },
        { symbol: SYMBOLS[0], speed: 0, offset: 0 },
      ];

      this.creditEl = document.getElementById("creditDisplay");
      this.winEl = document.getElementById("winDisplay");
      this.msgEl = document.getElementById("msgArea");

      this._bindLeverEvents();
      this._bindBetButtons();

      this._unsub = this.app.subscribe(() => this.refreshCredit());
      this.refreshCredit();
      this.setWin(0);

      requestAnimationFrame(() => this._loop());
    }

    setActive(v) {
      this.active = !!v;
      if (this.active) {
        this.refreshCredit();
        this.setMessage("레버를 당겨주세요!");
      }
    }

    refreshCredit() {
      if (!this.creditEl) return;
      const { chips } = this.app.getState();
      this.creditEl.textContent = this.app.fmtNum(chips);
    }

    setMessage(txt) {
      if (this.msgEl) this.msgEl.textContent = txt;
    }

    setWin(amount, color = "#9cf59c") {
      if (!this.winEl) return;
      const v = Math.max(0, Math.floor(Number(amount) || 0));
      this.winEl.textContent = this.app.fmtNum(v);
      this.winEl.style.color = color;
    }

    _bindBetButtons() {
      const btns = document.querySelectorAll("#slot-modal .bet-btn");
      btns.forEach((btn) => {
        btn.addEventListener("click", () => {
          const bet = Number(btn.dataset.bet || "0");
          this._changeBet(bet, btn);
        });
      });
    }

    _changeBet(amount, btnEl) {
      if (this.state !== "IDLE") return;
      this.bet = Math.max(0, Math.floor(Number(amount) || 0));

      document.querySelectorAll("#slot-modal .bet-btn").forEach((b) => b.classList.remove("active"));
      if (btnEl) btnEl.classList.add("active");

      this.setMessage(`배팅: ${this.app.fmtNum(this.bet)} 칩`);
    }

    _bindLeverEvents() {
      // mouse
      this.canvas.addEventListener("mousedown", (e) => {
        if (!this.active) return;
        const rect = this.canvas.getBoundingClientRect();
        this._startDrag(e.clientX - rect.left, e.clientY - rect.top);
      });

      window.addEventListener("mousemove", (e) => {
        if (!this.lever.isDragging) return;
        const rect = this.canvas.getBoundingClientRect();
        this._drag(e.clientY - rect.top);
      });

      window.addEventListener("mouseup", () => this._endDrag());

      // touch
      this.canvas.addEventListener("touchstart", (e) => {
        if (!this.active) return;
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const t = e.touches[0];
        this._startDrag(t.clientX - rect.left, t.clientY - rect.top);
      }, { passive: false });

      window.addEventListener("touchmove", (e) => {
        if (!this.lever.isDragging) return;
        const rect = this.canvas.getBoundingClientRect();
        const t = e.touches[0];
        this._drag(t.clientY - rect.top);
      }, { passive: false });

      window.addEventListener("touchend", () => this._endDrag());
    }

    _startDrag(x, y) {
      if (this.state !== "IDLE") return;
      // 기존 좌표 유지(우측 레버 영역)
      if (x > 310 && y < 180) {
        this.lever.isDragging = true;
        this.lever.dragStartY = y;
        this.state = "DRAGGING";
      }
    }

    _drag(y) {
      const delta = (y - this.lever.dragStartY) * 0.01;
      this.lever.angle = clamp(delta, 0, 1);
    }

    _endDrag() {
      if (!this.lever.isDragging) return;
      this.lever.isDragging = false;

      if (this.lever.angle > 0.6) {
        this._pullLeverAction();
      } else {
        this.state = "RELEASING";
      }
    }

    _pullLeverAction() {
      if (!this.active) return;

      // 칩 차감(환전 후 플레이)
      if (!this.app.spendChips(this.bet)) {
        this.setMessage("칩 부족! 환전소에서 환전하세요!");
        this.state = "RELEASING";
        this.refreshCredit();
        return;
      }

      this.refreshCredit();
      this.state = "RELEASING_SPIN";
      this.setMessage("행운을 빕니다! 🎲");
      this.setWin(0);

      this._startSpin();
    }

    _startSpin() {
      this.reels.forEach((reel, i) => { reel.speed = 30 + (i * 10); });

      this.finalResult = [];
      for (let i = 0; i < 3; i++) {
        this.finalResult.push(SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
      }

      setTimeout(() => this._stopReel(0), 1000);
      setTimeout(() => this._stopReel(1), 1800);
      setTimeout(() => this._stopReel(2), 2600);
    }

    _stopReel(index) {
      this.reels[index].speed = 0;
      this.reels[index].symbol = this.finalResult[index];

      if (index === 2) {
        this._checkWin();
        setTimeout(() => { this.state = "IDLE"; }, 500);
      }
    }

    _checkWin() {
      const [s1, s2, s3] = this.finalResult;
      let winChips = 0;
      let msg = "다음 기회에...";
      let color = "#9cf59c";

      if (s1.id === s2.id && s2.id === s3.id) {
        winChips = this.bet * s1.payout;
        msg = `★ 잭팟! [${s1.char}] x${s1.payout}!`;
        color = "#ffff00";
      } else {
        let cherry = 0;
        if (s1.id === "cherry") cherry++;
        if (s2.id === "cherry") cherry++;
        if (s3.id === "cherry") cherry++;

        if (cherry >= 2) {
          winChips = this.bet * 2;
          msg = "🍒 보너스 (2배)";
          color = "#ffaad4";
        } else if (cherry === 1) {
          winChips = Math.floor(this.bet * 0.5);
          msg = "🍒 환급 (50%)";
        }
      }

      if (winChips > 0) {
        this.app.addChips(winChips);
        this.setWin(winChips, color);
      } else {
        this.setWin(0);
      }

      this.setMessage(msg);
      this.refreshCredit();
    }

    _updatePhysics() {
      if (this.state === "RELEASING" || this.state === "RELEASING_SPIN" || this.state === "IDLE") {
        if (this.lever.angle > 0) {
          this.lever.angle -= 0.1;
          if (this.lever.angle < 0) this.lever.angle = 0;
        }
      }

      this.reels.forEach((reel) => {
        if (reel.speed > 0) {
          reel.offset += reel.speed;
          if (Math.random() > 0.5) {
            reel.symbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
          }
        } else {
          reel.offset = 0;
        }
      });
    }

    _loop() {
      // 모달 닫혔을 땐 비용 최소화(최적화)
      if (this.active) {
        this._updatePhysics();
        this._draw();
      }
      requestAnimationFrame(() => this._loop());
    }

    _draw() {
      const c = this.ctx;
      c.clearRect(0, 0, this.canvas.width, this.canvas.height);

      // --- 원본 좌표 유지 ---
      const mx = 10, my = 15, mw = 300, mh = 200;

      // 1. 바디
      const bodyGrad = c.createLinearGradient(mx, my, mx, my + mh);
      bodyGrad.addColorStop(0, "#b91c1c");
      bodyGrad.addColorStop(1, "#450a0a");
      this._roundRect(mx, my, mw, mh, 15, bodyGrad, "#fbbf24");

      // 2. 로고
      this._roundRect(mx + 15, my + 10, mw - 30, 35, 8, "#222", "#eab308");
      c.fillStyle = "#ffd700";
      c.font = 'bold 18px "Rye", serif';
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText("GOLDEN DICE", mx + mw / 2, my + 28);

      // 3. 릴
      const sx = mx + 20, sy = my + 55, sw = mw - 40, sh = 100;
      this._roundRect(sx, sy, sw, sh, 5, "#000", "#555");

      const reelW = sw / 3;
      c.save();
      c.beginPath();
      c.rect(sx, sy, sw, sh);
      c.clip();

      for (let i = 0; i < 3; i++) {
        const rx = sx + i * reelW;

        const rGrad = c.createLinearGradient(rx, sy, rx + reelW, sy);
        rGrad.addColorStop(0, "#ccc");
        rGrad.addColorStop(0.5, "#fff");
        rGrad.addColorStop(1, "#ccc");
        c.fillStyle = rGrad;
        c.fillRect(rx + 1, sy, reelW - 2, sh);

        if (i > 0) {
          c.fillStyle = "#000";
          c.fillRect(rx, sy, 1, sh);
        }

        const symbol = this.reels[i].symbol;
        c.font = "36px serif";
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.fillStyle = "#000";

        let dy = 0;
        if (this.reels[i].speed > 0) dy = (Math.random() * 6 - 3);

        c.fillText(symbol.char, rx + reelW / 2, sy + sh / 2 + dy);
      }
      c.restore();

      // 페이라인
      c.strokeStyle = "rgba(255, 0, 0, 0.5)";
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(sx, sy + sh / 2);
      c.lineTo(sx + sw, sy + sh / 2);
      c.stroke();

      // 4. 레버
      this._drawLever(mx + mw, my + 70);

      // 5. 배당표
      c.fillStyle = "#fbbf24";
      c.font = "9px sans-serif";
      c.textAlign = "center";
      c.fillText("🎲x50 💎x30 🔔x15 🍇x10 🍒x2", mx + mw / 2, my + mh - 12);
    }

    _drawLever(bx, by) {
      const c = this.ctx;
      const angle = this.lever.angle;
      const len = 60;

      c.save();
      c.translate(bx, by);

      // 축
      c.fillStyle = "#444";
      c.beginPath();
      c.arc(0, 0, 10, 0, Math.PI * 2);
      c.fill();
      c.stroke();

      // 막대 회전
      const rad = (Math.PI / 2 * angle) - (Math.PI / 6);
      c.rotate(rad);

      const grad = c.createLinearGradient(0, -3, len, 3);
      grad.addColorStop(0, "#ddd");
      grad.addColorStop(1, "#555");
      c.fillStyle = grad;
      c.fillRect(0, -3, len, 6);

      // 손잡이
      c.translate(len, 0);
      c.fillStyle = "#d00";
      c.shadowColor = "black";
      c.shadowBlur = 3;
      c.beginPath();
      c.arc(0, 0, 12, 0, Math.PI * 2);
      c.fill();

      c.restore();
    }

    _roundRect(x, y, w, h, r, fill, stroke) {
      const c = this.ctx;
      let rr = r;
      if (w < 2 * rr) rr = w / 2;
      if (h < 2 * rr) rr = h / 2;

      c.beginPath();
      c.moveTo(x + rr, y);
      c.arcTo(x + w, y, x + w, y + h, rr);
      c.arcTo(x + w, y + h, x, y + h, rr);
      c.arcTo(x, y + h, x, y, rr);
      c.arcTo(x, y, x + w, y, rr);
      c.closePath();

      if (fill) {
        c.fillStyle = fill;
        c.fill();
      }
      if (stroke) {
        c.strokeStyle = stroke;
        c.lineWidth = 2;
        c.stroke();
      }
    }
  }

  window.SlotMachine = SlotMachine;
})();