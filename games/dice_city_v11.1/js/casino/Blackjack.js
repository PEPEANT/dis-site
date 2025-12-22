/* 도박: 블랙잭 */
function getRealCard() { const suits = ['♠','♣','♥','◆']; const values = ['A','2','3','4','5','6','7','8','9','10','J','Q','K']; const val = values[Math.floor(Math.random()*13)]; const suit = suits[Math.floor(Math.random()*4)]; return { val, suit, id: Math.random() }; }
function calculateScore(hand) {
    let score = 0; let aces = 0;
    hand.forEach(c => { if(c.val === 'A') { aces += 1; score += 11; } else if (['J','Q','K'].includes(c.val)) { score += 10; } else { score += parseInt(c.val); } });
    while (score > 21 && aces > 0) { score -= 10; aces -= 1; } return score;
}
function renderCards(hand, elementId, hideFirst = false) {
    const el = document.getElementById(elementId); el.innerHTML = '';
    hand.forEach((c, i) => {
        if(hideFirst && i === 0) { el.innerHTML += `<div class="w-10 h-14 bg-indigo-900 rounded border border-indigo-700 flex items-center justify-center text-indigo-300 text-xs">?</div>`; } 
        else { const color = (c.suit === '♥' || c.suit === '◆') ? 'text-red-500' : 'text-gray-800'; el.innerHTML += `<div class="w-10 h-14 bg-white rounded border border-gray-300 flex flex-col items-center justify-center shadow-sm ${color} text-sm font-bold leading-none"><span>${c.val}</span><span class="text-xs">${c.suit}</span></div>`; }
    });
}
function startBlackjack() {
    const betVal = parseInt(document.getElementById('bet-amount').value);
    if(!betVal || betVal <= 0 || gameState.cash < betVal) return showToast('배팅금을 확인해주세요.');
    gameState.cash -= betVal; renderAll();
    document.getElementById('bj-result').classList.add('hidden'); document.getElementById('btn-bj-deal').classList.add('hidden'); document.getElementById('btn-bj-hit').classList.remove('hidden'); document.getElementById('btn-bj-stand').classList.remove('hidden'); document.getElementById('bj-dealer-score').style.opacity = '0';
    bjPlayerHand = [getRealCard(), getRealCard()]; bjDealerHand = [getRealCard(), getRealCard()];
    updateBlackjackTable(true);
    const pScore = calculateScore(bjPlayerHand); if(pScore === 21) setTimeout(() => standBlackjack(), 500);
}
function updateBlackjackTable(hideDealer = false) {
    renderCards(bjDealerHand, 'bj-dealer-cards', hideDealer); renderCards(bjPlayerHand, 'bj-player-cards');
    const pScore = calculateScore(bjPlayerHand); document.getElementById('bj-player-score').innerText = pScore;
    if(!hideDealer) { const dScore = calculateScore(bjDealerHand); document.getElementById('bj-dealer-score').innerText = dScore; document.getElementById('bj-dealer-score').style.opacity = '1'; }
}
function hitBlackjack() { bjPlayerHand.push(getRealCard()); updateBlackjackTable(true); const score = calculateScore(bjPlayerHand); if(score > 21) endBlackjack(true); }
async function standBlackjack() {
    document.getElementById('btn-bj-hit').classList.add('hidden'); document.getElementById('btn-bj-stand').classList.add('hidden');
    updateBlackjackTable(false); let dScore = calculateScore(bjDealerHand);
    while (dScore < 17) { await new Promise(r => setTimeout(r, 800)); bjDealerHand.push(getRealCard()); updateBlackjackTable(false); dScore = calculateScore(bjDealerHand); }
    setTimeout(() => endBlackjack(false), 500);
}
function endBlackjack(playerBust) {
     const pScore = calculateScore(bjPlayerHand); const dScore = calculateScore(bjDealerHand); const bet = parseInt(document.getElementById('bet-amount').value);
     let res = "LOSE"; let emoji = "😭"; let winAmount = 0;
     if (playerBust) { res = "BUST (패배)"; emoji = "💥"; } 
     else if (dScore > 21) { res = "WIN (딜러 버스트)"; emoji = "🎉"; winAmount = bet * 2; } 
     else if (pScore > dScore) { res = "WIN (승리!)"; emoji = "💰"; winAmount = bet * 2; } 
     else if (pScore === dScore) { res = "PUSH (무승부)"; emoji = "🤝"; winAmount = bet; } 
     else { res = "LOSE (패배)"; emoji = "😭"; }
     if(winAmount > 0) gameState.cash += winAmount;
     document.getElementById('bj-result-text').innerText = res; document.getElementById('bj-result-emoji').innerText = emoji; document.getElementById('bj-result').classList.remove('hidden');
     saveGame(); renderAll();
}
function resetBlackjackUI() {
    document.getElementById('bj-result').classList.add('hidden'); document.getElementById('btn-bj-deal').classList.remove('hidden');
    document.getElementById('bj-dealer-cards').innerHTML = ''; document.getElementById('bj-player-cards').innerHTML = ''; document.getElementById('bj-player-score').innerText = '0'; document.getElementById('bj-dealer-score').innerText = '0';
}
