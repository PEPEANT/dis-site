/* 앱: 초기 로드 + 시작 */
window.onload = () => {
    loadGame();
    switchTab('myinfo');
};

function startGame() {
    const audio = document.getElementById('bgm-player'); audio.volume = 0.5; 
    audio.play().then(() => { const btn = document.getElementById('bgm-btn'); if(btn) { btn.innerText = '🔊'; btn.classList.add('bg-indigo-100', 'text-indigo-600'); } }).catch(e => console.log("BGM Auto-play blocked"));
    const mainScreen = document.getElementById('main-screen'); mainScreen.classList.add('opacity-0', 'pointer-events-none');
    setTimeout(() => { mainScreen.classList.add('hidden'); document.getElementById('game-screen').classList.remove('hidden'); }, 500);
}
