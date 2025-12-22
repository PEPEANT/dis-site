/* 공통: 데이터/설정 + 초기 상태 */
// ==========================================
// 1. Core Data & Config
// ==========================================
const SAVE_VERSION = 11;
const STORAGE_KEY = 'dice_city_v11_sim';
const LEGACY_STORAGE_KEY = 'dice_city_v10_sim';
const LEGACY_USD_TO_KRW = 1350; // Legacy migration only
const PART_TIME_REWARD = 135000;
const EMERGENCY_CASH_THRESHOLD = 675000;

const CYCLE_ORDER = ['EXTREME_FEAR', 'FEAR', 'NEUTRAL', 'GREED', 'EXTREME_GREED'];
let cycleIndex = 2; 

const CYCLES = {
    EXTREME_GREED: { label: '극단적 탐욕', color: 'text-red-600', bias: 0.008 },
    GREED: { label: '탐욕', color: 'text-orange-500', bias: 0.003 },
    NEUTRAL: { label: '중립', color: 'text-gray-500', bias: 0 },
    FEAR: { label: '공포', color: 'text-blue-500', bias: -0.004 },
    EXTREME_FEAR: { label: '극단적 공포', color: 'text-purple-600', bias: -0.01 }
};

const NEWS_MESSAGES = {
    'EXTREME_GREED': ["비트코인 사상 최고치 경신… 시장은 새로운 시대를 맞이했다", "AI·반도체·양자 테마 폭등… 전문가 ‘이제 시작일 뿐’", "ETF 자금 유입 신기록… 개인·기관 모두 매수 가속", "글로벌 투자자, 위험자산 쏠림 현상 심화"],
    'GREED': ["상승 랠리 지속… 일부 전문가 ‘과열 조짐’ 지적", "기술주 강세 이어져… 차익실현 움직임 나타나", "비트코인 20% 급등… 개인 매수세 확대", "버핏, 시장 상승에도 ‘여전히 신중한 태도’"],
    'NEUTRAL': ["BTC·나스닥, 주요 구간에서 횡보… 시장은 방향성 탐색", "ETF 자금 유입 둔화… 관망세 확대", "경제지표 혼조… 강세·약세 의견 팽팽", "버크셔, 현금 보유 유지… 보수적 전략 지속"],
    'FEAR': ["비트코인 10~20% 급락… 추가 하락 가능성 경고", "기술주 약세 전환… 위험자산 선호도 감소", "기관투자자, 노출 축소 움직임 확대", "버핏, 현금 비중 확대… 시장 경고 신호로 해석"],
    'EXTREME_FEAR': ["시장 패닉… BTC·ETH·나스닥 동반 폭락", "암호화폐 구조적 한계 지적… 종말론 확산", "채굴업체·중소 기술기업 줄도산 우려", "워런 버핏, 현금 비중 역대 최고… ‘이런 시장 처음 본다’", "전문가들 ‘반등 가능성 제한적’ 비관론 우세"]
};

const RANKS = [
    { limit: 13500000, title: '노숙자', rankEmoji: '🥣', houseEmoji: '📦', houseDesc: '비가 오면 젖습니다.' },
    { limit: 135000000, title: '서민', rankEmoji: '🚲', houseEmoji: '🚪', houseDesc: '작지만 아늑한 단칸방.' },
    { limit: 675000000, title: '중산층', rankEmoji: '💼', houseEmoji: '🏢', houseDesc: '엘리베이터가 있는 아파트.' },
    { limit: 1350000000, title: '부자', rankEmoji: '💎', houseEmoji: '🌆', houseDesc: '한강이 보이는 고급 아파트.' },
    { limit: 13500000000, title: '자산가', rankEmoji: '🚁', houseEmoji: '🏰', houseDesc: '정원사가 있는 대저택.' },
    { limit: 135000000000, title: '재벌', rankEmoji: '👑', houseEmoji: '🏝️', houseDesc: '개인 소유 섬.' }
];

const INITIAL_STATE = {
    saveVersion: SAVE_VERSION,
    cash: 13500000,
    stocks: {
        'NASDAQ': { name: '나스닥', price: 20250000.00, qty: 0, avg: 0 },
        'TSLA': { name: '테슬라', price: 270000.00, qty: 0, avg: 0 },
        'AAPL': { name: '애플', price: 243000.00, qty: 0, avg: 0 },
        'NVDA': { name: '엔비디아', price: 607500.00, qty: 0, avg: 0 }
    },
    crypto: { 'BTC': { name: 'Bitcoin', price: 81000000.00 }, 'ETH': { name: 'Ethereum', price: 4050000.00 } },
    futures: [],
    realEstate: {
        'oneroom': { name: '원룸', price: 108000000, rent: 405000, count: 0, img: '🏠' },
        'apt': { name: '아파트', price: 2025000000, rent: 8100000, count: 0, img: '🌆' },
        'building': { name: '빌딩', price: 6750000000, rent: 33750000, count: 0, img: '🏦' }
    },
    luxury: {
        'phone': { name: '폴더폰', price: 675000, count: 0, img: '📱', type: 'essential', desc: '뉴스 열람' },
        'smartphone': { name: '스마트폰', price: 4050000, count: 0, img: '📲', type: 'essential', desc: '코인 시세 확인' },
        'gold': { name: '금괴 1kg', price: 87750000, count: 0, img: '🧈', type: 'asset', desc: '안전 자산', fixedPrice: false },
        'bag': { name: '루이비통 가방', price: 4050000, count: 0, img: '👜', type: 'asset', desc: '명품', fixedPrice: true },
        'shoes': { name: '명품 구두', price: 2025000, count: 0, img: '👠', type: 'asset', desc: '명품', fixedPrice: true },
        'ring': { name: '다이아 반지', price: 6750000, count: 0, img: '💍', type: 'asset', desc: '청혼용', fixedPrice: true },
        'rolex': { name: '롤렉스', price: 20250000, count: 0, img: '⌚', type: 'asset', desc: '성공의 상징', fixedPrice: true },
        'sedan': { name: '고급 세단', price: 81000000, count: 0, img: '🚘', type: 'asset', desc: '편안한 승차감', fixedPrice: true },
        'supercar': { name: '람보르기니', price: 405000000, count: 0, img: '🏎️', type: 'asset', desc: '부의 상징', fixedPrice: true }
    },
    newsHistory: [],
    partners: [] 
};

let gameState = JSON.parse(JSON.stringify(INITIAL_STATE));
let marketCycle = 'NEUTRAL';
let chartHistory = Array(20).fill(20250000);
let currentTrade = null;
let activePartnerIdx = -1;
let selectedCrypto = 'BTC';
let bjPlayerHand=[], bjDealerHand=[], bjGameActive=false, bjDeck=[];
let currentTickerMsg = "시장 데이터 수신 대기 중...";

let oddEvenStreak = 0;
let oddEvenBaseBet = 0;
let oddEvenCurrentWin = 0;
// 홀짝 더블업: "도전하기"를 눌렀을 때 다음 홀/짝 선택을 기다리는 상태
let oddEvenAwaitingPick = false;
const ODD_EVEN_RATES = [2, 5, 12]; 

const CRASH_INTERNAL = [ "속보: 트럼프 '관세 200% 부과' 선언... 시장 충격", "긴급: 파월 의장 '금리 인상 불가피' 매파적 발언", "충격: 미 연방정부 셧다운 돌입... 경제 마비 우려", "속보: 미국 비상 계엄령 선포 루머 확산" ];
const CRASH_EXTERNAL = [ "긴급: 중동 전쟁 확전... 유가 폭등 및 증시 급락", "속보: 대규모 테러 발생... 글로벌 투자심리 위축", "충격: 전산망 대규모 해킹 사태... 금융 시스템 마비", "악재: 테슬라 실적 쇼크... 기술주 동반 투매", "속보: 최신 AI 모델 치명적 오류 발생... 관련주 폭락" ];

let greedStreak = 0; 
let fearStreak = 0;
let pendingBullRun = false; 
