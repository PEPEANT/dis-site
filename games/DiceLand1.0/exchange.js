// exchange.js
// 환전소 모달 UI만 담당 (돈/칩 변경은 App API만 사용)

(() => {
  class ExchangeBoothUI {
    constructor(opts) {
      this.app = opts.app;

      this.modal = document.getElementById(opts.modalId);
      this.backdrop = document.getElementById(opts.backdropId);
      this.closeBtn = document.getElementById(opts.closeBtnId);

      this.cashEl = document.getElementById(opts.cashElId);
      this.chipsEl = document.getElementById(opts.chipsElId);
      this.msgEl = document.getElementById(opts.msgElId);

      this.isOpen = false;
      this._unsub = null;

      this._bind();
      this._unsub = this.app.subscribe(() => this._render());
      this._render();
    }

    _bind() {
      if (this.backdrop) this.backdrop.addEventListener("click", () => this.close());
      if (this.closeBtn) this.closeBtn.addEventListener("click", () => this.close());

      // 버튼 바인딩 (exchange-modal 내부만)
      const btns = document.querySelectorAll("#exchange-modal .xchg-btn");
      btns.forEach((btn) => {
        btn.addEventListener("click", () => {
          const dir = String(btn.dataset.dir || "");
          const amount = Number(btn.dataset.amount || "0"); // chips 단위
          this._exchange(dir, amount);
        });
      });
    }

    _exchange(dir, chips) {
      if (!this.isOpen) return;

      let ok = false;
      if (dir === "C2H") ok = this.app.exchangeCashToChips(chips);
      if (dir === "H2C") ok = this.app.exchangeChipsToCash(chips);

      if (!this.msgEl) return;

      if (ok) {
        this.msgEl.textContent = "환전 완료!";
      } else {
        this.msgEl.textContent = "잔액/칩 부족!";
      }
    }

    _render() {
      const { cash, chips } = this.app.getState();
      if (this.cashEl) this.cashEl.textContent = this.app.fmtNum(cash);
      if (this.chipsEl) this.chipsEl.textContent = this.app.fmtNum(chips);
    }

    open() {
      if (this.isOpen) return;
      this.isOpen = true;

      if (this.modal) {
        this.modal.classList.remove("hidden");
        this.modal.setAttribute("aria-hidden", "false");
      }
      if (this.msgEl) this.msgEl.textContent = "환전할 금액(칩)을 선택하세요!";
      this._render();
    }

    close() {
      if (!this.isOpen) return;
      this.isOpen = false;

      if (this.modal) {
        this.modal.classList.add("hidden");
        this.modal.setAttribute("aria-hidden", "true");
      }
    }
  }

  window.ExchangeBoothUI = ExchangeBoothUI;
})();