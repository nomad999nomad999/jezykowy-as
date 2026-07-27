Object.assign(Exercise, {
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
});
