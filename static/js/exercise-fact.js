Object.assign(Exercise, {

  async startDailyFact() {
    this.score = 0; this.xpEarned = 0; this._dfFactNum = 0; this._dfAllResults = [];
    this._dfSeenTitles = [];
    this._dfFact = null; // wymuś nowe generowanie przy każdym starcie
    this.total = 9;
    this.startTime = Date.now();
    this._dfRenderCategoryPicker();
  },

  _dfRenderCategoryPicker() {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    const cats = [
      { key:'primitive_human', icon:'🦴', name:'Człowiek pierwotny' },
      { key:'polish_business', icon:'💼', name:'Polski biznes' },
      { key:'biology', icon:'🔬', name:'Biologia' },
      { key:'evolutionary_biology', icon:'🧬', name:'Biologia ewolucyjna' },
      { key:'nature', icon:'🌿', name:'Przyroda & Zwierzęta' },
      { key:'physics', icon:'⚡', name:'Fizyka & Kosmos' },
      { key:'technology', icon:'💻', name:'Technologia & AI' },
      { key:'history', icon:'🏛️', name:'Historia świata' },
      { key:'psychology', icon:'🧠', name:'Psychologia & Mózg' },
      { key:'culture', icon:'🎬', name:'Popkultura & Sztuka' },
    ];
    document.getElementById('modalBody').innerHTML = `
      <div style="padding:20px;text-align:center;max-width:440px;margin:0 auto">
        <div style="font-size:44px;margin-bottom:8px">🧪</div>
        <h3 style="color:var(--text1);margin-bottom:6px;font-size:18px">Ciekawostka Dnia</h3>
        <p style="color:var(--text3);font-size:13px;line-height:1.5;margin-bottom:20px">
          Przeczytasz i odsłuchasz <strong>3 ciekawostki w języku angielskim</strong>.<br>
          Wyróżnione słowa to Twoje słówka. Możesz włączyć <strong>lektora</strong> oraz <strong>tłumaczenie PL</strong>.<br>
          Po każdej ciekawostce: <strong>3 pytania Prawda/Fałsz</strong>.
        </p>
        <div style="font-size:12px;color:var(--text3);font-weight:700;text-transform:uppercase;margin-bottom:10px">Wybierz kategorię:</div>
        <div class="df-cat-grid" style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px">
          ${cats.map(c => `
            <button class="df-cat-btn" onclick="Exercise._dfSelectCategory('${c.key}')" style="display:flex;align-items:center;gap:8px;padding:10px 12px;text-align:left">
              <span class="df-cat-icon" style="font-size:20px">${c.icon}</span>
              <span class="df-cat-name" style="font-size:13px;font-weight:700">${c.name}</span>
            </button>`).join('')}
        </div>
      </div>`;
  },

  async _dfSelectCategory(category) {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    this._dfCategory = category;
    this._dfFactNum = 0;
    this._dfSeenTitles = [];
    this._dfAllResults = [];
    this.score = 0; this.xpEarned = 0;
    await this._dfLoadFact();
  },

  async _dfLoadFact() {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    document.getElementById('modalBody').innerHTML = `
      <div style="text-align:center;padding:60px 20px">
        <div class="spinner" style="margin:auto"></div>
        <p style="color:var(--text3);margin-top:16px;font-size:14px">🧠 Gemini generuje ciekawostkę…</p>
      </div>`;
    const seenParam = encodeURIComponent((this._dfSeenTitles || []).join('; '));
    const res = await API.get(`/api/exercise/daily_fact?category=${this._dfCategory}&seen=${seenParam}&_t=${Date.now()}`);
    if (!res || res.error) {
      document.getElementById('modalBody').innerHTML = `<p style="text-align:center;padding:40px;color:var(--red)">Błąd: ${res?.error || 'Brak odpowiedzi'}</p>`;
      return;
    }
    this._dfFact = res;
    if (res.title) {
      if (!this._dfSeenTitles) this._dfSeenTitles = [];
      this._dfSeenTitles.push(res.title);
    }
    this._dfQuestionNum = 0;
    this._dfCorrectThisFact = 0;
    this._dfIsSpeaking = false;
    this._dfRenderRead();
  },

  _dfToggleSpeech() {
    if (!this._dfFact || !this._dfFact.fact) return;
    const btn = document.getElementById('dfTtsBtn');
    if (this._dfIsSpeaking) {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      this._dfIsSpeaking = false;
      if (btn) btn.innerHTML = '🔊 Lektor (EN)';
    } else {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      const cleanText = this._dfFact.fact.replace(/\*\*/g, '');
      this._dfIsSpeaking = true;
      if (btn) btn.innerHTML = '⏸️ Zatrzymaj EN';
      Speech.speak(cleanText, true, 0.78).then(() => {
        this._dfIsSpeaking = false;
        const b = document.getElementById('dfTtsBtn');
        if (b) b.innerHTML = '🔊 Lektor (EN)';
      });
    }
  },

  _dfToggleSpeechPl() {
    if (!this._cleanPlText) return;
    const btn = document.getElementById('dfTtsPlBtn');
    if (this._dfIsSpeakingPl) {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      this._dfIsSpeakingPl = false;
      if (btn) btn.innerHTML = '🇵🇱 Lektor (PL)';
    } else {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      this._dfIsSpeakingPl = true;
      if (btn) btn.innerHTML = '⏸️ Zatrzymaj PL';
      Speech.speakPl(this._cleanPlText).then(() => {
        this._dfIsSpeakingPl = false;
        const b = document.getElementById('dfTtsPlBtn');
        if (b) b.innerHTML = '🇵🇱 Lektor (PL)';
      });
    }
  },

  _dfFormatInteractiveText(text, wordMap = {}) {
    if (!text) return '';

    // Extract all **target_word** tokens first to avoid tag collisions
    const targetTokens = [];
    let processed = text.replace(/\*\*([^*]+)\*\*/g, (_, w) => {
      const idx = targetTokens.length;
      targetTokens.push(w);
      return `[[[${idx}]]]`;
    });

    // Make all plain words interactive
    processed = processed.replace(/\b([a-zA-Z']+)\b/g, (w) => {
      const esc = w.replace(/'/g, "\\'");
      return `<span class="df-interactive-word" onclick="Exercise._dfTranslateWord(this, '${esc}')">${w}</span>`;
    });

    // Put target words back with highlight styling & click handler
    targetTokens.forEach((targetWord, idx) => {
      const lower = targetWord.toLowerCase();
      const pl = wordMap[lower] || '';
      const escTarget = targetWord.replace(/'/g, "\\'");
      let repl = '';
      if (pl) {
        const escPl = pl.replace(/'/g, "\\'");
        repl = `<span class="df-highlight df-highlight-clickable" data-pl="${escPl}" onclick="Exercise._dfToggleTargetTranslation(this, '${escPl}')">${targetWord}</span>`;
      } else {
        repl = `<span class="df-highlight df-highlight-clickable" onclick="Exercise._dfTranslateWord(this, '${escTarget}')">${targetWord}</span>`;
      }
      processed = processed.replace(`[[[${idx}]]]`, repl);
    });

    return processed;
  },

  _dfToggleTargetTranslation(el, pl) {
    if (event) event.stopPropagation();
    const existing = el.querySelector('.df-word-tooltip');
    if (existing) {
      existing.remove();
      return;
    }
    const tempSpan = document.createElement('span');
    tempSpan.className = 'df-word-tooltip';
    tempSpan.style.cssText = 'background:linear-gradient(135deg, #10b981, #059669);color:#ffffff;font-size:11.5px;padding:2px 7px;border-radius:6px;margin-left:4px;display:inline-block;font-weight:700;box-shadow:0 3px 8px rgba(16,185,129,0.4)';
    tempSpan.textContent = `(${pl})`;
    el.appendChild(tempSpan);
  },

  async _dfTranslateWord(el, rawWord) {
    if (event) event.stopPropagation();
    const clean = rawWord.replace(/[^a-zA-Z']/g, '');
    if (!clean) return;
    
    const existing = el.querySelector('.df-word-tooltip');
    if (existing) {
      existing.remove();
      return;
    }

    if (!window._wordTransCache) window._wordTransCache = {};
    const lower = clean.toLowerCase();

    // Fast built-in dictionary for common connector words
    const FAST_DICT = {
      "a": "jeden / jakiś", "an": "jeden / jakiś", "the": "ten / ta / to",
      "in": "w / wewnątrz", "on": "na / o", "at": "przy / w", "to": "do / żeby",
      "for": "dla / za", "of": "z / o", "with": "z", "without": "bez", "by": "przez / obok",
      "from": "od / z", "about": "o / około", "into": "do / w", "through": "przez",
      "and": "i / a", "or": "lub / albo", "but": "ale / lecz", "so": "więc / tak",
      "if": "jeśli / czy", "as": "jak / jako", "than": "niż", "because": "ponieważ",
      "is": "jest", "are": "są", "was": "był / była", "were": "byli / były",
      "be": "być", "been": "był", "being": "będąc", "have": "mieć", "has": "ma", "had": "miał",
      "do": "robić", "does": "robi", "did": "zrobił", "can": "móc / potrafić",
      "could": "mógłby", "will": "będzie", "would": "byłby", "should": "powinien",
      "this": "ten / to", "that": "tamten / że", "these": "te", "those": "tamte",
      "it": "to / ono", "its": "jego", "he": "on", "his": "jego", "she": "ona", "her": "jej",
      "they": "oni", "their": "ich", "we": "my", "our": "nasz", "you": "ty / wy", "your": "twój",
      "i": "ja", "my": "mój", "me": "mnie", "not": "nie", "no": "nie / żaden",
      "more": "więcej", "most": "najbardziej", "some": "niektóre", "all": "wszystko",
      "many": "wiele", "very": "bardzo", "also": "również", "which": "który",
      "what": "co", "who": "kto", "when": "kiedy", "where": "gdzie", "why": "dlaczego", "how": "jak"
    };

    const tempSpan = document.createElement('span');
    tempSpan.className = 'df-word-tooltip';
    tempSpan.style.cssText = 'background:linear-gradient(135deg, #6366f1, #8b5cf6);color:#ffffff;font-size:11.5px;padding:2px 7px;border-radius:6px;margin-left:4px;display:inline-block;font-weight:700;box-shadow:0 3px 8px rgba(99,102,241,0.4)';

    if (FAST_DICT[lower]) {
      tempSpan.textContent = `(${FAST_DICT[lower]})`;
      el.appendChild(tempSpan);
      return;
    }

    if (window._wordTransCache[lower]) {
      tempSpan.textContent = `(${window._wordTransCache[lower]})`;
      el.appendChild(tempSpan);
      return;
    }

    tempSpan.textContent = '⏳ ...';
    el.appendChild(tempSpan);

    try {
      const res = await API.get(`/api/word/translate?word=${encodeURIComponent(clean)}`);
      const tr = res.translation || '—';
      window._wordTransCache[lower] = tr;
      tempSpan.textContent = `(${tr})`;
    } catch(e) {
      tempSpan.textContent = '(brak)';
    }
  },

  _dfRenderRead() {
    const fact = this._dfFact;
    const n = this._dfFactNum + 1;
    const wordMap = {};
    (fact.used_words || []).forEach(w => { wordMap[w.word.toLowerCase()] = w.translation; });
    
    // Process text: highlighted words AND all words clickable for instant translation
    const factHtml = this._dfFormatInteractiveText(fact.fact || '', wordMap);

    const wordsHtml = (fact.used_words || []).map(w =>
      `<div class="df-word-pill"><span class="df-word-en">${w.word}</span><span class="df-word-pl">${w.translation}</span></div>`
    ).join('');

    const cleanPl = (fact.fact_pl || '').replace(/\*\*/g, '').trim();
    const finalPl = cleanPl && !cleanPl.startsWith('Oto zestawienie') 
      ? cleanPl 
      : (fact.used_words ? `<strong>Kluczowe słówka:</strong> ${(fact.used_words||[]).map(w=>w.word+' = '+w.translation).join(', ')}.` : 'Tłumaczenie w trakcie przygotowywania...');

    this._cleanPlText = finalPl;

    document.getElementById('modalBody').innerHTML = `
      <div style="padding:16px;max-width:480px;margin:0 auto">
        <div class="df-progress-bar">
          <span class="df-progress-label">Ciekawostka ${n} / 3</span>
          <div class="df-progress-dots">
            ${[0,1,2].map(i=>`<span class="df-dot ${i<n?'df-dot-done':i===n-1?'df-dot-active':''}"></span>`).join('')}
          </div>
        </div>
        <div class="df-fact-card" style="margin-bottom:12px">
          <div class="df-fact-title">${fact.title || ''}</div>
          <div style="line-height:1.8;font-size:15px;color:var(--text1)">${factHtml}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:10px;text-align:center">
            💡 Kliknij dowolne słowo w tekście, aby sprawdzić tłumaczenie PL
          </div>
        </div>

        <!-- Lektor Audio (EN/PL) + Przycisk Tłumaczenia PL -->
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <button class="btn btn-outline" id="dfTtsBtn" onclick="Exercise._dfToggleSpeech()" style="background:rgba(99,102,241,0.12);color:#818cf8;border:1px solid rgba(99,102,241,0.3);font-weight:700;font-size:12.5px;padding:9px 6px">
              🔊 Lektor (EN)
            </button>
            <button class="btn btn-outline" id="dfTtsPlBtn" onclick="Exercise._dfToggleSpeechPl()" style="background:rgba(16,185,129,0.12);color:#10b981;border:1px solid rgba(16,185,129,0.3);font-weight:700;font-size:12.5px;padding:9px 6px">
              🇵🇱 Lektor (PL)
            </button>
          </div>
          
          <button class="btn btn-outline" onclick="document.getElementById('dfPlTrans').classList.toggle('hidden')" style="width:100%;font-size:13px;padding:9px">
            🇵🇱 Pokaż / Ukryj pełne tłumaczenie (PL)
          </button>
          <div id="dfPlTrans" class="hidden" style="background:rgba(255,255,255,0.04);border-left:3px solid var(--green);padding:12px;border-radius:8px;font-size:13.5px;color:var(--text2);line-height:1.6">
            <strong style="color:var(--green);display:block;margin-bottom:4px">Tłumaczenie polskie:</strong>
            ${finalPl}
          </div>
        </div>

        ${wordsHtml ? `<div class="df-words-section">
          <div style="font-size:11px;color:var(--text3);font-weight:700;text-transform:uppercase;margin-bottom:8px">Słowa z Twojej listy & kluczowe pojęcia:</div>
          <div class="df-words-row">${wordsHtml}</div>
        </div>` : ''}
        
        <button class="btn btn-primary" style="width:100%;margin-top:16px;padding:14px;font-size:15px"
          onclick="if(window.speechSynthesis)window.speechSynthesis.cancel();Exercise._dfStartQuiz()">
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
    const statementHtml = this._dfFormatInteractiveText(q.statement || '');
    const statementPl = q.statement_pl || 'Tłumaczenie pytania w trakcie przygotowywania...';

    document.getElementById('modalBody').innerHTML = `
      <div style="padding:16px;max-width:480px;margin:0 auto">
        <div class="df-progress-bar">
          <span class="df-progress-label">Ciekawostka ${fn}/3 · Pytanie ${qn}/3</span>
          <div class="df-progress-dots">
            ${[0,1,2].map(i=>`<span class="df-dot ${i<qn?'df-dot-done':i===qn-1?'df-dot-active':''}"></span>`).join('')}
          </div>
        </div>
        <div class="df-question-card" style="text-align:center">
          <div class="df-question-label">Prawda czy Fałsz?</div>
          <div class="df-question-text" style="font-size:16px;margin:12px 0">${statementHtml}</div>
          <div style="font-size:11px;color:var(--text3);margin-bottom:12px">
            💡 Kliknij słowo w pytaniu, aby sprawdzić znaczenie PL
          </div>

          <div style="display:flex;gap:8px;justify-content:center;margin-bottom:8px;flex-wrap:wrap">
            <button class="btn btn-outline" style="font-size:12px;padding:6px 12px;border-radius:20px;background:rgba(99,102,241,0.12);color:#818cf8;border:1px solid rgba(99,102,241,0.3)" 
              onclick="Speech.speak('${q.statement.replace(/'/g, "\\'")}', true, 0.82)">
              🔊 Lektor pytanie (EN)
            </button>
            <button class="btn btn-outline" style="font-size:12px;padding:6px 12px;border-radius:20px;background:rgba(16,185,129,0.12);color:#10b981;border:1px solid rgba(16,185,129,0.3)" 
              onclick="Speech.speakPl('${statementPl.replace(/'/g, "\\'")}', true)">
              🇵🇱 Lektor (PL)
            </button>
          </div>

          <button class="btn btn-outline" onclick="document.getElementById('dfQPlTrans').classList.toggle('hidden')" style="font-size:12px;padding:5px 12px;border-radius:20px;width:100%;margin-top:4px">
            🇵🇱 Pokaż / Ukryj tłumaczenie pytania (PL)
          </button>
          <div id="dfQPlTrans" class="hidden" style="background:rgba(255,255,255,0.04);border-left:3px solid var(--green);padding:10px;border-radius:8px;font-size:13px;color:var(--text2);margin-top:8px;text-align:left;line-height:1.5">
            <strong style="color:var(--green);display:block;margin-bottom:2px">Tłumaczenie pytania:</strong>
            ${statementPl}
          </div>
        </div>
        <div id="dfFeedback"></div>
        <div class="df-tf-btns" id="dfTfBtns" style="margin-top:16px">
          <button class="df-tf-btn df-tf-true" onclick="Exercise._dfAnswer(true)">✅ Prawda</button>
          <button class="df-tf-btn df-tf-false" onclick="Exercise._dfAnswer(false)">❌ Fałsz</button>
        </div>
      </div>`;
  },

  _dfAnswer(isTrue) {
    if (this._dfNextTimer) clearTimeout(this._dfNextTimer);
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
      fb.innerHTML = `
        <div class="df-feedback-box ${correct?'df-feedback-correct':'df-feedback-wrong'}" style="margin-top:14px;padding:14px;border-radius:12px">
          <strong style="font-size:15px">${correct ? '✅ Poprawnie!' : '❌ Błąd!'}</strong>
          <div style="margin-top:6px;font-size:13px;color:var(--text2);line-height:1.5">${q.explanation || ''}</div>
          ${q.explanation ? `
            <button class="btn btn-outline" style="font-size:12px;padding:5px 12px;border-radius:16px;margin-top:8px" onclick="Speech.speakPl('${(q.explanation||'').replace(/'/g, "\\'")}')">
              🔊 Odsłuchaj wyjaśnienie (PL)
            </button>
          ` : ''}
          <button class="btn btn-primary" style="width:100%;margin-top:12px;padding:10px;font-size:14px" onclick="Exercise._dfNextQuestion()">
            Następne pytanie ➔
          </button>
        </div>`;
    }
    this._dfNextTimer = setTimeout(() => this._dfNextQuestion(), 5000);
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
