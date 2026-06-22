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
};
