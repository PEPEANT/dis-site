/* 공통: 탭 전환 + 렌더 */

function renderAll() {
    const rank = getMyRank();

    // 상단 돈/자산 (클릭 토글)
    const headerCash = document.getElementById('header-cash');
    const headerAsset = document.getElementById('header-total-asset');
    bindMoneyToggle(headerCash);
    bindMoneyToggle(headerAsset);
    setMoneyText(headerCash, gameState.cash);
    setMoneyText(headerAsset, getMyTotalAsset());

    document.getElementById('player-rank').innerText = rank.title;
    document.getElementById('my-rank-badge').innerText = rank.title;

    // 카지노 상단 현금도 클릭 토글
    const casinoMyCash = document.getElementById('casino-my-cash');
    if (casinoMyCash) {
        bindMoneyToggle(casinoMyCash);
        setMoneyText(casinoMyCash, gameState.cash);
    }

    // 로고 이모지
    const logoEl = document.getElementById('header-logo');
    if (logoEl && logoEl.innerText !== rank.rankEmoji) logoEl.innerText = rank.rankEmoji;

    // 비상 알바
    if (gameState.cash < EMERGENCY_CASH_THRESHOLD) document.getElementById('emergency-job').classList.remove('hidden');
    else document.getElementById('emergency-job').classList.add('hidden');

    // 현재 활성 탭만 렌더
    const active = document.querySelector('.tab-content.active');
    const activeTab = active ? active.id : 'tab-myinfo';

    if (activeTab === 'tab-myinfo') renderMyInfoTab();
    if (activeTab === 'tab-stock') renderStockTab();
    if (activeTab === 'tab-futures') renderFuturesTab();
    if (activeTab === 'tab-realestate') renderAssetTab();
    if (activeTab === 'tab-shop') renderShopTab();
    if (activeTab === 'tab-news') renderNewsTab();
}

function switchTab(name) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    const tabEl = document.getElementById(`tab-${name}`);
    if (tabEl) tabEl.classList.add('active');

    document.querySelectorAll('.nav-item').forEach(el => {
        el.className = "nav-item flex-1 min-w-[60px] py-2 text-center text-gray-400 rounded-lg transition-colors duration-200";
    });

    const navEl = document.getElementById(`nav-${name}`);
    if (navEl) {
        navEl.className = "nav-item flex-1 min-w-[60px] py-2 text-center text-indigo-600 bg-indigo-50/50 font-bold rounded-lg";
    }

    // 카지노 들어갈 때 버튼 상태 세팅
    if (name === 'casino') {
        const activeGame = document.getElementById('game-oddeven').classList.contains('hidden') ? 'blackjack' : 'oddeven';
        setCasinoGame(activeGame);
    }

    renderAll();
}

function renderMyInfoTab() {
    const rank = getMyRank();
    let stockVal = 0;
    Object.values(gameState.stocks).forEach(s => stockVal += s.price * s.qty);

    let assetVal = 0;
    Object.values(gameState.realEstate).forEach(r => assetVal += r.price * r.count);
    Object.values(gameState.luxury).forEach(l => assetVal += l.price * l.count);

    const networthEl = document.getElementById('my-networth');
    const cashEl = document.getElementById('info-cash');
    const investEl = document.getElementById('info-invest');
    const assetEl = document.getElementById('info-asset');

    [networthEl, cashEl, investEl, assetEl].forEach(bindMoneyToggle);
    setMoneyText(networthEl, getMyTotalAsset());
    setMoneyText(cashEl, gameState.cash);
    setMoneyText(investEl, stockVal);
    setMoneyText(assetEl, assetVal);

    const avatarEl = document.getElementById('my-avatar');
    if (avatarEl) avatarEl.innerText = rank.rankEmoji;

    const loverCount = gameState.partners.filter(p => p.isLover).length;
    document.getElementById('relationship-status').innerText = loverCount > 0 ? `연인 ${loverCount}명` : "솔로";

    const list = document.getElementById('partner-list');
    list.innerHTML = '';
    if (gameState.partners.length === 0) {
        list.innerHTML = '<div class="text-gray-400 text-center py-4 text-xs">인연이 없습니다. 산책을 나가보세요.</div>';
        return;
    }

    gameState.partners.forEach((p, idx) => {
        const barColor = p.love >= 100 ? 'bg-pink-600' : 'bg-pink-400';
        const statusBadge = p.isLover ? '<span class="text-[10px] bg-pink-100 text-pink-600 font-bold px-1 rounded">LOVER</span>' : '';

        list.innerHTML += `
        <div class="bg-pink-50 p-3 rounded-xl border border-pink-100 flex justify-between items-center">
            <div class="flex items-center gap-3">
                <div class="text-2xl">${p.emoji}</div>
                <div>
                    <div class="font-bold text-gray-800 text-sm flex items-center gap-1">${p.name} ${statusBadge}</div>
                    <div class="flex items-center gap-1 mt-1 w-24">
                        <div class="flex-1 h-1.5 bg-white rounded-full overflow-hidden">
                            <div class="h-full ${barColor}" style="width:${Math.min(100, p.love)}%"></div>
                        </div>
                    </div>
                </div>
            </div>
            <button onclick="openInteractModal(${idx})" class="w-10 h-10 rounded-full bg-white border border-pink-200 text-xl shadow-sm">📞</button>
        </div>`;
    });
}

function renderShopTab() {
    const eList = document.getElementById('shop-essential-list');
    const aList = document.getElementById('shop-asset-list');
    eList.innerHTML = '';
    aList.innerHTML = '';

    Object.keys(gameState.luxury).forEach(k => {
        const item = gameState.luxury[k];
        const isEssential = item.type === 'essential';
        const target = isEssential ? eList : aList;

        let btnHtml = '';
        if (isEssential) {
            if (item.count > 0) btnHtml = `<button class="px-4 py-1.5 text-xs font-bold text-white bg-gray-400 rounded-lg cursor-not-allowed" disabled>보유중</button>`;
            else btnHtml = `<button onclick="buyAsset('luxury','${k}')" class="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 rounded-lg active:scale-95">구매</button>`;
        } else {
            btnHtml = `
                <button onclick="sellAsset('luxury','${k}')" class="px-3 py-1.5 text-xs font-bold text-gray-500 border rounded-lg active:scale-95" ${item.count <= 0 ? 'disabled opacity-50' : ''}>매도</button>
                <button onclick="buyAsset('luxury','${k}')" class="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 rounded-lg active:scale-95">구매</button>
            `;
        }

        const priceTag = item.fixedPrice ? `<span class="text-[10px] bg-gray-100 text-gray-500 px-1 rounded ml-1">정가</span>` : '';

        target.innerHTML += `
        <div class="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex gap-3 items-center">
            <div class="text-3xl bg-gray-50 w-12 h-12 flex items-center justify-center rounded-lg">${item.img}</div>
            <div class="flex-1">
                <div class="flex justify-between">
                    <h4 class="font-bold text-gray-800 text-sm">${item.name}</h4>
                    <span class="text-xs font-bold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">x${item.count}</span>
                </div>
                <div class="flex justify-between items-center mt-1">
                    <div class="text-sm font-mono font-bold text-gray-700">${fmt(item.price)}${priceTag}</div>
                    <div class="flex gap-1">${btnHtml}</div>
                </div>
            </div>
        </div>`;
    });
}

function renderStockTab() {
    const cyc = CYCLES[marketCycle];
    document.getElementById('market-cycle').innerText = cyc.label;
    document.getElementById('market-cycle').className = `text-2xl font-black transition-colors duration-500 ${cyc.color}`;
    document.getElementById('nasdaq-price').innerText = fmt(gameState.stocks['NASDAQ'].price);

    const ta = document.getElementById('stock-ticker-area');
    if (hasPhone()) {
        if (!ta.querySelector('.marquee-container')) {
            ta.innerHTML = `
                <div class="bg-red-600 px-3 py-2 text-xs font-bold text-white z-10 shrink-0">LIVE</div>
                <div class="marquee-container flex-1 py-2 text-sm text-gray-700 bg-gray-50 overflow-hidden">
                    <div class="marquee-content" id="stock-marquee-text">${currentTickerMsg}</div>
                </div>`;
        } else {
            const el = document.getElementById('stock-marquee-text');
            if (el && el.innerText !== currentTickerMsg) el.innerText = currentTickerMsg;
        }
    } else {
        if (ta.innerHTML.indexOf('접근 불가') === -1) {
            ta.innerHTML = `<div class="w-full text-center text-gray-400 text-xs py-2 bg-gray-100 flex justify-center gap-2">🔒 <span class="blur-sm">휴대폰이 없어 정보를 볼 수 없습니다</span></div>`;
        }
    }

    const ch = document.getElementById('nasdaq-chart');
    ch.innerHTML = '';
    const min = Math.min(...chartHistory) * 0.99;
    const max = Math.max(...chartHistory) * 1.01;
    chartHistory.forEach((p, i) => {
        const h = ((p - min) / (max - min)) * 100;
        ch.innerHTML += `<div class="flex-1 mx-0.5 rounded-t-sm ${i === chartHistory.length - 1 ? 'bg-indigo-600 animate-pulse' : 'bg-indigo-200'}" style="height:${Math.max(5, h)}%"></div>`;
    });

    const sl = document.getElementById('stock-list');
    sl.innerHTML = '';
    Object.keys(gameState.stocks).forEach(k => {
        const s = gameState.stocks[k];
        sl.innerHTML += `
        <tr class="group hover:bg-gray-50">
            <td class="px-4 py-3 font-bold text-gray-700">${s.name}</td>
            <td class="px-4 py-3 text-right font-mono font-bold text-gray-800">${fmt(s.price)}</td>
            <td class="px-4 py-3 text-center space-x-1">
                <button onclick="openTradeModal('${k}','buy')" class="bg-red-50 text-red-600 text-xs px-2 py-1 rounded border">매수</button>
                <button onclick="openTradeModal('${k}','sell')" class="bg-blue-50 text-blue-600 text-xs px-2 py-1 rounded border">매도</button>
            </td>
        </tr>`;
    });

    const pl = document.getElementById('my-portfolio-list');
    pl.innerHTML = '';
    let hasS = false;
    Object.keys(gameState.stocks).forEach(k => {
        const s = gameState.stocks[k];
        if (s.qty > 0) {
            hasS = true;
            const currentVal = s.price * s.qty;
            const buyVal = s.avg * s.qty;
            const pnl = currentVal - buyVal;
            const pnlRate = s.avg > 0 ? ((s.price - s.avg) / s.avg) * 100 : 0;
            const colorClass = pnl >= 0 ? 'text-red-600' : 'text-blue-600';

            pl.innerHTML += `
            <div class="flex justify-between items-center text-sm p-3 border-b border-gray-100 hover:bg-gray-50 transition">
                <div>
                    <div class="font-bold text-gray-800">${s.name}</div>
                    <div class="text-xs text-gray-400 mt-0.5">${s.qty}주 | 평단 ${fmt(s.avg)}</div>
                </div>
                <div class="text-right">
                    <div class="font-bold text-gray-900">${fmt(currentVal)}</div>
                    <div class="text-xs font-bold ${colorClass}">${pnl > 0 ? '+' : ''}${fmt(pnl)} (${pnlRate.toFixed(2)}%)</div>
                </div>
            </div>`;
        }
    });
    if (!hasS) pl.innerHTML = '<div class="text-center text-xs text-gray-400 py-8">보유 주식 없음</div>';
}

function renderFuturesTab() {
    document.getElementById('crypto-price-display').innerText =
        fmt(gameState.crypto[selectedCrypto].price);

    const fa = document.getElementById('futures-ticker-area');
    if (hasSmartPhone()) {
        if (!fa.querySelector('.marquee-container')) {
            fa.innerHTML = `
                <div class="bg-blue-600 px-3 py-2 text-xs font-bold text-white z-10 shrink-0">CRYPTO</div>
                <div class="marquee-container flex-1 py-2 text-sm text-cyan-300 bg-slate-800 overflow-hidden">
                    <div class="marquee-content" id="futures-marquee-text">${currentTickerMsg}</div>
                </div>`;
        } else {
            const el = document.getElementById('futures-marquee-text');
            if (el && el.innerText !== currentTickerMsg) el.innerText = currentTickerMsg;
        }
    } else {
        if (fa.innerHTML.indexOf('스마트폰이 필요') === -1) {
            fa.innerHTML = `<div class="w-full text-center text-gray-500 text-xs py-2 bg-slate-800 flex justify-center gap-2">🔒 <span class="blur-sm">스마트폰이 필요합니다</span></div>`;
        }
    }

    const c = document.getElementById('futures-positions');
    c.innerHTML = '';
    if (gameState.futures.length === 0) {
        c.innerHTML = '<div class="p-4 text-center text-gray-400 text-xs">포지션 없음</div>';
        return;
    }

    gameState.futures.forEach((p, i) => {
        const cur = gameState.crypto[p.symbol].price;
        const r = p.type === 'long'
            ? ((cur - p.entry) / p.entry) * p.leverage
            : ((p.entry - cur) / p.entry) * p.leverage;

        const v = p.margin * r;

        c.innerHTML += `
        <div class="p-3 bg-white flex justify-between items-center border-b border-gray-100 text-sm hover:bg-gray-50 transition">
            <div>
                <div class="font-bold text-gray-800">${p.symbol}
                    <span class="${p.type === 'long' ? 'text-green-600' : 'text-red-600'} uppercase">${p.type}</span> x${p.leverage}
                </div>
                <div class="text-xs text-gray-400 mt-0.5">진입: ${fmt(p.entry)}</div>
            </div>
            <div class="text-right">
                <div class="font-bold ${v >= 0 ? 'text-green-600' : 'text-red-500'}">${v >= 0 ? '+' : ''}${fmt(v)}</div>
                <div class="text-xs font-bold ${r >= 0 ? 'text-green-500' : 'text-red-400'}">(${(r * 100).toFixed(2)}%)</div>
                <button onclick="closeFutures(${i})" class="bg-gray-100 border border-gray-200 text-xs px-2 py-1 rounded mt-1 hover:bg-gray-200 transition">청산</button>
            </div>
        </div>`;

        if (r <= -0.95) {
            gameState.futures.splice(i, 1);
            showToast(`${p.symbol} 청산됨 (마진콜)`);
            saveGame();
            renderAll();
        }
    });
}

function renderNewsTab() {
    const c = document.getElementById('news-list-container');
    c.innerHTML = '';

    if (gameState.luxury.phone.count + gameState.luxury.smartphone.count === 0) {
        document.getElementById('news-locked').classList.remove('hidden');
        return;
    }

    document.getElementById('news-locked').classList.add('hidden');
    gameState.newsHistory.forEach(n => {
        c.innerHTML += `
        <div class="bg-white p-3 rounded-lg border shadow-sm text-sm">
            <div class="text-xs text-gray-400">${n.time}</div>
            <div>${n.msg}</div>
        </div>`;
    });
}

function renderAssetTab() {
    const c = document.getElementById('realestate-list');
    c.innerHTML = '';
    let rSum = 0;

    Object.keys(gameState.realEstate).forEach(k => {
        const i = gameState.realEstate[k];
        rSum += i.rent * i.count;

        c.innerHTML += `
        <div class="bg-white p-4 rounded-2xl border shadow-sm flex justify-between items-center">
            <div>
                <div class="text-3xl mb-2">${i.img}</div>
                <div class="font-bold">${i.name}</div>
                <div class="text-xs text-gray-500">시세: ${fmt(i.price)}</div>
                <div class="text-xs text-emerald-600 font-bold">월세: +${fmt(i.rent)}</div>
            </div>
            <div class="text-right space-y-2">
                <div class="text-2xl font-black text-emerald-600">${i.count}</div>
                <button onclick="buyAsset('realEstate','${k}')" class="bg-emerald-600 text-white text-xs px-3 py-1.5 rounded">구매</button>
                <button onclick="sellAsset('realEstate','${k}')" class="border text-xs px-3 py-1.5 rounded">매도</button>
            </div>
        </div>`;
    });

    document.getElementById('total-rent').innerText = `+${fmt(rSum)}`;
}
