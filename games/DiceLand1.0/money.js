// money.js
// 1) 확증형 슬롯(App API): 돈/칩/저장은 반드시 App.* 메서드로만 변경
// 2) 단일 갱신(Single Update Path): 상태 변경은 commit() 1회로 저장+UI+구독자 갱신

(() => {
  const STORAGE_KEY = "grand_casino_wallet_v1";
  const RATE_WON_PER_CHIP = 1000;

  const clampInt = (n, min = 0, max = Number.MAX_SAFE_INTEGER) => {
    const x = Math.floor(Number(n) || 0);
    return Math.max(min, Math.min(max, x));
  };

  const formatWon = (n) => `₩${clampInt(n).toLocaleString("ko-KR")}`;
  const formatNum = (n) => clampInt(n).toLocaleString("ko-KR");

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;

      return {
        cash: clampInt(parsed.cash, 0),
        chips: clampInt(parsed.chips, 0),
      };
    } catch {
      return null;
    }
  }

  function saveState(s) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    } catch {
      // 저장 실패해도 게임은 계속
    }
  }

  const App = {
    // public constants
    RATE_WON_PER_CHIP,

    // internal
    _state: {
      cash: 500000, // 시작 현금(원)
      chips: 0,     // 시작 칩
    },
    _subs: new Set(),
    _moneyEl: null,

    init({ moneyEl }) {
      this._moneyEl = moneyEl || null;

      const loaded = loadState();
      if (loaded) this._state = loaded;

      this._render();
      this._notify();
    },

    subscribe(fn) {
      if (typeof fn !== "function") return () => {};
      this._subs.add(fn);
      return () => this._subs.delete(fn);
    },

    getState() {
      // 읽기전용 스냅샷
      return { cash: this._state.cash, chips: this._state.chips };
    },

    commit(patchOrFn) {
      const prev = this._state;
      const next = { cash: prev.cash, chips: prev.chips };

      if (typeof patchOrFn === "function") {
        const partial = patchOrFn({ ...prev });
        if (partial && typeof partial === "object") {
          if ("cash" in partial) next.cash = clampInt(partial.cash, 0);
          if ("chips" in partial) next.chips = clampInt(partial.chips, 0);
        }
      } else if (patchOrFn && typeof patchOrFn === "object") {
        if ("cash" in patchOrFn) next.cash = clampInt(patchOrFn.cash, 0);
        if ("chips" in patchOrFn) next.chips = clampInt(patchOrFn.chips, 0);
      }

      this._state = next;
      saveState(next);
      this._render();
      this._notify();
    },

    // ---- Money APIs (확증형) ----
    spendCash(won) {
      const a = clampInt(won, 0);
      if (this._state.cash < a) return false;
      this.commit((s) => ({ cash: s.cash - a }));
      return true;
    },

    addCash(won) {
      const a = clampInt(won, 0);
      if (a <= 0) return;
      this.commit((s) => ({ cash: s.cash + a }));
    },

    spendChips(chips) {
      const a = clampInt(chips, 0);
      if (this._state.chips < a) return false;
      this.commit((s) => ({ chips: s.chips - a }));
      return true;
    },

    addChips(chips) {
      const a = clampInt(chips, 0);
      if (a <= 0) return;
      this.commit((s) => ({ chips: s.chips + a }));
    },

    exchangeCashToChips(chips) {
      const c = clampInt(chips, 0);
      const cost = c * RATE_WON_PER_CHIP;
      if (c <= 0) return false;
      if (this._state.cash < cost) return false;

      this.commit((s) => ({ cash: s.cash - cost, chips: s.chips + c }));
      return true;
    },

    exchangeChipsToCash(chips) {
      const c = clampInt(chips, 0);
      const gain = c * RATE_WON_PER_CHIP;
      if (c <= 0) return false;
      if (this._state.chips < c) return false;

      this.commit((s) => ({ chips: s.chips - c, cash: s.cash + gain }));
      return true;
    },

    // ---- UI render (단일 갱신 경로) ----
    _render() {
      if (this._moneyEl) {
        // HUD는 기존대로 "현금 잔고"만 표시(디자인 유지)
        this._moneyEl.textContent = formatWon(this._state.cash);
      }
    },

    _notify() {
      const snap = this.getState();
      for (const fn of this._subs) {
        try { fn(snap); } catch { /* ignore */ }
      }
    },

    // formatting helpers (필요시 다른 모듈에서 사용)
    fmtWon: formatWon,
    fmtNum: formatNum,
  };

  window.App = App;
})();