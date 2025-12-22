/* 공통: 시장 사이클/뉴스/타이머 */
// ==========================================
// Game Logic (Standard)
// ==========================================

function doPartTimeJob(e) {
    gameState.cash += PART_TIME_REWARD;
    saveGame(); renderAll();
    const el = document.createElement('div');
    el.className = 'click-effect'; el.innerText = `+${fmt(PART_TIME_REWARD)}`;
    el.style.left = e.clientX+'px'; el.style.top = e.clientY+'px';
    document.body.appendChild(el);
    setTimeout(()=>el.remove(), 1000);
}

function hasPhone() { return gameState.luxury.phone.count > 0 || gameState.luxury.smartphone.count > 0; }
function hasSmartPhone() { return gameState.luxury.smartphone.count > 0; }

function toggleBGM() {
    const audio = document.getElementById('bgm-player');
    const btn = document.getElementById('bgm-btn');
    if (audio.paused) {
        audio.play().then(() => {
            btn.innerText = '🔊';
            btn.classList.add('bg-indigo-100', 'text-indigo-600');
        }).catch(e => showToast("브라우저 정책상 재생 불가 (터치 필요)"));
    } else {
        audio.pause();
        btn.innerText = '🔇';
        btn.classList.remove('bg-indigo-100', 'text-indigo-600');
    }
}

setInterval(() => {
    const cycBias = CYCLES[marketCycle].bias;
    Object.keys(gameState.stocks).forEach(k => {
        gameState.stocks[k].price *= (1 + (Math.random()-0.5)*0.02 + cycBias);
        if(gameState.stocks[k].price<1) gameState.stocks[k].price=1;
    });
    chartHistory.push(gameState.stocks['NASDAQ'].price); chartHistory.shift();
    Object.keys(gameState.crypto).forEach(k => gameState.crypto[k].price *= (1 + (Math.random()-0.5)*0.05 + cycBias*2));
    Object.keys(gameState.luxury).forEach(k => {
        const item = gameState.luxury[k];
        if (!item.fixedPrice && item.type === 'asset') {
            item.price *= (1 + (Math.random()-0.4)*0.003); 
        }
    });
    renderAll();
}, 1000);

setInterval(() => {
    let isCrash = false;
    if (cycleIndex >= 3) { greedStreak++; fearStreak = 0; } 
    else if (cycleIndex <= 1) { fearStreak++; greedStreak = 0; } 
    else { greedStreak = 0; fearStreak = 0; }

    if (pendingBullRun) {
        cycleIndex = 3; pendingBullRun = false;
        showToast("🚀 과매도 후 급반등! 시장이 탐욕 단계로 진입합니다.");
    }
    else if (fearStreak >= 3) {
        cycleIndex = 2; fearStreak = 0; pendingBullRun = true;
        showToast("🕊️ 저가 매수세 유입! 시장이 바닥을 다집니다.");
    }
    else if (cycleIndex === 4 && Math.random() < 0.5) {
        isCrash = true;
        cycleIndex = 2; greedStreak = 0; 
        Object.keys(gameState.stocks).forEach(k => gameState.stocks[k].price *= 0.95);
        Object.keys(gameState.crypto).forEach(k => gameState.crypto[k].price *= 0.95);
        const crashMsg = CRASH_INTERNAL[Math.floor(Math.random() * CRASH_INTERNAL.length)];
        updateNews("📉 " + crashMsg + " (-5% 조정)");
        showToast("건전한 조정! 정책 이슈로 잠시 주춤합니다.");
    }
    else if (Math.random() < 0.05) { 
        isCrash = true;
        cycleIndex = 1; fearStreak = 0; pendingBullRun = false; 
        Object.keys(gameState.stocks).forEach(k => gameState.stocks[k].price *= 0.93);
        Object.keys(gameState.crypto).forEach(k => gameState.crypto[k].price *= 0.93);
        const crashMsg = CRASH_EXTERNAL[Math.floor(Math.random() * CRASH_EXTERNAL.length)];
        updateNews("🚨 " + crashMsg + " (-7% 급락)");
    } 
    else {
        if (cycleIndex === 0) cycleIndex += Math.floor(Math.random() * 2); 
        else cycleIndex += (Math.floor(Math.random() * 3) - 1); 
        if(cycleIndex < 0) cycleIndex = 0;
        if(cycleIndex > 4) cycleIndex = 4;
    }

    marketCycle = CYCLE_ORDER[cycleIndex];

    if (!isCrash) {
        const msgs = NEWS_MESSAGES[marketCycle];
        const msg = msgs[Math.floor(Math.random() * msgs.length)];
        updateNews(msg);
    }
    renderAll();
}, 10000);

function updateNews(msg) {
    currentTickerMsg = msg;
    const time = new Date().toLocaleTimeString('ko-KR',{hour12:false,hour:'2-digit',minute:'2-digit'});
    gameState.newsHistory.unshift({time, msg});
    if(gameState.newsHistory.length > 20) gameState.newsHistory.pop();
    const stockTicker = document.getElementById('stock-marquee-text');
    const futuresTicker = document.getElementById('futures-marquee-text');
    if(stockTicker) stockTicker.innerText = msg;
    if(futuresTicker) futuresTicker.innerText = msg;
}

async function generateAINews() {
    const btn = document.getElementById('btn-ai-news');
    const originalText = btn.innerHTML;
    if(!hasPhone()) {
        showToast("📵 휴대폰이 없어서 AI 속보를 수신할 수 없습니다.");
        return;
    }
    btn.innerHTML = `<span class="ai-loading">📡 수신중...</span>`;
    btn.disabled = true;
    const result = await callGemini("경제 뉴스 속보");
    if (result) {
        updateNews("✨ [AI 속보] " + result);
        showToast("✨ AI 특파원이 속보를 전송했습니다!");
    }
    btn.innerHTML = originalText;
    btn.disabled = false;
    renderNewsTab();
}

setInterval(() => {
    let r=0; Object.values(gameState.realEstate).forEach(i=>r+=i.rent*i.count);
    if(r>0) { gameState.cash+=r; saveGame(); showToast(`월세 수익: +${fmt(r)}`); }
}, 10000);

setInterval(() => {
    if (gameState.partners.length === 0) return;
    for (let i = gameState.partners.length - 1; i >= 0; i--) {
        const p = gameState.partners[i];
        if (p.isLover) continue;
        p.love -= 2; 
        if (p.love <= 0) {
            const name = p.name;
            gameState.partners.splice(i, 1);
            showToast(`💔 ${name}님이 떠났습니다.`);
        }
    }
    if(document.querySelector('#tab-myinfo.active')) renderMyInfoTab();
    saveGame();
}, 5000);
