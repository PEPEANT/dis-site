/**
 * DIS.COM - Advanced Platform Logic
 */

// ==========================================
// 1. FIREBASE CONFIG & IMPORTS
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { 
    getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, 
    sendEmailVerification, sendPasswordResetEmail, signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { 
    getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, 
    onSnapshot, query, orderBy, increment, serverTimestamp, setDoc, getDoc, getDocs, where 
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import {
    getDatabase, ref as dbRef, onValue as onDbValue, onDisconnect,
    set as dbSet, runTransaction as dbRunTransaction, serverTimestamp as dbServerTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js";

// [설정 값]
const firebaseConfig = {
  apiKey: "AIzaSyC59zHZiR7pPGS_nqWec7dnFuurKBlEhzk",
  authDomain: "dis-com-c1900.firebaseapp.com",
  projectId: "dis-com-c1900",
  databaseURL: "https://dis-com-c1900-default-rtdb.firebaseio.com",
  storageBucket: "dis-com-c1900.firebasestorage.app",
  messagingSenderId: "684181721206",
  appId: "1:684181721206:web:4aea1a2f7ea5c8314f8f57",
  measurementId: "G-P03449PBB7"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const rtdb = getDatabase(app);

// 컬렉션 참조
const GAMES_REF = collection(db, "games");
const SETTINGS_REF = collection(db, "site_settings");
const USERS_REF = collection(db, "users");

// ==========================================
// 2. STATE MANAGEMENT
// ==========================================
let isAdmin = false;       // 관리자 여부
let currentLang = "KO";    // 현재 언어
let gamesData = [];        // 게임 데이터 캐시
let currentGameId = null;  // 현재 열린 게임 ID
let siteSettings = {       // 사이트 설정 기본값
    bg_color: "#ffffff",
    bg_image: "",
    hero_image: "",
    hero_crop: { topPct: 0, bottomPct: 0 },
    texts: { KO: {}, EN: {} }
};

// ==========================================
// 3. INITIALIZATION & LISTENERS
// ==========================================

// 3-1. 게임 데이터 실시간 동기화
onSnapshot(query(GAMES_REF, orderBy("createdAt", "desc")), (snapshot) => {
    gamesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderGrid();
    if (currentGameId) {
        const game = gamesData.find(g => g.id === currentGameId);
        if (game) updatePlayerUI(game);
    }
});

// 3-2. 사이트 설정 실시간 동기화 (텍스트, 배경)
onSnapshot(doc(db, "site_settings", "config"), (docSnap) => {
    if (docSnap.exists()) {
        siteSettings = docSnap.data();
        applySiteSettings();
    }
});

// 3-3. 인증 상태 확인 (일반 회원용)
onAuthStateChanged(auth, (user) => {
    if (user && !isAdmin) { // 관리자가 아닌 일반 로그인
        console.log("User Logged In:", user.email);
        // 일반 유저 UI 처리는 필요시 추가
    }
});

// 3-4. 실시간 접속자/방문 통계 (Realtime Database)
initRealtimePresenceAndStats();

// ==========================================
// 4. CORE FUNCTIONS
// ==========================================

// --- 언어 변경 ---
window.toggleLang = () => {
    currentLang = currentLang === 'KO' ? 'EN' : 'KO';
    document.getElementById('current-lang').innerText = currentLang;
    applySiteSettings(); // 언어에 맞는 텍스트 적용
};

// --- 사이트 설정 적용 (배경, 텍스트) ---
function applySiteSettings() {
    // 1. 배경
    const body = document.getElementById('body-bg');
    if (siteSettings.bg_color) body.style.backgroundColor = siteSettings.bg_color;
    if (siteSettings.bg_image) body.style.backgroundImage = `url(${siteSettings.bg_image})`;
    else body.style.backgroundImage = 'none';


    // 1-1. 배너(히어로) 이미지
    const heroImg = document.getElementById('hero-image');
    if (heroImg && siteSettings.hero_image) {
        heroImg.src = siteSettings.hero_image;
    }


    // 2. 텍스트 (현재 언어에 맞춰서)
    const texts = siteSettings.texts && siteSettings.texts[currentLang] ? siteSettings.texts[currentLang] : {};
    document.querySelectorAll('.editable-text').forEach(el => {
        const key = el.getAttribute('data-key');
        if (texts[key]) {
            el.innerText = texts[key].replace(/\\n/g, '\n'); // 줄바꿈 처리
        }
    });
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// --- 그리드 렌더링 (공개/비공개 필터링) ---
function renderGrid() {
    const grid = document.getElementById('game-grid');
    const totalEl = document.getElementById('total-count');
    grid.innerHTML = '';

    // 관리자가 아니면 비공개(isPrivate) 숨김
    const displayGames = isAdmin ? gamesData : gamesData.filter(g => !g.isPrivate);
    
    totalEl.innerText = displayGames.length;

    displayGames.forEach(game => {
        const el = document.createElement('article');
        el.className = 'group cursor-pointer flex flex-col h-full bg-white p-2 rounded-sm shadow-sm hover:shadow-xl transition-all duration-300 animate-in fade-in';
        el.onclick = () => window.openPlayer(game.id);

        const thumbHtml = game.thumb 
            ? `<img src="${game.thumb}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">`
            : `<div class="w-full h-full bg-[#1a1a1a] group-hover:scale-105 transition-transform duration-500"></div>`;

        // 비공개 자물쇠 아이콘
        const lockBadge = game.isPrivate ? `<div class="absolute top-2 right-2 bg-red-600 text-white p-1 rounded z-10"><i data-lucide="lock" class="w-3 h-3"></i></div>` : '';

        // 관리자용 삭제 버튼
        const adminBtn = isAdmin ? `<button onclick="event.stopPropagation(); window.openUploadModal('${game.id}')" class="text-gray-300 hover:text-black p-1"><i data-lucide="edit" class="w-3 h-3"></i></button>` : '';

        el.innerHTML = `
            <div class="relative aspect-[4/3] mb-4 overflow-hidden bg-gray-100 border border-transparent group-hover:border-black transition-colors">
                ${thumbHtml}
                ${lockBadge}
                <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/10">
                    <div class="w-12 h-12 bg-white flex items-center justify-center rounded-full shadow-lg">
                        <i data-lucide="play" class="w-4 h-4 fill-black text-black ml-1"></i>
                    </div>
                </div>
                <div class="absolute bottom-2 right-2 flex gap-2 text-[10px] text-white bg-black/60 px-2 py-1 rounded-full backdrop-blur-sm">
                    <span class="flex items-center gap-1"><i data-lucide="eye" class="w-3 h-3"></i> ${game.views || 0}</span>
                    <span class="flex items-center gap-1"><i data-lucide="heart" class="w-3 h-3"></i> ${game.likes || 0}</span>
                </div>
            </div>
            <div class="flex flex-col px-1">
                <h4 class="font-bold truncate text-[#111] group-hover:underline decoration-2 underline-offset-4">${escapeHtml(game.title)}</h4>
                <p class="text-[10px] text-gray-500 line-clamp-1 mt-1">${escapeHtml(game.desc)}</p>
                <div class="flex justify-between items-center mt-2 border-t border-gray-100 pt-2">
                    <span class="text-[10px] text-gray-400 font-mono">${game.updatedDateString ? ("수정 " + game.updatedDateString) : (game.createdDateString || "")}</span>
                    ${adminBtn}
                </div>
            </div>
        `;
        grid.appendChild(el);
    });
    lucide.createIcons();
}

// ==========================================
// 5. AUTHENTICATION & ADMIN
// ==========================================

// --- 유저네임(아이디) -> 이메일 해석 ---
async function resolveEmailFromUsername(input) {
    const val = (input || '').trim();
    if (!val) return null;
    // 이메일 형태면 그대로
    if (val.includes('@')) return val;

    // username으로 users 컬렉션 검색
    const q = query(USERS_REF, where("username", "==", val));
    const snap = await getDocs(q);
    if (snap.empty) return null;

    // 동일 username이 여러 개면 첫 번째 사용
    const doc0 = snap.docs[0].data();
    return doc0.email || null;
}

async function isUsernameTaken(username) {
    const name = (username || '').trim();
    if (!name) return true;
    const q = query(USERS_REF, where("username", "==", name));
    const snap = await getDocs(q);
    return !snap.empty;
}


// 모달 열기/닫기
window.openAuthModal = (tab) => {
    document.getElementById('modal-auth').classList.remove('hidden');
    window.switchAuthTab(tab);
};

window.switchAuthTab = (tab) => {
    ['login', 'signup', 'forgot'].forEach(t => {
        document.getElementById(`form-${t}`).classList.add('hidden');
        const btn = document.getElementById(`tab-${t}`);
        if(btn) {
            btn.classList.remove('border-black', 'text-black');
            btn.classList.add('border-transparent', 'text-gray-400');
        }
    });
    document.getElementById(`form-${tab}`).classList.remove('hidden');
    const activeBtn = document.getElementById(`tab-${tab}`);
    if(activeBtn) {
        activeBtn.classList.remove('border-transparent', 'text-gray-400');
        activeBtn.classList.add('border-black', 'text-black');
    }
};

// 로그인 처리

window.handleAuthLogin = async (e) => {
    e.preventDefault();
    const idInput = document.getElementById('login-id').value;
    const pw = document.getElementById('login-pw').value;

    // 1. 관리자 하드코딩 체크
    if (idInput === 'rneetn' && pw === 'as2486348211') {
        isAdmin = true;
        alert("관리자로 로그인되었습니다. 환영합니다 운영자 훈서기님.");
        document.getElementById('admin-panel').classList.remove('hidden');
        document.getElementById('btn-login').classList.add('hidden');
        document.querySelectorAll('.admin-edit-btn').forEach(el => el.classList.remove('hidden')); // 편집 버튼 보이기
        document.getElementById('btn-admin-edit-post')?.classList.remove('hidden');
        window.closeModal('modal-auth');
        renderGrid();
        return;
    }

    // 2. 일반 회원 Firebase 로그인 (이메일 또는 아이디)
    try {
        const email = await resolveEmailFromUsername(idInput);
        if (!email) {
            alert("로그인 실패: 이메일/아이디를 찾을 수 없습니다.");
            return;
        }

        const cred = await signInWithEmailAndPassword(auth, email, pw);

        // 이메일 인증 체크
        if (!cred.user.emailVerified) {
            await signOut(auth);
            const retry = confirm("이메일 인증이 아직 완료되지 않았습니다. 인증 메일을 다시 보낼까요?");
            if (retry) {
                try {
                    await sendEmailVerification(cred.user);
                    alert("인증 메일을 다시 보냈습니다. 메일함(스팸함 포함)을 확인해주세요.");
                } catch (e) {
                    alert("인증 메일 재전송 실패: " + (e?.message || ""));
                }
            }
            return;
        }

        alert("로그인 성공!");
        window.closeModal('modal-auth');
    } catch (err) {
        alert("로그인 실패: 비밀번호를 확인하세요.");
    }
};

// 회원가입 처리


window.handleAuthSignup = async (e) => {
    e.preventDefault();
    const email = document.getElementById('signup-email').value.trim();
    const username = document.getElementById('signup-username').value.trim();
    const pw = document.getElementById('signup-pw').value;

    // 아이디 중복 체크
    try {
        if (await isUsernameTaken(username)) {
            alert("이미 사용 중인 아이디입니다. 다른 아이디를 입력해주세요.");
            return;
        }

        const userCredential = await createUserWithEmailAndPassword(auth, email, pw);

        // users 컬렉션에 uid 기반으로 저장 (아이디/이메일 매핑)
        await setDoc(doc(db, "users", userCredential.user.uid), {
            email,
            username,
            createdAt: serverTimestamp()
        }, { merge: true });

        await sendEmailVerification(userCredential.user);

        alert("가입 성공! 입력하신 이메일로 인증 메일을 보냈습니다. 메일함(스팸함 포함) 확인 후 로그인해주세요.");
        window.switchAuthTab('login');
    } catch (err) {
        alert("가입 실패: " + (err?.message || ""));
    }
};

// 비밀번호 찾기

window.handleAuthForgot = async (e) => {
    e.preventDefault();
    const email = document.getElementById('forgot-email').value;
    try {
        await sendPasswordResetEmail(auth, email);
        alert("재설정 이메일을 보냈습니다.");
    } catch (err) {
        alert("전송 실패: 가입된 이메일인지 확인하세요.");
    }
};

window.logout = () => {
    isAdmin = false;
    signOut(auth);
    alert("로그아웃 되었습니다.");
    document.getElementById('admin-panel').classList.add('hidden');
    document.getElementById('btn-login').classList.remove('hidden');
    document.querySelectorAll('.admin-edit-btn').forEach(el => el.classList.add('hidden'));
    renderGrid();
};

// ==========================================
// 6. UPLOAD & EDITING
// ==========================================

// 파일 -> Base64 변환
window.handleFileSelect = (e, targetId) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
            document.getElementById(targetId).value = reader.result;
        };
        reader.readAsDataURL(file);
    }
};

window.openUploadModal = (editId = null) => {
    if (!isAdmin) {
        alert("관리자만 가능합니다.");
        return;
    }
    const form = document.querySelector('#modal-upload form');
    form.reset();
    document.getElementById('edit-id').value = '';
    
    if (editId) {
        const game = gamesData.find(g => g.id === editId);
        document.getElementById('edit-id').value = game.id;
        document.getElementById('up-title').value = game.title;
        document.getElementById('up-desc').value = game.desc;
        document.getElementById('up-content').value = game.content || "";
        document.getElementById('up-url').value = game.url;
        document.getElementById('up-thumb').value = game.thumb;
        
        const radios = document.getElementsByName('visibility');
        radios[0].checked = !game.isPrivate;
        radios[1].checked = game.isPrivate;
    }
    window.openModal('modal-upload');
};


window.handleUpload = async (e) => {
    e.preventDefault();
    if (!isAdmin) {
        alert("관리자만 가능합니다.");
        return;
    }
    const editId = document.getElementById('edit-id').value;
    const isPrivate = document.querySelector('input[name="visibility"]:checked').value === 'private';

    const baseData = {
        title: document.getElementById('up-title').value,
        desc: document.getElementById('up-desc').value,
        content: document.getElementById('up-content').value,
        url: document.getElementById('up-url').value,
        thumb: document.getElementById('up-thumb').value,
        isPrivate: isPrivate
    };

    try {
        if (editId) {
            // 수정 시: createdAt은 유지, updatedAt만 갱신
            const data = {
                ...baseData,
                updatedAt: serverTimestamp(),
                updatedDateString: new Date().toLocaleString('ko-KR')
            };
            await updateDoc(doc(db, "games", editId), data);
        } else {
            // 신규 생성
            const data = {
                ...baseData,
                createdAt: serverTimestamp(),
                createdDateString: new Date().toLocaleString('ko-KR'),
                updatedAt: serverTimestamp(),
                updatedDateString: new Date().toLocaleString('ko-KR'),
                views: 0,
                likes: 0,
                comments: []
            };
            await addDoc(GAMES_REF, data);
        }
        window.closeModal('modal-upload');
    } catch (err) {
        alert("저장 실패: " + (err?.message || ""));
    }
};

// 텍스트 수정 (CMS)
let currentEditKey = null;
window.openTextEdit = (key) => {
    if (!isAdmin) {
        alert("관리자만 가능합니다.");
        return;
    }
    currentEditKey = key;
    const currentText = document.querySelector(`[data-key="${key}"]`).innerText;
    document.getElementById('input-text-edit').value = currentText;
    window.openModal('modal-text-edit');
};

window.handleTextSave = async (e) => {
    e.preventDefault();
    if (!isAdmin) {
        alert("관리자만 가능합니다.");
        return;
    }
    if (!currentEditKey) return;
    
    const newVal = document.getElementById('input-text-edit').value;
    
    // 깊은 객체 업데이트를 위한 로직
    const updatePath = `texts.${currentLang}.${currentEditKey}`;
    
    try {
        await updateDoc(doc(db, "site_settings", "config"), {
            [updatePath]: newVal
        });
        // 만약 문서가 없으면 생성 (최초 1회)
    } catch (err) {
        await setDoc(doc(db, "site_settings", "config"), {
            texts: { [currentLang]: { [currentEditKey]: newVal } }
        }, { merge: true });
    }
    
    window.closeModal('modal-text-edit');
};

// 사이트 설정 (배경)
window.handleSiteSettings = async (e) => {
    e.preventDefault();
    if (!isAdmin) {
        alert("관리자만 가능합니다.");
        return;
    }
    const color = document.getElementById('set-bg-color').value;
    const img = document.getElementById('set-bg-image').value;

    try {
        await setDoc(doc(db, "site_settings", "config"), {
            bg_color: color,
            bg_image: img
        }, { merge: true });
        window.closeModal('modal-settings');
    } catch(err) {
        alert("설정 저장 실패");
    }
};


// ==========================================
// 6-1. 배너(히어로) 이미지 크롭 & 업로드
// ==========================================
let __bannerImg = null;

window.handleBannerFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
            __bannerImg = img;
            const dim = document.getElementById('banner-dim');
            if (dim) dim.innerText = `${img.width} x ${img.height}`;
            window.renderBannerPreview();
        };
        img.src = reader.result;
    };
    reader.readAsDataURL(file);
};

window.renderBannerPreview = () => {
    const canvas = document.getElementById('banner-canvas');
    if (!canvas || !__bannerImg) return;

    const topPct = parseInt(document.getElementById('banner-crop-top')?.value || '0', 10);
    const bottomPct = parseInt(document.getElementById('banner-crop-bottom')?.value || '0', 10);

    const w = __bannerImg.width;
    const h = __bannerImg.height;

    const topPx = Math.floor(h * (topPct / 100));
    const bottomPx = Math.floor(h * (bottomPct / 100));
    const cropH = Math.max(10, h - topPx - bottomPx);

    // 캔버스는 3:1 비율 미리보기
    canvas.width = 1200;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');

    // cover 방식으로 그리기
    const targetW = canvas.width;
    const targetH = canvas.height;

    // 원본 크롭 영역
    const sx = 0;
    const sy = topPx;
    const sWidth = w;
    const sHeight = cropH;

    // cover 계산
    const srcAR = sWidth / sHeight;
    const dstAR = targetW / targetH;

    let drawW = targetW, drawH = targetH, dx = 0, dy = 0;
    if (srcAR > dstAR) {
        // 원본이 더 넓음 -> 좌우 잘라내기
        drawH = targetH;
        drawW = targetH * srcAR;
        dx = -(drawW - targetW) / 2;
    } else {
        // 원본이 더 높음 -> 상하 잘라내기
        drawW = targetW;
        drawH = targetW / srcAR;
        dy = -(drawH - targetH) / 2;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(__bannerImg, sx, sy, sWidth, sHeight, dx, dy, drawW, drawH);
};

window.saveBanner = async () => {
    if (!isAdmin) {
        alert("관리자만 가능합니다.");
        return;
    }
    const canvas = document.getElementById('banner-canvas');
    if (!canvas || !__bannerImg) {
        alert("이미지를 먼저 업로드해주세요.");
        return;
    }
    try {
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        await setDoc(doc(db, "site_settings", "config"), {
            hero_image: dataUrl,
            hero_updatedAt: serverTimestamp()
        }, { merge: true });

        alert("배너가 저장되었습니다.");
        window.closeModal('modal-banner');
    } catch (e) {
        alert("배너 저장 실패: " + (e?.message || ""));
    }
};


// ==========================================
// 7. PLAYER & COMMENTS
// ==========================================


window.openPlayer = async (id) => {
    currentGameId = id;
    window.__currentGameIdForEdit = id;

    const game = gamesData.find(g => g.id === id);
    if (!game) return;

    // 비공개인데 관리자가 아니면 차단 (혹시 모를 우회 방지)
    if (game.isPrivate && !isAdmin) {
        alert("비공개 게임입니다.");
        return;
    }

    updatePlayerUI(game);
    window.openModal('modal-player');

    // 조회수 증가: 같은 브라우저에서 같은 글은 1회만 카운트(새로고침/재진입 남발 방지)
    try {
        const key = `viewed_${id}`;
        const already = localStorage.getItem(key);
        if (!already) {
            localStorage.setItem(key, '1');
            // UI 즉시 반영(체감 실시간)
            const vEl = document.getElementById('player-views');
            if (vEl) vEl.innerText = String((game.views || 0) + 1);

            await updateDoc(doc(db, "games", id), { views: increment(1) });
        }
    } catch (e) {}
};

function updatePlayerUI(game) {
    document.getElementById('player-title').innerText = game.title;
    document.getElementById('player-views').innerText = game.views || 0;
    document.getElementById('player-likes').innerText = game.likes || 0;
    const upEl = document.getElementById('player-updated');
    if (upEl) upEl.innerText = game.updatedDateString || game.createdDateString || '-';

    // 관리자 전용: 수정 버튼 노출
    const adminEditBtn = document.getElementById('btn-admin-edit-post');
    if (adminEditBtn) {
        if (isAdmin) adminEditBtn.classList.remove('hidden');
        else adminEditBtn.classList.add('hidden');
    }
    document.getElementById('player-content').innerText = game.content || game.desc;
    document.getElementById('game-iframe').src = game.url;
    
    const lock = document.getElementById('player-lock-icon');
    if (game.isPrivate) lock.classList.remove('hidden');
    else lock.classList.add('hidden');

    renderComments(game.comments || []);
}

// 댓글 렌더링
function renderComments(comments) {
    const list = document.getElementById('comments-list');
    list.innerHTML = '';
    
    if (comments.length === 0) {
        list.innerHTML = '<p class="text-gray-400 text-xs text-center py-4">첫 번째 댓글을 남겨보세요.</p>';
        return;
    }

    comments.forEach((c, idx) => {
        const div = document.createElement('div');
        div.className = 'border-b border-gray-50 last:border-0 pb-3 mb-3';
        div.innerHTML = `
            <div class="flex justify-between items-center mb-1">
                <span class="font-bold text-xs">${escapeHtml(c.nick)}</span>
                <div class="flex items-center gap-2">
                    <span class="text-[10px] text-gray-400">${escapeHtml(c.date)}</span>
                    <button onclick="window.deleteComment(${idx})" class="text-gray-300 hover:text-red-500 text-[10px]"><i data-lucide="x" class="w-3 h-3"></i></button>
                </div>
            </div>
            <p class="text-sm text-gray-700">${escapeHtml(c.text)}</p>
        `;
        list.appendChild(div);
    });
    lucide.createIcons();
}

window.handleAddComment = async (e) => {
    e.preventDefault();
    if (!currentGameId) return;

    const nick = document.getElementById('cmt-nick').value;
    const pw = document.getElementById('cmt-pw').value;
    const text = document.getElementById('cmt-text').value;

    const newComment = {
        nick, pw, text,
        date: new Date().toLocaleDateString('ko-KR')
    };

    const gameRef = doc(db, "games", currentGameId);
    const game = gamesData.find(g => g.id === currentGameId);
    const updatedComments = game.comments ? [...game.comments, newComment] : [newComment];

    try {
        await updateDoc(gameRef, { comments: updatedComments });
        document.getElementById('cmt-text').value = ''; // 내용만 초기화
    } catch (err) {
        alert("댓글 등록 실패");
    }
};

window.deleteComment = async (idx) => {
    if (!currentGameId) return;
    const game = gamesData.find(g => g.id === currentGameId);
    const target = game.comments[idx];

    // 관리자는 프리패스
    if (!isAdmin) {
        const inputPw = prompt("댓글 비밀번호를 입력하세요:");
        if (inputPw !== target.pw) {
            alert("비밀번호가 틀렸습니다.");
            return;
        }
    }

    const newComments = game.comments.filter((_, i) => i !== idx);
    try {
        await updateDoc(doc(db, "games", currentGameId), { comments: newComments });
    } catch (err) {
        alert("삭제 실패");
    }
};

window.handleLike = async () => {
    if(!currentGameId) return;
    try {
        const key = `liked_${currentGameId}`;
        if (localStorage.getItem(key)) {
            alert("이미 좋아요를 눌렀습니다.");
            return;
        }
        localStorage.setItem(key, '1');
        const el = document.getElementById('player-likes');
        if (el) el.innerText = String((parseInt(el.innerText || '0', 10) || 0) + 1);
        await updateDoc(doc(db, "games", currentGameId), { likes: increment(1) });
    } catch(e) {}
};

window.shareUrl = () => {
    navigator.clipboard.writeText(window.location.href);
    alert("주소가 복사되었습니다.");
};

// --- 유틸리티 ---
window.openModal = (id) => document.getElementById(id).classList.remove('hidden');
window.closeModal = (id) => document.getElementById(id).classList.add('hidden');
window.toggleFullscreen = () => {
    const el = document.getElementById('game-container');
    el.classList.toggle('fixed'); el.classList.toggle('inset-0');
    el.classList.toggle('z-[100]'); el.classList.toggle('h-screen');
    el.classList.toggle('max-w-screen-xl');
};


// ==========================================
// 8. REALTIME PRESENCE & VISITS (RTDB)
// ==========================================
function _pad2(n){ return String(n).padStart(2,'0'); }
function _dateKeyLocal(){
    const d = new Date();
    return `${d.getFullYear()}-${_pad2(d.getMonth()+1)}-${_pad2(d.getDate())}`;
}
function _monthKeyLocal(){
    const d = new Date();
    return `${d.getFullYear()}-${_pad2(d.getMonth()+1)}`;
}

function initRealtimePresenceAndStats(){
    // (A) Presence: 실시간 접속자 수
    const sessionId = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const presenceRef = dbRef(rtdb, `presence/${sessionId}`);
    const connectedRef = dbRef(rtdb, '.info/connected');

    onDbValue(connectedRef, (snap) => {
        if (snap.val() === true) {
            dbSet(presenceRef, {
                ts: dbServerTimestamp(),
                path: location.pathname || '/',
            });
            onDisconnect(presenceRef).remove();
        }
    });

    onDbValue(dbRef(rtdb, 'presence'), (snap) => {
        const live = snap.exists() ? snap.numChildren() : 0;
        const el = document.getElementById('visitor-count');
        const statLive = document.getElementById('stat-live');
        if (el) el.innerText = String(live);
        if (statLive) statLive.innerText = String(live);
    });

    // (B) Visits: 오늘/이번달 방문자(브라우저 기준 1일 1회 집계)
    const dayKey = _dateKeyLocal();
    const monthKey = _monthKeyLocal();

    const bump = () => {
        dbRunTransaction(dbRef(rtdb, `analytics/daily/${dayKey}/visits`), (cur) => (cur || 0) + 1);
        dbRunTransaction(dbRef(rtdb, `analytics/monthly/${monthKey}/visits`), (cur) => (cur || 0) + 1);
        dbRunTransaction(dbRef(rtdb, `analytics/total/visits`), (cur) => (cur || 0) + 1);
    };

    try {
        const onceKey = `visit_once_${dayKey}`;
        if (!localStorage.getItem(onceKey)) {
            localStorage.setItem(onceKey, '1');
            bump();
        }
    } catch(e) {
        // localStorage 제한 환경에서는 중복 집계될 수 있음
        bump();
    }

    const todayEl = document.getElementById('stat-today');
    const monthEl = document.getElementById('stat-month');

    onDbValue(dbRef(rtdb, `analytics/daily/${dayKey}/visits`), (snap) => {
        if (todayEl) todayEl.innerText = String(snap.val() || 0);
    });
    onDbValue(dbRef(rtdb, `analytics/monthly/${monthKey}/visits`), (snap) => {
        if (monthEl) monthEl.innerText = String(snap.val() || 0);
    });
}

lucide.createIcons();
