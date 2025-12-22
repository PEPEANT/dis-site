/* 공통: 유틸 + 저장/불러오기 */
// ==========================================
// 2. Utility & Save System (V11 Safe Mode)
// ==========================================
// === [교체] 돈 표기 (토글용) ===
const fmtExact = (krw) => {
    // 예: 100,000,000원 (정확 콤마)
    if (krw === null || isNaN(krw)) return '0원';
    const neg = krw < 0;
    const abs = Math.round(Math.abs(krw));
    return (neg ? '-' : '') + abs.toLocaleString() + '원';
};

const fmtCompact = (krw) => {
    // 예: 1조 2,000억 5,400만원 / 1억원
    // - 100만원 미만은 절삭(컴팩트에서는 디테일 컷)
    if (krw === null || isNaN(krw)) return '0원';
    const neg = krw < 0;
    let abs = Math.round(Math.abs(krw));
    if (abs === 0) return '0원';

    if (abs >= 1_000_000) abs = Math.floor(abs / 1_000_000) * 1_000_000;

    const JO = 1_000_000_000_000; // 1조
    const EOK = 100_000_000;      // 1억
    const MANWON = 10_000;        // 1만원

    const jo = Math.floor(abs / JO);
    abs -= jo * JO;

    const eok = Math.floor(abs / EOK);
    abs -= eok * EOK;

    const man = Math.floor(abs / MANWON);

    const parts = [];
    if (jo > 0) parts.push(`${jo}조`);
    if (eok > 0) parts.push(`${eok.toLocaleString()}억`);
    if (man > 0) parts.push(`${man.toLocaleString()}만원`);

    // 1만원 미만이면 그냥 원 단위(이 경우는 컴팩트에서도 OK)
    if (parts.length === 0) return (neg ? '-' : '') + Math.round(Math.abs(krw)).toLocaleString() + '원';

    let out = parts.join(' ');
    // 조/억로 끝나는 경우만 "원"을 붙여 "1억원"처럼 마무리
    if (!out.endsWith('원')) out += '원';

    return (neg ? '-' : '') + out;
};

// ✅ 기존 코드 호환용 매핑(기존 호출부 유지)
const fmt = fmtCompact; // 컴팩트
const fmtK = fmtExact;  // 정확(콤마)

// === [교체] 클릭 토글 바인딩 ===
function bindMoneyToggle(el) {
    if (!el) return;
    if (el.dataset.moneyToggleBound === '1') return;
    el.dataset.moneyToggleBound = '1';

    // 기본은 컴팩트
    if (!el.dataset.moneyMode) el.dataset.moneyMode = 'compact';

    el.style.cursor = 'pointer';
    el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        el.dataset.moneyMode = (el.dataset.moneyMode === 'exact') ? 'compact' : 'exact';
        setMoneyText(el, Number(el.dataset.moneyVal || 0));
    });
}

function setMoneyText(el, krwVal) {
    if (!el) return;
    el.dataset.moneyVal = String(krwVal ?? 0);
    const mode = el.dataset.moneyMode || 'compact';
    el.innerText = (mode === 'exact') ? fmtK(krwVal) : fmt(krwVal);
}

function getMyTotalAsset() {
    let t = gameState.cash;
    Object.keys(gameState.stocks).forEach(k => t += gameState.stocks[k].price * gameState.stocks[k].qty);
    Object.keys(gameState.luxury).forEach(k => t += gameState.luxury[k].price * gameState.luxury[k].count);
    return t;
}

function getMyRank() {
    const t = getMyTotalAsset();
    return RANKS.find(r => t < r.limit) || RANKS[RANKS.length-1];
}

function showToast(msg) {
    const c = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = "bg-black/80 text-white px-4 py-2 rounded-full text-xs shadow-lg mb-2 animate-[fadeIn_0.3s_ease-out]";
    t.innerText = msg;
    c.appendChild(t);
    setTimeout(()=>t.remove(), 2500);
}

function _scaleLegacyMoney(value) {
    if(typeof value !== 'number' || isNaN(value)) return 0;
    return Math.round(value * LEGACY_USD_TO_KRW);
}

function _migrateLegacySave(data) {
    if(!data) return data;
    const migrated = JSON.parse(JSON.stringify(data));

    if(typeof migrated.cash === 'number') migrated.cash = _scaleLegacyMoney(migrated.cash);

    if(migrated.stocks) Object.keys(migrated.stocks).forEach(k => {
        const s = migrated.stocks[k];
        if(!s) return;
        if(typeof s.price === 'number') s.price = _scaleLegacyMoney(s.price);
        if(typeof s.avg === 'number') s.avg = _scaleLegacyMoney(s.avg);
    });

    if(migrated.crypto) Object.keys(migrated.crypto).forEach(k => {
        const c = migrated.crypto[k];
        if(!c) return;
        if(typeof c.price === 'number') c.price = _scaleLegacyMoney(c.price);
    });

    if(migrated.realEstate) Object.keys(migrated.realEstate).forEach(k => {
        const r = migrated.realEstate[k];
        if(!r) return;
        if(typeof r.price === 'number') r.price = _scaleLegacyMoney(r.price);
        if(typeof r.rent === 'number') r.rent = _scaleLegacyMoney(r.rent);
    });

    if(migrated.luxury) Object.keys(migrated.luxury).forEach(k => {
        const l = migrated.luxury[k];
        if(!l) return;
        if(typeof l.price === 'number') l.price = _scaleLegacyMoney(l.price);
    });

    if(Array.isArray(migrated.futures)) migrated.futures.forEach(p => {
        if(!p) return;
        if(typeof p.entry === 'number') p.entry = _scaleLegacyMoney(p.entry);
        if(typeof p.margin === 'number') p.margin = _scaleLegacyMoney(p.margin);
    });

    migrated.saveVersion = SAVE_VERSION;
    return migrated;
}

// --- Save System V11 (Safe Mode) ---
function exportSaveData() {
    // 1. 상태를 문자열로 변환
    gameState.saveVersion = SAVE_VERSION;
    const jsonStr = JSON.stringify(gameState);
    // 2. 한글 깨짐 방지를 위해 인코딩 후 Base64 변환
    const encoded = btoa(encodeURIComponent(jsonStr));

    // 3. 클립보드 복사 시도
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(encoded).then(() => {
            showToast("✅ 저장 코드가 클립보드에 복사되었습니다!");
            showToast("메모장에 붙여넣기(Ctrl+V) 하여 보관하세요.");
        }).catch(err => {
            showManualSaveModal(encoded); // 실패 시 수동 창
        });
    } else {
        showManualSaveModal(encoded); // 지원 안함 시 수동 창
    }
}

function showManualSaveModal(code) {
    const modal = document.getElementById('manual-save-modal');
    const textarea = document.getElementById('manual-save-code');
    textarea.value = code;
    modal.classList.remove('hidden');
    textarea.select();
    textarea.setSelectionRange(0, 99999); // 모바일 호환
}

function openLoadGameModal() {
    document.getElementById('load-game-modal').classList.remove('hidden');
    document.getElementById('load-code-input').value = "";
}

function closeLoadGameModal() {
    document.getElementById('load-game-modal').classList.add('hidden');
}

function importSaveData() {
    const input = document.getElementById('load-code-input').value.trim();
    if(!input) return showToast("코드를 입력해주세요.");

    try {
        // 1. 디코딩
        const decodedStr = decodeURIComponent(atob(input));
        // 2. JSON 파싱
        const loadedData = JSON.parse(decodedStr);

        // 3. V11 핵심: 안전 모드 (현금만 복구)
        // - 전체 객체를 덮어쓰면 데이터 구조 불일치로 렌더링 에러가 날 수 있음
        // - location.reload()는 인앱 브라우저에서 세션 종료를 유발함 -> 제거

        const isLegacy = !loadedData.saveVersion || loadedData.saveVersion < SAVE_VERSION;
        if (loadedData.cash !== undefined && !isNaN(loadedData.cash)) {
            gameState.cash = isLegacy ? _scaleLegacyMoney(loadedData.cash) : loadedData.cash; // 현금만 업데이트
            gameState.saveVersion = SAVE_VERSION;

            // 즉시 저장
            saveGame(); 

            // UI 강제 업데이트 (새로고침 없이)
            renderAll(); 

            closeLoadGameModal();
            showToast("✅ 안전 모드: 현금 자산만 복구되었습니다.");
            showToast("화면이 즉시 갱신되었습니다.");
        } else {
            throw new Error("현금 데이터가 없습니다.");
        }

    } catch (e) {
        showToast("⛔ 잘못된 코드이거나 데이터 버전이 다릅니다.");
        console.error(e);
    }
}

function saveGame() {
    gameState.saveVersion = SAVE_VERSION;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(gameState));
}
function loadGame() {
    let s = localStorage.getItem(STORAGE_KEY);
    let usedLegacyKey = false;
    if(!s) {
        s = localStorage.getItem(LEGACY_STORAGE_KEY);
        usedLegacyKey = !!s;
    }
    if(s) {
        try {
            let p = JSON.parse(s);
            const shouldMigrate = usedLegacyKey || !p.saveVersion || p.saveVersion < SAVE_VERSION;
            if(shouldMigrate) p = _migrateLegacySave(p);
            gameState.cash = p.cash || 0;
            if(p.stocks) Object.keys(p.stocks).forEach(k=>{if(gameState.stocks[k]) Object.assign(gameState.stocks[k], p.stocks[k])});
            Object.keys(INITIAL_STATE.luxury).forEach(k => {
                if (!gameState.luxury[k]) gameState.luxury[k] = JSON.parse(JSON.stringify(INITIAL_STATE.luxury[k]));
                else {
                     const savedCount = gameState.luxury[k].count;
                     Object.assign(gameState.luxury[k], INITIAL_STATE.luxury[k]);
                     gameState.luxury[k].count = savedCount;
                }
            });
            if(p.realEstate) Object.keys(p.realEstate).forEach(k=>{if(gameState.realEstate[k]) gameState.realEstate[k].count = p.realEstate[k].count});
            gameState.futures = p.futures || [];
            gameState.partners = p.partners || [];
            gameState.partners.forEach(pt => {
                if(pt.isLover === undefined) pt.isLover = false;
                if(pt.title === undefined) pt.title = "지인";
            });
            gameState.saveVersion = SAVE_VERSION;
            if(shouldMigrate) {
                saveGame();
                if(usedLegacyKey) localStorage.removeItem(LEGACY_STORAGE_KEY);
            }
        } catch(e){ console.error(e); }
    }
}
