const COCA_LEVELS = [
  { words:100,  stage:'🟩', rank:'Odkrywca',         pct:'~50%',  power:'Rozpoznajesz strukturę zdania. Przetrwasz na lotnisku, zamówisz kawę i zapytasz o drogę.' },
  { words:300,  stage:'🟩', rank:'Komunikator',       pct:'~60%',  power:'Opisujesz siebie i rodzinę. W obcym kraju nie zginiesz, a sprzedawca zrozumie czego chcesz.' },
  { words:500,  stage:'🟩', rank:'Operator',          pct:'~68%',  power:'Robisz zakupy online, rozumiesz proste instrukcje, rezerwujesz hotel przez telefon.' },
  { words:750,  stage:'🟨', rank:'Lokalny Bywalec',   pct:'~75%',  power:'Zaczynasz small talk. Potrafisz powiedzieć co robiłeś w weekend i wyrazić emocje.' },
  { words:1000, stage:'🟨', rank:'Autonomiczny',      pct:'~80%',  power:'Komunikacyjna niezależność! Znasz 80% słów w codziennych rozmowach. Przełom B1.' },
  { words:1300, stage:'🟨', rank:'Konsument Mediów',  pct:'~82%',  power:'Rozumiesz memy, TikTok, posty na Insta i nieskomplikowane artykuły na portalach.' },
  { words:1500, stage:'🟦', rank:'Obywatel Świata',   pct:'~85%',  power:'Naturalna dyskusja o marzeniach, planach i opiniach. Mowa staje się płynna — bez tłumaczenia w głowie.' },
  { words:1750, stage:'🟦', rank:'Ekspert Contentu',  pct:'~87%',  power:'Oglądasz zagranicznych YouTuberów bez napisów i nadążasz za ich myślami.' },
  { words:2000, stage:'🟦', rank:'Biznesmen',         pct:'~90%',  power:'Piszesz maile w pracy, uczestniczysz w spotkaniach międzynarodowych, prowadzisz negocjacje.' },
  { words:2500, stage:'🟥', rank:'Pożeracz Książek',  pct:'~92%',  power:'Czytasz kryminały i biografie, oglądasz Netflixa bez ciągłego zaglądania do słownika.' },
  { words:3000, stage:'🟥', rank:'Elita Językowa',    pct:'~95%',  power:'Rozumiesz ironię i dwuznaczności. Bronisz swojego zdania w zażartej dyskusji.' },
  { words:4000, stage:'🟥', rank:'Erudyta',           pct:'~98%',  power:'Pełna swoboda akademicka. Rozumiesz literaturę piękną, podcasty naukowe, niuanse polityczne.' },
];

const Home = {
  _tutStep: 0,
  _levelsOpen: false,
  _stats: null,

  openSuperpowerModal() {
    const modal = document.getElementById('superpowerModal');
    if (!modal) return;
    const userZnam = this._stats ? (this._stats.znam || 0) : 0;
    const listEl = document.getElementById('superpowersSchemeList');
    if (listEl) {
      listEl.innerHTML = COCA_LEVELS.map(lv => {
        const isReached = userZnam >= lv.words;
        const isCurrent = COCA_LEVELS.filter(l => userZnam >= l.words).length === COCA_LEVELS.indexOf(lv) + 1
          || (userZnam < lv.words && COCA_LEVELS.findIndex(l => userZnam < l.words) === COCA_LEVELS.indexOf(lv));
        
        return `
          <div class="superpower-scheme-card ${isCurrent ? 'active' : ''} ${isReached ? 'reached' : ''}">
            <div class="superpower-scheme-header">
              <span class="superpower-scheme-rank">
                ${lv.stage} ${lv.rank} ${isCurrent ? ' 👈 (Twój poziom)' : isReached ? ' ✓' : ''}
              </span>
              <span class="superpower-scheme-words">${lv.words} słów</span>
            </div>
            <div class="superpower-scheme-desc">${lv.power}</div>
          </div>
        `;
      }).join('');
    }
    modal.classList.remove('hidden');
  },

  closeSuperpowerModal() {
    const modal = document.getElementById('superpowerModal');
    if (modal) modal.classList.add('hidden');
  },

  async load(stats) {
    if (!stats) {
      try { stats = await API.get('/api/stats'); } catch(e) {}
    }
    this._stats = stats;
    // Greeting
    const user = JSON.parse(localStorage.getItem('em_user') || '{}');
    // Adi dynamic messages based on time and context
    const hour = new Date().getHours();
    const adiMsgs = hour < 8
      ? ['Adi widzi, że uczysz się z samego rana — szacunek! 🌅','Poranna nauka to najlepsza nauka — Adi to potwierdza!']
      : hour < 12
      ? ['Adi jest ciekawy ile nauczysz się dzisiaj! 🃏','Dobry początek dnia — Adi śledzi Twój postęp!']
      : hour < 18
      ? ['Adi obserwuje Twój popołudniowy progres 📊','Popołudniowa sesja — Adi kibicuje Tobie!']
      : ['Adi docenia wieczorną naukę — tak trzymaj! 🌙','Wieczorna sesja to niezły nawyk — Adi is pod wrażeniem!'];
    const adiMsg = adiMsgs[Math.floor(Math.random() * adiMsgs.length)];
    const adiEl = document.getElementById('adiHomeMsg');
    if (adiEl) adiEl.innerHTML = `🃏 <em>${adiMsg}</em>`;
    const greetEl = document.getElementById('adiGreeting');
    if (greetEl) greetEl.textContent = hour < 12 ? 'Dzień dobry! Gotowy na naukę?' : hour < 18 ? 'Dobry wieczór! Uczymy się?' : 'Dobry wieczór! Czas na trening!';

    const nameEl = document.getElementById('homeUsername');
    if (nameEl) nameEl.textContent = Session.username || user.username || 'Kursant';

    if (stats) {
      // Refresh Header XP & Streak
      document.getElementById('xpDisplay').textContent = (stats.xp || 0) + ' XP';
      const streakBadge = document.getElementById('streakBadge');
      if (streakBadge) streakBadge.textContent = '🔥 ' + (stats.streak?.current_streak || stats.streak || 0);

      // Streak
      const strEl = document.getElementById('homeStreak');
      if (strEl) strEl.textContent = stats.streak?.current_streak || 0;
      // XP bar
      const xp = stats.xp || 0;
      const lvl = stats.level || 1;
      const xpInLvl = xp % 500;
      document.getElementById('homeXP').textContent = xp + ' XP';
      document.getElementById('homeLvl').textContent = 'Poziom ' + lvl;
      const fill = document.getElementById('homeXpFill');
      if (fill) fill.style.width = Math.round(xpInLvl / 500 * 100) + '%';
    }

    // SRS count
    let srsCount = 0;
    try {
      const sc = await API.get('/api/stats/srs-count');
      srsCount = sc?.count || 0;
      // na home
      const hc = document.getElementById('homeSRSCount');
      if (hc) {
        if (srsCount > 0) {
          hc.textContent = srsCount;
          hc.classList.remove('hidden');
        } else {
          hc.classList.add('hidden');
        }
      }
      // na exercises
      const desc = document.getElementById('srsDesc');
      if (desc && srsCount > 0) desc.innerHTML = `<span class="srs-due-badge">${srsCount}</span> do powtórki`;
    } catch(e) {}

    // Daily quests
    try {
      const quests = await API.get('/api/quests');
      const questsEl = document.getElementById('homeQuestsList');
      if (questsEl && quests && quests.length) {
        const done = quests.filter(q => q.completed).length;
        const badge = document.getElementById('homeQuestsBadge');
        if (badge) badge.textContent = `${done}/${quests.length} ukończone`;
        questsEl.innerHTML = quests.map(q => {
          const pct = Math.min(100, Math.round(q.progress / q.target * 100));
          const isDone = q.completed;
          return `<div class="quest-card ${isDone ? 'quest-done' : ''}" onclick="Home.handleQuestClick('${q.quest_type}')" style="cursor: pointer;" title="Kliknij, aby przejść do zadania">
            <div class="quest-top">
              <span class="quest-icon">${q.icon}</span>
              <div class="quest-info">
                <div class="quest-desc">${q.description}</div>
                <div class="quest-prog-text">${q.progress}/${q.target}</div>
              </div>
              <div class="quest-xp">${isDone ? '✅' : ''}+${q.xp_reward} XP</div>
            </div>
            <div class="quest-bar-wrap">
              <div class="quest-bar-fill" style="width:${pct}%"></div>
            </div>
          </div>`;
        }).join('');
      }
    } catch(e) {}

    // Render COCA levels
    this.renderLevels(stats?.znam || 0);

    // Vocab counts on home
    if (stats) {
      const znam = stats.znam || 0;
      const troche = stats.troche || 0;
      const nie = stats.nie_znam || 0;
      const total = znam + troche + nie;
      const el = id => document.getElementById(id);
      
      if (el('homeTotalWords')) el('homeTotalWords').textContent = total + ' / 3000 słów';

      // Pionowe słupki wykresu
      const maxVal = Math.max(znam, troche, nie, 1);
      
      const colZnam = el('colZnam');
      if (colZnam) colZnam.style.height = Math.round((znam / maxVal) * 100) + '%';
      if (el('valZnam')) el('valZnam').textContent = znam;

      const colTroche = el('colTroche');
      if (colTroche) colTroche.style.height = Math.round((troche / maxVal) * 100) + '%';
      if (el('valTroche')) el('valTroche').textContent = troche;

      const colNie = el('colNie');
      if (colNie) colNie.style.height = Math.round((nie / maxVal) * 100) + '%';
      if (el('valNie')) el('valNie').textContent = nie;

      // Wskaźnik kołowy (progress ring) powiązany z Supermocami
      let currentLvl = { words: 0, stage: '⚪', rank: 'Początkujący', power: 'Sklasyfikuj pierwsze słowa, aby odblokować supermoc!' };
      let nextLvl = COCA_LEVELS[0];

      for (let i = 0; i < COCA_LEVELS.length; i++) {
        if (znam >= COCA_LEVELS[i].words) {
          currentLvl = COCA_LEVELS[i];
          nextLvl = COCA_LEVELS[i + 1] || null;
        } else {
          break;
        }
      }

      let milestonePct = 0;
      let milestoneText = '';
      if (!nextLvl) {
        milestonePct = 100;
        milestoneText = `Osiągnąłeś maksymalny stopień! (${znam} słów)`;
      } else {
        const startWords = currentLvl.words;
        const endWords = nextLvl.words;
        const range = endWords - startWords;
        const progress = znam - startWords;
        milestonePct = Math.min(100, Math.max(0, Math.round((progress / range) * 100)));
        milestoneText = `Następny cel: ${nextLvl.rank} (${znam}/${nextLvl.words} słów)`;
      }

      if (el('ringProgressText')) el('ringProgressText').textContent = milestonePct + '%';
      const fillEl = el('ringProgressFill');
      if (fillEl) fillEl.setAttribute('stroke-dasharray', `${milestonePct}, 100`);

      if (el('spRank')) el('spRank').innerHTML = `${currentLvl.stage} ${currentLvl.rank}`;
      if (el('spPower')) el('spPower').textContent = currentLvl.power;
      if (el('spNextMilestone')) el('spNextMilestone').textContent = milestoneText;

      // Dynamic CTA Card logic
      const unclassifiedCount = Math.max(0, 3000 - total);
      this._srsCount = srsCount;
      this._unclassifiedCount = unclassifiedCount;

      const macCard = el('mainActionCard');
      const macTitle = el('macTitle');
      const macSubtitle = el('macSubtitle');
      const macProgressInfo = el('macProgressInfo');

      if (srsCount > 0) {
        if (macTitle) macTitle.innerHTML = 'Czas na powtórki 🧠';
        if (macSubtitle) macSubtitle.textContent = `Masz ${srsCount} słów do powtórzenia (algorytm SM-2)`;
        if (macProgressInfo) macProgressInfo.textContent = 'KLIKNIJ, ABY ROZPOCZĄĆ POWTÓRKI';
        if (macCard) {
          macCard.style.background = 'linear-gradient(135deg, #6366f1, #a855f7)';
          macCard.style.boxShadow = '0 8px 30px rgba(99, 102, 241, 0.3)';
        }
      } else if (unclassifiedCount > 0) {
        if (macTitle) macTitle.innerHTML = 'Poznaj nowe słowa 🚀';
        if (macSubtitle) macSubtitle.textContent = `Sklasyfikuj kolejne z ${unclassifiedCount} nowych słów z bazy COCA`;
        if (macProgressInfo) macProgressInfo.textContent = `Sklasyfikowano: ${Math.round((total / 3000) * 100)}% bazy`;
        if (macCard) {
          macCard.style.background = 'linear-gradient(135deg, #10b981, #06b6d4)';
          macCard.style.boxShadow = '0 8px 30px rgba(16, 185, 129, 0.3)';
        }
      } else {
        if (macTitle) macTitle.innerHTML = 'Ćwicz dalej! 🏋️';
        if (macSubtitle) macSubtitle.textContent = 'Wszystkie 3000 słów COCA sklasyfikowane! Utrwalaj wiedzę w grach.';
        if (macProgressInfo) macProgressInfo.textContent = 'KLIKNIJ, ABY PRZEJŚĆ DO ĆWICZEŃ';
        if (macCard) {
          macCard.style.background = 'linear-gradient(135deg, #3b82f6, #1d4ed8)';
          macCard.style.boxShadow = '0 8px 30px rgba(59, 130, 246, 0.3)';
        }
      }

      // Adi satisfaction based on today's activity
      const todayCls = stats.today_classified || 0;
      const s0 = 'Sklasyfikuj pierwsze słowa albo ćwicz!';
      const s1 = 'Adi widzi ' + todayCls + ' słów — może trochę więcej?';
      const s2 = todayCls + ' słów dziś — dobry wynik!';
      const s3 = todayCls + ' słów w jednej sesji — świetnie!';
      const s4 = todayCls + ' słów! Jesteś niesamowity!';
      const satData = todayCls === 0
        ? { e:'😴', t:'Adi czeka aż zaczniesz…', s: s0 }
        : todayCls < 5
        ? { e:'🙂', t:'Niezły start!', s: s1 }
        : todayCls < 15
        ? { e:'😊', t:'Adi jest zadowolony z Twojej pracy!', s: s2 }
        : todayCls < 30
        ? { e:'😄', t:'Adi jest pod wrażeniem!', s: s3 }
        : { e:'🤩', t:'Adi jest zachwycony!', s: s4 };
      if (el('adiSatEmoji')) el('adiSatEmoji').textContent = satData.e;
      if (el('adiSatTitle')) el('adiSatTitle').textContent = satData.t;
      if (el('adiSatSub'))   el('adiSatSub').textContent   = satData.s;
    }

    // Tutorial for new users
    try {
      const statsData = stats || await API.get('/api/stats');
      if (!localStorage.getItem('tutorial_v1_done') && (statsData.total_classified || 0) < 5) {
        setTimeout(() => this.showTutorial(), 800);
      }
    } catch(e) {}
  },

  renderLevels(userZnam) {
    const el = document.getElementById('homeLevels');
    if (!el) return;
    el.innerHTML = COCA_LEVELS.map(lv => {
      const isReached = userZnam >= lv.words;
      const isCurrent = COCA_LEVELS.filter(l => userZnam >= l.words).length === COCA_LEVELS.indexOf(lv) + 1
        || (userZnam < lv.words && COCA_LEVELS.findIndex(l => userZnam < l.words) === COCA_LEVELS.indexOf(lv));
      const isNext = !isReached && COCA_LEVELS.filter(l => userZnam < l.words)[0]?.words === lv.words;
      return `<div class="coca-level-card ${isReached ? 'lvl-reached' : ''} ${isNext ? 'lvl-next' : ''}">
        <div class="lvl-left">
          <div class="lvl-stage">${lv.stage}</div>
          <div class="lvl-words">${lv.words} słów</div>
          <div class="lvl-pct">${lv.pct}</div>
        </div>
        <div class="lvl-body">
          <div class="lvl-rank">${lv.rank}${isNext ? ' ← <em>Twój cel</em>' : ''}${isReached ? ' ✓' : ''}</div>
          <div class="lvl-power">${lv.power}</div>
        </div>
      </div>`;
    }).join('');
  },

  toggleLevels() {
    const el = document.getElementById('homeLevels');
    const tog = document.getElementById('homeLevelToggle');
    if (!el) return;
    this._levelsOpen = !this._levelsOpen;
    el.classList.toggle('hidden', !this._levelsOpen);
    if (tog) tog.textContent = this._levelsOpen ? '▲ zwiń' : '▼ rozwiń';
  },

  /* ── TUTORIAL ── */
  showTutorial() {
    const ov = document.getElementById('tutorialOverlay');
    if (ov) ov.classList.remove('hidden');
  },

  tutGoTo(step) {
    this._tutStep = step;
    document.querySelectorAll('.tut-step').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tut-dot').forEach((d, i) => d.classList.toggle('active', i === step));
    const target = document.querySelector(`.tut-step[data-step="${step}"]`);
    if (target) target.classList.add('active');
    const lastStep = 5;
    document.getElementById('tutPrev').style.display = step > 0 ? 'inline-flex' : 'none';
    const nextBtn = document.getElementById('tutNext');
    nextBtn.textContent = step === lastStep ? '🚀 Zacznij!' : 'Dalej →';
    if (step === lastStep) nextBtn.onclick = () => this.tutDone();
    else nextBtn.onclick = () => this.tutNav(1);
  },

  tutNav(dir) {
    const next = Math.max(0, Math.min(5, this._tutStep + dir));
    this.tutGoTo(next);
  },

  startNextAction() {
    if (this._srsCount > 0) {
      Exercise.start('srs');
    } else if (this._unclassifiedCount > 0) {
      UI.goTo('classify');
    } else {
      Exercise.start('super_quiz');
    }
  },

  handleQuestClick(questType) {
    if (!questType) return;
    switch (questType) {
      case 'classify':
      case 'promote_words':
        UI.goTo('classify');
        break;
      case 'session':
        UI.goTo('exercises');
        break;
      case 'speed_round':
      case 'srs':
      case 'match_pairs':
      case 'fill_blank':
      case 'super_quiz':
      case 'quick_challenge':
      case 'daily_fact':
      case 'sentence_builder':
      case 'hands_free':
        Exercise.start(questType);
        break;
      default:
        UI.goTo('exercises');
    }
  },

  tutDone() {
    localStorage.setItem('tutorial_v1_done', '1');
    const ov = document.getElementById('tutorialOverlay');
    if (ov) { ov.style.opacity = '0'; setTimeout(() => ov.classList.add('hidden'), 300); }
  },
};
