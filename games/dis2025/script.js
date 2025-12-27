// Data Logic
const categories = [
  {
    id: 'A',
    title: '시뮬레이션 안의 시뮬레이션',
    subtitle: '철학 / 존재론',
    iconName: 'layers',
    color: 'text-cyan-400',
    borderColor: 'border-cyan-500/50',
    bgHover: 'hover:bg-cyan-950/30',
    description: '중첩된 세계에서의 존재 가능성과 상위 문명의 개입 확률에 대한 탐구',
    items: [
      {
        title: "Are You Living in a Computer Simulation?",
        author: "Nick Bostrom",
        year: "2003",
        summary: "인류가 시뮬레이션 속에 살고 있지 않을 확률보다, 기술이 성숙한 문명이 수많은 '조상 시뮬레이션'을 돌리고 있을 확률이 훨씬 높다는 통계적/논리적 논증.",
        connection: "당신의 프레임 중 '현실 → 가상 → 가상의 가상(중첩)' 단계에서, 하위 시뮬레이션이 필연적으로 발생함을 증명하는 가장 강력한 원전.",
        linkText: "PDF (Original)",
        url: "https://simulation-argument.com/simulation.pdf"
      },
      {
        title: "The Matrix as Metaphysics",
        author: "David J. Chalmers",
        year: "2005",
        summary: "시뮬레이션 속의 객체는 '허상(Illusion)'이 아니라, 비트(Bit)로 이루어진 '실재(Reality)'이며, 따라서 시뮬레이션 속의 나도 진정한 존재라는 철학적 주장.",
        connection: "'시뮬레이션의 나는 존재한다'는 당신의 선언을 뒷받침하며, 가상 존재가 0과 1의 구조 위에서 어떻게 실재성을 획득하는지 설명.",
        linkText: "PDF (Original)",
        url: "https://consc.net/papers/matrix.pdf"
      },
      {
        title: "Living in a Simulated Universe",
        author: "John D. Barrow",
        year: "2007",
        summary: "우주가 시뮬레이션이라면, 시뮬레이터(설계자)는 계산 비용을 아끼기 위해 우리가 관측할 때만 세밀하게 렌더링하는 기법을 쓸 것이며, 중첩된 시뮬레이션도 가능하다는 우주론적 관점.",
        connection: "'시뮬레이션의 시뮬레이션'이 무한히 이어질 때 발생할 수 있는 오류(Glitch)나 자원 제약을 다루며, 이는 DIS의 재귀적 구조와 일치함.",
        linkText: "PDF (Circulated)",
        url: "https://simulation-argument.com/barrowsim.pdf"
      }
    ],
    synthesis: [
      "시뮬레이션 가설은 '우리가 매트릭스냐?'라는 질문보다 '이 세계의 규칙은 누가 바꾸는가?'를 묻는다.",
      "현실이든 가상이든, 우리를 지배하는 건 '규칙'이고, 그 규칙을 바꾸는 건 오직 '설계자 권한(Authority)'뿐이다."
    ]
  },
  {
    id: 'B',
    title: '가상세계 안의 가상세계',
    subtitle: 'HCI / VR',
    iconName: 'monitor',
    color: 'text-purple-400',
    borderColor: 'border-purple-500/50',
    bgHover: 'hover:bg-purple-950/30',
    description: '재귀적 인터랙션, 미니어처 조작(God Mode), 그리고 설계자의 권한',
    items: [
      {
        title: "Virtual Reality on a WIM: Interactive Worlds in Miniature",
        author: "Stoakley, Conway, & Pausch",
        year: "1995",
        summary: "VR 공간 안에서 그 공간의 축소판(미니어처)을 손에 들고 조작하면, 실제 거대 공간이 동시에 변하는 'WIM(Worlds in Miniature)' 인터페이스를 제안한 고전 논문.",
        connection: "'설계자 권한/상위 차원의 개입'을 시각적으로 구현한 사례로, 미니어처(하위)를 만져 상위 세계를 바꾸는 재귀적 조작의 원형.",
        linkText: "ACM Digital Library",
        url: "https://dl.acm.org/doi/10.1145/223904.223938"
      },
      {
        title: "Don't Panic: Recursive Interactions in a Miniature Metaworld",
        author: "Bluff et al.",
        year: "2019",
        summary: "메타버스 안에서 또 다른 메타버스를 설계하고 진입하는 '재귀적 창작'과 그로 인해 발생하는 인터페이스의 층위 문제를 다룸.",
        connection: "'현실에 존재할 수 없는 허상'인 DIS가 겹겹이 쌓일 때, 사용자가 겪는 차원 이동의 감각과 '만들기 장벽'이 무너지는 현상을 설명.",
        linkText: "ACM Digital Library",
        url: "https://dl.acm.org/doi/fullHtml/10.1145/3359997.3365682"
      },
      {
        title: "Portal Rendering and Creation Interactions in Virtual Reality",
        author: "Ablett et al.",
        year: "2022",
        summary: "가상 현실 내에 '거울'이나 '포털' 형태의 또 다른 뷰포트를 배치하여, 자기 자신을 포함한 공간을 무한히 비추거나 다른 차원으로 연결하는 렌더링 기법.",
        connection: "'시뮬레이션에 들어가도 존재할 수 없다'는 역설처럼, 거울 속의 거울로 들어갈수록 원본(Source)에서 멀어지는 디지털 공간의 특성을 기술적으로 보여줌.",
        linkText: "Wearable Computer Lab",
        url: "https://wearables.unisa.edu.au/uploads/1/2/7/6/127656642/portal_rendering_and_creation_interactions_in_virtual_reality.pdf"
      }
    ],
    synthesis: [
      "HCI의 WIM(미니어처 세계) 모델은 DIS의 설계자가 신(God)이 아니라, 시스템의 ‘축소판’을 손에 쥔 관리자(Admin)로서 기능함을 보여준다.",
      "가상 공간 안에서 또 다른 가상을 여는 재귀적 인터랙션은, 지금의 ‘석기시대 수준’인 평면적 타이핑을 넘어 공간 그 자체를 쥐고 흔드는 바이브코딩(Vibe Coding)의 미래형이다."
    ]
  },
  {
    id: 'C',
    title: '시뮬레이션 가설의 컴퓨터과학적 접근',
    subtitle: '계산 / 복잡성',
    iconName: 'cpu',
    color: 'text-emerald-400',
    borderColor: 'border-emerald-500/50',
    bgHover: 'hover:bg-emerald-950/30',
    description: '계산 가능성, 자원 제약, 0과 1의 한계, 자기 시뮬레이션',
    items: [
      {
        title: "Ultimate physical limits to computation",
        author: "Seth Lloyd",
        year: "2000",
        summary: "우주 전체를 하나의 컴퓨터로 가정했을 때 처리 가능한 정보량(비트)과 연산 속도의 물리적 한계치를 양자역학적으로 계산한 기념비적 논문.",
        connection: "'지금의 디지털을 석기시대 수준이라 말한다'는 주장의 근거. 우리가 만드는 시뮬레이션이 현실을 완벽히 대체하지 못하는 이유는 우주의 계산 용량 한계 때문임을 시사.",
        linkText: "arXiv",
        url: "https://arxiv.org/abs/quant-ph/9908043"
      },
      {
        title: "Constraints on the Universe as a Numerical Simulation",
        author: "Silas R. Beane et al.",
        year: "2012",
        summary: "만약 우주가 시뮬레이션이라면, 고에너지 입자의 분포에서 격자(Lattice) 구조 같은 '디지털 아티팩트'가 발견될 것이라고 주장하며 이를 검증하려 한 시도.",
        connection: "'DIS는 결국 현실에 존재할 수 없는 허상'이라는 문장처럼, 아무리 정교한 시뮬레이션도 근본적인 '격자(Grid/Rule)'의 흔적을 지울 수 없음을 과학적으로 뒷받침.",
        linkText: "arXiv",
        url: "https://arxiv.org/abs/1210.1847"
      },
      {
        title: "Computational Irreducibility",
        author: "Stephen Wolfram",
        year: "2002",
        summary: "복잡한 시스템의 미래를 알기 위해서는 실제로 그 시뮬레이션을 돌려보는(계산하는) 수밖에 없으며, 지름길(단축 공식)은 존재하지 않는다는 원리.",
        connection: "'노동/생각정리가 필요하다'는 현실의 제약을 설명. AI가 코딩을 해도 결국 '실행(Run)'이라는 시간의 축을 건너뛸 수 없다는 코딩의 본질적 한계와 연결.",
        linkText: "Wolfram Science",
        url: "https://www.wolframscience.com/nks/p737--computational-irreducibility/"
      }
    ],
    synthesis: [
      "무한히 겹친 세계는 존재할 수 없다. 계산에는 물리적 한계가 있고, 복잡성에는 지름길(Shortcut)이 없기 때문이다.",
      "DIS의 핵심은 '무한한 세계'를 만드는 것이 아니라, 어디까지를 '규칙(격자)'으로 묶고 어디부터를 인간에게 남길 것인가를 결정하는 데 있다."
    ]
  },
  {
    id: 'D',
    title: '규칙의 규칙: 헌법과 프로토콜',
    subtitle: '설계자 권한',
    iconName: 'scale',
    color: 'text-amber-400',
    borderColor: 'border-amber-500/50',
    bgHover: 'hover:bg-amber-950/30',
    description: 'Code is Law, 거버넌스, 2차 규칙, 불변 규칙',
    items: [
      {
        title: "Code and Other Laws of Cyberspace",
        author: "Lawrence Lessig",
        year: "1999",
        summary: "\"Code is Law\". 사이버 공간에서는 아키텍처(코드) 자체가 물리적 제약이자 법률처럼 작동하여 사용자의 행동을 원천적으로 통제한다는 법학적 통찰.",
        connection: "'자유는 무규칙이 아니라 불변 규칙 위에서 성립한다'는 당신의 논지와 정확히 일치. 프로토콜이 단순한 약속이 아니라 '디지털 헌법'임을 천명.",
        linkText: "Lessig.org (PDF)",
        url: "https://lessig.org/images/resources/1999-Code.pdf"
      },
      {
        title: "Blockchain and the Law: The Rule of Code",
        author: "Primavera De Filippi & Aaron Wright",
        year: "2018",
        summary: "블록체인 프로토콜을 'Lex Cryptographia'로 정의하며, 중앙 관리자 없이도 코드가 스스로 집행하는 거버넌스와 그 한계(유연성 부족 등)를 분석.",
        connection: "'설계자 권한 / 헌법 / 프로토콜' 파트의 핵심 레퍼런스. 규칙을 바꾸는 규칙(개헌 절차)이 코드에 내장되어야 진정한 DIS 거버넌스임을 시사.",
        linkText: "Harvard Univ. Press",
        url: "https://www.hup.harvard.edu/books/9780674241596"
      },
      {
        title: "The Concept of Law (Secondary Rules)",
        author: "H.L.A. Hart",
        year: "1961",
        summary: "법체계는 의무를 부과하는 '1차 규칙'과, 그 규칙을 만들고 변경하는 방법을 정한 '2차 규칙(승인의 규칙)'의 결합이라는 법철학의 고전.",
        connection: "'프로토콜(규칙의 규칙)' 개념의 이론적 뿌리. 단순 코딩(1차 규칙)을 넘어, 시스템을 유지하는 헌법적 코딩(2차 규칙)이 설계자의 진짜 권한임을 증명.",
        linkText: "Oxford Academic",
        url: "https://global.oup.com/academic/product/the-concept-of-law-9780199644704"
      }
    ],
    synthesis: [
      "DIS는 '도시'가 아니라, 욕망을 다루는 규칙(프로토콜)의 실험장이다. 노동-보상-소비-중독이 하나의 코드 안에서 자동 집행된다.",
      "레식(Lessig)이 말했듯 코드는 법이다. 우리는 현실을 부정하는 것이 아니라, 이미 디지털이 되어버린 현실 위에서 '인간적인 조건(규칙)'을 다시 설계하려는 것이다."
    ]
  }
];

// App State
let state = {
  activeTab: 'ARCHITECTURE' // Default tab
};

// DOM Elements
const appContainer = document.getElementById('app-container');
const tabNav = document.getElementById('tab-nav');
const mainContent = document.getElementById('main-content');

// --- Render Functions ---

function renderTabs() {
  const tabs = [
    { id: 'ARCHITECTURE', label: 'ARCHITECTURE', icon: 'key', colorClass: 'bg-orange-600 text-white shadow-sm shadow-orange-500/20' },
    { id: 'TRAJECTORY', label: 'TRAJECTORY', icon: 'trending-up', colorClass: 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/20' },
    { id: 'ALL', label: 'ALL REFS', icon: null, colorClass: 'bg-slate-700 text-white shadow-sm' }
  ];

  let html = '';

  // Static Tabs
  tabs.forEach(tab => {
    const isActive = state.activeTab === tab.id;
    const activeClass = isActive ? tab.colorClass : 'text-slate-400 hover:text-slate-200';
    const iconHtml = tab.icon ? `<i data-lucide="${tab.icon}" class="w-3.5 h-3.5 mr-2"></i>` : '';

    html += `
            <button 
                onclick="setActiveTab('${tab.id}')"
                class="px-4 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap flex items-center ${activeClass}"
            >
                ${iconHtml}
                <span>${tab.label}</span>
            </button>
        `;
  });

  // Divider
  html += `<div class="w-px h-4 bg-slate-700 mx-1"></div>`;

  // Category Tabs
  categories.forEach(cat => {
    const isActive = state.activeTab === cat.id;
    const activeClass = isActive ? `${cat.color} bg-slate-800 shadow-sm` : 'text-slate-400 hover:text-slate-200';

    html += `
            <button
                onclick="setActiveTab('${cat.id}')"
                class="px-4 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap flex items-center gap-2 ${activeClass}"
            >
                <span>${cat.id}</span>
                <span class="hidden md:inline text-[10px] opacity-70">${cat.subtitle}</span>
            </button>
        `;
  });

  tabNav.innerHTML = html;
}

function renderMain() {
  mainContent.innerHTML = '';

  // Intro always shows
  const introHtml = `
        <section class="mb-16 text-center max-w-3xl mx-auto">
          <h2 class="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-slate-100 to-slate-500 mb-6">
            The Architecture of <br class="hidden md:block" />Nested Reality
          </h2>
          <p class="text-slate-400 leading-relaxed text-lg">
            "시뮬레이션 안의 시뮬레이션" 이론을 뒷받침하는 학술적 기틀.<br/>
            철학, HCI, 컴퓨터과학, 그리고 법학의 관점에서 DIS의 존재론적 위치를 탐구합니다.
          </p>
        </section>
    `;

  let contentHtml = '';

  if (state.activeTab === 'ARCHITECTURE') {
    contentHtml = renderArchitectureView();
  } else if (state.activeTab === 'TRAJECTORY') {
    contentHtml = renderTrajectoryView();
  } else {
    contentHtml = renderArchiveView();
  }

  mainContent.innerHTML = introHtml + contentHtml;

  // Re-initialize icons after DOM update
  lucide.createIcons();
}

function renderArchitectureView() {
  return `
        <section class="mb-24 animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-20">
            
            <!-- 1. Access vs Money (UHI Concept) -->
            <div class="bg-slate-900/40 border border-slate-800 rounded-3xl overflow-hidden">
                <div class="p-8 md:p-10 border-b border-slate-800">
                    <h3 class="text-orange-400 font-mono text-sm tracking-widest uppercase mb-2">HI: Access Infrastructure</h3>
                    <h2 class="text-3xl font-bold text-white mb-4">"빈부(Wealth)의 시대가 가고,<br/>권한(Access)의 시대가 온다"</h2>
                    <p class="text-slate-400 max-w-3xl leading-relaxed">
                        우리가 '빈부'라고 부르는 건 결국 숫자 문제가 아니라, 무엇에 접근할 수 있느냐의 문제입니다.
                        UBI(기본소득)는 'UI 패치'에 불과하며, 미래의 격차는 "얼마를 받느냐"가 아니라 "어떤 권한(UHI)을 갖느냐"로 갈리게 됩니다.
                    </p>
                </div>
                
                <div class="grid md:grid-cols-2">
                    <!-- Left: The Old World -->
                    <div class="p-8 md:p-10 bg-slate-950/50 border-r border-slate-800 flex flex-col items-center text-center">
                        <div class="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-6 text-slate-500">
                            <i data-lucide="scale" class="w-8 h-8"></i>
                        </div>
                        <h4 class="text-xl font-bold text-slate-400 mb-2">Old Paradigm: Wealth</h4>
                        <p class="text-sm text-slate-500 mb-6 font-mono">Inequality of Possession</p>
                        <ul class="text-slate-400 text-sm space-y-3 text-left w-full max-w-xs mx-auto">
                            <li class="flex items-center gap-3">
                                <span class="w-2 h-2 rounded-full bg-slate-600"></span>
                                화폐로 상품을 구매
                            </li>
                            <li class="flex items-center gap-3">
                                <span class="w-2 h-2 rounded-full bg-slate-600"></span>
                                가격에 의한 진입 장벽
                            </li>
                            <li class="flex items-center gap-3">
                                <span class="w-2 h-2 rounded-full bg-slate-600"></span>
                                감정과 인맥이 통하는 문
                            </li>
                        </ul>
                    </div>

                    <!-- Right: The New World -->
                    <div class="p-8 md:p-10 bg-orange-950/10 flex flex-col items-center text-center relative overflow-hidden">
                        <div class="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                        
                        <div class="w-16 h-16 rounded-full bg-orange-900/30 flex items-center justify-center mb-6 text-orange-400 border border-orange-500/30 shadow-lg shadow-orange-900/20">
                            <i data-lucide="key" class="w-8 h-8"></i>
                        </div>
                        <h4 class="text-xl font-bold text-white mb-2">New Paradigm: Access</h4>
                        <p class="text-sm text-orange-400/70 mb-6 font-mono">Inequality of Permission</p>
                        <ul class="text-slate-300 text-sm space-y-3 text-left w-full max-w-xs mx-auto">
                            <li class="flex items-center gap-3">
                                <i data-lucide="shield" class="w-3.5 h-3.5 text-orange-400"></i>
                                프로토콜에 의한 권한 부여
                            </li>
                            <li class="flex items-center gap-3">
                                <i data-lucide="shield" class="w-3.5 h-3.5 text-orange-400"></i>
                                시스템 엑세스 (API/Tool)
                            </li>
                            <li class="flex items-center gap-3">
                                <i data-lucide="shield" class="w-3.5 h-3.5 text-orange-400"></i>
                                자동화된 규칙과 차단
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            <!-- 2. City Loop (Labor -> Economy -> Consume) -->
            <div class="relative">
                <div class="absolute left-1/2 -translate-x-1/2 -top-10 text-slate-700">
                    <i data-lucide="activity" class="w-[120px] h-[120px]" stroke-width="1"></i>
                </div>
                <h3 class="text-center text-slate-500 font-mono text-sm tracking-widest uppercase mb-8 relative z-10">The Loop of Existence</h3>
                
                <div class="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-12 relative z-10">
                    
                    <!-- Labor -->
                    <div class="flex flex-col items-center gap-4 group">
                        <div class="w-20 h-20 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center shadow-xl group-hover:border-cyan-500 transition-colors">
                            <i data-lucide="hammer" class="w-8 h-8 text-cyan-500"></i>
                        </div>
                        <div class="text-center">
                            <span class="block font-bold text-slate-200">LABOR City</span>
                            <span class="text-xs text-slate-500">Production & Effort</span>
                        </div>
                    </div>

                    <i data-lucide="arrow-right" class="w-6 h-6 text-slate-700 rotate-90 md:rotate-0"></i>

                    <!-- Economy -->
                    <div class="flex flex-col items-center gap-4 group">
                        <div class="w-20 h-20 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center shadow-xl group-hover:border-emerald-500 transition-colors">
                            <i data-lucide="trending-up" class="w-8 h-8 text-emerald-500"></i>
                        </div>
                        <div class="text-center">
                            <span class="block font-bold text-slate-200">ECONOMY City</span>
                            <span class="text-xs text-slate-500">Reward & Exchange</span>
                        </div>
                    </div>

                    <i data-lucide="arrow-right" class="w-6 h-6 text-slate-700 rotate-90 md:rotate-0"></i>

                    <!-- Consume -->
                    <div class="flex flex-col items-center gap-4 group">
                        <div class="w-20 h-20 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center shadow-xl group-hover:border-pink-500 transition-colors">
                            <i data-lucide="refresh-cw" class="w-8 h-8 text-pink-500"></i>
                        </div>
                        <div class="text-center">
                            <span class="block font-bold text-slate-200">CONSUME City</span>
                            <span class="text-xs text-slate-500">Depletion & Reset</span>
                        </div>
                    </div>
                </div>
                
                <p class="text-center text-slate-400 mt-10 max-w-2xl mx-auto italic text-sm">
                    "도시는 이 루프를 숨기기 위해 만들어진 것이 아니라, 이 루프가 굴러가게 하려고 설계된 것이다.<br/>
                    DIS는 도시를 통해 인간의 선택이 사실은 구조의 언어임을 증명한다."
                </p>
            </div>

            <!-- 3. Structure & Game Patterns -->
            <div class="bg-slate-950 border border-slate-800 rounded-xl p-8 relative overflow-hidden group hover:border-slate-600 transition-colors">
                <div class="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-40 transition-opacity">
                    <i data-lucide="box" class="w-[100px] h-[100px]" stroke-width="0.5"></i>
                </div>

                <div class="flex items-center gap-3 mb-6">
                    <div class="p-2 bg-blue-900/30 rounded text-blue-400">
                        <i data-lucide="layers" class="w-5 h-5"></i>
                    </div>
                    <h3 class="text-xl font-bold text-white">From Vibe Coding to System Architecture</h3>
                </div>

                <div class="grid md:grid-cols-2 gap-10">
                    <div>
                        <h4 class="text-slate-300 font-bold mb-3 flex items-center gap-2">
                            <i data-lucide="zap" class="w-4 h-4 text-yellow-400"></i> Agentic Workflow
                        </h4>
                        <p class="text-slate-400 text-sm mb-4 leading-relaxed">
                            에이전트는 생산성을 폭발시키고 누구나 '창작'하게 해줍니다. 하지만 에이전트는 "가능"만 줄 뿐, "지속"은 주지 않습니다. 코드가 길어질수록 한 줄 수정이 전체 세계를 무너뜨립니다.
                        </p>
                        <div class="bg-red-950/20 border border-red-900/30 rounded p-3 text-xs text-red-400 font-mono">
                            WARNING: Structure Fragility High
                        </div>
                    </div>

                    <div>
                        <h4 class="text-slate-300 font-bold mb-3 flex items-center gap-2">
                            <i data-lucide="box" class="w-4 h-4 text-blue-400"></i> Game Programming Patterns
                        </h4>
                        <p class="text-slate-400 text-sm mb-4 leading-relaxed">
                            세계관을 지키는 것은 서사가 아니라 구조입니다. 상태 머신, 컴포넌트, 이벤트 버스 등의 패턴만이 "내가 만든 세계가 스스로 유지될 수 있는가?"라는 질문에 답할 수 있습니다.
                        </p>
                        <div class="bg-blue-950/20 border border-blue-900/30 rounded p-3 text-xs text-blue-400 font-mono">
                            GOAL: Modular & Immutable System
                        </div>
                    </div>
                </div>

                <div class="mt-8 pt-6 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div class="text-xs text-slate-500 font-mono">
                        TRANSITION PHASE: Single-File Prototype → Modular Architecture
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="px-2 py-1 rounded bg-slate-800 text-slate-300 text-xs font-mono">State Machine</span>
                        <span class="px-2 py-1 rounded bg-slate-800 text-slate-300 text-xs font-mono">Event Bus</span>
                        <span class="px-2 py-1 rounded bg-slate-800 text-slate-300 text-xs font-mono">ECS</span>
                    </div>
                </div>
            </div>

        </section>
    `;
}

function renderTrajectoryView() {
  return `
        <section class="mb-24 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div class="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 md:p-10 relative overflow-hidden shadow-2xl shadow-indigo-900/10">
                
                <!-- Grid Background -->
                <div class="absolute inset-0 opacity-10" 
                    style="background-image: linear-gradient(to right, #4f46e5 1px, transparent 1px), linear-gradient(to bottom, #4f46e5 1px, transparent 1px); background-size: 40px 40px;">
                </div>

                <div class="relative z-10">
                    <div class="flex flex-col md:flex-row items-start justify-between mb-10 gap-6">
                        <div>
                            <h3 class="text-indigo-400 font-mono text-sm tracking-widest uppercase mb-2">The Path to Immersion</h3>
                            <h2 class="text-3xl font-bold text-white mb-2">Singularity & Fidelity</h2>
                            <p class="text-slate-400 max-w-xl">
                                현실 복제 기술의 발전 속도(Fidelity)와 특이점(Singularity) 도달의 상관관계.<br/>
                                우리는 지금 <strong>UHI</strong>의 직전에 서 있습니다.
                            </p>
                        </div>
                        <div class="flex flex-col gap-2 text-right">
                            <div class="inline-flex items-center gap-2 justify-end text-emerald-400 font-mono text-sm">
                                <span class="relative flex h-2 w-2">
                                    <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                                System Online
                            </div>
                            <div class="text-xs text-slate-500 font-mono">Current Era: Transitional Phase</div>
                        </div>
                    </div>

                    <!-- Graph Visualization -->
                    <div class="w-full h-64 md:h-96 relative bg-slate-950/50 rounded-xl border border-slate-800 mb-10 overflow-hidden group">
                        
                        <!-- The Curve -->
                        <svg class="w-full h-full absolute inset-0 p-8" viewBox="0 0 400 200" preserveAspectRatio="none">
                            <defs>
                                <linearGradient id="gradientCurve" x1="0" y1="0" x2="1" y2="0">
                                    <stop offset="0%" stopColor="#64748b" stopOpacity="0.3" />
                                    <stop offset="60%" stopColor="#38bdf8" stopOpacity="0.8" />
                                    <stop offset="100%" stopColor="#a855f7" stopOpacity="1" />
                                </linearGradient>
                            </defs>
                            
                            <!-- Grid Lines -->
                            <line x1="0" y1="180" x2="400" y2="180" stroke="#334155" stroke-width="1" />
                            <line x1="0" y1="0" x2="0" y2="180" stroke="#334155" stroke-width="1" />

                            <!-- Exponential Curve -->
                            <path 
                                d="M 0 180 Q 200 180 250 150 C 300 120 320 100 350 10" 
                                fill="none" 
                                stroke="url(#gradientCurve)" 
                                stroke-width="3" 
                                class="drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]"
                            />

                            <!-- Past -->
                            <circle cx="50" cy="180" r="3" fill="#64748b" />
                            <text x="50" y="195" fill="#64748b" font-size="8" text-anchor="middle">Text-based (MUDs)</text>

                            <!-- Present (You are here) -->
                            <circle cx="230" cy="160" r="4" fill="#38bdf8" class="animate-pulse" />
                            <g transform="translate(230, 160)">
                                <line x1="0" y1="0" x2="0" y2="-40" stroke="#38bdf8" stroke-dasharray="2,2" />
                                <rect x="-40" y="-60" width="80" height="20" rx="4" fill="#0f172a" stroke="#38bdf8" />
                                <text x="0" y="-48" fill="#38bdf8" font-size="8" text-anchor="middle" font-weight="bold">WE ARE HERE</text>
                            </g>

                            <!-- UHI (Near Future) -->
                            <circle cx="300" cy="120" r="4" fill="#a855f7" />
                            <text x="310" y="120" fill="#a855f7" font-size="10" font-weight="bold">UHI</text>
                            
                            <!-- FDVR / Singularity (Far Future/Limit) -->
                            <line x1="350" y1="180" x2="350" y2="0" stroke="#ec4899" stroke-width="1" stroke-dasharray="4,4" />
                            <circle cx="350" cy="10" r="5" fill="#ec4899" class="drop-shadow-[0_0_8px_rgba(236,72,153,0.8)]" />
                            <text x="360" y="20" fill="#ec4899" font-size="10" font-weight="bold">FDVR / Singularity</text>
                        </svg>
                        
                        <!-- Axis Labels -->
                        <div class="absolute bottom-2 right-4 text-xs text-slate-500">Time →</div>
                        <div class="absolute top-4 left-2 text-xs text-slate-500 rotate-90 origin-left">Immersion Fidelity →</div>
                    </div>

                    <!-- Key Concepts Cards -->
                    <div class="grid md:grid-cols-3 gap-6">
                        
                        <!-- UHI Card -->
                        <div class="bg-slate-950/60 border border-slate-800 p-5 rounded-xl hover:border-purple-500/50 transition-colors group">
                            <div class="flex items-center gap-3 mb-3">
                                <div class="p-2 bg-purple-900/30 rounded-lg text-purple-400 group-hover:text-purple-300">
                                    <i data-lucide="zap" class="w-[18px] h-[18px]"></i>
                                </div>
                                <h4 class="font-bold text-slate-200">UHI</h4>
                            </div>
                            <p class="text-xs text-purple-400 font-mono mb-2">Universal Human Interface</p>
                            <p class="text-sm text-slate-400 leading-relaxed">
                                모니터와 키보드라는 '석기시대' 도구를 버리고, <strong>뇌와 기계가 직접 연결</strong>되는 시점. 생각이 곧 코드가 되고, 상상이 곧 현실 렌더링이 되는 인터페이스의 혁명.
                            </p>
                        </div>

                        <!-- FDVR Card -->
                        <div class="bg-slate-950/60 border border-slate-800 p-5 rounded-xl hover:border-pink-500/50 transition-colors group">
                            <div class="flex items-center gap-3 mb-3">
                                <div class="p-2 bg-pink-900/30 rounded-lg text-pink-400 group-hover:text-pink-300">
                                    <i data-lucide="globe" class="w-[18px] h-[18px]"></i>
                                </div>
                                <h4 class="font-bold text-slate-200">완몰가 (FDVR)</h4>
                            </div>
                            <p class="text-xs text-pink-400 font-mono mb-2">Full Dive Virtual Reality</p>
                            <p class="text-sm text-slate-400 leading-relaxed">
                                특이점 이후, 현실과 시뮬레이션의 구분이 <strong>물리적으로 불가능해지는 단계</strong>. 오감(Five Senses)이 0과 1의 데이터로 완벽하게 대체되며 '제2의 실재'가 탄생함.
                            </p>
                        </div>

                        <!-- Protocol Card -->
                        <div class="bg-slate-950/60 border border-slate-800 p-5 rounded-xl hover:border-amber-500/50 transition-colors group">
                            <div class="flex items-center gap-3 mb-3">
                                <div class="p-2 bg-amber-900/30 rounded-lg text-amber-400 group-hover:text-amber-300">
                                    <i data-lucide="lock" class="w-[18px] h-[18px]"></i>
                                </div>
                                <h4 class="font-bold text-slate-200">Protocol</h4>
                            </div>
                            <p class="text-xs text-amber-400 font-mono mb-2">The Immutable Law</p>
                            <p class="text-sm text-slate-400 leading-relaxed">
                                특이점과 완몰가의 세계가 붕괴하지 않도록 지탱하는 <strong>절대 규칙(Constitution)</strong>. 설계자조차 위반할 수 없는 '코드화된 법'만이 무한한 자유를 보장함.
                            </p>
                        </div>

                    </div>
                </div>
            </div>
        </section>
    `;
}

function renderArchiveView() {
  const filteredCategories = ['TRAJECTORY', 'ARCHITECTURE', 'ALL'].includes(state.activeTab)
    ? categories
    : categories.filter(cat => cat.id === state.activeTab);

  return `
        <div class="space-y-24">
            ${filteredCategories.map(category => `
              <section class="relative">
                <!-- Category Header -->
                <div class="flex flex-col md:flex-row md:items-end justify-between mb-8 pb-4 border-b border-slate-800">
                  <div class="flex items-start gap-4">
                    <div class="p-3 rounded-xl bg-slate-900 border border-slate-800 ${category.color}">
                      <i data-lucide="${category.iconName}" class="w-5 h-5"></i>
                    </div>
                    <div>
                      <h3 class="text-sm font-bold tracking-widest uppercase mb-1 ${category.color}">
                        Category ${category.id}
                      </h3>
                      <h2 class="text-2xl font-bold text-slate-100">${category.title}</h2>
                      <p class="text-slate-500 text-sm mt-1 max-w-xl">
                        ${category.description}
                      </p>
                    </div>
                  </div>
                </div>

                <!-- Cards Grid -->
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
                  ${category.items.map(item => `
                    <div class="group relative flex flex-col bg-slate-900/50 rounded-xl border border-slate-800 p-6 transition-all duration-300 hover:border-slate-700 hover:shadow-2xl hover:shadow-black/50 ${category.bgHover}">
                      <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-slate-700 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      
                      <div class="flex items-start justify-between mb-4">
                        <i data-lucide="book-open" class="w-[18px] h-[18px] text-slate-600 group-hover:text-slate-400 transition-colors"></i>
                        <span class="text-xs font-mono text-slate-500 border border-slate-800 px-2 py-1 rounded bg-slate-950">
                          ${item.year}
                        </span>
                      </div>

                      <h4 class="text-lg font-bold text-slate-200 mb-1 leading-snug group-hover:text-white transition-colors">
                        ${item.title}
                      </h4>
                      <p class="text-sm text-slate-500 mb-4 font-mono">${item.author}</p>

                      <div class="mb-6 flex-grow">
                        <p class="text-sm text-slate-400 leading-relaxed mb-4">
                          ${item.summary}
                        </p>
                        <div class="text-sm p-3 rounded-lg bg-slate-950/50 border-l-2 ${category.borderColor.replace('/50', '')}">
                          <span class="text-xs font-bold uppercase block mb-1 ${category.color}">DIS Connection</span>
                          <span class="text-slate-300">${item.connection}</span>
                        </div>
                      </div>

                      <div class="mt-auto pt-4 border-t border-slate-800/50 flex justify-end">
                        <a href="${item.url}" target="_blank" class="text-xs flex items-center gap-1.5 text-slate-500 hover:text-slate-300 transition-colors group/link">
                          <i data-lucide="link" class="w-3 h-3"></i>
                          <span>${item.linkText}</span>
                          <i data-lucide="arrow-right" class="w-[10px] h-[10px] opacity-0 -translate-x-2 group-hover/link:opacity-100 group-hover/link:translate-x-0 transition-all"></i>
                        </a>
                      </div>
                    </div>
                  `).join('')}
                </div>

                <!-- Synthesis / Connection Loop -->
                <div class="bg-slate-900 border border-slate-800 rounded-2xl p-8 relative overflow-hidden">
                  <div class="absolute top-0 left-0 w-1 h-full ${category.color.replace('text-', 'bg-')}"></div>
                  <div class="absolute -right-10 -bottom-10 opacity-5 pointer-events-none transform rotate-12">
                    <i data-lucide="quote" class="w-[200px] h-[200px]"></i>
                  </div>
                  
                  <h3 class="text-lg font-bold text-white mb-6 flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full ${category.color.replace('text-', 'bg-')}"></span>
                    DIS와의 연결 고리
                  </h3>
                  
                  <div class="grid md:grid-cols-2 gap-8 relative z-10">
                    ${category.synthesis.map(text => `
                      <blockquote class="relative pl-6">
                        <i data-lucide="quote" class="absolute top-0 left-0 opacity-30 w-5 h-5 ${category.color}"></i>
                        <p class="text-slate-300 italic leading-relaxed font-serif text-lg">
                          "${text}"
                        </p>
                      </blockquote>
                    `).join('')}
                  </div>
                </div>
              </section>
            `).join('')}
        </div>
    `;
}

// Logic Actions
function setActiveTab(id) {
  state.activeTab = id;
  renderTabs(); // Re-render tabs to update active state
  renderMain(); // Re-render main content
}

// Initialization
document.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();
  renderTabs();
  renderMain();
});
