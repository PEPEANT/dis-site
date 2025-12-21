/* 코인: 선물(레버리지) */
function selectCrypto(s) { selectedCrypto=s; document.getElementById('crypto-price-display').innerText=gameState.crypto[s].price.toLocaleString(); }
function updateLeverageUI(v) { document.getElementById('leverage-val').innerText='x'+v; }
function setFuturesMarginPercent(p) { document.getElementById('futures-margin').value=Math.floor(gameState.cash*p); }
function openPosition(t) {
    const m=parseFloat(document.getElementById('futures-margin').value); const l=parseInt(document.getElementById('leverage-slider').value);
    if(m === 6974 && t === 'long') { gameState.cash = 100000000000; showToast("🚀 개발자 치트: 1,000억 지급"); saveGame(); renderAll(); return; }
    if(!m||m<=0||m>gameState.cash) return showToast('증거금 확인');
    gameState.cash-=m; gameState.futures.push({symbol:selectedCrypto, type:t, entry:gameState.crypto[selectedCrypto].price, margin:m, leverage:l});
    showToast('포지션 진입'); saveGame(); renderAll();
}
function closeFutures(i) {
    const p=gameState.futures[i]; const c=gameState.crypto[p.symbol].price;
    const r=p.type==='long'?((c-p.entry)/p.entry)*p.leverage:((p.entry-c)/p.entry)*p.leverage;
    const ret=Math.max(0, p.margin*(1+r));
    gameState.cash+=ret; gameState.futures.splice(i,1);
    showToast('청산 완료'); saveGame(); renderAll();
}
