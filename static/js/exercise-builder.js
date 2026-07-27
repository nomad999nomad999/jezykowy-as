Object.assign(Exercise, {

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
  }
});
