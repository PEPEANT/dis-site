/* 공통: 유틸 + 저장/불러오기 */
// ==========================================
// 2. Utility & Save System (V10.5 Safe Mode)
// ==========================================
const fmt = (usd) => {
    if(isNaN(usd)) return '0원';
    const krw = usd * EXCHANGE_RATE;
    if(Math.abs(krw)>=100000000) return (krw/100000000).toFixed(1)+'억원';
    return Math.floor(krw).toLocaleString()+'원';
};

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

// --- Save System V10.5 (Safe Mode) ---
function exportSaveData() {
    // 1. 상태를 문자열로 변환
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

        // 3. V10.5 핵심: 안전 모드 (현금만 복구)
        // - 전체 객체를 덮어쓰면 데이터 구조 불일치로 렌더링 에러가 날 수 있음
        // - location.reload()는 인앱 브라우저에서 세션 종료를 유발함 -> 제거

        if (loadedData.cash !== undefined && !isNaN(loadedData.cash)) {
            gameState.cash = loadedData.cash; // 현금만 업데이트

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

function saveGame() { localStorage.setItem(STORAGE_KEY, JSON.stringify(gameState)); }
function loadGame() {
    const s = localStorage.getItem(STORAGE_KEY);
    if(s) {
        try {
            const p = JSON.parse(s);
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
        } catch(e){ console.error(e); }
    }
}
