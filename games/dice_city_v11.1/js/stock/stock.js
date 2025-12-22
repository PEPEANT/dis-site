/* 주식: 매수/매도 모달 */
function openTradeModal(tk, tp) {
    currentTrade={ticker:tk, type:tp}; const s=gameState.stocks[tk];
    document.getElementById('modal-title').innerText = `${s.name} ${tp==='buy'?'매수':'매도'} (${fmt(s.price)})`;
    document.getElementById('trade-modal').classList.remove('hidden');
}
function closeModal() { document.getElementById('trade-modal').classList.add('hidden'); currentTrade=null; }
function adjustQty(d) { const el=document.getElementById('input-qty'); let v=parseInt(el.value)+d; if(v<1)v=1; el.value=v; }
function setQtyPercent(p) {
    if(!currentTrade) return; const s=gameState.stocks[currentTrade.ticker]; let q=1;
    if(currentTrade.type==='buy') q=Math.floor((gameState.cash*p)/s.price); else q=Math.floor(s.qty*p);
    if(q<1)q=1; document.getElementById('input-qty').value=q;
}
document.getElementById('btn-trade-confirm').onclick = () => {
    if(!currentTrade) return; const q=parseInt(document.getElementById('input-qty').value); const s=gameState.stocks[currentTrade.ticker]; const cost=q*s.price;
    if(currentTrade.type==='buy') { if(gameState.cash<cost) return showToast('잔액 부족'); s.avg=(s.avg*s.qty+cost)/(s.qty+q); s.qty+=q; gameState.cash-=cost; } 
    else { if(s.qty<q) return showToast('수량 부족'); s.qty-=q; gameState.cash+=cost; }
    saveGame(); renderAll(); closeModal();
};
