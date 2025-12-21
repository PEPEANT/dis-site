/* 내정보: 파트너/산책/선물/AI대화 */
function interactPartner(type) {
    if (activePartnerIdx === -1) return;
    const p = gameState.partners[activePartnerIdx];
    if(type === 'interest') { p.love = Math.min(100, p.love + 5); showToast(`👀 관심을 보였습니다. (+5)`); } 
    else if (type === 'call') { p.love = Math.min(100, p.love + 8); showToast(`📞 통화가 즐거웠습니다. (+8)`); } 
    else if (type === 'intimacy') { showToast(`❤️ ${p.name}와 깊은 시간을 보냈습니다.`); } 
    else if (type === 'marry') {
        if(gameState.luxury.ring.count > 0) {
            gameState.luxury.ring.count--; p.title = "배우자";
            showToast(`💍 청혼 성공! ${p.name}와 결혼했습니다.`); closeInteractModal(); saveGame(); renderAll(); return;
        } else { showToast(`❌ 반지가 없습니다! 상점에서 다이아 반지를 사오세요.`); return; }
    }
    if (!p.isLover && p.love >= 100) { p.isLover = true; p.title = "연인"; showToast(`🎉 축하합니다! ${p.name}와 연인이 되었습니다!`); }
    saveGame();
    document.getElementById('interact-love-val').innerText = Math.floor(p.love) + '%';
    document.getElementById('interact-love-bar').style.width = p.love + '%';
    openInteractModal(activePartnerIdx); 
}

function openInteractModal(idx) {
    activePartnerIdx = idx;
    const p = gameState.partners[idx];
    document.getElementById('interact-title').innerText = `${p.name} (${p.title || '지인'})`;
    document.getElementById('interact-emoji').innerText = p.emoji;
    document.getElementById('interact-love-val').innerText = Math.floor(p.love) + '%';
    document.getElementById('interact-love-bar').style.width = p.love + '%';
    const aiResponseEl = document.getElementById('ai-talk-response'); aiResponseEl.classList.add('hidden'); aiResponseEl.innerText = "";
    document.getElementById('interaction-modal').classList.remove('hidden');
    const btnContainer = document.getElementById('interact-buttons'); btnContainer.innerHTML = '';
    const aiTalkBtn = `<button onclick="talkWithAI()" id="btn-ai-talk" class="py-3 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-xl font-bold shadow-md mb-2 active:scale-95 transition">✨ AI와 대화하기</button>`;
    if (p.isLover) {
        btnContainer.innerHTML = `<div class="text-xs text-pink-500 font-bold bg-pink-50 p-2 rounded mb-2">❤️ 연인 사이입니다 (호감도 감소 없음)</div>${aiTalkBtn}<button onclick="interactPartner('intimacy')" class="py-3 bg-pink-100 text-pink-600 rounded-xl font-bold">👩‍❤️‍💋‍👨 깊은 관계 (Intimacy)</button>${p.title !== '배우자' ? `<button onclick="interactPartner('marry')" class="py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg animate-pulse">💍 결혼하기 (반지 필요)</button>` : '<div class="py-2 bg-gray-100 text-gray-500 rounded-xl text-xs">이미 결혼한 사이입니다</div>'}<button onclick="openGiftSelectModal()" class="py-3 border border-pink-200 rounded-xl font-bold text-pink-600">🎁 선물하기 (물건)</button>`;
    } else {
        btnContainer.innerHTML = `${aiTalkBtn}<button onclick="interactPartner('interest')" class="py-3 border border-pink-200 text-pink-600 rounded-xl font-bold">👀 관심 보이기 (무료)</button><button onclick="interactPartner('call')" class="py-3 border border-indigo-200 text-indigo-600 rounded-xl font-bold">📞 전화하기 (무료)</button><button onclick="openGiftSelectModal()" class="py-3 bg-pink-500 text-white rounded-xl font-bold shadow-md">🎁 선물하기 (물건)</button>`;
    }
}

function closeInteractModal() { document.getElementById('interaction-modal').classList.add('hidden'); activePartnerIdx = -1; }

async function talkWithAI() {
    if (activePartnerIdx === -1) return;
    const p = gameState.partners[activePartnerIdx];
    const btn = document.getElementById('btn-ai-talk');
    const responseEl = document.getElementById('ai-talk-response');
    btn.innerHTML = `<span class="ai-loading">💬 생각하는 중...</span>`;
    btn.disabled = true;
    responseEl.classList.remove('hidden');
    responseEl.innerText = "...";
    const result = await callGemini("역할놀이");
    if (result) {
        responseEl.innerText = `"${result}"`;
        p.love = Math.min(100, p.love + 2);
        document.getElementById('interact-love-val').innerText = Math.floor(p.love) + '%';
        document.getElementById('interact-love-bar').style.width = p.love + '%';
        saveGame();
    } else { responseEl.innerText = "(대화에 실패했습니다)"; }
    btn.innerHTML = `✨ AI와 대화하기`;
    btn.disabled = false;
}

function openGiftSelectModal() {
    document.getElementById('interaction-modal').classList.add('hidden');
    document.getElementById('gift-select-modal').classList.remove('hidden');
    const list = document.getElementById('gift-item-list'); list.innerHTML = '';
    let hasItem = false;
    Object.keys(gameState.luxury).forEach(k => {
        const item = gameState.luxury[k];
        if(item.type === 'asset' && item.count > 0) {
            hasItem = true;
            list.innerHTML += `<button onclick="sendGift('${k}')" class="w-full text-left p-3 border rounded-lg mb-2 flex justify-between items-center hover:bg-gray-50"><div class="flex items-center gap-3"><div class="text-2xl">${item.img}</div><div><div class="font-bold text-sm">${item.name}</div><div class="text-xs text-gray-400">${fmt(item.price)}</div></div></div><div class="bg-indigo-50 text-indigo-600 text-xs px-2 py-1 rounded font-bold">보유: ${item.count}</div></button>`;
        }
    });
    if(!hasItem) list.innerHTML = '<div class="text-center text-gray-400 text-sm py-10">선물할 수 있는 명품이 없습니다.<br>상점에서 구매하세요.</div>';
}
function closeGiftSelectModal() { document.getElementById('gift-select-modal').classList.add('hidden'); if(activePartnerIdx !== -1) openInteractModal(activePartnerIdx); }
function sendGift(key) {
    const item = gameState.luxury[key];
    item.count--;
    if(activePartnerIdx === -1 || !gameState.partners[activePartnerIdx]) return;
    const p = gameState.partners[activePartnerIdx];
    p.love = Math.min(100, p.love + 25);
    showToast(`🎁 ${item.name}(${fmt(item.price)}) 선물! ${p.name}님이 매우 기뻐합니다.`);
    if (!p.isLover && p.love >= 100) { p.isLover = true; p.title = "연인"; showToast(`🎉 ${p.name}와 연인이 되었습니다!`); }
    saveGame(); closeGiftSelectModal();
}

function goHome() {
    const rank = getMyRank();
    const houseModal = document.getElementById('house-modal');
    document.getElementById('house-emoji').innerText = rank.houseEmoji;
    document.getElementById('house-title').innerText = `${rank.title}의 보금자리`;
    let extraMsg = "";
    if(rank.title === '노숙자') extraMsg = "<span class='text-xs text-blue-400 block mt-2'>춥고 배고픕니다...</span>";
    else if(rank.title === '재벌') extraMsg = "<span class='text-xs text-amber-500 block mt-2 font-bold'>집사가 와인을 따라줍니다.</span>";
    else extraMsg = "<span class='text-xs text-gray-400 block mt-2'>편안한 휴식 중...</span>";
    document.getElementById('house-desc').innerHTML = rank.houseDesc + extraMsg;
    houseModal.classList.remove('hidden');
}
function goForWalk() { document.getElementById('walk-result-area').classList.add('hidden'); document.getElementById('btn-try-hunting').classList.remove('hidden'); document.getElementById('walk-modal').classList.remove('hidden'); }
function closeWalkModal() { document.getElementById('walk-modal').classList.add('hidden'); }
function tryGetNumber() {
    document.getElementById('btn-try-hunting').classList.add('hidden');
    document.getElementById('walk-result-area').classList.remove('hidden');
    const rankIdx = RANKS.indexOf(getMyRank()); const chance = Math.min(90, (rankIdx + 1) * 15);
    const isSuccess = Math.random() * 100 < chance;
    const rEmoji = document.getElementById('walk-result-emoji'); const rText = document.getElementById('walk-result-text');
    if(isSuccess) {
        const types = [{name:"대학생", emoji:"👩‍🎓"}, {name:"직장인", emoji:"👩‍💼"}, {name:"모델", emoji:"💃"}, {name:"간호사", emoji:"👩‍⚕️"}, {name:"운동선수", emoji:"🏃‍♀️"}];
        const t = types[Math.floor(Math.random()*types.length)];
        gameState.partners.push({ name: t.name, emoji: t.emoji, love: 40, isLover: false, title: '지인' });
        saveGame();
        rEmoji.innerText = "😍"; rText.innerText = `"${t.name}"의 번호를 따냈습니다!`; rText.className = "font-bold mb-4 text-pink-600";
        if(document.querySelector('#tab-myinfo.active')) renderMyInfoTab();
    } else { rEmoji.innerText = "💔"; rText.innerText = "거절당했습니다..."; rText.className = "font-bold mb-4 text-gray-500"; }
}
