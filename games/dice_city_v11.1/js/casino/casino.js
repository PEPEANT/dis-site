/* 도박: 공통 + 홀짝(더블업) */

function setBetPercent(p) {
    const el = document.getElementById('bet-amount');
    if(!el) return;

    let v = Math.floor((gameState?.cash || 0) * p);
    if(v < 0) v = 0;
    el.value = v;
    updateCasinoBetDisplay(v);
}

function updateCasinoBetDisplay(v) {
    casinoBet = parseInt(v) || 0;
    const el = document.getElementById('casino-bet-display');
    if(el) el.innerText = fmt(casinoBet);
}

function setCasinoGame(game) {
    const games = ['oddeven', 'blackjack'];
    games.forEach(g => {
        const el = document.getElementById(`game-${g}`);
        const btn = document.getElementById(`btn-game-${g}`);
        if(el) el.classList.add('hidden');
        if(btn) btn.classList.remove('bg-white', 'shadow-sm', 'text-gray-500');
        if(btn) btn.classList.add('text-gray-500');
    });

    const el = document.getElementById(`game-${game}`);
    const btn = document.getElementById(`btn-game-${game}`);
    if(el) el.classList.remove('hidden');
    if(btn) btn.classList.add('bg-white', 'shadow-sm');
    if(btn) btn.classList.remove('text-gray-500');

    // 제목
    const title = document.getElementById('casino-house-title');
    if(title) title.innerText = game === 'oddeven' ? "🎲 인생 한방 홀짝" : "🃏 블랙잭 테이블";
}

/* -----------------------
   홀짝(연승 더블업)
   - 첫 승리: 2배
   - 다음 도전 성공: 5배
   - 다음 도전 성공: 12배
   ----------------------- */

function _setOddEvenStatus(html, tone='neutral') {
    const st = document.getElementById('oddeven-status');
    if(!st) return;

    st.innerHTML = html;
    st.classList.remove('text-gray-400', 'text-green-600', 'text-red-500', 'text-amber-600');
    if(tone === 'win') st.classList.add('text-green-600');
    else if(tone === 'lose') st.classList.add('text-red-500');
    else if(tone === 'warn') st.classList.add('text-amber-600');
    else st.classList.add('text-gray-400');
}

function _showOddEvenDoubleModal() {
    const modal = document.getElementById('oddeven-double-modal');
    if(!modal) return;

    const msgEl = document.getElementById('double-up-msg');
    const nextAmtEl = document.getElementById('double-up-next-amount');
    const badgeEl = document.getElementById('double-up-rate-badge');

    // oddEvenStreak = "다음 단계 인덱스"로 운용
    const maxIdx = (ODD_EVEN_RATES?.length || 0) - 1;
    const curMaxPay = oddEvenBaseBet * (ODD_EVEN_RATES?.[maxIdx] || 0);

    const isMaxReached = (maxIdx >= 0) && (oddEvenCurrentWin >= curMaxPay);

    if(msgEl) msgEl.innerText = `현재 당첨금: ${fmt(oddEvenCurrentWin)}\n(확정하면 바로 지급)`;

    if(isMaxReached) {
        if(badgeEl) badgeEl.innerText = `✅ 최대 배율(12배) 도달`;
        if(nextAmtEl) nextAmtEl.innerText = fmt(oddEvenCurrentWin);
    } else {
        const nextRate = ODD_EVEN_RATES?.[oddEvenStreak] || 2;
        if(badgeEl) badgeEl.innerText = `${nextRate}배 도전! (50%)`;
        if(nextAmtEl) nextAmtEl.innerText = fmt(oddEvenBaseBet * nextRate);
    }

    modal.classList.remove('hidden');
}

function _hideOddEvenDoubleModal() {
    const modal = document.getElementById('oddeven-double-modal');
    if(modal) modal.classList.add('hidden');
}

function playOddEven(choice) {
    // 더블업 진행 중
    // - 일반 상태: 모달에서 (확정/도전) 선택
    // - 도전 상태(oddEvenAwaitingPick=true): 다시 홀/짝을 선택해서 결과를 판정
    if(oddEvenCurrentWin > 0) {
        if(!oddEvenAwaitingPick) {
            showToast('⚠️ 더블업 진행 중입니다. (확정/도전 선택)');
            _showOddEvenDoubleModal();
            return;
        }

        // ✅ 도전하기를 누른 뒤: 홀/짝 재선택으로 승/패 결정
        oddEvenAwaitingPick = false;

        const roll = Math.floor(Math.random() * 100) + 1;
        const isOdd = (roll % 2) === 1;
        const win = (choice === 'odd' && isOdd) || (choice === 'even' && !isOdd);

        const maxIdx = (ODD_EVEN_RATES?.length || 0) - 1;
        const maxPay = oddEvenBaseBet * (ODD_EVEN_RATES?.[maxIdx] || 0);

        // 최대 배율 도달이면 더 이상 도전 불가
        if(maxIdx >= 0 && oddEvenCurrentWin >= maxPay) {
            showToast('✅ 이미 최대 배율(12배)입니다. 확정하세요.');
            _showOddEvenDoubleModal();
            return;
        }

        if(win) {
            const rate = ODD_EVEN_RATES?.[oddEvenStreak] || 2;
            oddEvenCurrentWin = oddEvenBaseBet * rate;

            // 다음 단계로
            oddEvenStreak = Math.min(oddEvenStreak + 1, Math.max(0, maxIdx));

            _setOddEvenStatus(
                `🔥 도전 성공! (결과: ${isOdd ? '홀' : '짝'} / ${roll})<br><span class="text-xs font-normal opacity-70">현재 당첨금: ${fmt(oddEvenCurrentWin)}</span>`,
                'win'
            );

            renderAll();
            _showOddEvenDoubleModal();
        } else {
            // 실패 = 당첨금 0
            oddEvenStreak = 0;
            oddEvenBaseBet = 0;
            oddEvenCurrentWin = 0;

            _hideOddEvenDoubleModal();
            _setOddEvenStatus(`💀 도전 실패! (결과: ${isOdd ? '홀' : '짝'} / ${roll})<br>당첨금 0원`, 'lose');

            renderAll();
            showToast('💀 더블업 실패! (당첨금 0원)');
        }

        return;
    }

    const betVal = parseInt(document.getElementById('bet-amount')?.value || '0', 10);
    if(!betVal || betVal <= 0) return showToast('배팅금을 확인해주세요.');
    if(!gameState || gameState.cash < betVal) return showToast('잔액이 부족합니다.');

    // 베팅 먼저 차감
    gameState.cash -= betVal;

    // 홀짝 판정 (완전 50%)
    const roll = Math.floor(Math.random() * 100) + 1; // 1~100
    const isOdd = (roll % 2) === 1;
    const win = (choice === 'odd' && isOdd) || (choice === 'even' && !isOdd);

    oddEvenBaseBet = betVal;

    if(win) {
        const rate = ODD_EVEN_RATES?.[oddEvenStreak] || 2;
        oddEvenCurrentWin = betVal * rate;

        // 다음 단계로 (2→5→12). 마지막(12) 이상은 고정.
        const maxIdx = (ODD_EVEN_RATES?.length || 0) - 1;
        oddEvenStreak = Math.min(oddEvenStreak + 1, Math.max(0, maxIdx));

        _setOddEvenStatus(
            `🎉 성공! (결과: ${isOdd ? '홀' : '짝'} / ${roll})<br><span class="text-xs font-normal opacity-70">당첨금: ${fmt(oddEvenCurrentWin)}</span>`,
            'win'
        );

        saveGame();
        renderAll();
        _showOddEvenDoubleModal();
    } else {
        // 패배: 올인(베팅금 손실)
        oddEvenStreak = 0;
        oddEvenBaseBet = 0;
        oddEvenCurrentWin = 0;
        oddEvenAwaitingPick = false;

        _setOddEvenStatus(
            `❌ 실패! (결과: ${isOdd ? '홀' : '짝'} / ${roll})`,
            'lose'
        );

        saveGame();
        renderAll();
    }
}

// 모달: “도전하기(50%)”
function continueDoubleUp() {
    if(oddEvenCurrentWin <= 0 || oddEvenBaseBet <= 0) {
        showToast('진행 중인 더블업이 없습니다.');
        _hideOddEvenDoubleModal();
        return;
    }

    const maxIdx = (ODD_EVEN_RATES?.length || 0) - 1;
    const maxPay = oddEvenBaseBet * (ODD_EVEN_RATES?.[maxIdx] || 0);

    // 최대 배율(12) 도달 시 더 이상 도전 못 하게(리스크만 커짐)
    if(maxIdx >= 0 && oddEvenCurrentWin >= maxPay) {
        showToast('✅ 이미 최대 배율(12배)입니다. 확정하세요.');
        _showOddEvenDoubleModal();
        return;
    }

    // ✅ 이전 버그: 여기서 바로 승/패를 굴려버려서 "자동 확정"처럼 보였음
    // ✅ 수정: 도전하기를 누르면 모달을 닫고, 플레이어가 다시 홀/짝을 선택하게 함
    oddEvenAwaitingPick = true;
    _hideOddEvenDoubleModal();
    _setOddEvenStatus('🎲 도전 시작! 위에서 <b>홀</b> 또는 <b>짝</b>을 다시 선택하세요.', 'warn');
    showToast('🎲 도전! 홀/짝을 선택하세요.');
}

// 모달: “확정하기”
function stopDoubleUp() {
    if(oddEvenCurrentWin <= 0) {
        _hideOddEvenDoubleModal();
        return;
    }

    // 당첨금 지급
    gameState.cash += oddEvenCurrentWin;

    const paid = oddEvenCurrentWin;

    // 리셋
    oddEvenStreak = 0;
    oddEvenBaseBet = 0;
    oddEvenCurrentWin = 0;
    oddEvenAwaitingPick = false;

    _hideOddEvenDoubleModal();
    saveGame();
    renderAll();

    _setOddEvenStatus(`💰 확정! +${fmt(paid)}`, 'win');
    showToast(`💰 당첨금 수령: ${fmt(paid)}`);
}
