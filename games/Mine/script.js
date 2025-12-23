import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, deleteDoc, onSnapshot, arrayUnion, serverTimestamp, collection, getDocs } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

// ==========================================
// [중요] 여기에 본인의 Firebase 설정값을 붙여넣으세요
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyB7hYmlQ8nmUgIGlX1zGx0ZGrgJIYF7fwc",
    authDomain: "minesweeper-game-bb4ac.firebaseapp.com",
    projectId: "minesweeper-game-bb4ac",
    storageBucket: "minesweeper-game-bb4ac.firebasestorage.app",
    messagingSenderId: "127790987940",
    appId: "1:127790987940:web:abb96ea52e136d1f1d0431",
    measurementId: "G-8K2RN74M5W"
};

// 앱 초기화
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'minesweeper-game'; // 고정값 (원하는대로 변경 가능)

// --- 전역 상태 ---
let currentUser = null;
let roomId = null;
let unsubscribeRoom = null;
let unsubscribeChat = null;

// 동적 설정을 위한 상태 변수
let MAX_LIVES = 5;
const CELL_SIZE = 28;
const LONG_PRESS_MS = 300;

// Lobby config limits
const ROOM_LIMITS = {
    MIN_SIZE: 5,
    MAX_ROWS: 60,
    MAX_COLS: 60,
    MAX_DENSITY: 0.35,
    MAX_MINES_ABS: 1200
};

function clampValue(value, min, max) {
    if (!Number.isFinite(value)) return min;
    return Math.min(Math.max(value, min), max);
}

function getMaxMines(rows, cols) {
    const r = clampValue(Number(rows), ROOM_LIMITS.MIN_SIZE, ROOM_LIMITS.MAX_ROWS);
    const c = clampValue(Number(cols), ROOM_LIMITS.MIN_SIZE, ROOM_LIMITS.MAX_COLS);

    const cells = r * c;
    const maxMinesByDensity = Math.floor(cells * ROOM_LIMITS.MAX_DENSITY);
    const maxMinesBySafeCell = cells - 1;

    return Math.max(1, Math.min(maxMinesBySafeCell, maxMinesByDensity, ROOM_LIMITS.MAX_MINES_ABS));
}

function updateMinesLimit() {
    const rowsInput = document.getElementById('conf-rows');
    const colsInput = document.getElementById('conf-cols');
    const minesInput = document.getElementById('conf-mines');
    const minesMaxLabel = document.getElementById('conf-mines-max');

    if (!rowsInput || !colsInput || !minesInput) return;

    const r = clampValue(parseInt(rowsInput.value, 10), ROOM_LIMITS.MIN_SIZE, ROOM_LIMITS.MAX_ROWS);
    const c = clampValue(parseInt(colsInput.value, 10), ROOM_LIMITS.MIN_SIZE, ROOM_LIMITS.MAX_COLS);

    rowsInput.value = r;
    colsInput.value = c;

    const maxMines = getMaxMines(r, c);

    minesInput.min = "1";
    minesInput.max = String(maxMines);

    const currentMines = parseInt(minesInput.value, 10);
    const m = clampValue(currentMines, 1, maxMines);
    minesInput.value = m;

    if (minesMaxLabel) {
        minesMaxLabel.textContent = `max: ${maxMines}`;
    }
}

function setupConfigInputs() {
    const rowsInput = document.getElementById('conf-rows');
    const colsInput = document.getElementById('conf-cols');
    const minesInput = document.getElementById('conf-mines');

    if (!rowsInput || !colsInput || !minesInput) return;

    rowsInput.min = String(ROOM_LIMITS.MIN_SIZE);
    rowsInput.max = String(ROOM_LIMITS.MAX_ROWS);
    colsInput.min = String(ROOM_LIMITS.MIN_SIZE);
    colsInput.max = String(ROOM_LIMITS.MAX_COLS);

    const handler = () => updateMinesLimit();
    rowsInput.addEventListener('input', handler);
    colsInput.addEventListener('input', handler);
    minesInput.addEventListener('input', handler);

    updateMinesLimit();
}

// 게임 상태
let localGrid = [];
let gameState = {
    status: 'waiting', 
    lives: MAX_LIVES,
    players: [],
    host: '',
    minesLeft: 0,
    roomName: '',
    config: { rows: 16, cols: 16, mines: 40 }
};
let canvas, ctx;

// 인터랙션
let longPressTimer;
let isScrolling = false;
let touchStartPos = { x: 0, y: 0 };
let hoveredCell = { r: -1, c: -1 };

// 오디오
let audioCtx;
let bgmTimerId = null;
let bgmNoteIndex = 0;
let isMuted = false;

// --- 1. 초기화 및 인증 ---
async function initApp() {
    try {
        await signInAnonymously(auth);
    } catch (e) {
        console.error("Auth Error:", e);
        document.querySelector('#loading-screen div').innerText = "접속 오류. 새로고침 해주세요 (Firebase 설정을 확인하세요).";
        return;
    }

    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            document.getElementById('lobby-screen').classList.remove('hidden');
            document.getElementById('loading-screen').classList.add('hidden');
            refreshRoomList(); 
        }
    });
}

// --- 2. 로비 및 설정 로직 ---

// 전역 함수로 등록 (HTML에서 호출하기 위해)
window.applyPreset = (type) => {
    const rowsInput = document.getElementById('conf-rows');
    const colsInput = document.getElementById('conf-cols');
    const minesInput = document.getElementById('conf-mines');

    if (type === 'easy') {
        rowsInput.value = 9; colsInput.value = 9; minesInput.value = 10;
    } else if (type === 'medium') {
        rowsInput.value = 16; colsInput.value = 16; minesInput.value = 40;
    } else if (type === 'hard') {
        rowsInput.value = 16; colsInput.value = 30; minesInput.value = 99;
    } else if (type === 'extreme') {
        rowsInput.value = 50; colsInput.value = 30; minesInput.value = 300;
    }

    updateMinesLimit();
    
    document.querySelectorAll('.preset-btn').forEach(btn => btn.classList.remove('bg-blue-600', 'text-white'));
    document.querySelectorAll('.preset-btn').forEach(btn => btn.classList.add('bg-slate-200', 'text-slate-700'));
    
    const selectedBtn = document.getElementById(`btn-${type}`);
    if(selectedBtn) {
        selectedBtn.classList.remove('bg-slate-200', 'text-slate-700');
        selectedBtn.classList.add('bg-blue-600', 'text-white');
    }
}

window.refreshRoomList = async () => {
    const listContainer = document.getElementById('room-list');
    listContainer.innerHTML = '<div class="text-center text-slate-500 py-4">방 목록을 불러오는 중...</div>';
    
    try {
        const roomsRef = collection(db, 'artifacts', appId, 'public', 'data', 'rooms');
        const snapshot = await getDocs(roomsRef);
        listContainer.innerHTML = '';
        
        if (snapshot.empty) {
            listContainer.innerHTML = '<div class="text-center text-slate-400 py-4">생성된 방이 없습니다.</div>';
            return;
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            const playersCount = data.players?.length || 0;
            
            if (playersCount === 0) return;

            const isFull = playersCount >= 5;
            const configText = data.config ? `${data.config.cols}x${data.config.rows} (💣${data.config.mines})` : 'Classic';
            
            const el = document.createElement('div');
            el.className = `bg-white p-3 rounded-xl shadow-sm border-2 ${isFull ? 'border-slate-200 opacity-60' : 'border-blue-100 hover:border-blue-400 cursor-pointer'} transition flex justify-between items-center mb-2`;
            el.onclick = () => { if(!isFull) joinRoom(doc.id); };
            
            el.innerHTML = `
                <div>
                    <div class="font-bold text-slate-700">${data.roomName || '이름 없는 방'}</div>
                    <div class="text-xs text-slate-500 font-bold mt-1 flex gap-2">
                        <span class="bg-slate-100 px-1 rounded">${configText}</span>
                        <span class="${data.status === 'playing' ? 'text-green-600' : 'text-red-500'}">${data.status}</span>
                        <span>👤 ${playersCount}/5</span>
                    </div>
                </div>
                <button class="px-3 py-1.5 ${isFull ? 'bg-slate-300' : 'bg-blue-500 hover:bg-blue-600'} text-white font-bold rounded text-xs">
                    입장
                </button>
            `;
            listContainer.appendChild(el);
        });
        
        if (listContainer.children.length === 0) {
                listContainer.innerHTML = '<div class="text-center text-slate-400 py-4">생성된 방이 없습니다.</div>';
        }

    } catch (e) {
        console.error(e);
        listContainer.innerHTML = '<div class="text-center text-red-400 py-4">불러오기 실패<br>(DB 권한을 확인하세요)</div>';
    }
};

window.createRoom = async () => {
    const nickname = document.getElementById('nickname').value.trim() || `익명${Math.floor(Math.random()*1000)}`;
    const roomName = document.getElementById('new-room-name').value.trim() || `지뢰밭 ${Math.floor(Math.random()*100)}`;
    
    let r = parseInt(document.getElementById('conf-rows').value) || 16;
    let c = parseInt(document.getElementById('conf-cols').value) || 16;
    let m = parseInt(document.getElementById('conf-mines').value) || 40;

    r = clampValue(r, ROOM_LIMITS.MIN_SIZE, ROOM_LIMITS.MAX_ROWS);
    c = clampValue(c, ROOM_LIMITS.MIN_SIZE, ROOM_LIMITS.MAX_COLS);

    const maxMines = getMaxMines(r, c);
    m = clampValue(m, 1, maxMines);

    const config = { rows: r, cols: c, mines: m };

    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    try {
        const newRoomId = 'room_' + Date.now() + '_' + Math.floor(Math.random()*1000);
        const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', newRoomId);

        const initialGrid = createInitialGrid(config);
        
        await setDoc(roomRef, {
            grid: JSON.stringify(initialGrid),
            status: 'playing',
            lives: MAX_LIVES,
            createdAt: serverTimestamp(),
            host: currentUser.uid,
            roomName: roomName,
            config: config,
            players: [{ uid: currentUser.uid, name: nickname, color: getRandomColor() }]
        });

        roomId = newRoomId;
        enterGameScreen();
        startBGM();

    } catch (e) {
        console.error("Create Room Error:", e);
        showToast("방 생성 실패: " + e.message);
    }
};

window.joinRoom = async (selectedRoomId) => {
    const nickname = document.getElementById('nickname').value.trim() || `익명${Math.floor(Math.random()*1000)}`;
    
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    try {
        const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', selectedRoomId);
        const roomSnap = await getDoc(roomRef);

        if (!roomSnap.exists()) {
            showToast("존재하지 않는 방입니다.");
            refreshRoomList();
            return;
        }

        const data = roomSnap.data();
        if (data.players.length >= 5) {
            showToast("방이 꽉 찼습니다.");
            return;
        }

        const existingPlayer = data.players.find(p => p.uid === currentUser.uid);
        if (!existingPlayer) {
            await updateDoc(roomRef, {
                players: arrayUnion({ uid: currentUser.uid, name: nickname, color: getRandomColor() })
            });
        }

        roomId = selectedRoomId;
        enterGameScreen();
        startBGM();

    } catch (e) {
        console.error("Join Error:", e);
        showToast("입장 실패");
    }
};

function enterGameScreen() {
    document.getElementById('lobby-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    listenToRoom();
    window.addEventListener('beforeunload', handleBeforeUnload);
}

// --- 3. 게임 로직 (동기화) ---
function listenToRoom() {
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomId);
    
    unsubscribeRoom = onSnapshot(roomRef, (docSnap) => {
        if (!docSnap.exists()) {
            exitGame(false);
            showToast("방이 삭제되었습니다.");
            return;
        }
        const data = docSnap.data();
        
        let parsedGrid;
        try {
            parsedGrid = JSON.parse(data.grid);
        } catch (e) {
            console.error("Grid parse error:", e);
            showToast("맵 동기화 오류(새로고침 권장)");
            return;
        }
        localGrid = parsedGrid;
        gameState.lives = data.lives;
        gameState.status = data.status;
        gameState.players = data.players || [];
        gameState.host = data.host;
        gameState.roomName = data.roomName;
        gameState.config = data.config || { rows: 16, cols: 16, mines: 40 };

        if (!canvas || canvas.width !== gameState.config.cols * CELL_SIZE || canvas.height !== gameState.config.rows * CELL_SIZE) {
            setupCanvas();
        }

        let flaggedCount = 0;
        let revealedCount = 0;
        const ROWS = gameState.config.rows;
        const COLS = gameState.config.cols;

        for (let r = 0; r < ROWS; r++) {
            const row = localGrid?.[r];
            if (!Array.isArray(row)) continue;

            for (let c = 0; c < COLS; c++) {
                const cell = row?.[c];
                if (!cell) continue;

                if (cell.state === 2) flaggedCount++;
                if (cell.state === 1) revealedCount++;
            }
        }
        const minesTotal = Number(gameState.config?.mines) || 0;
        const minesLeft = minesTotal - flaggedCount;
        gameState.minesLeft = Math.max(0, Math.min(minesTotal, minesLeft));

        updateUI();
        render();

        if (gameState.status === 'gameover') {
            showModal("GAME OVER", "팀 생명력이 모두 소진되었습니다!", false);
            stopBGM();
        } else if (gameState.status === 'win') {
            showModal("VICTORY!", "모든 지뢰를 찾았습니다!", true);
        } else {
                document.getElementById('game-modal').classList.add('hidden');
                if (revealedCount === (ROWS * COLS - gameState.config.mines) && gameState.status === 'playing') {
                    updateDoc(roomRef, { status: 'win' }).catch(e=>console.log(e));
                }
        }
    }, (error) => {
        console.error("Sync Error:", error);
    });

        const chatRef = doc(db, 'artifacts', appId, 'public', 'data', 'chats', roomId);
        unsubscribeChat = onSnapshot(chatRef, (snap) => {
            if(snap.exists()) {
                const messages = snap.data().messages || [];
                renderChat(messages);
            }
        });
}

// --- 4. 캔버스 및 인터랙션 ---
function setupCanvas() {
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');
    
    const container = document.getElementById('canvas-container');
    canvas.width = gameState.config.cols * CELL_SIZE;
    canvas.height = gameState.config.rows * CELL_SIZE;
    
    container.scrollTop = 0;
    container.scrollLeft = (canvas.width - container.clientWidth) / 2;
    
    canvas.onmousedown = handleMouseDown;
    canvas.ontouchstart = handleTouchStart;
    canvas.ontouchmove = handleTouchMove;
    canvas.ontouchend = handleTouchEnd;
    canvas.oncontextmenu = e => e.preventDefault();
}

function handleMouseDown(e) {
    if (gameState.status !== 'playing') return;
    if (e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) return;

    const pos = getGridPos(e);
    if (!isValidPos(pos)) return;

    if (e.button === 0) clickCell(pos.r, pos.c, 'reveal');
    else if (e.button === 2) clickCell(pos.r, pos.c, 'flag');
}

function handleTouchStart(e) {
    if (gameState.status !== 'playing') return;
    const touch = e.touches[0];
    touchStartPos = { x: touch.clientX, y: touch.clientY };
    isScrolling = false;
    
    const pos = getGridPos(touch);
    if (isValidPos(pos)) {
        hoveredCell = pos;
        render();
        
        longPressTimer = setTimeout(() => {
            if (!isScrolling) {
                if (navigator.vibrate) navigator.vibrate(50);
                clickCell(pos.r, pos.c, 'flag');
                hoveredCell = {r: -1, c: -1}; 
                render();
            }
        }, LONG_PRESS_MS);
    }
}

function handleTouchMove(e) {
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartPos.x);
    const dy = Math.abs(touch.clientY - touchStartPos.y);
    
    if (dx > 10 || dy > 10) {
        isScrolling = true;
        clearTimeout(longPressTimer);
        hoveredCell = {r: -1, c: -1};
        render();
    }
}

function handleTouchEnd(e) {
    clearTimeout(longPressTimer);
    if (gameState.status !== 'playing') return;
    
    if (!isScrolling && hoveredCell.r !== -1) {
        if(e.cancelable) e.preventDefault();
        clickCell(hoveredCell.r, hoveredCell.c, 'reveal');
    }
    hoveredCell = {r: -1, c: -1};
    render();
}

async function clickCell(r, c, action) {
    const cell = localGrid[r][c];
    if (cell.state === 1) return; 

    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomId);

    if (action === 'flag') {
        const newState = cell.state === 2 ? 0 : 2;
        localGrid[r][c].state = newState;
        playSound('flag');
    } else if (action === 'reveal') {
        if (cell.state === 2) return; 

        if (cell.isMine) {
            playSound('explosion');
            shakeScreen();
            
            localGrid[r][c].state = 1;
            const newLives = gameState.lives - 1;
            
            let updates = {
                grid: JSON.stringify(localGrid),
                lives: newLives
            };
            
            if (newLives <= 0) {
                updates.status = 'gameover';
                revealAllMines();
                updates.grid = JSON.stringify(localGrid);
            }
            
            await updateDoc(roomRef, updates);
            return;
        } else {
            playSound('dig');
            floodFill(r, c);
        }
    }
    await updateDoc(roomRef, { grid: JSON.stringify(localGrid) });
}

function floodFill(r, c) {
    const stack = [[r, c]];
    const ROWS = gameState.config.rows;
    const COLS = gameState.config.cols;

    while(stack.length > 0) {
        const [curR, curC] = stack.pop();
        if (curR < 0 || curR >= ROWS || curC < 0 || curC >= COLS) continue;
        const cell = localGrid[curR][curC];
        
        if (cell.state !== 0) continue;
        
        cell.state = 1; 
        if (cell.surroundingMines === 0) {
            for(let dr=-1; dr<=1; dr++){
                for(let dc=-1; dc<=1; dc++){
                    stack.push([curR+dr, curC+dc]);
                }
            }
        }
    }
}

function revealAllMines() {
    const ROWS = gameState.config.rows;
    const COLS = gameState.config.cols;
    for(let r=0; r<ROWS; r++){
        for(let c=0; c<COLS; c++){
            if(localGrid[r][c].isMine) localGrid[r][c].state = 1;
        }
    }
}

// --- 유틸리티 및 렌더링 ---
function createInitialGrid(config) {
    const ROWS = Number(config.rows) || 16;
    const COLS = Number(config.cols) || 16;

    // 안전하게 정수화 + 상한은 호출쪽(createRoom)에서 최종 결정하지만,
    // 여기서도 1칸은 반드시 안전칸 남기도록 보정
    const maxAllowed = (ROWS * COLS) - 1;
    const MINES = Math.max(1, Math.min(Number(config.mines) || 40, maxAllowed));

    // 빈 그리드 생성
    const grid = Array.from({ length: ROWS }, () =>
        Array.from({ length: COLS }, () => ({
            isMine: false,
            state: 0,
            surroundingMines: 0
        }))
    );

    // === 핵심: "좌표 풀"을 섞어서 앞에서부터 MINES개를 지뢰로 박음 ===
    // => 무조건 정확히 MINES개
    const positions = new Array(ROWS * COLS);
    for (let i = 0; i < positions.length; i++) positions[i] = i;

    // Fisher–Yates shuffle
    for (let i = positions.length - 1; i > 0; i--) {
        const j = (Math.random() * (i + 1)) | 0;
        const tmp = positions[i];
        positions[i] = positions[j];
        positions[j] = tmp;
    }

    for (let k = 0; k < MINES; k++) {
        const idx = positions[k];
        const r = (idx / COLS) | 0;
        const c = idx % COLS;
        grid[r][c].isMine = true;
    }

    // 주변 지뢰 수 계산
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (grid[r][c].isMine) continue;

            let count = 0;
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    if (dr === 0 && dc === 0) continue;
                    const nr = r + dr, nc = c + dc;
                    if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && grid[nr][nc].isMine) count++;
                }
            }
            grid[r][c].surroundingMines = count;
        }
    }

    return grid;
}

function render() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(0,0, canvas.width, canvas.height);

    const ROWS = gameState.config.rows;
    const COLS = gameState.config.cols;

    for(let r=0; r<ROWS; r++) {
        for(let c=0; c<COLS; c++) {
            const x = c * CELL_SIZE;
            const y = r * CELL_SIZE;
            const cell = localGrid[r][c];
            
            if (r === hoveredCell.r && c === hoveredCell.c && cell.state !== 1) {
                ctx.fillStyle = '#cbd5e1';
                ctx.fillRect(x,y,CELL_SIZE,CELL_SIZE);
            }

            if (cell.state === 1) { 
                ctx.fillStyle = '#e2e8f0';
                ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
                ctx.strokeStyle = '#cbd5e1';
                ctx.strokeRect(x,y,CELL_SIZE,CELL_SIZE);
                
                if (cell.isMine) {
                    ctx.fillStyle = '#ef4444';
                    ctx.beginPath();
                    ctx.arc(x+CELL_SIZE/2, y+CELL_SIZE/2, CELL_SIZE/3, 0, Math.PI*2);
                    ctx.fill();
                    ctx.fillStyle = 'white';
                    ctx.font = '12px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('💣', x+CELL_SIZE/2, y+CELL_SIZE/2);
                } else if (cell.surroundingMines > 0) {
                    const colors = [null, '#2563eb', '#16a34a', '#dc2626', '#7c3aed', '#db2777', '#0891b2', '#0f172a'];
                    ctx.fillStyle = colors[cell.surroundingMines] || 'black';
                    ctx.font = 'bold 16px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(cell.surroundingMines, x+CELL_SIZE/2, y+CELL_SIZE/2);
                }
            } else { 
                ctx.fillStyle = '#cbd5e1';
                ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
                ctx.fillStyle = 'rgba(255,255,255,0.7)';
                ctx.beginPath(); ctx.moveTo(x,y+CELL_SIZE); ctx.lineTo(x,y); ctx.lineTo(x+CELL_SIZE,y); ctx.fill();
                ctx.fillStyle = 'rgba(0,0,0,0.3)';
                ctx.beginPath(); ctx.moveTo(x+CELL_SIZE,y); ctx.lineTo(x+CELL_SIZE,y+CELL_SIZE); ctx.lineTo(x,y+CELL_SIZE); ctx.fill();
                ctx.fillStyle = '#94a3b8';
                ctx.fillRect(x+2, y+2, CELL_SIZE-4, CELL_SIZE-4);
                if (cell.state === 2) {
                    ctx.font = '16px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('🚩', x+CELL_SIZE/2, y+CELL_SIZE/2);
                }
            }
        }
    }
}

function updateUI() {
    const heartsContainer = document.getElementById('lives-display');
    heartsContainer.innerHTML = '';
    for(let i=0; i<MAX_LIVES; i++) {
        const span = document.createElement('span');
        span.innerText = i < gameState.lives ? '❤️' : '🖤';
        span.className = 'text-xl animate-pulse';
        heartsContainer.appendChild(span);
    }
    document.getElementById('mines-count').innerText = gameState.minesLeft;
    document.getElementById('room-name-display').innerText = gameState.roomName || 'Team Mines';

    const playerList = document.getElementById('player-list');
    playerList.innerHTML = gameState.players.map(p => 
        `<div class="flex items-center gap-1 bg-white/50 px-2 py-0.5 rounded-full border border-slate-200 shrink-0"><div class="w-3 h-3 rounded-full shadow-sm" style="background:${p.color}"></div><span class="text-xs font-bold truncate max-w-[80px]">${p.name}</span></div>`
    ).join('');
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.innerText = msg;
    toast.classList.remove('opacity-0', 'translate-y-4');
    setTimeout(() => toast.classList.add('opacity-0', 'translate-y-4'), 3000);
}

function getRandomColor() {
    return '#' + Math.floor(Math.random()*16777215).toString(16);
}

function getGridPos(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX || e.touches?.[0]?.clientX;
    const clientY = e.clientY || e.touches?.[0]?.clientY;
    return {
        c: Math.floor((clientX - rect.left) / CELL_SIZE),
        r: Math.floor((clientY - rect.top) / CELL_SIZE)
    };
}

function isValidPos(pos) {
    return pos.r >= 0 && pos.r < gameState.config.rows && pos.c >= 0 && pos.c < gameState.config.cols;
}

function shakeScreen() {
    const body = document.body;
    body.classList.add('animate-shake');
    setTimeout(() => body.classList.remove('animate-shake'), 500);
}

window.restartGame = async () => {
    if (!roomId) return;
    const initialGrid = createInitialGrid(gameState.config); 
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomId);
    
    await updateDoc(roomRef, {
        grid: JSON.stringify(initialGrid),
        status: 'playing',
        lives: MAX_LIVES
    });
    document.getElementById('game-modal').classList.add('hidden');
    startBGM(); 
};

async function leaveRoomInternal() {
    if (!roomId || !currentUser) return;
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomId);
    
    try {
        const snap = await getDoc(roomRef);
        if (snap.exists()) {
            const data = snap.data();
            const newPlayers = (data.players || []).filter(p => p.uid !== currentUser.uid);
            
            if (newPlayers.length === 0) {
                await deleteDoc(roomRef);
            } else {
                await updateDoc(roomRef, { players: newPlayers });
            }
        }
    } catch(e) {
        console.error("Leave room error:", e);
    }
}

function handleBeforeUnload() {
    leaveRoomInternal(); 
}

window.exitGame = async (updateDB = true) => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
        if(unsubscribeRoom) unsubscribeRoom();
        if(unsubscribeChat) unsubscribeChat();
        
        if (updateDB) {
            await leaveRoomInternal();
        }
        
        document.getElementById('game-screen').classList.add('hidden');
        document.getElementById('lobby-screen').classList.remove('hidden');
        
        roomId = null;
        stopBGM();
        refreshRoomList();
}

function showModal(title, msg, isWin) {
    const modal = document.getElementById('game-modal');
    const mTitle = document.getElementById('modal-title');
    const mMsg = document.getElementById('modal-msg');
    
    mTitle.innerText = title;
    mTitle.className = isWin ? "text-3xl font-bold text-blue-600 mb-2" : "text-3xl font-bold text-red-600 mb-2";
    mMsg.innerText = msg;
    
    modal.classList.remove('hidden');
}

window.toggleChat = () => {
    const chatBox = document.getElementById('chat-box');
    chatBox.classList.toggle('hidden');
};

window.sendMessage = async () => {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;

    const chatRef = doc(db, 'artifacts', appId, 'public', 'data', 'chats', roomId);
    const chatSnap = await getDoc(chatRef);
    
    const newMessage = {
        sender: currentUser.uid, 
        name: gameState.players.find(p => p.uid === currentUser.uid)?.name || 'Unknown',
        text: text,
        time: Date.now()
    };

    if (!chatSnap.exists()) {
        await setDoc(chatRef, { messages: [newMessage] });
    } else {
        await updateDoc(chatRef, { messages: arrayUnion(newMessage) });
    }
    input.value = '';
};

window.checkEnter = (e) => {
    if(e.key === 'Enter') {
        if(e.target.id === 'chat-input') sendMessage();
    }
}

function renderChat(messages) {
    const container = document.getElementById('chat-messages');
    container.innerHTML = messages.map(m => `
        <div class="mb-1">
            <span class="font-bold text-xs text-blue-800">${m.name}:</span>
            <span class="text-xs text-slate-800">${m.text}</span>
        </div>
    `).join('');
    container.scrollTop = container.scrollHeight;
}

window.toggleSound = () => {
    isMuted = !isMuted;
    const btn = document.getElementById('sound-btn');
    btn.innerText = isMuted ? '🔇' : '🔊';
    
    if (isMuted) stopBGM();
    else if (gameState.status === 'playing') startBGM();
}

function startBGM() {
    if (isMuted || bgmTimerId) return;
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const notes = [220.0, 261.63, 220.0, 196.0];

    const tick = () => {
        if (isMuted || gameState.status !== 'playing') { stopBGM(); return; }

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.type = 'square';
        const base = notes[bgmNoteIndex % notes.length];
        const octave = (Math.floor(bgmNoteIndex / 8) % 2) ? 1.5 : 1.0;
        osc.frequency.value = base * octave;

        gain.gain.setValueAtTime(0.02, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.15);

        osc.start();
        osc.stop(audioCtx.currentTime + 0.16);

        bgmNoteIndex++;
        bgmTimerId = setTimeout(tick, 180);
    };

    tick();
}

function stopBGM() {
    if (bgmTimerId) {
        clearTimeout(bgmTimerId);
        bgmTimerId = null;
    }
}

function playSound(type) {
    if (isMuted) return;
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'dig') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.1);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'flag') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(600, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.05);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.05);
    } else if (type === 'explosion') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + 0.8);
        gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.8);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.8);
    }
}

// 앱 시작
setupConfigInputs();
initApp();
