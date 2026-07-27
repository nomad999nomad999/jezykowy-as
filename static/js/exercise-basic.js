Object.assign(Exercise, {
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

});
