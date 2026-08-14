Object.assign(Exercise, {
  /* ── AI DEBATE SIMULATOR (DEBATE IT!) ── */
  async startDebate() {
    this._debateRenderTopicPicker();
  },

  _debateRenderTopicPicker() {
    document.getElementById('modalBody').innerHTML = `
      <div style="padding:16px;max-width:520px;margin:0 auto;text-align:center">
        <div style="font-size:42px;margin-bottom:8px">⚖️</div>
        <h3 style="color:var(--text1);margin-bottom:6px;font-size:20px">Debate It! — Debata z AI</h3>
        <p style="color:var(--text3);font-size:13px;margin-bottom:20px">Wybierz kontrowersyjny temat. AI przyjmie przeciwne stanowisko i sprawdzi Twoją retorykę oraz angielski!</p>
        
        <div style="display:flex;flex-direction:column;gap:10px;text-align:left;margin-bottom:20px">
          <button class="ex-card" style="padding:14px;background:linear-gradient(135deg, rgba(245, 158, 11, 0.18), rgba(168, 85, 247, 0.18));border:1px solid var(--amber);text-align:left;width:100%" onclick="Exercise._debateInitSession('Random', 'RANDOM')">
            <span style="font-size:22px;margin-right:12px;float:left">🔥</span>
            <div style="display:inline-block;vertical-align:middle;width:calc(100% - 40px)">
              <strong style="color:var(--text1);display:block">Losowa Gorąca Debata (AI Choice)</strong>
              <span style="color:var(--amber);font-size:12px">AI wygeneruje losowy gorący temat sporu społecznego lub naukowego.</span>
            </div>
          </button>
          
          <button class="ex-card" style="padding:14px;background:var(--card);text-align:left;width:100%" onclick="Exercise._debateInitSession('Is Remote Work Better Than Working in an Office?', 'FOR')">
            <span style="font-size:22px;margin-right:12px;float:left">💻</span>
            <div style="display:inline-block;vertical-align:middle;width:calc(100% - 40px)">
              <strong style="color:var(--text1);display:block">Is Remote Work Better Than Office Work?</strong>
              <span style="color:var(--text3);font-size:12px">Praca z domu vs biuro — kultura firmy, produktywność, koszty.</span>
            </div>
          </button>

          <button class="ex-card" style="padding:14px;background:var(--card);text-align:left;width:100%" onclick="Exercise._debateInitSession('Should Artificial Intelligence Be Strictly Regulated?', 'FOR')">
            <span style="font-size:22px;margin-right:12px;float:left">🤖</span>
            <div style="display:inline-block;vertical-align:middle;width:calc(100% - 40px)">
              <strong style="color:var(--text1);display:block">Should AI Be Strictly Regulated?</strong>
              <span style="color:var(--text3);font-size:12px">Bezpieczeństwo AI, etyka, zastępowanie miejsc pracy vs innowacje.</span>
            </div>
          </button>

          <button class="ex-card" style="padding:14px;background:var(--card);text-align:left;width:100%" onclick="Exercise._debateInitSession('Are Social Media Harmful to Young People?', 'FOR')">
            <span style="font-size:22px;margin-right:12px;float:left">📱</span>
            <div style="display:inline-block;vertical-align:middle;width:calc(100% - 40px)">
              <strong style="color:var(--text1);display:block">Are Social Media Harmful to Youth?</strong>
              <span style="color:var(--text3);font-size:12px">Wpływ na psychikę, relacje i koncentrację vs cyfrowy rozwój.</span>
            </div>
          </button>

          <button class="ex-card" style="padding:14px;background:var(--card);text-align:left;width:100%" onclick="Exercise._debateInitSession('Should Cities Completely Ban Petrol and Diesel Cars?', 'FOR')">
            <span style="font-size:22px;margin-right:12px;float:left">🚗</span>
            <div style="display:inline-block;vertical-align:middle;width:calc(100% - 40px)">
              <strong style="color:var(--text1);display:block">Should Cities Ban Petrol & Diesel Cars?</strong>
              <span style="color:var(--text3);font-size:12px">Ekologia i czyste powietrze vs swoboda przemieszczania się.</span>
            </div>
          </button>
        </div>
      </div>`;
  },

  async _debateInitSession(topic, stance = 'FOR') {
    document.getElementById('modalBody').innerHTML = `
      <div style="text-align:center;padding:40px">
        <div class="spinner" style="margin:auto"></div>
        <p style="margin-top:14px;color:var(--text3)">⚖️ AI przygotowuje swoje stanowisko i kontrargumenty...</p>
      </div>`;

    try {
      const data = await API.get(`/api/exercise/debate/init?topic=${encodeURIComponent(topic)}&stance=${encodeURIComponent(stance)}`);
      this._debateTopic = data.topic || topic;
      this._debateAiStance = data.ai_stance || "Anti Stance";
      this._debateKeyVocab = data.key_vocab || [];
      this._debateHistory = [{ role: 'bot', text: data.ai_opening_en, text_pl: data.ai_opening_pl }];
      this._debateTurn = 1;
      this._debateMaxTurns = 3;
      this.score = 0;
      this.total = 0;
      this.xpEarned = 0;
      this.startTime = Date.now();

      this._debateRenderChat();
      if (data.ai_opening_en) Speech.speak(data.ai_opening_en);
    } catch(e) {
      console.error(e);
      document.getElementById('modalBody').innerHTML = '<div style="text-align:center;padding:20px;color:var(--red)">Błąd inicjalizacji debaty. Spróbuj ponownie.</div>';
    }
  },

  _debateRenderChat() {
    const vocabHtml = this._debateKeyVocab.map(v => {
      const used = this._debateHistory.some(m => m.role === 'user' && m.text.toLowerCase().includes(v.word.toLowerCase()));
      return `<span class="dialogue-word-pill ${used ? 'dialogue-word-used' : ''}">${v.word} <small>(${v.translation})</small></span>`;
    }).join('');

    const chatHtml = this._debateHistory.map(m => {
      const isBot = m.role === 'bot';
      return `
        <div class="chat-msg-wrapper ${isBot ? 'msg-bot' : 'msg-user'}">
          <div class="chat-avatar">${isBot ? '⚖️' : '👤'}</div>
          <div class="chat-bubble-container">
            <div class="chat-bubble">
              ${m.text}
              ${m.text_pl ? `<div style="font-size:11px;color:var(--text3);margin-top:6px;border-top:1px dashed var(--border);padding-top:4px">🇵🇱 ${m.text_pl}</div>` : ''}
            </div>
            ${m.feedback ? `
              <div class="chat-feedback-box" style="border-left:3px solid var(--amber)">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                  <span style="color:var(--text3);font-size:11px">Ocena retoryki i języka:</span>
                  <strong style="color:${m.feedback.score >= 80 ? 'var(--green)' : 'var(--yellow)'};font-size:12px">${m.feedback.score}/100</strong>
                </div>
                <div class="chat-feedback-text">${m.feedback.feedback_pl}</div>
                ${m.feedback.xp_earned ? `
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px;padding-top:4px;border-top:1px solid var(--border);font-size:11px;color:var(--green);font-weight:600">
                    <span>Punkty za ripostę:</span>
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
        <div class="dialogue-header" style="background:linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(168, 85, 247, 0.1));border-color:rgba(245, 158, 11, 0.3)">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <strong style="color:var(--text1);font-size:13px">⚖️ ${this._debateTopic}</strong>
            <span style="font-size:10px;padding:2px 8px;border-radius:10px;background:var(--amber-dim);color:var(--amber);font-weight:600">Runda ${this._debateTurn}/${this._debateMaxTurns}</span>
          </div>
          <div style="font-size:11px;color:var(--text3)">Słownictwo do wykorzystania w debacie:</div>
          <div class="dialogue-words-row" style="margin-top:4px">${vocabHtml || '—'}</div>
        </div>

        <div class="dialogue-chat-list" id="debateChatList">
          ${chatHtml}
        </div>

        <div class="dialogue-input-area">
          <div class="dialogue-transcript-box" id="debateTranscript"></div>
          <div style="display:flex;gap:12px;align-items:center;justify-content:center;margin-top:8px">
            <button class="dialogue-mic-btn" id="debateMicBtn" onclick="Exercise._debateToggleListen()">
              🎤
            </button>
            <input type="text" id="debateManualInput" class="login-input" style="flex:1;display:none" placeholder="Wpisz swój argument/ripostę po angielsku..." onkeydown="if(event.key==='Enter') Exercise._debateSubmitManual()">
            <button class="btn btn-primary" id="debateSendBtn" style="display:none" onclick="Exercise._debateSubmitReply()">Ripostuj ➔</button>
            <button class="btn btn-outline" id="debateKeyboardBtn" onclick="Exercise._debateToggleKeyboard()">⌨️</button>
          </div>
          <div class="dialogue-status" id="debateStatus">Kliknij mikrofon lub klawiaturę i przedstaw swój argument!</div>
        </div>
      </div>`;

    const chatList = document.getElementById('debateChatList');
    if (chatList) chatList.scrollTop = chatList.scrollHeight;
  },

  _debateToggleKeyboard() {
    const input = document.getElementById('debateManualInput');
    const mic = document.getElementById('debateMicBtn');
    const send = document.getElementById('debateSendBtn');
    const kbdBtn = document.getElementById('debateKeyboardBtn');
    const transcript = document.getElementById('debateTranscript');

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

  _debateToggleListen() {
    if (this._debateListening) {
      this._debateStopListening();
    } else {
      this._debateStartListening();
    }
  },

  _debateStartListening() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      this._debateSwitchToKeyboard('Rozpoznawanie mowy niedostępne w tej przeglądarce. Wpisz argument ręcznie.');
      return;
    }

    this._debateListening = true;
    this._debateTranscriptAccumulated = '';
    const btn = document.getElementById('debateMicBtn');
    const status = document.getElementById('debateStatus');
    const transcript = document.getElementById('debateTranscript');
    const sendBtn = document.getElementById('debateSendBtn');

    if (btn) btn.classList.add('recording');
    if (status) status.innerHTML = '<span class="status-listening">🔴 Słucham argumentu... Kliknij mikrofon powtórnie, by zakończyć.</span>';
    if (transcript) transcript.textContent = '';
    if (sendBtn) sendBtn.style.display = 'none';

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.lang = 'en-US';
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let text = '';
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i][0].transcript + ' ';
      }
      text = text.trim();
      if (transcript) transcript.textContent = text;
      this._lastDebateTranscript = text;
      if (text && sendBtn) sendBtn.style.display = 'block';
    };

    recognition.onerror = (event) => {
      console.error(event);
      this._debateSwitchToKeyboard('Przełączono na wpisywanie ręczne.');
    };

    recognition.onend = () => {
      this._debateListening = false;
      if (btn) btn.classList.remove('recording');
      if (status && this._lastDebateTranscript) {
        status.textContent = "Gotowe! Kliknij 'Ripostuj', aby wydać odpowiedź AI.";
      }
    };

    this._debateRecognition = recognition;
    this._lastDebateTranscript = '';
    recognition.start();
  },

  _debateStopListening() {
    if (this._debateRecognition) {
      try { this._debateRecognition.stop(); } catch(e) {}
    }
    this._debateListening = false;
    const btn = document.getElementById('debateMicBtn');
    if (btn) btn.classList.remove('recording');
  },

  _debateSwitchToKeyboard(msg) {
    this._debateStopListening();
    const input = document.getElementById('debateManualInput');
    const mic = document.getElementById('debateMicBtn');
    const send = document.getElementById('debateSendBtn');
    const status = document.getElementById('debateStatus');
    if (input) { input.style.display = 'block'; input.focus(); }
    if (mic) mic.style.display = 'none';
    if (send) send.style.display = 'block';
    if (status && msg) status.innerHTML = `<span style="color:var(--amber)">⚠️ ${msg}</span>`;
  },

  _debateSubmitManual() {
    const input = document.getElementById('debateManualInput');
    if (!input || !input.value.trim()) return;
    this._lastDebateTranscript = input.value.trim();
    input.value = '';
    this._debateSubmitReply();
  },

  async _debateSubmitReply() {
    const text = this._lastDebateTranscript;
    if (!text) return;

    this._debateStopListening();

    const status = document.getElementById('debateStatus');
    const sendBtn = document.getElementById('debateSendBtn');
    const micBtn = document.getElementById('debateMicBtn');
    const kbdBtn = document.getElementById('debateKeyboardBtn');

    if (sendBtn) sendBtn.style.display = 'none';
    if (micBtn) micBtn.disabled = true;
    if (kbdBtn) kbdBtn.disabled = true;
    if (status) status.innerHTML = '<div class="spinner spinner-small" style="display:inline-block;vertical-align:middle;margin-right:8px"></div> AI przygotowuje ripostę...';

    this._debateHistory.push({ role: 'user', text: text });
    this.total++;
    this._debateRenderChat();

    try {
      const payload = {
        topic: this._debateTopic,
        chat_history: this._debateHistory.slice(0, -1),
        user_input: text,
        turn_number: this._debateTurn
      };

      const result = await API.post('/api/exercise/debate/reply', payload);
      const score = typeof result.argument_score === 'number' ? result.argument_score : 80;
      const turnXp = Math.round(score / 8); // ~10-15 XP per turn

      this._debateHistory[this._debateHistory.length - 1].feedback = {
        score: score,
        feedback_pl: result.feedback_pl,
        xp_earned: turnXp
      };

      this.score += score;
      this.xpEarned += turnXp;
      showXP(`+${turnXp} XP`);

      this._debateHistory.push({ role: 'bot', text: result.ai_reply_en, text_pl: result.ai_reply_pl });
      this._debateTurn++;

      this._debateRenderChat();
      if (result.ai_reply_en) Speech.speak(result.ai_reply_en);

      if (result.is_debate_complete || this._debateTurn > this._debateMaxTurns) {
        setTimeout(() => this._debateShowResult(), 4500);
      } else {
        if (status) status.textContent = "Twój ruch! Odpowiedz na argument AI.";
        if (micBtn) micBtn.disabled = false;
        if (kbdBtn) kbdBtn.disabled = false;
      }
    } catch(e) {
      console.error(e);
      if (status) status.innerHTML = '<span style="color:var(--red)">Błąd komunikacji w debacie.</span>';
      if (micBtn) micBtn.disabled = false;
      if (kbdBtn) kbdBtn.disabled = false;
    }
  },

  _debateShowResult() {
    const avgScore = this.total > 0 ? Math.round(this.score / this.total) : 0;
    const rankLabel = avgScore >= 85 ? 'Retoryczny Mistrz 🏆' : avgScore >= 65 ? 'Skuteczny Dyskutant ⚖️' : 'Adept Debaty 📚';

    document.getElementById('modalBody').innerHTML = `
      <div style="text-align:center;padding:30px 20px">
        <div style="font-size:54px;margin-bottom:10px">⚖️</div>
        <h3 style="color:var(--text1);margin-bottom:6px">Debata Zakończona!</h3>
        <p style="color:var(--text3);font-size:14px;margin-bottom:16px">${this._debateTopic}</p>

        <div style="background:var(--card);border-radius:16px;border:1px solid var(--border);padding:18px;margin:16px 0;text-align:center">
          <span style="color:var(--text3);font-size:12px;display:block;margin-bottom:4px">TWÓJ KROK RETORYCZNY</span>
          <strong style="color:var(--amber);font-size:22px;display:block">${rankLabel}</strong>
          <span style="font-size:14px;color:var(--green);font-weight:600;margin-top:6px;display:block">Średnia jakość argumentacji: ${avgScore}/100</span>
        </div>

        <p style="color:var(--text3);font-size:13px;margin-bottom:24px">⭐ Zdobyte doświadczenie: <strong style="color:var(--text1)">+${this.xpEarned} XP</strong></p>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
          <button class="btn btn-primary" onclick="Exercise.startDebate()">Kolejna Debata ⚖️</button>
          <button class="btn btn-outline" onclick="Exercise.close()">Zakończ</button>
        </div>
      </div>`;
  }
});
