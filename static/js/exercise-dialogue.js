Object.assign(Exercise, {
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

});
