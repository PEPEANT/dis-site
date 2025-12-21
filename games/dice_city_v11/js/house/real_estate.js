/* 부동산/상점 공용: 자산 구매/매도(buyAsset/sellAsset) */
function buyAsset(cat, k) {
    const i=gameState[cat][k];
    if(gameState.cash<i.price) return showToast('잔액 부족');
    gameState.cash-=i.price; i.count++;
    showToast(`${i.name} 구매 완료`); saveGame(); renderAll();
}
function sellAsset(cat, k) {
    const i=gameState[cat][k];
    if(i.count<=0) return;
    let penalty = 0.95; if (cat === 'luxury' && i.fixedPrice) penalty = 0.8;
    const ret=Math.floor(i.price * penalty);
    gameState.cash+=ret; i.count--;
    showToast(`${i.name} 매도 (+${fmt(ret)})`); saveGame(); renderAll();
}
