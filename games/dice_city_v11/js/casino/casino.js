/* 카지노: 배팅%/게임전환 */
function setBetPercent(p) { const amt = Math.floor(gameState.cash*p); document.getElementById('bet-amount').value = amt; updateCasinoBetDisplay(amt); }
function updateCasinoBetDisplay(val) { const el = document.getElementById('casino-bet-display'); if(val === '' || val < 0) val = 0; el.innerText = parseInt(val).toLocaleString(); }
function setCasinoGame(g) {
    document.getElementById('game-oddeven').classList.add('hidden'); document.getElementById('game-blackjack').classList.add('hidden');
    document.getElementById(`game-${g}`).classList.remove('hidden');
    const btnOdd = document.getElementById('btn-game-oddeven'); const btnBj = document.getElementById('btn-game-blackjack');
    if(g === 'oddeven') {
        btnOdd.className = "flex-1 py-2 rounded-lg text-sm font-bold transition-all bg-white shadow-sm text-indigo-600";
        btnBj.className = "flex-1 py-2 rounded-lg text-sm font-bold text-gray-500 transition-all hover:bg-gray-100";
    } else {
        btnBj.className = "flex-1 py-2 rounded-lg text-sm font-bold transition-all bg-white shadow-sm text-green-700";
        btnOdd.className = "flex-1 py-2 rounded-lg text-sm font-bold text-gray-500 transition-all hover:bg-gray-100";
    }
}
