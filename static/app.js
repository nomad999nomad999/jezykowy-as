/* ── Reclassify bar helper ── */
function reclassifyBar(wordId, word) {
  return `<div class="reclassify-bar">
    <span>Przenieś:</span>
    <button style="background:var(--green-dim);color:var(--green)" onclick="Exercise.reclassify(${wordId},'ZNAM',this)">✅ Znam</button>
    <button style="background:var(--yellow-dim);color:var(--yellow)" onclick="Exercise.reclassify(${wordId},'TROCHE',this)">⚠️ Trochę</button>
    <button style="background:var(--red-dim);color:var(--red)" onclick="Exercise.reclassify(${wordId},'NIE_ZNAM',this)">❌ Nie znam</button>
  </div>`;
}

/* ── Exercises ── */
const Exercise = {
  type: null, data: [], idx: 0, score: 0, total: 0, startTime: 0, xpEarned: 0,

  async start(type) {
    this.type = type; this.idx = 0; this.score = 0; this.xpEarned = 0;
    const titles = { super_quiz:'🏆 Super-Quiz', flashcards:'🎴 Fiszki', multiple_choice:'🎯 Wybór wielokrotny', fill_blank:'✍️ Uzupełnij lukę (ABCD)', match_pairs:'🔗 Dopasuj pary', speed_round:'⚡ Speed Round', context:'🧩 Kontekst AI', audio_quiz:'🔊 Audio Quiz', srs:'🧠 Powtórka SRS', hands_free:'🎧 Audionauka', quick_challenge:'⚡ Szybkie Wyzwanie', sentence_builder:'🔤 Budowanie zdań', daily_fact:'🧪 Ciekawostka Dnia', rpg_adventure:'⚔️ Przygoda RPG z AI', dialogue:'💬 Symulator Dialogu' };
    document.getElementById('modalTitle').textContent = titles[type] || type;
    document.getElementById('exerciseModal').classList.remove('hidden');
    document.getElementById('modalBody').innerHTML = '<div style="text-align:center;padding:40px"><div class="spinner" style="margin:auto"></div></div>';
    if (type === 'super_quiz') await this.startSuperQuiz();
    else if (type === 'flashcards') await this.startFlashcards();
    else if (type === 'multiple_choice') await this.startMC();
    else if (type === 'fill_blank') await this.startFillBlank();
    else if (type === 'match_pairs') await this.startMatchPairs();
    else if (type === 'speed_round') await this.startSpeed();
    else if (type === 'context') await this.startContext();
    else if (type === 'audio_quiz') await this.startAudioQuiz();
    else if (type === 'srs') await this.startSRS();
    else if (type === 'hands_free') await this.startHandsFree();
    else if (type === 'quick_challenge') await this.startQuickChallenge();
    else if (type === 'sentence_builder') await this.startSentenceBuilder();
    else if (type === 'daily_fact') await this.startDailyFact();
    else if (type === 'rpg_adventure') await this.startRpgAdventure();
    else if (type === 'dialogue') await this.startDialogue();
  },


  async close() {
    if (this.sqTimeout) { clearTimeout(this.sqTimeout); this.sqTimeout = null; }
    if (this.qcTimer) { clearInterval(this.qcTimer); this.qcTimer = null; }
    if (this.qcAnswerTimeout) { clearTimeout(this.qcAnswerTimeout); this.qcAnswerTimeout = null; }
    if (this.srTimer) { clearInterval(this.srTimer); this.srTimer = null; }
    if (this.srAnswerTimeout) { clearTimeout(this.srAnswerTimeout); this.srAnswerTimeout = null; }
    if (this.type === 'hands_free') {
      this.isPlaying = false;
      window.speechSynthesis.cancel();
      this.releaseWakeLock();
    }
    document.getElementById('exerciseModal').classList.add('hidden');
    if (this.type && this.total > 0) {
      const dur = Math.round((Date.now() - this.startTime) / 1000);
      // Pass accumulated xpEarned for SRS (earned per card), so sessions table records correct XP
      const sessionPayload = { type: this.type, words: this.total, correct: this.score, duration: dur };
      if (this.xpEarned > 0) sessionPayload.xp_earned = this.xpEarned;
      const res = await API.post('/api/session', sessionPayload);
      if (res.xp_earned) XP.show(res.xp_earned);
    }
    if (document.getElementById('page-home').classList.contains('active')) {
      Home.load();
    } else if (document.getElementById('page-stats').classList.contains('active')) {
      Stats.load();
    }
  },

  setScore() { document.getElementById('modalScore').textContent = `${this.score}/${this.total}`; },

  showResult(extra='') {
    if (this.sqTimeout) { clearTimeout(this.sqTimeout); this.sqTimeout = null; }
    if (this.srTimer) { clearInterval(this.srTimer); this.srTimer = null; }
    if (this.srAnswerTimeout) { clearTimeout(this.srAnswerTimeout); this.srAnswerTimeout = null; }
    if (this.type === 'hands_free') {
      this.releaseWakeLock();
    }
    const pct = this.total > 0 ? Math.round(this.score / this.total * 100) : 0;
    const emoji = pct >= 80 ? '🏆' : pct >= 50 ? '👍' : '💪';
    document.getElementById('modalBody').innerHTML = `
      <div class="result-screen">
        <div class="result-icon">${emoji}</div>
        <div class="result-score">${this.score}/${this.total}</div>
        <div class="result-label">${pct}% poprawnych${extra}</div>
        <button class="btn btn-primary" style="margin-top:24px" onclick="Exercise.start('${this.type}')">Zagraj ponownie</button>
        <button class="btn btn-outline" style="margin-top:8px" onclick="Exercise.close()">Zakończ</button>
      </div>`;
  },

  async reclassify(wordId, status, btn) {
    await API.post(`/api/words/${wordId}/status`, { status });
    const bar = btn.closest('.reclassify-bar');
    if (bar) bar.innerHTML = `<span style="color:var(--green)">✅ Przeniesiono!</span>`;
  },

  /* ─ FLASHCARDS ─ */
  async startFlashcards() {
    this.data = await API.get('/api/exercise/flashcards');
    this.idx = 0; this.total = this.data.length; this.startTime = Date.now();
    if (!this.data.length) { document.getElementById('modalBody').innerHTML = '<p style="text-align:center;padding:40px;color:var(--text2)">Brak słów do ćwiczeń!</p>'; return; }
    this.renderFC();
  },

  renderFC() {
    if (this.idx >= this.data.length) { this.showResult(); return; }
    const w = this.data[this.idx];
    const cardId = `fc-${this.idx}`; // unique ID per card to avoid async race
    const statusMap = {
      'NIE_ZNAM': { label: '❌ Nie znam', cls: 'fc-status-nie' },
      'TROCHE':   { label: '⚠️ Trochę znam', cls: 'fc-status-troche' },
      'ZNAM':     { label: '✅ Znam', cls: 'fc-status-znam' },
    };
    const st = statusMap[w.status] || { label: w.status, cls: '' };
    const rankBadge = w.frequency_rank && w.frequency_rank < 9999
      ? `<span class="fc-rank">#${w.frequency_rank}</span>` : '';
    document.getElementById('modalBody').innerHTML = `
      <p class="swipe-hint">Tap aby odsłonić • ${this.idx+1}/${this.data.length}</p>
      <div class="flashcard-wrap">
        <div class="flashcard" id="fc" onclick="Exercise.flipFC()">
          <div class="card-face card-front">
            <div class="fc-meta">
              <span class="fc-status-badge ${st.cls}">${st.label}</span>
              ${rankBadge}
            </div>
            <div class="card-word">${w.word}</div>
            <button onclick="event.stopPropagation();Speech.speak('${w.word.replace(/'/g,"\\'")}')"
              style="margin-top:12px;background:none;border:1px solid rgba(255,255,255,0.2);color:var(--text2);padding:6px 14px;border-radius:20px;cursor:pointer;font-size:13px">🔊 Wymów</button>
            <div class="card-hint" style="margin-top:12px">Tap aby zobaczyć tłumaczenie 👆</div>
          </div>
          <div class="card-face card-back">
            <div class="card-translation">${w.translation || '—'}</div>
            <div class="card-sentence" id="fcSentence-${this.idx}">⏳ Ładowanie zdania…</div>
          </div>
        </div>
      </div>
      <div id="fcActions" style="display:none;flex-direction:column;gap:8px;max-width:400px;margin:0 auto">
        <div style="display:flex;gap:8px">
          <button style="flex:1;background:var(--green-dim);color:var(--green);padding:14px;border-radius:10px;border:none;font-size:14px;font-weight:700;cursor:pointer" onclick="Exercise.fcAnswer('ZNAM',${w.id})">✅ Znam</button>
          <button style="flex:1;background:var(--yellow-dim);color:var(--yellow);padding:14px;border-radius:10px;border:none;font-size:14px;font-weight:700;cursor:pointer" onclick="Exercise.fcAnswer('TROCHE',${w.id})">⚠️ Trochę</button>
          <button style="flex:1;background:var(--red-dim);color:var(--red);padding:14px;border-radius:10px;border:none;font-size:14px;font-weight:700;cursor:pointer" onclick="Exercise.fcAnswer('NIE_ZNAM',${w.id})">❌ Nie znam</button>
        </div>
        <p style="text-align:center;color:var(--text3);font-size:11px;margin:0">Wybór zmieni status słowa na liście</p>
      </div>`;
    this.setScore();
    // Async sentence load — use idx snapshot to avoid race condition
    const myIdx = this.idx;
    if (w.translation) {
      API.get(`/api/gemini/sentence?word=${encodeURIComponent(w.word)}&translation=${encodeURIComponent(w.translation)}`)
        .then(s => {
          if (this.idx !== myIdx) return; // user already moved on
          const el = document.getElementById(`fcSentence-${myIdx}`);
          if (el) el.innerHTML = `<em>${s.sentence}</em><br><small style="color:var(--text3)">${s.sentence_pl}</small>`;
        }).catch(() => { const el = document.getElementById(`fcSentence-${myIdx}`); if (el) el.textContent = ''; });
    }
  },

  flipFC() {
    const fc = document.getElementById('fc');
    if (!fc) return;
    fc.classList.toggle('flipped');
    if (fc.classList.contains('flipped')) {
      const a = document.getElementById('fcActions');
      if (a) a.style.display = 'flex';
      Speech.speak(this.data[this.idx].word);
    }
  },

  fcAnswer(status, wordId) {
    API.post(`/api/words/${wordId}/status`, { status });
    if (status === 'ZNAM') this.score++;
    API.post('/api/review_result', { word_id: wordId, correct: status === 'ZNAM' });
    this.idx++; this.renderFC();
  },

  /* ─ MULTIPLE CHOICE ─ */
  async startMC() {
    this.data = await API.get('/api/exercise/multiple_choice');
    this.idx = 0; this.total = this.data.length; this.startTime = Date.now();
    if (!this.data.length) { document.getElementById('modalBody').innerHTML = '<p style="text-align:center;padding:40px;color:var(--text2)">Brak słów!</p>'; return; }
    this.renderMC();
  },

  renderMC() {
    if (this.idx >= this.data.length) { this.showResult(); return; }
    const w = this.data[this.idx];
    document.getElementById('modalBody').innerHTML = `
      <div class="mc-word">${w.word}</div>
      <span class="mc-speak" onclick="Speech.speak('${w.word.replace(/'/g,"\\'")}')">🔊 Wymów</span>
      <div class="mc-options">
        ${w.options.map((opt,i) => `<button class="mc-option" id="mco${i}" onclick="Exercise.mcAnswer('${opt.replace(/'/g,"\\'")}','${w.translation.replace(/'/g,"\\'")}',${w.id},${i})">${opt}</button>`).join('')}
      </div>
      <div id="mcReclass"></div>`;
    this.setScore();
  },

  mcAnswer(chosen, correct, wordId, idx) {
    const ok = chosen === correct;
    if (ok) this.score++;
    document.getElementById('mco'+idx).classList.add(ok ? 'correct' : 'wrong');
    if (!ok) document.querySelectorAll('.mc-option').forEach(b => { if (b.textContent.trim() === correct) b.classList.add('correct'); });
    document.querySelectorAll('.mc-option').forEach(b => b.disabled = true);
    API.post('/api/review_result', { word_id: wordId, correct: ok });
    const rc = document.getElementById('mcReclass');
    if (rc) rc.innerHTML = reclassifyBar(wordId, '');
    setTimeout(() => { this.idx++; this.renderMC(); }, 2000);
  },

  /* ─ FILL BLANK (Test pisowni) ─ */
  async startFillBlank() {
    this.data = await API.get('/api/exercise/flashcards');
    this.idx = 0; this.total = Math.min(this.data.length, 8); this.startTime = Date.now();
    if (!this.data.length) { document.getElementById('modalBody').innerHTML = '<p style="text-align:center;padding:40px;color:var(--text2)">Brak słów!</p>'; return; }
    this.loadFB();
  },

  loadFB() {
    if (this.idx >= this.total) { this.showResult(); return; }
    const w = this.data[this.idx];
    const hint = w.word[0] + '_'.repeat(w.word.length - 1);
    document.getElementById('modalBody').innerHTML = `
      <p style="text-align:center;color:var(--text2);margin-bottom:8px;font-size:13px">${this.idx+1}/${this.total}</p>
      <div class="spelling-translation" style="font-size:22px;font-weight:700;text-align:center;margin-bottom:12px;color:var(--text1)">${w.translation}</div>
      <div class="spelling-hint" style="text-align:center;color:var(--text3);font-size:16px;margin-bottom:24px;letter-spacing:4px;font-family:monospace">${hint} (${w.word.length} liter)</div>
      <div style="max-width:300px;margin:0 auto;display:flex;flex-direction:column;gap:12px">
        <input type="text" id="spellingInput" autocomplete="off" spellcheck="false" class="login-input" style="font-size:18px;text-align:center;padding:12px;border-radius:10px;border:2px solid var(--border);background:var(--card);color:var(--text1);width:100%" placeholder="Wpisz angielskie słowo..." onkeydown="if(event.key==='Enter') Exercise.checkSpelling()">
        <button class="btn btn-primary" onclick="Exercise.checkSpelling()">Sprawdź</button>
      </div>
      <div id="spellingResult" style="text-align:center;margin-top:20px;font-size:16px;font-weight:600;min-height:24px"></div>`;
    this.setScore();
    setTimeout(() => {
      const input = document.getElementById('spellingInput');
      if (input) input.focus();
    }, 100);
  },

  async checkSpelling() {
    const w = this.data[this.idx];
    const input = document.getElementById('spellingInput');
    const resultEl = document.getElementById('spellingResult');
    if (!input || !resultEl) return;
    
    const val = input.value.trim().toLowerCase();
    const correct = w.word.trim().toLowerCase();
    const ok = val === correct;
    
    input.disabled = true;
    const btn = resultEl.previousElementSibling.querySelector('button');
    if (btn) btn.disabled = true;

    if (ok) {
      this.score++;
      resultEl.style.color = 'var(--green)';
      resultEl.textContent = '✅ Doskonale!';
      input.style.borderColor = 'var(--green)';
      Speech.speak(w.word);
    } else {
      resultEl.style.color = 'var(--red)';
      resultEl.innerHTML = `❌ Błąd! Poprawna odpowiedź to: <strong style="font-size:18px">${w.word}</strong>`;
      input.style.borderColor = 'var(--red)';
      Speech.speak(w.word);
    }

    await API.post('/api/review_result', { word_id: w.id, correct: ok });

    setTimeout(() => {
      this.idx++;
      this.loadFB();
    }, ok ? 1500 : 2500);
  },

  /* ─ MATCH PAIRS ─ */
  async startMatchPairs() {
    this.data = await API.get('/api/exercise/match_pairs');
    if (!this.data.length) { document.getElementById('modalBody').innerHTML = '<p style="text-align:center;padding:40px;color:var(--text2)">Brak słów!</p>'; return; }
    this.mpSel = null; this.mpMatched = 0; this.score = 0; this.total = this.data.length; this.startTime = Date.now();
    this.renderMP();
  },

  renderMP() {
    // Left column = Polish (shuffled), Right column = English (shuffled)
    const shuffle = arr => [...arr].sort(() => Math.random() - 0.5);
    const plItems = shuffle(this.data.map(w => ({ id: 'pl-' + w.id, text: w.translation || '—', type: 'pl', pair: w.id })));
    const enItems = shuffle(this.data.map(w => ({ id: 'en-' + w.id, text: w.word, type: 'en', pair: w.id })));
    const mkItem = item => `<div class="match-item" id="mi-${item.id}" data-pair="${item.pair}" data-type="${item.type}" onclick="Exercise.mpSelect(this)">${item.text}</div>`;
    document.getElementById('modalBody').innerHTML = `
      <p style="text-align:center;color:var(--text2);margin-bottom:12px;font-size:13px">🇵🇱 Po lewej: polskie &nbsp;|&nbsp; 🇬🇧 Po prawej: angielskie</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div style="display:flex;flex-direction:column;gap:8px">${plItems.map(mkItem).join('')}</div>
        <div style="display:flex;flex-direction:column;gap:8px">${enItems.map(mkItem).join('')}</div>
      </div>`;
    this.setScore();
  },

  mpSelect(el) {
    if (el.classList.contains('matched')) return;
    if (!this.mpSel) { el.classList.add('selected'); this.mpSel = el; return; }
    const a = this.mpSel, b = el;
    if (a === b) { a.classList.remove('selected'); this.mpSel = null; return; }
    if (a.dataset.type !== b.dataset.type && a.dataset.pair === b.dataset.pair) {
      a.classList.remove('selected'); a.classList.add('matched'); b.classList.add('matched');
      this.mpMatched++; this.score++;
      this.mpSel = null;
      if (this.mpMatched === this.data.length) setTimeout(() => this.showResult(), 600);
    } else {
      a.classList.remove('selected'); a.classList.add('wrong-flash'); b.classList.add('wrong-flash');
      setTimeout(() => { a.classList.remove('wrong-flash'); b.classList.remove('wrong-flash'); }, 500);
      this.mpSel = null;
    }
    this.total = this.data.length; this.setScore();
  },

  /* ─ SPEED ROUND ─ */
  async startSpeed() {
    this.data = await API.get('/api/exercise/speed_round');
    if (!this.data.length) { document.getElementById('modalBody').innerHTML = '<p style="text-align:center;padding:40px;color:var(--text2)">Brak słów!</p>'; return; }
    this.idx = 0; this.score = 0; this.total = 0; this.startTime = Date.now();
    this.srTime = 60;
    
    if (this.srTimer) { clearInterval(this.srTimer); this.srTimer = null; }
    if (this.srAnswerTimeout) { clearTimeout(this.srAnswerTimeout); this.srAnswerTimeout = null; }
    
    this.srTimer = setInterval(() => {
      this.srTime--;
      const el = document.getElementById('srTimer');
      if (el) {
        el.textContent = this.srTime;
        if (this.srTime <= 10) el.style.color = 'var(--red)';
      }
      if (this.srTime <= 0) {
        clearInterval(this.srTimer);
        this.srTimer = null;
        this.showResult(' ⏱️');
      }
    }, 1000);
    this.renderSpeed();
  },

  renderSpeed() {
    if (!this.srTimer || this.srTime <= 0) return;
    if (this.idx >= this.data.length) {
      clearInterval(this.srTimer);
      this.srTimer = null;
      this.showResult(' – koniec słów!');
      return;
    }
    const w = this.data[this.idx];
    document.getElementById('modalBody').innerHTML = `
      <div class="speed-timer" id="srTimer">${this.srTime}</div>
      <div class="speed-score">✅ ${this.score} poprawnych</div>
      <div class="speed-word">${w.word}</div>
      <div class="mc-options">${w.options.map((opt,i) => `<button class="mc-option" onclick="Exercise.srAnswer('${opt.replace(/'/g,"\\'")}','${w.translation.replace(/'/g,"\\'")}',${i})">${opt}</button>`).join('')}</div>`;
  },

  srAnswer(chosen, correct, idx) {
    const ok = chosen === correct;
    if (ok) this.score++;
    this.total++;
    const btns = document.querySelectorAll('.mc-option');
    if (btns[idx]) { btns[idx].classList.add(ok ? 'correct' : 'wrong'); btns[idx].disabled = true; }
    
    if (this.srAnswerTimeout) clearTimeout(this.srAnswerTimeout);
    this.srAnswerTimeout = setTimeout(() => {
      this.srAnswerTimeout = null;
      this.idx++;
      this.renderSpeed();
    }, 400);
    this.setScore();
  },

  /* ─ CONTEXT AI ─ */
  async startContext() {
    this.data = await API.get('/api/exercise/flashcards');
    this.idx = 0; this.total = Math.min(this.data.length, 6); this.startTime = Date.now();
    if (!this.data.length) { document.getElementById('modalBody').innerHTML = '<p style="text-align:center;padding:40px;color:var(--text2)">Brak słów!</p>'; return; }
    this.loadCtx();
  },

  async loadCtx() {
    if (this.idx >= this.total) { this.showResult(); return; }
    const w = this.data[this.idx];
    document.getElementById('modalBody').innerHTML = '<div style="text-align:center;padding:40px"><div class="spinner" style="margin:auto"></div><p style="margin-top:12px;color:var(--text2)">Gemini generuje…</p></div>';
    const task = await API.get(`/api/gemini/context?word=${encodeURIComponent(w.word)}&translation=${encodeURIComponent(w.translation||'')}`);
    document.getElementById('modalBody').innerHTML = `
      <p style="text-align:center;color:var(--text2);margin-bottom:12px">${this.idx+1}/${this.total}</p>
      <div class="ctx-text">${(task.text||'').replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')}</div>
      <p class="ctx-question">${task.question}</p>
      <div class="mc-options">${(task.options||[]).map((opt,i) => `<button class="mc-option" id="cto${i}" onclick="Exercise.ctxAnswer('${opt.replace(/'/g,"\\'")}','${(task.correct||'').replace(/'/g,"\\'")}',${w.id},${i})">${opt}</button>`).join('')}</div>
      <div id="ctxReclass"></div>`;
    this.setScore();
  },

  ctxAnswer(chosen, correct, wordId, idx) {
    const ok = chosen === correct;
    if (ok) this.score++;
    document.querySelectorAll('.mc-option')[idx].classList.add(ok ? 'correct' : 'wrong');
    if (!ok) document.querySelectorAll('.mc-option').forEach(b => { if (b.textContent.trim() === correct) b.classList.add('correct'); });
    document.querySelectorAll('.mc-option').forEach(b => b.disabled = true);
    API.post('/api/review_result', { word_id: wordId, correct: ok });
    const rc = document.getElementById('ctxReclass');
    if (rc) rc.innerHTML = reclassifyBar(wordId, '');
    setTimeout(() => { this.idx++; this.loadCtx(); }, 2500);
  },

  /* ─ AUDIO QUIZ ─ */
  async startAudioQuiz() {
    this.data = await API.get('/api/exercise/multiple_choice');
    this.idx = 0; this.total = this.data.length; this.startTime = Date.now();
    if (!this.data.length) { document.getElementById('modalBody').innerHTML = '<p style="text-align:center;padding:40px;color:var(--text2)">Brak słów!</p>'; return; }
    this.renderAQ();
  },

  renderAQ() {
    if (this.idx >= this.data.length) { this.showResult(); return; }
    const w = this.data[this.idx];
    setTimeout(() => Speech.speak(w.word), 300);
    document.getElementById('modalBody').innerHTML = `
      <p style="text-align:center;color:var(--text2);font-size:13px;margin-bottom:8px">${this.idx+1}/${this.data.length}</p>
      <div style="text-align:center;margin:20px 0">
        <div style="font-size:56px;margin-bottom:8px">🔊</div>
        <p style="color:var(--text2);font-size:15px">Usłyszysz słowo automatycznie</p>
        <button id="aqRepeat"
          style="margin-top:8px;background:var(--card);border:1px solid var(--border);color:var(--text1);padding:8px 20px;border-radius:20px;cursor:pointer;font-size:14px">
          🔄 Powtórz: <strong>${w.word}</strong>
        </button>
      </div>
      <div class="mc-options" id="aqOptions"></div>
      <div id="aqReclass"></div>`;
    document.getElementById('aqRepeat').addEventListener('click', () => Speech.speak(w.word));
    const container = document.getElementById('aqOptions');
    w.options.forEach((opt, i) => {
      const btn = document.createElement('button');
      btn.className = 'mc-option';
      btn.id = `aqo${i}`;
      btn.textContent = opt;
      btn.dataset.chosen = opt;
      btn.dataset.correct = w.translation;
      btn.dataset.wordId = w.id;
      btn.addEventListener('click', () => Exercise.aqAnswer(btn));
      container.appendChild(btn);
    });
    this.setScore();
  },

  aqAnswer(btn) {
    const chosen  = btn.dataset.chosen;
    const correct = btn.dataset.correct;
    const wordId  = parseInt(btn.dataset.wordId);
    const ok = chosen === correct;
    if (ok) this.score++;
    btn.classList.add(ok ? 'correct' : 'wrong');
    if (!ok) {
      document.querySelectorAll('#aqOptions .mc-option').forEach(b => {
        if (b.dataset.chosen === correct) b.classList.add('correct');
      });
    }
    document.querySelectorAll('#aqOptions .mc-option').forEach(b => b.disabled = true);
    API.post('/api/review_result', { word_id: wordId, correct: ok });
    setTimeout(() => { this.idx++; this.renderAQ(); }, 1600);
  },

  /* ─ SUPER QUIZ (Combined Fiszki + Wybór + Audio) ─ */
  async startSuperQuiz() {
    if (this.sqTimeout) { clearTimeout(this.sqTimeout); this.sqTimeout = null; }
    this.data = await API.get('/api/exercise/multiple_choice');
    this.idx = 0; this.total = this.data.length; this.startTime = Date.now();
    if (!this.data.length) {
      document.getElementById('modalBody').innerHTML = '<p style="text-align:center;padding:40px;color:var(--text2)">Brak słów do ćwiczeń! Sklasyfikuj najpierw nowe słówka w zakładce "Nowe".</p>';
      return;
    }
    this.renderSuperQuiz();
  },

  renderSuperQuiz() {
    if (this.idx >= this.data.length) { this.showResult(); return; }
    const w = this.data[this.idx];
    
    // Play pronunciation automatically
    setTimeout(() => Speech.speak(w.word), 250);

    const statusMap = {
      'NIE_ZNAM': { label: '❌ Nie znam', cls: 'fc-status-nie' },
      'TROCHE':   { label: '⚠️ Trochę znam', cls: 'fc-status-troche' },
      'ZNAM':     { label: '✅ Znam', cls: 'fc-status-znam' },
    };
    const st = statusMap[w.status] || { label: w.status, cls: '' };
    const rankBadge = w.frequency_rank && w.frequency_rank < 9999
      ? `<span class="fc-rank">#${w.frequency_rank}</span>` : '';

    document.getElementById('modalBody').innerHTML = `
      <p style="text-align:center;color:var(--text2);font-size:13px;margin-bottom:8px">${this.idx+1}/${this.data.length}</p>
      
      <div class="sq-card">
        <div class="sq-meta">
          <span class="fc-status-badge ${st.cls}" id="sqStatusBadge">${st.label}</span>
          ${rankBadge}
        </div>
        <div class="sq-word-section">
          <div class="sq-word">${w.word}</div>
          <button class="sq-speak-btn" onclick="Speech.speak('${w.word.replace(/'/g,"\\'")}');">🔊 Odsłuchaj ponownie</button>
        </div>
      </div>

      <div class="mc-options" id="sqOptions">
        ${w.options.map((opt, i) => `
          <button class="mc-option" id="sqo${i}" onclick="Exercise.sqAnswer('${opt.replace(/'/g,"\\'")}','${w.translation.replace(/'/g,"\\'")}',${w.id},${i})">
            ${opt}
          </button>
        `).join('')}
      </div>
      
      <div class="sq-reclass-panel" id="sqReclass">
        <div class="reclassify-bar">
          <span>Zmień status:</span>
          <button style="background:var(--green-dim);color:var(--green)" onclick="Exercise.sqReclassify(${w.id},'ZNAM',this)">✅ Znam</button>
          <button style="background:var(--yellow-dim);color:var(--yellow)" onclick="Exercise.sqReclassify(${w.id},'TROCHE',this)">⚠️ Trochę</button>
          <button style="background:var(--red-dim);color:var(--red)" onclick="Exercise.sqReclassify(${w.id},'NIE_ZNAM',this)">❌ Nie znam</button>
        </div>
      </div>

      <button class="btn btn-primary" id="sqNextBtn" style="margin-top:16px;width:100%;display:none" onclick="Exercise.sqNext()">Dalej ➔</button>
    `;
    this.setScore();
  },

  sqAnswer(chosen, correct, wordId, optionIdx) {
    const ok = chosen === correct;
    if (ok) this.score++;
    
    // Highlight choices
    const chosenBtn = document.getElementById('sqo' + optionIdx);
    if (chosenBtn) chosenBtn.classList.add(ok ? 'correct' : 'wrong');
    
    if (!ok) {
      document.querySelectorAll('#sqOptions .mc-option').forEach(b => {
        if (b.textContent.trim() === correct) b.classList.add('correct');
      });
    }
    // Disable all options
    document.querySelectorAll('#sqOptions .mc-option').forEach(b => b.disabled = true);
    
    // Submit review result
    API.post('/api/review_result', { word_id: wordId, correct: ok });

    // Auto-advance after showing result (1.2s if correct, 2s if wrong so they can see correct answer)
    const delay = ok ? 1200 : 2000;
    this.sqTimeout = setTimeout(() => {
      this.sqNext();
    }, delay);

    // Keep the Continue button displayed (in case they want to click it immediately to skip the wait)
    const nextBtn = document.getElementById('sqNextBtn');
    if (nextBtn) nextBtn.style.display = 'block';
  },

  async sqReclassify(wordId, status, btn) {
    if (this.sqTimeout) clearTimeout(this.sqTimeout);
    await API.post(`/api/words/${wordId}/status`, { status });
    
    // Update badge on screen
    const badge = document.getElementById('sqStatusBadge');
    if (badge) {
      const statusMap = {
        'NIE_ZNAM': { label: '❌ Nie znam', cls: 'fc-status-nie' },
        'TROCHE':   { label: '⚠️ Trochę znam', cls: 'fc-status-troche' },
        'ZNAM':     { label: '✅ Znam', cls: 'fc-status-znam' },
      };
      const st = statusMap[status];
      badge.className = `fc-status-badge ${st.cls}`;
      badge.textContent = st.label;
    }

    // Show feedback in the bar
    const bar = btn.closest('.reclassify-bar');
    if (bar) {
      bar.innerHTML = `<span style="color:var(--green);font-weight:700">✓ Zmieniono status słowa!</span>`;
    }

    // Show Next button so they can proceed when they want
    const nextBtn = document.getElementById('sqNextBtn');
    if (nextBtn) nextBtn.style.display = 'block';
  },

  sqNext() {
    if (this.sqTimeout) clearTimeout(this.sqTimeout);
    this.idx++;
    this.renderSuperQuiz();
  },

  /* ─ QUICK CHALLENGE (Arcade Survival) ─ */
  async startQuickChallenge() {
    this.data = await API.get('/api/exercise/speed_round');
    if (!this.data.length) {
      document.getElementById('modalBody').innerHTML = '<p style="text-align:center;padding:40px;color:var(--text2)">Brak słów do wyzwań!</p>';
      return;
    }
    
    this.data = this.data.sort(() => Math.random() - 0.5);
    this.idx = 0;
    this.score = 0;
    this.total = 0;
    this.startTime = Date.now();
    this.qcTime = 35;
    
    if (this.qcTimer) { clearInterval(this.qcTimer); this.qcTimer = null; }
    if (this.qcAnswerTimeout) { clearTimeout(this.qcAnswerTimeout); this.qcAnswerTimeout = null; }
    
    this.qcTimer = setInterval(() => {
      this.qcTime--;
      const timerEl = document.getElementById('qcTimer');
      const barEl = document.getElementById('qcTimerBar');
      if (timerEl) {
        timerEl.textContent = this.qcTime + 's';
        if (this.qcTime <= 10) {
          timerEl.style.color = 'var(--red)';
          timerEl.classList.add('pulse-animation');
        } else {
          timerEl.style.color = 'var(--text1)';
          timerEl.classList.remove('pulse-animation');
        }
      }
      if (barEl) {
        const pct = Math.min(100, Math.round((this.qcTime / 60) * 100));
        barEl.style.width = pct + '%';
        if (this.qcTime <= 10) barEl.style.backgroundColor = 'var(--red)';
        else barEl.style.backgroundColor = 'var(--yellow)';
      }
      
      if (this.qcTime <= 0) {
        clearInterval(this.qcTimer);
        this.qcTimer = null;
        this.showQCResult();
      }
    }, 1000);
    
    this.renderQC();
  },

  renderQC() {
    if (!this.qcTimer || this.qcTime <= 0) return;
    if (this.idx >= this.data.length) {
      clearInterval(this.qcTimer);
      this.qcTimer = null;
      this.showQCResult();
      return;
    }
    
    const w = this.data[this.idx];
    let format = Math.floor(Math.random() * 3);
    let questionHtml = '';
    let options = [];
    let correctOption = '';
    let heading = '';
    
    if (format === 0) {
      heading = '🎯 Wybierz poprawne tłumaczenie';
      questionHtml = `<div class="qc-word">${w.word}</div>`;
      options = w.options;
      correctOption = w.translation;
    } else if (format === 1) {
      heading = '✍️ Co oznacza to słowo?';
      questionHtml = `<div class="qc-word" style="color:var(--yellow)">${w.translation}</div>`;
      const otherWords = this.data.filter(x => x.id !== w.id).map(x => x.word);
      const shuffledOthers = otherWords.sort(() => Math.random() - 0.5);
      options = [w.word].concat(shuffledOthers.slice(0, 3));
      options = options.sort(() => Math.random() - 0.5);
      correctOption = w.word;
    } else {
      heading = '🔊 Odsłuchaj i wybierz znaczenie';
      questionHtml = `
        <div style="text-align:center;margin:15px 0">
          <button class="qc-audio-btn" onclick="Speech.speak('${w.word.replace(/'/g,"\\'")}'); event.stopPropagation();">🔊 Odsłuchaj</button>
        </div>`;
      options = w.options;
      correctOption = w.translation;
      setTimeout(() => Speech.speak(w.word), 200);
    }
    
    document.getElementById('modalBody').innerHTML = `
      <div class="qc-container">
        <div class="qc-header-row">
          <div class="qc-score-badge">Punkty: <strong>${this.score}</strong></div>
          <div class="qc-timer-container">
            <span id="qcTimer" class="qc-timer-text">${this.qcTime}s</span>
            <div class="qc-float-indicator" id="qcFloatIndicator"></div>
          </div>
        </div>
        
        <div class="progress-bar-wrap" style="height:6px;margin-bottom:20px;background:rgba(255,255,255,0.08)">
          <div id="qcTimerBar" class="progress-bar-fill" style="width:${Math.min(100, Math.round((this.qcTime / 60) * 100))}%;transition: width 1s linear, background-color 0.3s;"></div>
        </div>
        
        <p class="qc-heading-text">${heading}</p>
        <div class="qc-question-box">${questionHtml}</div>
        
        <div class="mc-options" id="qcOptions">
          ${options.map((opt, i) => `
            <button class="mc-option" id="qco${i}" onclick="Exercise.qcAnswer('${opt.replace(/'/g,"\\'")}','${correctOption.replace(/'/g,"\\'")}',${w.id},${i})">
              ${opt}
            </button>
          `).join('')}
        </div>
      </div>`;
      
      this.setScore();
  },

  qcAnswer(chosen, correct, wordId, optionIdx) {
    const ok = chosen === correct;
    this.total++;
    
    const chosenBtn = document.getElementById('qco' + optionIdx);
    if (chosenBtn) chosenBtn.classList.add(ok ? 'correct' : 'wrong');
    
    if (!ok) {
      document.querySelectorAll('#qcOptions .mc-option').forEach(b => {
        if (b.textContent.trim() === correct) b.classList.add('correct');
      });
    }
    
    document.querySelectorAll('#qcOptions .mc-option').forEach(b => b.disabled = true);
    
    const floatEl = document.getElementById('qcFloatIndicator');
    if (ok) {
      this.score++;
      this.qcTime = Math.min(60, this.qcTime + 3);
      if (floatEl) {
        floatEl.textContent = '+3s';
        floatEl.className = 'qc-float-indicator float-green show';
      }
      API.post('/api/review_result', { word_id: wordId, correct: true });
    } else {
      this.qcTime = Math.max(0, this.qcTime - 5);
      if (floatEl) {
        floatEl.textContent = '-5s';
        floatEl.className = 'qc-float-indicator float-red show';
      }
      API.post('/api/review_result', { word_id: wordId, correct: false });
    }
    
    const scoreBadges = document.querySelectorAll('.qc-score-badge strong');
    scoreBadges.forEach(b => b.textContent = this.score);
    
    if (this.qcTime <= 0) {
      if (this.qcTimer) { clearInterval(this.qcTimer); this.qcTimer = null; }
      if (this.qcAnswerTimeout) { clearTimeout(this.qcAnswerTimeout); this.qcAnswerTimeout = null; }
      setTimeout(() => {
        this.showQCResult();
      }, 700);
      return;
    }
    
    if (this.qcAnswerTimeout) clearTimeout(this.qcAnswerTimeout);
    this.qcAnswerTimeout = setTimeout(() => {
      this.qcAnswerTimeout = null;
      this.idx++;
      this.renderQC();
    }, 450);
  },

  showQCResult() {
    if (this.qcTimer) { clearInterval(this.qcTimer); this.qcTimer = null; }
    if (this.qcAnswerTimeout) { clearTimeout(this.qcAnswerTimeout); this.qcAnswerTimeout = null; }
    
    const xpGained = this.score * 5;
    document.getElementById('modalBody').innerHTML = `
      <div class="result-screen">
        <div class="result-icon" style="font-size:72px;animation: bounce 1s infinite alternate">⏱️</div>
        <h2 style="color:var(--text1);font-weight:900;margin-top:12px">Koniec czasu!</h2>
        <div class="result-score" style="font-size:48px;color:var(--yellow)">${this.score} poprawnych</div>
        <p style="color:var(--text3);font-size:14px;margin-top:4px">Wspaniały wynik w wyzwaniu przetrwania!</p>
        
        <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:12px;padding:16px;margin:20px 0;width:100%;max-width:320px;text-align:left">
          <div style="display:flex;justify-content:space-between;margin-bottom:8px">
            <span style="color:var(--text2)">Zdobyty XP:</span>
            <strong style="color:var(--green)">+${xpGained} XP</strong>
          </div>
          <div style="display:flex;justify-content:space-between">
            <span style="color:var(--text2)">Odpowiedzi:</span>
            <strong style="color:var(--text1)">${this.score} / ${this.total}</strong>
          </div>
        </div>
        
        <button class="btn btn-primary" style="margin-top:12px;width:100%;max-width:240px;background:linear-gradient(135deg, rgba(239, 68, 68, 1), rgba(245, 158, 11, 1))" onclick="Exercise.start('quick_challenge')">Zagraj ponownie ⚡</button>
        <button class="btn btn-outline" style="margin-top:8px;width:100%;max-width:240px" onclick="Exercise.close()">Zakończ</button>
      </div>`;
  }
};


/* ── INIT ── */
async function startApp() {
  document.getElementById('accountPickerScreen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('xpDisplay').textContent = (Session.xp || 0) + ' XP';

  // Load stats and classify — independently resilient
  let stats = null;
  try { stats = await API.get('/api/stats'); } catch(e) {}
  try { await Classify.load(); } catch(e) {}

  // Populate header
  if (stats) {
    document.getElementById('xpDisplay').textContent = (stats.xp || 0) + ' XP';
    const streakEl = document.getElementById('streakBadge');
    if (streakEl) streakEl.textContent = '🔥 ' + (stats.streak?.current_streak || stats.streak || 0);
  }

  // Load non-blocking
  try { Stats.load(); } catch(e) {}
  try { Home.load(stats); } catch(e) { console.warn('Home.load error:', e); }

  // Navigate to home
  UI.goTo('home');
}

window.addEventListener('load', async () => {
  try {
    // Zainicjalizuj lokalną bazę danych IndexedDB (Dexie) przed startem aplikacji
    await DB.init();
  } catch(e) {
    console.error("DB.init failed:", e);
  }
  document.getElementById('splash').style.display = 'none';
  if (Session.load()) {
    try { await startApp(); }
    catch (e) { Session.clear(); Auth.showPicker(); }
  } else {
    Auth.showPicker();
  }
});

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

/* ─ SRS EXERCISE ─ */
Object.assign(Exercise, {
  async startSRS() {
    this.data = await API.get('/api/exercise/srs');
    this.idx = 0; this.score = 0; this.srsReviewed = 0; this.startTime = Date.now();
    if (!this.data.length) {
      document.getElementById('modalBody').innerHTML = `
        <div style="text-align:center;padding:40px">
          <div style="font-size:56px;margin-bottom:16px">🎉</div>
          <h3 style="color:var(--text1);margin-bottom:8px">Brak powtórek na dziś!</h3>
          <p style="color:var(--text3);font-size:14px">Wszystkie słowa przerobione. Wróć jutro!</p>
        </div>`;
      return;
    }
    this.total = this.data.length;
    this.renderSRS();
  },

  _srsNextLabel(reps, ef, quality) {
    // Predykcja nowego interwału dla danej jakości (podgląd)
    let newInt;
    if (quality >= 3) {
      if (reps === 0) newInt = 1;
      else if (reps === 1) newInt = 6;
      else newInt = Math.max(1, Math.round(reps * ef));
    } else {
      newInt = 1;
    }
    if (newInt === 1) return 'jutro';
    if (newInt < 7) return 'za ' + newInt + ' dni';
    const weeks = Math.round(newInt / 7);
    return weeks === 1 ? 'za tydzień' : 'za ' + weeks + ' tyg.';
  },

  renderSRS() {
    if (this.idx >= this.data.length) { this.showSRSResult(); return; }
    const w = this.data[this.idx];
    const progressPct = Math.round((this.idx / this.data.length) * 100);
    const lFail = this._srsNextLabel(w.repetitions, w.ef, 1);
    const lHard = this._srsNextLabel(w.repetitions, w.ef, 3);
    const lGood = this._srsNextLabel(w.repetitions, w.ef, 4);
    const lEasy = this._srsNextLabel(w.repetitions, w.ef, 5);
    const repsBadge = w.repetitions === 0
      ? `<span style="background:rgba(239,68,68,0.15);color:var(--red);padding:2px 8px;border-radius:6px;font-size:10px;font-weight:700">NOWE</span>`
      : `<span style="background:rgba(99,102,241,0.15);color:#818cf8;padding:2px 8px;border-radius:6px;font-size:10px;font-weight:700">×${w.repetitions}</span>`;

    // Auto-speak słowo przy każdym nowym wyświetleniu karty
    setTimeout(() => Speech.speak(w.word), 300);
    document.getElementById('modalBody').innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <div style="flex:1;background:rgba(255,255,255,0.06);border-radius:4px;height:4px;overflow:hidden">
          <div style="width:${progressPct}%;height:100%;background:linear-gradient(90deg,var(--primary),#818cf8);transition:width 0.4s"></div>
        </div>
        <span style="color:var(--text3);font-size:11px;white-space:nowrap">${this.idx+1}/${this.data.length}</span>
      </div>
      <div class="srs-card" id="srsCard">
        <div class="srs-front">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
            <span style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:1px">Angielski</span>
            ${repsBadge}
          </div>
          <div class="srs-word">${w.word}</div>
          <button class="srs-speak" onclick="Speech.speak(\'${w.word.replace(/\'/g, "\\\'")}\')">\U0001f50a</button>
          <p style="color:var(--text3);font-size:13px;margin-top:20px">Czy pamiętasz znaczenie?</p>
          <button class="btn srs-reveal-btn" id="srsReveal">Pokaż tłumaczenie</button>
        </div>
      </div>
      <div id="srsQuality" class="hidden">
        <p style="text-align:center;color:var(--text2);font-size:13px;margin-bottom:10px">Jak dobrze pamiętasz?</p>
        <div class="srs-translation" id="srsTrans">${w.translation || '—'}</div>
        <div class="srs-buttons">
          <button class="srs-btn srs-fail" onclick="Exercise.rateSRS(${w.srs_id},1)">😓<br><span>Nie wiem</span><small style="display:block;font-size:9px;opacity:0.6;margin-top:2px">${lFail}</small></button>
          <button class="srs-btn srs-hard" onclick="Exercise.rateSRS(${w.srs_id},3)">😐<br><span>Trudne</span><small style="display:block;font-size:9px;opacity:0.6;margin-top:2px">${lHard}</small></button>
          <button class="srs-btn srs-good" onclick="Exercise.rateSRS(${w.srs_id},4)">😊<br><span>Dobrze</span><small style="display:block;font-size:9px;opacity:0.6;margin-top:2px">${lGood}</small></button>
          <button class="srs-btn srs-easy" onclick="Exercise.rateSRS(${w.srs_id},5)">😄<br><span>Łatwe</span><small style="display:block;font-size:9px;opacity:0.6;margin-top:2px">${lEasy}</small></button>
        </div>
        <p class="srs-interval" id="srsInterval" style="opacity:0.7">Aktualny interwał: ${w.interval} ${w.interval === 1 ? 'dzień' : 'dni'}</p>
      </div>`;
    document.getElementById('srsReveal').addEventListener('click', () => {
      document.getElementById('srsQuality').classList.remove('hidden');
      document.getElementById('srsReveal').classList.add('hidden');
    });
    this.setScore();
  },

  async rateSRS(srsId, quality) {
    document.querySelectorAll('.srs-btn').forEach(b => b.disabled = true);
    const res = await API.post('/api/srs/result', { srs_id: srsId, quality });
    if (res && res.interval !== undefined) {
      const intEl = document.getElementById('srsInterval');
      if (intEl) {
        const days = res.interval;
        const label = days === 1 ? 'jutro' : days < 7 ? ('za ' + days + ' dni') : days < 14 ? 'za tydzień' : ('za ' + Math.round(days/7) + ' tygodnie');
        intEl.textContent = '✅ Następna powtórka: ' + label;
        intEl.style.color = quality >= 4 ? 'var(--green)' : quality === 3 ? 'var(--yellow)' : 'var(--red)';
        intEl.style.opacity = '1';
        intEl.style.fontWeight = '700';
      }
    }
    if (quality >= 3) {
      this.score++;
      const cardXp = quality >= 5 ? 5 : quality >= 4 ? 4 : 3;
      this.xpEarned = (this.xpEarned || 0) + cardXp; // accumulate for session record
      showXP('+' + cardXp + ' XP');
    }
    setTimeout(() => { this.idx++; this.renderSRS(); }, 1200);
  },

  showSRSResult() {
    const total = this.data.length;
    const pct = total > 0 ? Math.round(this.score / total * 100) : 0;
    const emoji = pct >= 80 ? '🏆' : pct >= 50 ? '👍' : '💪';
    document.getElementById('modalBody').innerHTML = `
      <div style="text-align:center;padding:30px 20px">
        <div style="font-size:52px;margin-bottom:12px">${emoji}</div>
        <h3 style="color:var(--text1);margin-bottom:6px">Powtórka ukończona!</h3>
        <p style="color:var(--text3);font-size:14px;margin-bottom:4px">${this.score}/${total} zapamiętanych (${pct}%)</p>
        <p style="color:var(--text3);font-size:12px;margin-bottom:16px">Algorytm SM-2 zaplanował kolejne powtórki</p>
        <div style="background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:20px;font-size:13px;color:var(--text2);line-height:1.8;text-align:left">
          <div>😄 Łatwe → następna powtórka za kilka tygodni</div>
          <div>😊 Dobrze → następna powtórka za kilka dni</div>
          <div>😐 Trudne → wraca jutro</div>
          <div>😓 Nie wiem → wraca jutro (reset)</div>
        </div>
        <button class="btn btn-primary" style="margin-top:4px" onclick="Exercise.close()">Zakończ</button>
      </div>`;
  },

  // ─── SENTENCE BUILDER ────────────────────────────────────────────────────────
  _sbSentence: '',
  _sbPlaced: [],
  _sbPool: [],

  async startSentenceBuilder() {
    const words = await API.get('/api/exercise/multiple_choice?n=10');
    if (!words || !words.length) {
      document.getElementById('modalBody').innerHTML = '<p style="text-align:center;padding:40px;color:var(--text3)">Brak słów do ćwiczenia. Sklasyfikuj więcej słów!</p>';
      return;
    }
    this.data = words.sort(() => Math.random() - 0.5);
    this.total = this.data.length;
    this.idx = 0;
    this.score = 0;
    this.xpEarned = 0;
    this.startTime = Date.now();
    this.setScore();
    await this.renderSentenceBuilder();
  },

  async renderSentenceBuilder() {
    if (this.idx >= this.data.length) { this.showSentenceBuilderResult(); return; }
    this.setScore();
    const w = this.data[this.idx];
    this._sbSentence = '';
    this._sbPlaced = [];
    this._sbPool = [];

    document.getElementById('modalBody').innerHTML = `
      <div style="padding:16px 12px;max-width:420px;margin:0 auto">
        <div style="text-align:center;margin-bottom:14px">
          <div style="font-size:28px;font-weight:900;color:var(--text1);letter-spacing:1px">${w.word}</div>
          <div style="font-size:13px;color:var(--text3);margin-top:4px">${w.translation}</div>
          <div style="margin-top:8px">
            <button style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:13px" onclick="Speech.speak('${w.word.replace(/'/g,"\\'")}')">🔊 wymowa</button>
          </div>
        </div>
        <div style="font-size:12px;color:var(--text3);font-weight:600;text-transform:uppercase;margin-bottom:6px">Ułóż zdanie:</div>
        <div id="sbAnswerArea" class="sb-answer-area">
          <span id="sbPlaceholder" style="color:var(--text3);font-size:13px;font-style:italic">Kliknij słowa poniżej aby budować zdanie…</span>
        </div>
        <div style="font-size:12px;color:var(--text3);font-weight:600;text-transform:uppercase;margin:12px 0 6px">Dostępne słowa:</div>
        <div id="sbChipPool" class="sb-chip-pool">
          <div style="text-align:center;padding:20px"><div class="spinner" style="margin:auto"></div><div style="margin-top:8px;color:var(--text3);font-size:12px">Generuję zdanie…</div></div>
        </div>
        <div id="sbFeedback" style="min-height:32px;text-align:center;margin-top:8px;font-size:14px;font-weight:700"></div>
        <div style="display:flex;gap:8px;margin-top:12px">
          <button class="btn btn-outline" style="flex:1" onclick="Exercise.sbClear()">🔄 Wyczyść</button>
          <button class="btn btn-primary" style="flex:2" onclick="Exercise.sbCheck()" id="sbCheckBtn" disabled>✔ Sprawdź</button>
        </div>
        <button class="btn btn-outline" style="margin-top:8px;width:100%;font-size:13px;opacity:0.7" onclick="Exercise.sbSkip()">Pomiń słowo →</button>
      </div>`;

    // Load sentence from Gemini
    const res = await API.get(`/api/gemini/sentence_builder?word=${encodeURIComponent(w.word)}&translation=${encodeURIComponent(w.translation)}`);
    this._sbSentence = res.sentence || '';
    this._sbPool = [...(res.words_scrambled || res.sentence.split(' '))];
    this._sbPlaced = [];
    if (res.translation_pl && !res.translation_pl.startsWith('(offline')) {
      const transEl = document.querySelector('#sbAnswerArea');
      // Show pl translation as hint below the word
      const hint = document.createElement('div');
      hint.style.cssText = 'font-size:12px;color:var(--text3);text-align:center;margin-bottom:8px';
      hint.textContent = '🇵🇱 ' + res.translation_pl;
      transEl?.parentNode?.insertBefore(hint, transEl);
    }
    this._sbRenderPool();
  },

  _sbRenderPool() {
    const poolEl = document.getElementById('sbChipPool');
    const areaEl = document.getElementById('sbAnswerArea');
    const checkBtn = document.getElementById('sbCheckBtn');
    if (!poolEl || !areaEl) return;

    poolEl.innerHTML = this._sbPool.map((w, i) =>
      `<button class="sb-chip" onclick="Exercise.sbSelectWord(${i})">${w}</button>`
    ).join('');

    const placeholderEl = document.getElementById('sbPlaceholder');
    if (this._sbPlaced.length === 0) {
      areaEl.innerHTML = '<span id="sbPlaceholder" style="color:var(--text3);font-size:13px;font-style:italic">Kliknij słowa poniżej aby budować zdanie…</span>';
    } else {
      areaEl.innerHTML = this._sbPlaced.map((w, i) =>
        `<button class="sb-chip sb-chip-placed" onclick="Exercise.sbRemoveWord(${i})">${w}</button>`
      ).join('');
    }

    if (checkBtn) checkBtn.disabled = this._sbPlaced.length < 2;
  },

  sbSelectWord(poolIdx) {
    if (poolIdx < 0 || poolIdx >= this._sbPool.length) return;
    const word = this._sbPool.splice(poolIdx, 1)[0];
    this._sbPlaced.push(word);
    this._sbRenderPool();
  },

  sbRemoveWord(placedIdx) {
    if (placedIdx < 0 || placedIdx >= this._sbPlaced.length) return;
    const word = this._sbPlaced.splice(placedIdx, 1)[0];
    this._sbPool.push(word);
    this._sbRenderPool();
  },

  sbClear() {
    // Move all placed words back to pool
    this._sbPool = [...this._sbPool, ...this._sbPlaced];
    this._sbPlaced = [];
    this._sbRenderPool();
    const fb = document.getElementById('sbFeedback');
    if (fb) fb.textContent = '';
  },

  sbCheck() {
    if (!this._sbSentence) return;
    const userSentence = this._sbPlaced.join(' ').trim();
    const correct = this._sbSentence.trim();
    // Compare ignoring trailing punctuation and case
    const normalize = s => s.toLowerCase().replace(/[.,!?;:]+$/, '').trim();
    const isCorrect = normalize(userSentence) === normalize(correct);

    const fb = document.getElementById('sbFeedback');
    const area = document.getElementById('sbAnswerArea');

    if (isCorrect) {
      this.score++;
      const cardXp = 5;
      this.xpEarned = (this.xpEarned || 0) + cardXp;
      showXP(`+${cardXp} XP`);
      this.setScore();
      if (fb) { fb.textContent = '✅ Świetnie! Zdanie poprawne!'; fb.style.color = 'var(--green)'; }
      if (area) area.style.borderColor = 'var(--green)';
      // Disable chips
      document.querySelectorAll('.sb-chip').forEach(b => b.disabled = true);
      setTimeout(() => { this.idx++; this.renderSentenceBuilder(); }, 1400);
    } else {
      if (fb) {
        fb.innerHTML = `❌ Błąd! Poprawne: <em style="color:var(--text2)">${correct}</em>`;
        fb.style.color = 'var(--red)';
      }
      if (area) { area.style.borderColor = 'var(--red)'; setTimeout(() => { area.style.borderColor = ''; }, 1500); }
    }
  },

  sbSkip() {
    this.idx++;
    this.renderSentenceBuilder();
  },

  showSentenceBuilderResult() {
    const total = this.data.length;
    const pct = total > 0 ? Math.round(this.score / total * 100) : 0;
    const emoji = pct >= 80 ? '🏆' : pct >= 50 ? '👍' : '💪';
    document.getElementById('modalBody').innerHTML = `
      <div style="text-align:center;padding:30px 20px">
        <div style="font-size:52px;margin-bottom:12px">${emoji}</div>
        <h3 style="color:var(--text1);margin-bottom:6px">Ćwiczenie ukończone!</h3>
        <p style="color:var(--text3);font-size:14px;margin-bottom:4px">${this.score}/${total} poprawnych (${pct}%)</p>
        <p style="color:var(--text3);font-size:12px;margin-bottom:16px">+${this.xpEarned} XP zarobione podczas sesji</p>
        <button class="btn btn-primary" style="margin-top:4px;margin-right:8px" onclick="Exercise.start('sentence_builder')">Zagraj ponownie 🔄</button>
        <button class="btn btn-outline" style="margin-top:4px" onclick="Exercise.close()">Zakończ</button>
      </div>`;
  },

  // ─── DAILY FACT ──────────────────────────────────────────────────────────────
  _dfCategory: 'biology',
  _dfFact: null,
  _dfFactNum: 0,
  _dfQuestionNum: 0,
  _dfCorrectThisFact: 0,
  _dfAllResults: [],

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
  async startDialogue() {
    this._dialogueRenderTopicPicker();
  },

  _dialogueRenderTopicPicker() {
    document.getElementById('modalBody').innerHTML = `
      <div style="padding:16px;max-width:500px;margin:0 auto;text-align:center">
        <h3 style="color:var(--text1);margin-bottom:8px;font-size:18px">Wybierz temat rozmowy</h3>
        <p style="color:var(--text3);font-size:13px;margin-bottom:20px">Rozmawiaj na głos z AI, a system oceni Twoją gramatykę i wymowę.</p>
        <div style="display:flex;flex-direction:column;gap:12px;text-align:left">
          <button class="ex-card" style="padding:16px;background:var(--card);text-align:left;width:100%" onclick="Exercise._dialogueInitSession('Kawiarnia')">
            <span style="font-size:24px;margin-right:12px;float:left">☕</span>
            <div style="display:inline-block;vertical-align:middle;width:calc(100% - 40px)">
              <strong style="color:var(--text1);display:block">W Kawiarni (At a Cafe)</strong>
              <span style="color:var(--text3);font-size:12px">Zamawianie jedzenia, napojów, prośba o hasło do Wi-Fi.</span>
            </div>
          </button>
          <button class="ex-card" style="padding:16px;background:var(--card);text-align:left;width:100%" onclick="Exercise._dialogueInitSession('Lotnisko')">
            <span style="font-size:24px;margin-right:12px;float:left">✈️</span>
            <div style="display:inline-block;vertical-align:middle;width:calc(100% - 40px)">
              <strong style="color:var(--text1);display:block">Odprawa na lotnisku (Airport Check-in)</strong>
              <span style="color:var(--text3);font-size:12px">Nadawanie bagażu, pytanie o bramkę, paszport.</span>
            </div>
          </button>
          <button class="ex-card" style="padding:16px;background:var(--card);text-align:left;width:100%" onclick="Exercise._dialogueInitSession('Hotel')">
            <span style="font-size:24px;margin-right:12px;float:left">🏨</span>
            <div style="display:inline-block;vertical-align:middle;width:calc(100% - 40px)">
              <strong style="color:var(--text1);display:block">W Hotelu (At a Hotel)</strong>
              <span style="color:var(--text3);font-size:12px">Zameldowanie, pytanie o udogodnienia i śniadanie.</span>
            </div>
          </button>
          <button class="ex-card" style="padding:16px;background:var(--card);text-align:left;width:100%" onclick="Exercise._dialogueInitSession('Sklep')">
            <span style="font-size:24px;margin-right:12px;float:left">🛍️</span>
            <div style="display:inline-block;vertical-align:middle;width:calc(100% - 40px)">
              <strong style="color:var(--text1);display:block">W Sklepie (Shopping)</strong>
              <span style="color:var(--text3);font-size:12px">Pytanie o rozmiar, przymierzalnię i płatność.</span>
            </div>
          </button>
          <button class="ex-card" style="padding:16px;background:var(--card);text-align:left;width:100%" onclick="Exercise._dialogueInitSession('Praca')">
            <span style="font-size:24px;margin-right:12px;float:left">💼</span>
            <div style="display:inline-block;vertical-align:middle;width:calc(100% - 40px)">
              <strong style="color:var(--text1);display:block">Rozmowa o pracę (Job Interview)</strong>
              <span style="color:var(--text3);font-size:12px">Odpowiadanie na pytania rekrutacyjne o doświadczenie.</span>
            </div>
          </button>
        </div>
      </div>`;
  },

  async _dialogueInitSession(topic) {
    document.getElementById('modalBody').innerHTML = '<div style="text-align:center;padding:40px"><div class="spinner" style="margin:auto"></div><p style="margin-top:12px;color:var(--text3)">AI przygotowuje scenariusz rozmowy...</p></div>';
    try {
      const data = await API.get(`/api/exercise/dialogue/init?topic=${encodeURIComponent(topic)}`);
      this._dialogueTopic = topic;
      this._dialogueGoal = data.goal;
      this._dialogueTargetWords = data.target_words || [];
      this._dialogueExpectedPhrases = data.expected_phrases || [];
      this._dialogueHistory = [{ role: 'bot', text: data.bot_first_msg }];
      this._dialogueTurn = 0;
      this._dialogueMaxTurns = 4;
      this.score = 0;
      this.total = 0; // turns count
      this.xpEarned = 0;
      this.startTime = Date.now();
      
      this._dialogueRenderChat();
      Speech.speak(data.bot_first_msg);
    } catch(e) {
      console.error(e);
      document.getElementById('modalBody').innerHTML = '<div style="text-align:center;padding:20px;color:var(--red)">Błąd inicjalizacji scenariusza. Spróbuj ponownie.</div>';
    }
  },

  _dialogueRenderChat() {
    const wordsHtml = this._dialogueTargetWords.map(w => {
      const used = this._dialogueHistory.some(m => m.role === 'user' && m.text.toLowerCase().includes(w.word.toLowerCase()));
      return `<span class="dialogue-word-pill ${used ? 'dialogue-word-used' : ''}">${w.word} <small>(${w.translation})</small></span>`;
    }).join('');

    const chatHtml = this._dialogueHistory.map(m => {
      const isBot = m.role === 'bot';
      return `
        <div class="chat-msg-wrapper ${isBot ? 'msg-bot' : 'msg-user'}">
          <div class="chat-avatar">${isBot ? '🤖' : '👤'}</div>
          <div class="chat-bubble-container">
            <div class="chat-bubble">${m.text}</div>
            ${m.feedback ? `
              <div class="chat-feedback-box">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:6px">
                  <div style="display:flex;justify-content:space-between;background:var(--bg);padding:4px 8px;border-radius:6px;border:1px solid var(--border)">
                    <span style="color:var(--text3);font-size:10px">Poprawność:</span>
                    <strong style="color:${m.feedback.correctness_score >= 80 ? 'var(--green)' : m.feedback.correctness_score >= 50 ? 'var(--yellow)' : 'var(--red)'};font-size:11px">${m.feedback.correctness_score}/100</strong>
                  </div>
                  <div style="display:flex;justify-content:space-between;background:var(--bg);padding:4px 8px;border-radius:6px;border:1px solid var(--border)">
                    <span style="color:var(--text3);font-size:10px">Użycie słów:</span>
                    <strong style="color:${m.feedback.vocabulary_score > 0 ? (m.feedback.vocabulary_score >= 80 ? 'var(--green)' : 'var(--yellow)') : 'var(--text3)'};font-size:11px">
                      ${m.feedback.vocabulary_score > 0 ? `${m.feedback.vocabulary_score}/100` : '—'}
                    </strong>
                  </div>
                </div>
                <div class="chat-feedback-text">${m.feedback.feedback_pl}</div>
                ${m.feedback.better_version ? `<div class="chat-feedback-better">💡 <em>Lepiej:</em> "${m.feedback.better_version}"</div>` : ''}
                ${m.feedback.xp_earned ? `
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px;padding-top:4px;border-top:1px solid var(--border);font-size:11px;color:var(--green);font-weight:600">
                    <span>Punkty za wypowiedź:</span>
                    <span>+${m.feedback.xp_earned} XP</span>
                  </div>
                ` : ''}
              </div>
            ` : ''}
          </div>
        </div>`;
    }).join('');

    document.getElementById('modalBody').innerHTML = `
      <div class="dialogue-container">
        <div class="dialogue-header">
          <div class="dialogue-goal">🎯 Cel: ${this._dialogueGoal}</div>
          <div class="dialogue-words-row">${wordsHtml}</div>
        </div>
        
        <div class="dialogue-chat-list" id="dialogueChatList">
          ${chatHtml}
        </div>
        
        <div class="dialogue-input-area">
          <div class="dialogue-transcript-box" id="dialogueTranscript"></div>
          <div style="display:flex;gap:12px;align-items:center;justify-content:center;margin-top:8px">
            <button class="dialogue-mic-btn" id="dialogueMicBtn" onclick="Exercise._dialogueToggleListen()">
              🎤
            </button>
            <input type="text" id="dialogueManualInput" class="login-input" style="flex:1;display:none" placeholder="Wpisz odpowiedź ręcznie..." onkeydown="if(event.key==='Enter') Exercise._dialogueSubmitManual()">
            <button class="btn btn-primary" id="dialogueSendBtn" style="display:none" onclick="Exercise._dialogueSubmitReply()">Wyślij ➔</button>
            <button class="btn btn-outline" id="dialogueKeyboardBtn" onclick="Exercise._dialogueToggleKeyboard()">⌨️</button>
          </div>
          <div class="dialogue-status" id="dialogueStatus">Kliknij mikrofon i zacznij mówić po angielsku.</div>
        </div>
      </div>`;

    const chatList = document.getElementById('dialogueChatList');
    if (chatList) chatList.scrollTop = chatList.scrollHeight;
  },

  _dialogueToggleKeyboard() {
    const input = document.getElementById('dialogueManualInput');
    const mic = document.getElementById('dialogueMicBtn');
    const send = document.getElementById('dialogueSendBtn');
    const kbdBtn = document.getElementById('dialogueKeyboardBtn');
    const transcript = document.getElementById('dialogueTranscript');

    if (input.style.display === 'none') {
      input.style.display = 'block';
      mic.style.display = 'none';
      send.style.display = 'block';
      transcript.style.display = 'none';
      kbdBtn.textContent = '🎤';
      input.focus();
    } else {
      input.style.display = 'none';
      mic.style.display = 'flex';
      send.style.display = 'none';
      transcript.style.display = 'block';
      kbdBtn.textContent = '⌨️';
    }
  },

  _dialogueToggleListen() {
    if (this._dialogueListening) {
      this._dialogueStopListening();
    } else {
      this._dialogueStartListening();
    }
  },

  _dialogueStartListening() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      this._dialogueSwitchToKeyboard('Rozpoznawanie mowy niedostępne w tej przeglądarce. Wpisz odpowiedź ręcznie.');
      return;
    }

    this._dialogueListening = true;
    this._dialogueTranscriptAccumulated = '';
    const btn = document.getElementById('dialogueMicBtn');
    const status = document.getElementById('dialogueStatus');
    const transcript = document.getElementById('dialogueTranscript');
    const sendBtn = document.getElementById('dialogueSendBtn');

    if (btn) btn.classList.add('recording');
    if (status) status.innerHTML = '<span class="status-listening">🔴 Słucham... Kliknij mikrofon ponownie, aby zakończyć.</span>';
    if (transcript) transcript.textContent = '';
    if (sendBtn) sendBtn.style.display = 'none';

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const normalize = (str) => {
        return str.toLowerCase()
                  .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "")
                  .replace(/\s+/g, " ")
                  .trim();
      };

      let merged = [];
      for (let i = 0; i < event.results.length; ++i) {
        let transcriptVal = event.results[i][0].transcript.trim();
        if (!transcriptVal) continue;
        
        if (merged.length === 0) {
          merged.push(transcriptVal);
        } else {
          let last = merged[merged.length - 1];
          let normLast = normalize(last);
          let normNew = normalize(transcriptVal);
          
          if (normNew.startsWith(normLast)) {
            // New segment contains the previous one (common on Android Chrome), so replace it
            merged[merged.length - 1] = transcriptVal;
          } else if (normLast.startsWith(normNew)) {
            // Previous segment already contains the new one, so ignore this new one
          } else {
            // Different segment (e.g. desktop Chrome), append it
            merged.push(transcriptVal);
          }
        }
      }

      const text = merged.join(' ').replace(/\s+/g, ' ').trim();
      const fullText = (this._dialogueTranscriptAccumulated + ' ' + text).trim();
      if (transcript) transcript.textContent = fullText;
      this._lastTranscript = fullText;
      
      if (fullText && sendBtn) {
        sendBtn.style.display = 'block';
      }
    };

    recognition.onerror = (event) => {
      console.error(event);
      if (event.error === 'not-allowed') {
        this._dialogueSwitchToKeyboard(
          'Mikrofon zablokowany przez przeglądarkę (brak HTTPS). Wpisz odpowiedź ręcznie poniżej.'
        );
      } else if (event.error !== 'no-speech') {
        if (status) status.textContent = `Błąd mikrofonu: ${event.error}`;
        this._dialogueStopListening();
      }
    };

    recognition.onend = () => {
      if (this._dialogueListening) {
        // Automatic timeout end - restart recognition to keep listening
        if (this._lastTranscript) {
          this._dialogueTranscriptAccumulated = this._lastTranscript;
        }
        setTimeout(() => {
          if (this._dialogueListening && this._recognition) {
            try {
              this._recognition.start();
            } catch(e) {
              console.warn("Failed to restart speech recognition:", e);
            }
          }
        }, 100);
        return;
      }

      this._dialogueListening = false;
      if (btn) btn.classList.remove('recording');
      if (status) {
        if (this._lastTranscript) {
          status.textContent = "Gotowe! Kliknij Wyślij, aby ocenić wypowiedź.";
          if (sendBtn) sendBtn.style.display = 'block';
        } else {
          status.textContent = "Nie usłyszano mowy. Kliknij mikrofon ponownie.";
        }
      }
    };

    this._recognition = recognition;
    this._lastTranscript = '';
    recognition.start();
  },

  _dialogueStopListening() {
    if (this._recognition) {
      try { this._recognition.stop(); } catch(e) {}
    }
    this._dialogueListening = false;
    const btn = document.getElementById('dialogueMicBtn');
    if (btn) btn.classList.remove('recording');
  },

  _dialogueSwitchToKeyboard(message) {
    this._dialogueStopListening();
    const input = document.getElementById('dialogueManualInput');
    const mic = document.getElementById('dialogueMicBtn');
    const send = document.getElementById('dialogueSendBtn');
    const kbdBtn = document.getElementById('dialogueKeyboardBtn');
    const transcript = document.getElementById('dialogueTranscript');
    const status = document.getElementById('dialogueStatus');
    if (input) { input.style.display = 'block'; input.focus(); }
    if (mic) mic.style.display = 'none';
    if (send) send.style.display = 'block';
    if (transcript) transcript.style.display = 'none';
    if (kbdBtn) kbdBtn.textContent = '🎤';
    if (status && message) {
      status.innerHTML = `<span style="color:#f59e0b;font-size:12px">⚠️ ${message}</span>`;
    }
  },

  _dialogueSubmitManual() {
    const input = document.getElementById('dialogueManualInput');
    if (!input || !input.value.trim()) return;
    this._lastTranscript = input.value.trim();
    input.value = '';
    this._dialogueSubmitReply();
  },

  async _dialogueSubmitReply() {
    const text = this._lastTranscript;
    if (!text) return;

    this._dialogueStopListening();
    
    const status = document.getElementById('dialogueStatus');
    const sendBtn = document.getElementById('dialogueSendBtn');
    const micBtn = document.getElementById('dialogueMicBtn');
    const kbdBtn = document.getElementById('dialogueKeyboardBtn');
    const input = document.getElementById('dialogueManualInput');

    if (sendBtn) sendBtn.style.display = 'none';
    if (micBtn) micBtn.disabled = true;
    if (kbdBtn) kbdBtn.disabled = true;
    if (input) input.disabled = true;
    if (status) status.innerHTML = '<div class="spinner spinner-small" style="display:inline-block;vertical-align:middle;margin-right:8px"></div> AI analizuje Twoją wypowiedź...';

    this._dialogueHistory.push({ role: 'user', text: text });
    this.total++;
    this._dialogueRenderChat();

    try {
      const payload = {
        chat_history: this._dialogueHistory.slice(0, -1),
        user_input: text,
        expected_phrases: this._dialogueExpectedPhrases,
        goal: this._dialogueGoal
      };

      const result = await API.post('/api/exercise/dialogue/reply', payload);
      
      const cScore = typeof result.correctness_score === 'number' ? result.correctness_score : result.score;
      const vScore = typeof result.vocabulary_score === 'number' ? result.vocabulary_score : 0;
      
      const correctnessXp = Math.round(cScore / 10); // 0-10 XP
      const vocabXp = vScore > 0 ? Math.round(vScore / 20) : 0; // 0-5 XP
      const turnXp = correctnessXp + vocabXp;
      
      this._dialogueHistory[this._dialogueHistory.length - 1].feedback = {
        score: result.score,
        correctness_score: cScore,
        vocabulary_score: vScore,
        feedback_pl: result.feedback_pl,
        better_version: result.better_version,
        xp_earned: turnXp
      };

      this.score += result.score;
      this.xpEarned += turnXp;
      showXP(`+${turnXp} XP`);

      this._dialogueHistory.push({ role: 'bot', text: result.bot_reply });
      this._dialogueTurn++;

      this._dialogueRenderChat();
      Speech.speak(result.bot_reply);

      if (result.is_goal_achieved || this._dialogueTurn >= this._dialogueMaxTurns) {
        setTimeout(() => this._dialogueShowResult(), 4000);
      } else {
        if (status) status.textContent = "Kliknij mikrofon i odpowiedz botowi.";
        if (micBtn) micBtn.disabled = false;
        if (kbdBtn) kbdBtn.disabled = false;
        if (input) { input.disabled = false; input.style.display = 'none'; }
        if (document.getElementById('dialogueTranscript')) document.getElementById('dialogueTranscript').textContent = '';
      }
    } catch(e) {
      console.error(e);
      if (status) status.innerHTML = '<span style="color:var(--red)">Błąd komunikacji z serwerem.</span>';
      if (micBtn) micBtn.disabled = false;
      if (kbdBtn) kbdBtn.disabled = false;
      if (input) input.disabled = false;
    }
  },

  _dialogueShowResult() {
    const avgScore = this.total > 0 ? Math.round(this.score / this.total) : 0;
    const emoji = avgScore >= 80 ? '🏆' : avgScore >= 55 ? '👍' : '💪';
    
    const userTurns = this._dialogueHistory.filter(m => m.role === 'user' && m.feedback);
    const correctnessSum = userTurns.reduce((acc, m) => acc + (m.feedback.correctness_score || 0), 0);
    const avgCorrectness = userTurns.length > 0 ? Math.round(correctnessSum / userTurns.length) : 0;
    
    const vocabTurns = userTurns.filter(m => m.feedback.vocabulary_score > 0);
    const avgVocabulary = vocabTurns.length > 0 
      ? Math.round(vocabTurns.reduce((acc, m) => acc + m.feedback.vocabulary_score, 0) / vocabTurns.length)
      : 0;

    document.getElementById('modalBody').innerHTML = `
      <div style="text-align:center;padding:30px 20px">
        <div style="font-size:52px;margin-bottom:12px">${emoji}</div>
        <h3 style="color:var(--text1);margin-bottom:6px">Rozmowa zakończona!</h3>
        <p style="color:var(--text3);font-size:14px;margin-bottom:12px">Wypowiedzi: ${this.total} · Średni ogólny wynik: ${avgScore}/100</p>
        
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0">
          <div style="background:var(--card);border-radius:12px;border:1px solid var(--border);padding:12px;text-align:center">
            <span style="color:var(--text3);font-size:11px;display:block;margin-bottom:4px">Średnia poprawność</span>
            <strong style="color:var(--green);font-size:18px">${avgCorrectness}/100</strong>
          </div>
          <div style="background:var(--card);border-radius:12px;border:1px solid var(--border);padding:12px;text-align:center">
            <span style="color:var(--text3);font-size:11px;display:block;margin-bottom:4px">Średnie użycie słów</span>
            <strong style="color:var(--green);font-size:18px">${avgVocabulary > 0 ? `${avgVocabulary}/100` : '—'}</strong>
          </div>
        </div>

        <div style="background:var(--card);border-radius:12px;border:1px solid var(--border);padding:16px;margin:16px 0;text-align:left">
          <strong style="color:var(--text1);display:block;margin-bottom:8px">Podsumowanie AI:</strong>
          <p style="color:var(--text2);font-size:13px;line-height:1.6">
            ${avgScore >= 85 ? 'Świetna płynność i dobór słownictwa! Porozumiewasz się swobodnie.' :
              avgScore >= 60 ? 'Dobra komunikacja. Popracuj nad precyzją wypowiedzi i gramatyką w trudniejszych zdaniach.' :
              'Praca w toku. Staraj się budować prostsze zdania i zwracaj uwagę na wskazówki gramatyczne.'}
          </p>
        </div>

        <p style="color:var(--text3);font-size:13px;margin-bottom:24px">⭐ Zdobyte doświadczenie: <strong style="color:var(--text1)">+${this.xpEarned} XP</strong></p>
        <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
          <button class="btn btn-primary" onclick="Exercise.startDialogue()">Rozpocznij nową 💬</button>
          <button class="btn btn-outline" onclick="Exercise.close()">Zakończ</button>
        </div>
      </div>`;
  },

  async startHandsFree() {


    this.total = 15;
    this.score = 0;
    this.idx = 0;
    this.isPlaying = false;
    
    const currentPool = this._currentHfPool || 'review';
    
    document.getElementById('modalBody').innerHTML = `
      <div style="padding:20px;max-width:400px;margin:0 auto;text-align:center">
        <div style="font-size:60px;margin-bottom:16px">🎧</div>
        <h3 style="font-size:20px;font-weight:700;color:var(--text1);margin-bottom:8px">Audionauka Hands-Free</h3>
        <p style="color:var(--text3);font-size:14px;line-height:1.5;margin-bottom:24px">
          Słuchaj słówek i ich tłumaczeń bez patrzenia na ekran. Tryb idealny podczas jazdy autem, spaceru lub pracy.
        </p>
        
        <div style="text-align:left;margin-bottom:24px">
          <label style="font-size:12px;font-weight:700;color:var(--text3);text-transform:uppercase;display:block;margin-bottom:8px">Wybierz pulę słówek</label>
          <select id="hfWordPool" style="width:100%;padding:12px;border-radius:10px;border:2px solid var(--border);background:var(--card);color:var(--text1);font-size:14px">
            <option value="review" ${currentPool === 'review' ? 'selected' : ''}>Słowa do nauki (Nie znam & Trochę)</option>
            <option value="learned" ${currentPool === 'learned' ? 'selected' : ''}>Słowa wyuczone (Poznałem)</option>
            <option value="all" ${currentPool === 'all' ? 'selected' : ''}>Wszystkie sklasyfikowane słowa</option>
          </select>
        </div>
        
        <button class="btn btn-primary" onclick="Exercise.beginHandsFreePlayback()" style="width:100%;background:linear-gradient(135deg, var(--green), #06b6d4)">Rozpocznij odtwarzanie 🎧</button>
      </div>
    `;
  },

  async beginHandsFreePlayback() {
    const selectEl = document.getElementById('hfWordPool');
    const poolType = selectEl ? selectEl.value : (this._currentHfPool || 'review');
    this._currentHfPool = poolType;

    document.getElementById('modalBody').innerHTML = '<div style="text-align:center;padding:40px"><div class="spinner" style="margin:auto"></div><p style="margin-top:12px;color:var(--text3)">Pobieranie słówek...</p></div>';
    
    let words = [];
    if (poolType === 'review') {
      words = await API.get('/api/exercise/flashcards');
    } else if (poolType === 'learned') {
      words = await API.get('/api/words?status=ZNAM');
    } else {
      words = await API.get('/api/words');
    }
    
    if (!words || !words.length) {
      document.getElementById('modalBody').innerHTML = `
        <div style="padding:20px;text-align:center">
          <div style="font-size:40px;margin-bottom:12px">⚠️</div>
          <p style="color:var(--text2)">Brak słów w wybranej puli!</p>
          <button class="btn btn-primary" style="margin-top:16px" onclick="Exercise.start('hands_free')">Powrót</button>
        </div>
      `;
      return;
    }
    
    // Tasujemy słówka i wybieramy paczkę do 15 sztuk
    this.data = words.sort(() => Math.random() - 0.5).slice(0, 15);
    this.total = this.data.length;
    this.idx = 0;
    this.score = 0;
    this.startTime = Date.now();
    this.isPlaying = true;
    
    await this.requestWakeLock();
    this.startNewHandsFreeLoop();
  },

  changeHandsFreePool(poolVal) {
    this._currentHfPool = poolVal;
    window.speechSynthesis.cancel();
    this.beginHandsFreePlayback();
  },

  async waitPlaying(ms) {
    const step = 100;
    let elapsed = 0;
    while (elapsed < ms) {
      if (!this.isPlaying || this.type !== 'hands_free') {
        throw new Error('paused_or_closed');
      }
      await new Promise(r => setTimeout(r, step));
      elapsed += step;
    }
  },

  startNewHandsFreeLoop() {
    this.hfLoopId = (this.hfLoopId || 0) + 1;
    this.playHandsFreeLoop(this.hfLoopId);
  },

  async playHandsFreeLoop(loopId) {
    if (this.type !== 'hands_free' || !this.isPlaying || this.hfLoopId !== loopId) return;
    if (this.idx >= this.data.length) {
      // Zaliczenie całej sesji (wszystkie poprawne dla celów XP)
      this.score = this.data.length;
      this.releaseWakeLock();
      this.showResult(' (tryb Audionauki)');
      return;
    }
    
    const w = this.data[this.idx];
    this.renderHandsFreeCard(w);
    
    const checkActive = () => {
      if (this.hfLoopId !== loopId || !this.isPlaying || this.type !== 'hands_free') {
        throw new Error('loop_aborted');
      }
    };
    
    try {
      checkActive();
      // 1. Wymów słowo po angielsku
      await Speech.speak(w.word);
      checkActive();
      
      // 2. Pauza na pomyślenie
      const pauseSec = parseFloat(document.getElementById('hfPauseSec')?.value) || 2.5;
      await this.waitPlaying(pauseSec * 1000);
      checkActive();
      
      // 3. Wymów tłumaczenie po polsku
      await Speech.speakPl(w.translation);
      checkActive();
      
      // Pokazujemy tekst tłumaczenia zamiast "🤔 Słuchaj..."
      const transEl = document.getElementById('hfTranslation');
      if (transEl) transEl.textContent = w.translation;
      
      // 4. Zdania przykładowe (jeśli włączone)
      const includeSentences = document.getElementById('hfIncludeSentences')?.checked !== false;
      if (includeSentences) {
        await this.waitPlaying(1200);
        checkActive();
        
        const sentEl = document.getElementById('hfSentence');
        if (sentEl) sentEl.innerHTML = `<span style="color:var(--text3)">⏳ Ładowanie zdania...</span>`;
        
        const res = await API.get(`/api/gemini/sentence?word=${encodeURIComponent(w.word)}&translation=${encodeURIComponent(w.translation)}`);
        checkActive();
        
        if (sentEl) {
          sentEl.innerHTML = `
            <div style="color:var(--text1)"><em>${res.sentence}</em></div>
            <div style="color:var(--text3);font-size:14px;margin-top:4px">${res.sentence_pl}</div>
          `;
        }
        
        // Powiedz zdanie angielskie
        await Speech.speak(res.sentence);
        checkActive();
        
        await this.waitPlaying(1500);
        checkActive();
        // Powiedz zdanie polskie
        await Speech.speakPl(res.sentence_pl);
        checkActive();
      }
      
      // 5. Pauza przejściowa do kolejnego słowa
      await this.waitPlaying(2200);
      checkActive();
      
      // 6. Następne słowo
      this.idx++;
      this.playHandsFreeLoop(loopId);
    } catch (err) {
      if (err.message === 'loop_aborted' || err.message === 'paused_or_closed') {
        console.log('Odtwarzanie wstrzymane lub przerwane nową akcją.');
      } else {
        console.error(err);
      }
    }
  },

  toggleHandsFreePlay() {
    this.isPlaying = !this.isPlaying;
    const playBtn = document.getElementById('hfPlayBtn');
    if (playBtn) playBtn.innerHTML = this.isPlaying ? '⏸️' : '▶️';
    if (!this.isPlaying) {
      window.speechSynthesis.cancel();
      this.releaseWakeLock();
    } else {
      this.requestWakeLock();
      this.startNewHandsFreeLoop();
    }
  },

  handsFreeNext() {
    window.speechSynthesis.cancel();
    this.idx = Math.min(this.idx + 1, this.data.length);
    this.isPlaying = true;
    this.startNewHandsFreeLoop();
  },

  handsFreePrev() {
    window.speechSynthesis.cancel();
    this.idx = Math.max(this.idx - 1, 0);
    this.isPlaying = true;
    this.startNewHandsFreeLoop();
  },

  // Wake Lock / NoSleep fallback
  wakeLock: null,
  noSleepVideo: null,

  async requestWakeLock() {
    // 1. Spróbuj użyć oficjalnego Wake Lock API (działa na localhost oraz HTTPS)
    try {
      if ('wakeLock' in navigator) {
        this.wakeLock = await navigator.wakeLock.request('screen');
        console.log('Oficjalny Wake Lock aktywowany (HTTPS/localhost).');
        return;
      }
    } catch (err) {
      console.warn('Nie udało się aktywować oficjalnego Wake Lock:', err);
    }

    // 2. Fallback na odtwarzanie niewidocznego wideo w pętli (działa na HTTP / IP sieci lokalnej)
    console.log('Aktywuję fallback wideo (NoSleep) dla HTTP...');
    if (!this.noSleepVideo) {
      const v = document.createElement('video');
      v.setAttribute('loop', 'true');
      v.setAttribute('muted', 'true');
      v.setAttribute('playsinline', 'true');
      v.setAttribute('webkit-playsinline', 'true');
      v.style.position = 'absolute';
      v.style.width = '1px';
      v.style.height = '1px';
      v.style.opacity = '0.01';
      v.style.pointerEvents = 'none';
      v.src = 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAr9tZGF0AAACoAYF//+///AAAAMmF2Y0MBZAAK/+EAGWdkAAqs2V+WXAWyAAADAAIAAAMAYB4kSywBAAZo6+PLIsAAAAAYc3R0cwAAAAAAAAABAAAAAQAAAgAAAAAcc3RzYwAAAAAAAAABAAAAAQAAAAEAAAABAAAAFHN0c3oAAAAAAAACtwAAAAEAAAAUc3RjbwAAAAAAAAABAAAAMAAAAGJ1ZHRhAAAAWm1ldGEAAAAAAAAAIWhkbHIAAAAAAAAAAG1kaXJhcHBsAAAAAAAAAAAAAAAALWlsc3QAAAAlqXRvbwAAAB1kYXRhAAAAAQAAAABMYXZmNTQuNjMuMTA0';
      document.body.appendChild(v);
      this.noSleepVideo = v;
    }
    
    try {
      await this.noSleepVideo.play();
      console.log('Niewidoczne wideo NoSleep odtwarza się w pętli.');
    } catch (e) {
      console.warn('Błąd odtwarzania wideo NoSleep:', e);
    }
  },

  releaseWakeLock() {
    // 1. Zwolnij oficjalny Wake Lock
    if (this.wakeLock) {
      this.wakeLock.release().then(() => {
        this.wakeLock = null;
        console.log('Oficjalny Wake Lock zwolniony.');
      }).catch(err => {
        console.warn('Błąd zwalniania Wake Lock:', err);
      });
    }

    // 2. Zatrzymaj wideo NoSleep
    if (this.noSleepVideo) {
      try {
        this.noSleepVideo.pause();
        console.log('Wideo NoSleep zatrzymane.');
      } catch (e) {
        console.warn('Błąd zatrzymywania wideo NoSleep:', e);
      }
    }
  },

  renderHandsFreeCard(w) {
    const pct = Math.round((this.idx / this.data.length) * 100);
    document.getElementById('modalBody').innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;text-align:center;min-height:350px">
        <div style="font-size:13px;color:var(--text3);margin-bottom:16px">${this.idx + 1} z ${this.data.length} słówek</div>
        <div class="progress-bar-wrap" style="width:100%;max-width:300px;margin-bottom:30px">
          <div class="progress-bar-fill" style="width:${pct}%"></div>
        </div>
        
        <div id="hfWord" style="font-size:38px;font-weight:800;color:var(--text1);margin-bottom:8px;word-break:break-word">${w.word}</div>
        <div id="hfTranslation" style="font-size:22px;color:var(--text2);margin-bottom:24px">🤔 Słuchaj...</div>
        
        <div id="hfSentence" style="min-height:60px;max-width:400px;margin:20px 0;text-align:center;padding:12px;background:rgba(255,255,255,0.03);border-radius:12px;border:1px solid var(--border);width:100%">
          <span style="color:var(--text3);font-size:14px">Zdanie przykładowe pojawi się automatycznie</span>
        </div>
        
        <div style="display:flex;align-items:center;gap:20px;margin:24px 0">
          <button class="btn btn-outline" style="width:60px;height:60px;border-radius:50%;padding:0;font-size:20px;display:flex;align-items:center;justify-content:center" onclick="Exercise.handsFreePrev()">⏮️</button>
          <button id="hfPlayBtn" class="btn btn-primary" style="width:74px;height:74px;border-radius:50%;padding:0;font-size:28px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg, var(--green), #06b6d4)" onclick="Exercise.toggleHandsFreePlay()">${this.isPlaying ? '⏸️' : '▶️'}</button>
          <button class="btn btn-outline" style="width:60px;height:60px;border-radius:50%;padding:0;font-size:20px;display:flex;align-items:center;justify-content:center" onclick="Exercise.handsFreeNext()">⏭️</button>
        </div>
        
        <div style="width:100%;max-width:320px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:14px;padding:16px;margin-top:16px;text-align:left">
          <div style="font-size:12px;font-weight:700;color:var(--text3);margin-bottom:12px;text-transform:uppercase;letter-spacing:1px">Ustawienia Audionauki</div>
          
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <label style="font-size:13px;color:var(--text2)">Pula słówek</label>
            <select id="hfActiveWordPool" onchange="Exercise.changeHandsFreePool(this.value)" style="width:130px;padding:6px;border-radius:8px;border:1px solid var(--border);background:var(--card);color:var(--text1);font-size:12px">
              <option value="review" ${this._currentHfPool === 'review' ? 'selected' : ''}>Do nauki</option>
              <option value="learned" ${this._currentHfPool === 'learned' ? 'selected' : ''}>Poznane</option>
              <option value="all" ${this._currentHfPool === 'all' ? 'selected' : ''}>Wszystkie</option>
            </select>
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <label style="font-size:13px;color:var(--text2)">Pauza na odpowiedź</label>
            <div style="display:flex;align-items:center;gap:6px">
              <input type="range" id="hfPauseSec" min="1.5" max="5.0" step="0.5" value="2.5" oninput="document.getElementById('hfPauseVal').textContent = this.value + 's'" style="width:80px">
              <span id="hfPauseVal" style="font-size:13px;color:var(--text1);min-width:30px;text-align:right">2.5s</span>
            </div>
          </div>
          
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <label style="font-size:13px;color:var(--text2)">Generuj zdania przez AI</label>
            <input type="checkbox" id="hfGeminiEnabled" ${localStorage.getItem('gemini_api_enabled') !== 'false' ? 'checked' : ''} onchange="localStorage.setItem('gemini_api_enabled', this.checked ? 'true' : 'false')" style="width:20px;height:20px;cursor:pointer">
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center">
            <label style="font-size:13px;color:var(--text2)">Czytaj zdania przykładowe</label>
            <input type="checkbox" id="hfIncludeSentences" checked style="width:20px;height:20px;cursor:pointer">
          </div>
        </div>
      </div>
    `;
  }
});

/* ────────────────────────────────────────────────
   HOME MODULE
   ──────────────────────────────────────────────── */
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
          return `<div class="quest-card ${isDone ? 'quest-done' : ''}">
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

  tutDone() {
    localStorage.setItem('tutorial_v1_done', '1');
    const ov = document.getElementById('tutorialOverlay');
    if (ov) { ov.style.opacity = '0'; setTimeout(() => ov.classList.add('hidden'), 300); }
  },

  async startRpgAdventure() {
    this.score = 0;
    this.xpEarned = 0;
    this.total = 5;
    this.startTime = Date.now();
    this._rpgStage = 1;
    this._rpgHearts = 3;
    this._rpgPreviousStory = "";
    this._rpgTheme = null;
    this._rpgTargetWord = null;
    this._rpgStepData = null;
    this.setScore();
    this._rpgRenderThemePicker();
  },

  _rpgRenderThemePicker() {
    const themes = [
      { key: "Space Odyssey", icon: "🚀", name: "Odyseja kosmiczna", desc: "Zasoby kosmiczne, anomalie, obcy i walka o przetrwanie." },
      { key: "Fantasy Kingdom", icon: "🧙‍♂️", name: "Królestwo fantasy", desc: "Magiczne stwory, smoki, elfy i zamkowe lochy." },
      { key: "Detective Mystery", icon: "🕵️‍♂️", name: "Zagadka kryminalna", desc: "Śledztwo, wskazówki, podejrzani i szukanie sprawcy." },
      { key: "Zombie Apocalypse", icon: "🧟‍♂️", name: "Apokalipsa zombie", desc: "Barykady, racje żywnościowe, hordy umarlaków." },
      { key: "Primeval Man", icon: "🍖", name: "Człowiek pierwotny", desc: "Ogień, mamuty, pierwsze narzędzia i jaskinie." },
      { key: "Dinosaurs Era", icon: "🦖", name: "Era dinozaurów", desc: "Welociraptory, T-Rex, ucieczka przez prehistoryczną dżunglę." }
    ];

    document.getElementById('modalBody').innerHTML = `
      <div style="padding:20px;text-align:center;max-width:440px;margin:0 auto">
        <div style="font-size:44px;margin-bottom:8px">⚔️</div>
        <h3 style="color:var(--text1);margin-bottom:6px;font-size:18px">Przygoda RPG z AI</h3>
        <p style="color:var(--text3);font-size:13px;line-height:1.5;margin-bottom:20px">
          Przeżyj 5-etapową historię RPG. Podejmuj decyzje, które testują Twoją znajomość słówek. Masz 3 serduszka — każda błędna odpowiedź kosztuje jedno!
        </p>
        <div style="font-size:12px;color:var(--text3);font-weight:700;text-transform:uppercase;margin-bottom:10px">Wybierz motyw przygody:</div>
        <div class="rpg-theme-grid">
          ${themes.map(t => `
            <button class="rpg-theme-btn" onclick="Exercise._rpgSelectTheme('${t.key}')">
              <span class="rpg-theme-icon">${t.icon}</span>
              <span class="rpg-theme-name">${t.name}</span>
            </button>
          `).join('')}
        </div>
      </div>`;
  },

  async _rpgSelectTheme(theme) {
    this._rpgTheme = theme;
    document.getElementById('modalBody').innerHTML = `
      <div style="text-align:center;padding:60px 20px">
        <div class="spinner" style="margin:auto"></div>
        <p style="color:var(--text3);margin-top:16px;font-size:14px">Wczytywanie słówek do przygody…</p>
      </div>`;
    
    const words = await API.get('/api/exercise/multiple_choice?n=5');
    if (!words || !words.length) {
      document.getElementById('modalBody').innerHTML = `
        <div style="text-align:center;padding:30px 20px">
          <p style="color:var(--text3);margin-bottom:20px">Brak słów do ćwiczenia. Sklasyfikuj więcej słów w zakładce klasyfikacji!</p>
          <button class="btn btn-primary" onclick="Exercise.close()">Zamknij</button>
        </div>`;
      return;
    }

    let gameWords = [...words];
    const defaultWords = [
      { word: "adventure", translation: "przygoda" },
      { word: "courage", translation: "odwaga" },
      { word: "survive", translation: "przetrwać" },
      { word: "explore", translation: "eksplorować" },
      { word: "discover", translation: "odkryć" }
    ];
    while (gameWords.length < 5) {
      const pad = defaultWords[gameWords.length % defaultWords.length];
      gameWords.push(pad);
    }
    this.data = gameWords.slice(0, 5);
    this._rpgStage = 1;
    this._rpgHearts = 3;
    this._rpgPreviousStory = "";
    
    await this._rpgLoadStage();
  },

  async _rpgLoadStage() {
    document.getElementById('modalBody').innerHTML = `
      <div style="text-align:center;padding:60px 20px">
        <div class="spinner" style="margin:auto"></div>
        <p style="color:var(--text3);margin-top:16px;font-size:14px">🧠 Gemini generuje etap ${this._rpgStage}/5…</p>
      </div>`;
    
    const w = this.data[this._rpgStage - 1];
    const res = await API.post('/api/gemini/rpg_adventure', {
      theme: this._rpgTheme,
      stage: this._rpgStage,
      previous_story: this._rpgPreviousStory,
      word: w.word,
      translation: w.translation
    });

    if (!res || res.error) {
      document.getElementById('modalBody').innerHTML = `
        <div style="text-align:center;padding:30px 20px">
          <p style="color:var(--red);margin-bottom:20px">Błąd: ${res?.error || 'Brak odpowiedzi'}</p>
          <button class="btn btn-primary" onclick="Exercise.close()">Zamknij</button>
        </div>`;
      return;
    }

    this._rpgStepData = res;
    this._rpgRenderStage();
  },

  _rpgRenderStage() {
    const step = this._rpgStepData;
    const w = this.data[this._rpgStage - 1];
    
    // Serca
    let heartsHtml = "";
    for (let i = 0; i < 3; i++) {
      if (i < this._rpgHearts) {
        heartsHtml += `<span class="rpg-heart" style="display:inline-block">❤️</span>`;
      } else {
        heartsHtml += `<span style="font-size:18px;opacity:0.3;display:inline-block">🖤</span>`;
      }
    }

    // Wyróżnienie słowa w tekście angielskim
    let storyHtml = step.story || "";
    storyHtml = storyHtml.replace(/\*\*([^*]+)\*\*/g, '<strong style="color:#c084fc;font-size:16px">$1</strong>');

    document.getElementById('modalBody').innerHTML = `
      <div style="padding:16px 12px;max-width:440px;margin:0 auto">
        <div class="rpg-status-bar">
          <span class="rpg-stage-indicator">Etap ${this._rpgStage} z 5</span>
          <div class="rpg-hearts-container">${heartsHtml}</div>
        </div>

        <div style="background:rgba(124, 58, 237, 0.08);border:1px solid rgba(124, 58, 237, 0.25);border-radius:12px;padding:10px 14px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-size:10px;font-weight:800;color:#a78bfa;text-transform:uppercase;letter-spacing:1px">Słowo kluczowe</div>
            <div style="font-size:16px;font-weight:900;color:#ffffff">${w.word}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:10px;font-weight:800;color:var(--text3);text-transform:uppercase;letter-spacing:1px">Tłumaczenie</div>
            <div style="font-size:14px;font-weight:700;color:#c084fc">${w.translation}</div>
          </div>
        </div>

        <div class="rpg-story-card">
          <div class="rpg-story-title">Historia</div>
          <div style="color:#ffffff;line-height:1.75">${storyHtml}</div>
          ${step.story_pl ? `<div class="rpg-story-pl">${step.story_pl}</div>` : ''}
        </div>

        <div style="font-size:12px;color:var(--text3);font-weight:700;text-transform:uppercase;margin:12px 0 6px">Co robisz?</div>
        <div class="rpg-choices-list">
          ${step.choices.map((c, idx) => `
            <button class="rpg-choice-btn" id="rpgChoiceBtn_${idx}" onclick="Exercise._rpgSelectChoice(${idx})">
              <span class="rpg-choice-text">${c.text}</span>
              <span class="rpg-choice-pl">${c.text_pl || ''}</span>
            </button>
          `).join('')}
        </div>
        <div id="rpgFeedback" style="margin-top:12px"></div>
      </div>`;
  },

  _rpgSelectChoice(choiceIdx) {
    const step = this._rpgStepData;
    const choice = step.choices[choiceIdx];
    const feedbackEl = document.getElementById('rpgFeedback');
    if (!feedbackEl) return;

    // Zablokuj klikniętą opcję (albo wszystkie jeśli poprawna)
    if (choice.is_correct) {
      // Wyłącz wszystkie
      step.choices.forEach((_, i) => {
        const btn = document.getElementById(`rpgChoiceBtn_${i}`);
        if (btn) btn.disabled = true;
      });
      
      const choiceBtn = document.getElementById(`rpgChoiceBtn_${choiceIdx}`);
      if (choiceBtn) choiceBtn.classList.add('rpg-choice-correct');

      this.score++;
      this.xpEarned += 10;
      this.setScore();

      feedbackEl.innerHTML = `
        <div class="rpg-feedback-alert" style="background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.3);color:var(--green)">
          <span style="font-size:20px">💚</span>
          <div>
            <strong>Dobry wybór!</strong> ${choice.effect || "Ruszacie dalej!"}
          </div>
        </div>
        <button class="btn btn-primary" style="width:100%;margin-top:10px;padding:14px" onclick="Exercise._rpgNext(${choiceIdx})">
          Kontynuuj przygodę →
        </button>`;
    } else {
      // Błędna odpowiedź
      const choiceBtn = document.getElementById(`rpgChoiceBtn_${choiceIdx}`);
      if (choiceBtn) {
        choiceBtn.classList.add('rpg-choice-wrong');
        choiceBtn.disabled = true;
      }

      this._rpgHearts--;
      
      // Odśwież serduszka w status barze
      let heartsHtml = "";
      for (let i = 0; i < 3; i++) {
        if (i < this._rpgHearts) {
          heartsHtml += `<span class="rpg-heart" style="display:inline-block">❤️</span>`;
        } else {
          heartsHtml += `<span style="font-size:18px;opacity:0.3;display:inline-block">🖤</span>`;
        }
      }
      const container = document.querySelector('.rpg-hearts-container');
      if (container) container.innerHTML = heartsHtml;

      if (this._rpgHearts <= 0) {
        // Wszystkie przyciski wyłączone
        step.choices.forEach((_, i) => {
          const btn = document.getElementById(`rpgChoiceBtn_${i}`);
          if (btn) btn.disabled = true;
        });

        feedbackEl.innerHTML = `
          <div class="rpg-feedback-alert" style="background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.3);color:var(--red)">
            <span style="font-size:20px">☠️</span>
            <div>
              <strong>Koniec gry!</strong> ${choice.effect || "Straciłeś ostatnie serduszko."}
            </div>
          </div>
          <button class="btn btn-primary" style="width:100%;margin-top:10px;padding:14px" onclick="Exercise._rpgShowResult(false)">
            Pokaż podsumowanie 💀
          </button>`;
      } else {
        feedbackEl.innerHTML = `
          <div class="rpg-feedback-alert" style="background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.3);color:var(--red)">
            <span style="font-size:20px">💔</span>
            <div>
              <strong>Błędna decyzja!</strong> ${choice.effect || "Tracisz serduszko."} Wybierz inną akcję!
            </div>
          </div>`;
      }
    }
  },

  async _rpgNext(correctChoiceIdx) {
    const step = this._rpgStepData;
    const choice = step.choices[correctChoiceIdx];
    
    // Zapisz historię dla Gemini
    this._rpgPreviousStory += `\nNarrative: ${step.story}\nAction: ${choice.text}\nResult: Success.`;
    
    this._rpgStage++;
    if (this._rpgStage > 5) {
      this._rpgShowResult(true);
    } else {
      await this._rpgLoadStage();
    }
  },

  _rpgShowResult(victory) {
    const pct = Math.round(this.score / 5 * 100);
    const emoji = victory ? '👑' : '💀';
    const title = victory ? 'Przygoda ukończona pomyślnie!' : 'Zginąłeś w głębinach przygody!';
    const desc = victory 
      ? `Brawo! Pokonałeś wszystkie niebezpieczeństwa i pomyślnie doprowadziłeś historię do końca (${this.score}/5 poprawnych).`
      : `Straciłeś wszystkie serduszka na etapie ${this._rpgStage} z 5. Spróbuj jeszcze raz!`;

    document.getElementById('modalBody').innerHTML = `
      <div style="text-align:center;padding:30px 20px;max-width:400px;margin:0 auto">
        <div style="font-size:64px;margin-bottom:16px;filter:drop-shadow(0 4px 10px rgba(0,0,0,0.3))">${emoji}</div>
        <h3 style="color:var(--text1);margin-bottom:8px;font-size:18px">${title}</h3>
        <p style="color:var(--text3);font-size:13.5px;line-height:1.5;margin-bottom:20px">${desc}</p>
        
        <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:16px;padding:16px;margin-bottom:24px;display:flex;justify-content:space-around">
          <div>
            <div style="font-size:10px;font-weight:800;color:var(--text3);text-transform:uppercase;margin-bottom:4px">Poprawne akcje</div>
            <div style="font-size:24px;font-weight:900;color:#ffffff">${this.score}/5</div>
          </div>
          <div style="border-left:1px solid var(--border)"></div>
          <div>
            <div style="font-size:10px;font-weight:800;color:var(--text3);text-transform:uppercase;margin-bottom:4px">Zdobyte doświadczenie</div>
            <div style="font-size:24px;font-weight:900;color:var(--accent)">+${this.xpEarned} XP</div>
          </div>
        </div>

        <div style="display:flex;gap:10px;justify-content:center">
          <button class="btn btn-primary" style="flex:1;padding:12px" onclick="Exercise.startRpgAdventure()">
            Graj ponownie 🔄
          </button>
          <button class="btn btn-outline" style="flex:1;padding:12px" onclick="Exercise.close()">
            Zakończ
          </button>
        </div>
      </div>`;
  },

  tutDone() {
    localStorage.setItem('tutorial_v1_done', '1');
    const ov = document.getElementById('tutorialOverlay');
    if (ov) { ov.style.opacity = '0'; setTimeout(() => ov.classList.add('hidden'), 300); }
  }
};

// Automatyczne odnawianie Wake Locka po powrocie do widocznej karty
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible' && Exercise.type === 'hands_free' && Exercise.isPlaying) {
    await Exercise.requestWakeLock();
  }
});
