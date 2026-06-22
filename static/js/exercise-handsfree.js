Object.assign(Exercise, {
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
