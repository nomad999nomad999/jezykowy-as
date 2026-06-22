Object.assign(Exercise, {
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

});
