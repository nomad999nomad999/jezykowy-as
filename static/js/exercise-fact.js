Object.assign(Exercise, {

  async startDailyFact() {
    this.score = 0; this.xpEarned = 0; this._dfFactNum = 0; this._dfAllResults = [];
    this._dfFact = null; // wymuś nowe generowanie przy każdym starcie
    this.total = 9;
    this.startTime = Date.now();
    this._dfRenderCategoryPicker();
  },

  _dfRenderCategoryPicker() {
    const cats = [
      { key:'biology', icon:'🔬', name:'Biologia' },
      { key:'evolutionary_biology', icon:'🧬', name:'Biologia ewolucyjna' },
      { key:'nature', icon:'🌿', name:'Przyroda' },
      { key:'physics', icon:'⚡', name:'Fizyka' },
      { key:'technology', icon:'💻', name:'Technika' },
    ];
    document.getElementById('modalBody').innerHTML = `
      <div style="padding:20px;text-align:center;max-width:420px;margin:0 auto">
        <div style="font-size:44px;margin-bottom:8px">🧪</div>
        <h3 style="color:var(--text1);margin-bottom:6px;font-size:18px">Ciekawostka Dnia</h3>
        <p style="color:var(--text3);font-size:13px;line-height:1.5;margin-bottom:20px">
          Przeczytasz <strong>3 ciekawostki naukowe</strong> w języku angielskim.<br>
          Wyróżnione słowa to Twoje słówka — kliknij je aby zobaczyć tłumaczenie.<br>
          Po każdej ciekawostce: <strong>3 pytania Prawda/Fałsz</strong>.
        </p>
        <div style="font-size:12px;color:var(--text3);font-weight:700;text-transform:uppercase;margin-bottom:10px">Wybierz kategorię:</div>
        <div class="df-cat-grid">
          ${cats.map(c => `
            <button class="df-cat-btn" onclick="Exercise._dfSelectCategory('${c.key}')">
              <span class="df-cat-icon">${c.icon}</span>
              <span class="df-cat-name">${c.name}</span>
            </button>`).join('')}
        </div>
      </div>`;
  },

  async _dfSelectCategory(category) {
    this._dfCategory = category;
    this._dfFactNum = 0;
    this._dfAllResults = [];
    this.score = 0; this.xpEarned = 0;
    await this._dfLoadFact();
  },

  async _dfLoadFact() {
    document.getElementById('modalBody').innerHTML = `
      <div style="text-align:center;padding:60px 20px">
        <div class="spinner" style="margin:auto"></div>
        <p style="color:var(--text3);margin-top:16px;font-size:14px">🧠 Gemini generuje ciekawostkę…</p>
      </div>`;
    // Cache-buster: każde wywołanie to nowe zapytanie do AI (nowa ciekawostka)
    const res = await API.get(`/api/exercise/daily_fact?category=${this._dfCategory}&_t=${Date.now()}`);
    if (!res || res.error) {
      document.getElementById('modalBody').innerHTML = `<p style="text-align:center;padding:40px;color:var(--red)">Błąd: ${res?.error || 'Brak odpowiedzi'}</p>`;
      return;
    }
    this._dfFact = res;
    this._dfQuestionNum = 0;
    this._dfCorrectThisFact = 0;
    this._dfRenderRead();
  },

  _dfRenderRead() {
    const fact = this._dfFact;
    const n = this._dfFactNum + 1;
    // Convert **word** to highlighted spans with data-pl tooltip (try to match used_words)
    const wordMap = {};
    (fact.used_words || []).forEach(w => { wordMap[w.word.toLowerCase()] = w.translation; });
    const factHtml = (fact.fact || '').replace(/\*\*([^*]+)\*\*/g, (_, w) => {
      const pl = wordMap[w.toLowerCase()] || '';
      if (pl) {
        // Mamy tłumaczenie — klikalne z tooltipem
        return `<span class="df-highlight df-highlight-clickable" data-pl="${pl}" onclick="this.classList.toggle('df-highlight-active')">${w}</span>`;
      } else {
        // Brak tłumaczenia w liście (Gemini zboldował dodatkowe słowo) — złote bez tooltipa
        return `<span class="df-highlight">${w}</span>`;
      }
    });
    const wordsHtml = (fact.used_words || []).map(w =>
      `<div class="df-word-pill"><span class="df-word-en">${w.word}</span><span class="df-word-pl">${w.translation}</span></div>`
    ).join('');

    document.getElementById('modalBody').innerHTML = `
      <div style="padding:16px;max-width:480px;margin:0 auto">
        <div class="df-progress-bar">
          <span class="df-progress-label">Ciekawostka ${n} / 3</span>
          <div class="df-progress-dots">
            ${[0,1,2].map(i=>`<span class="df-dot ${i<n?'df-dot-done':i===n-1?'df-dot-active':''}"></span>`).join('')}
          </div>
        </div>
        <div class="df-fact-card">
          <div class="df-fact-title">${fact.title || ''}</div>
          <div style="line-height:1.8">${factHtml}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:10px;text-align:center">
            💡 Kliknij <span style="color:#fbbf24;font-weight:700">złote słowo</span> aby zobaczyć tłumaczenie
          </div>
        </div>
        ${wordsHtml ? `<div class="df-words-section">
          <div style="font-size:11px;color:var(--text3);font-weight:700;text-transform:uppercase;margin-bottom:8px">Słowa z Twojej listy:</div>
          <div class="df-words-row">${wordsHtml}</div>
        </div>` : ''}
        <button class="btn btn-primary" style="width:100%;margin-top:16px;padding:14px;font-size:15px"
          onclick="Exercise._dfStartQuiz()">
          Sprawdź rozumienie →
        </button>
      </div>`;
  },

  _dfStartQuiz() {
    this._dfQuestionNum = 0;
    this._dfCorrectThisFact = 0;
    this._dfRenderQuestion();
  },

  _dfRenderQuestion() {
    const q = this._dfFact.questions[this._dfQuestionNum];
    const qn = this._dfQuestionNum + 1;
    const fn = this._dfFactNum + 1;
    document.getElementById('modalBody').innerHTML = `
      <div style="padding:16px;max-width:480px;margin:0 auto">
        <div class="df-progress-bar">
          <span class="df-progress-label">Ciekawostka ${fn}/3 · Pytanie ${qn}/3</span>
          <div class="df-progress-dots">
            ${[0,1,2].map(i=>`<span class="df-dot ${i<qn?'df-dot-done':i===qn-1?'df-dot-active':''}"></span>`).join('')}
          </div>
        </div>
        <div class="df-question-card">
          <div class="df-question-label">Prawda czy Fałsz?</div>
          <div class="df-question-text">${q.statement}</div>
        </div>
        <div id="dfFeedback"></div>
        <div class="df-tf-btns" id="dfTfBtns">
          <button class="df-tf-btn df-tf-true" onclick="Exercise._dfAnswer(true)">✅ Prawda</button>
          <button class="df-tf-btn df-tf-false" onclick="Exercise._dfAnswer(false)">❌ Fałsz</button>
        </div>
      </div>`;
  },

  _dfAnswer(isTrue) {
    const q = this._dfFact.questions[this._dfQuestionNum];
    const correct = (isTrue === true && q.answer === true) || (isTrue === false && q.answer === false);
    document.querySelectorAll('.df-tf-btn').forEach(b => b.disabled = true);
    if (correct) {
      this.score++;
      this._dfCorrectThisFact++;
      this.xpEarned += 6;
      this.setScore();
      showXP('+6 XP');
    }
    const fb = document.getElementById('dfFeedback');
    if (fb) {
      fb.innerHTML = `<div class="df-feedback-box ${correct?'df-feedback-correct':'df-feedback-wrong'}">
        <strong>${correct ? '✅ Poprawnie!' : '❌ Błąd!'}</strong>
        <div style="margin-top:4px;font-size:12px;color:var(--text2)">${q.explanation || ''}</div>
      </div>`;
    }
    setTimeout(() => this._dfNextQuestion(), 2000);
  },

  _dfNextQuestion() {
    this._dfQuestionNum++;
    if (this._dfQuestionNum < 3) {
      this._dfRenderQuestion();
    } else {
      // All 3 questions done for this fact
      const bonus = this._dfCorrectThisFact === 3 ? 8 : 0;
      if (bonus > 0) { this.xpEarned += bonus; showXP(`+${bonus} XP bonus!`); }
      this._dfAllResults.push({ correct: this._dfCorrectThisFact, bonus });
      this._dfFactNum++;
      if (this._dfFactNum < 3) {
        this._dfShowFactTransition();
      } else {
        this._dfShowResult();
      }
    }
  },

  _dfShowFactTransition() {
    const fn = this._dfFactNum; // completed facts
    document.getElementById('modalBody').innerHTML = `
      <div style="text-align:center;padding:30px 20px">
        <div style="font-size:40px;margin-bottom:8px">✅</div>
        <h3 style="color:var(--text1);margin-bottom:6px">Ciekawostka ${fn}/3 zaliczona!</h3>
        <p style="color:var(--text3);font-size:14px;margin-bottom:20px">Jeszcze ${3-fn} ${3-fn===1?'ciekawostka':'ciekawostki'}…</p>
        <button class="btn btn-primary" style="width:100%;padding:14px" onclick="Exercise._dfLoadFact()">
          Następna ciekawostka →
        </button>
        <button class="btn btn-outline" style="width:100%;margin-top:8px" onclick="Exercise._dfRenderCategoryPicker()">
          Zmień kategorię
        </button>
      </div>`;
  },

  _dfShowResult() {
    const total = 9; // 3 facts × 3 questions
    const pct = Math.round(this.score / total * 100);
    const emoji = pct >= 80 ? '🏆' : pct >= 55 ? '👍' : '💪';
    const bonusTotal = this._dfAllResults.reduce((s,r)=>s+r.bonus, 0);
    document.getElementById('modalBody').innerHTML = `
      <div style="text-align:center;padding:30px 20px">
        <div style="font-size:52px;margin-bottom:12px">${emoji}</div>
        <h3 style="color:var(--text1);margin-bottom:6px">Sesja ukończona!</h3>
        <p style="color:var(--text3);font-size:14px;margin-bottom:4px">${this.score}/${total} poprawnych odpowiedzi (${pct}%)</p>
        ${bonusTotal>0 ? `<p style="color:var(--green);font-size:13px;font-weight:700;margin-bottom:4px">🎯 Bonus za komplet: +${bonusTotal} XP</p>` : ''}
        <p style="color:var(--text3);font-size:13px;margin-bottom:20px">⭐ Łącznie: <strong style="color:var(--text1)">+${this.xpEarned} XP</strong></p>
        <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
          <button class="btn btn-primary" onclick="Exercise.startDailyFact()">Graj ponownie 🔄</button>
          <button class="btn btn-outline" onclick="Exercise.close()">Zakończ</button>
        </div>
      </div>`;
  },

  /* ─ AI VOICE DIALOGUE SIMULATOR ─ */
});
