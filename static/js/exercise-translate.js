Object.assign(Exercise, {
  /* ─ TŁUMACZENIE ZDAŃ (Sentence Translation Exercise) ─ */
  trDifficulty: 'medium', // 'easy' | 'medium' | 'hard'
  trNumSentences: 1, // 1 or 2
  trInputMode: 'text', // 'text' | 'voice'
  trIsRecording: false,
  trRecognition: null,
  trTask: null,
  trCurrentSentenceIdx: 0,

  async startSentenceTranslation() {
    this.trCurrentSentenceIdx = 0;
    this.trSeenWords = [];
    this.score = 0;
    this.total = 0;
    this.startTime = Date.now();
    this.renderTranslateSetup();
  },

  renderTranslateSetup() {
    document.getElementById('modalBody').innerHTML = `
      <div class="tr-setup-card">
        <div style="font-size:48px;margin-bottom:8px;text-align:center">🗣️💬</div>
        <h2 style="text-align:center;color:var(--text1);font-weight:900;margin-bottom:6px">Tłumaczenie Zdań</h2>
        <p style="text-align:center;color:var(--text2);font-size:14px;margin-bottom:24px">Przetłumacz wygenerowane zdanie z języka polskiego na angielski pisemnie lub głosem!</p>

        <!-- Ustawienia poziomu trudności -->
        <div class="tr-option-group">
          <label class="tr-option-label">📊 Poziom trudności wyrażenia:</label>
          <div class="tr-btn-grid-3">
            <button class="tr-opt-btn ${this.trDifficulty==='easy'?'active':''}" onclick="Exercise.setTrDifficulty('easy')">
              <span>🟢 Łatwy</span>
              <small>A1 - A2</small>
            </button>
            <button class="tr-opt-btn ${this.trDifficulty==='medium'?'active':''}" onclick="Exercise.setTrDifficulty('medium')">
              <span>🟡 Średni</span>
              <small>B1 - B2</small>
            </button>
            <button class="tr-opt-btn ${this.trDifficulty==='hard'?'active':''}" onclick="Exercise.setTrDifficulty('hard')">
              <span>🔴 Trudny</span>
              <small>C1 - C2</small>
            </button>
          </div>
        </div>

        <!-- Liczba zdań -->
        <div class="tr-option-group" style="margin-top:18px">
          <label class="tr-option-label">🔢 Liczba zdań do przetłumaczenia:</label>
          <div class="tr-btn-grid-2">
            <button class="tr-opt-btn ${this.trNumSentences===1?'active':''}" onclick="Exercise.setTrNumSentences(1)">
              <span>1 Zdanie</span>
            </button>
            <button class="tr-opt-btn ${this.trNumSentences===2?'active':''}" onclick="Exercise.setTrNumSentences(2)">
              <span>2 Zdania</span>
            </button>
          </div>
        </div>

        <!-- Tryb odpowiedzi -->
        <div class="tr-option-group" style="margin-top:18px">
          <label class="tr-option-label">🎙️ Tryb udzielania odpowiedzi:</label>
          <div class="tr-btn-grid-2">
            <button class="tr-opt-btn ${this.trInputMode==='voice'?'active':''}" onclick="Exercise.setTrInputMode('voice')">
              <span>🎙️ Głosem (Mikrofon)</span>
            </button>
            <button class="tr-opt-btn ${this.trInputMode==='text'?'active':''}" onclick="Exercise.setTrInputMode('text')">
              <span>✍️ Pisemnie (Klawiatura)</span>
            </button>
          </div>
        </div>

        <button class="btn btn-primary" style="width:100%;margin-top:24px;padding:14px;font-size:16px" onclick="Exercise.loadTrTask()">
          Rozpocznij Ćwiczenie 🚀
        </button>
      </div>
    `;
  },

  setTrDifficulty(diff) {
    this.trDifficulty = diff;
    this.renderTranslateSetup();
  },

  setTrNumSentences(num) {
    this.trNumSentences = num;
    this.renderTranslateSetup();
  },

  setTrInputMode(mode) {
    this.trInputMode = mode;
    this.renderTranslateSetup();
  },

  async loadTrTask() {
    document.getElementById('modalBody').innerHTML = `
      <div style="text-align:center;padding:50px 20px">
        <div class="spinner" style="margin:0 auto 16px"></div>
        <h3 style="color:var(--text1);font-weight:700">Gemini przygotowuje zdanie…</h3>
        <p style="color:var(--text3);font-size:13px">Poziom: ${this.trDifficulty.toUpperCase()} • ${this.trNumSentences} zdanie/a</p>
      </div>`;

    try {
      const seenParam = encodeURIComponent((this.trSeenWords || []).join(','));
      this.trTask = await API.get(`/api/gemini/sentence_translation?difficulty=${this.trDifficulty}&num_sentences=${this.trNumSentences}&seen_words=${seenParam}&_t=${Date.now()}`);
      if (this.trTask && this.trTask.word) {
        if (!this.trSeenWords) this.trSeenWords = [];
        this.trSeenWords.push(this.trTask.word);
      }
      this.trCurrentSentenceIdx = 0;
      this.total += (this.trTask.sentences || []).length;
      this.renderTrQuestion();
    } catch(e) {
      document.getElementById('modalBody').innerHTML = `
        <div style="text-align:center;padding:40px;color:var(--red)">
          Błąd podczas generowania zadania: ${e.message||e}
        </div>`;
    }
  },

  renderTrQuestion() {
    const sentences = this.trTask.sentences || [];
    if (this.trCurrentSentenceIdx >= sentences.length) {
      this.showResult();
      return;
    }

    const cur = sentences[this.trCurrentSentenceIdx];
    const targetWord = this.trTask.word || '';

    document.getElementById('modalBody').innerHTML = `
      <div class="tr-exercise-card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <span style="font-size:12px;color:var(--text3);font-weight:600">Zdanie ${this.trCurrentSentenceIdx + 1} z ${sentences.length}</span>
          <span class="badge" style="background:rgba(99,102,241,0.15);color:var(--accent);border:1px solid rgba(99,102,241,0.3);display:inline-flex;align-items:center;gap:6px">
            <span>Słowo klucz: <strong>${targetWord}</strong> (${this.trTask.translation || ''})</span>
            ${this.trTask.frequency_rank && this.trTask.frequency_rank < 9999 ? `<span style="background:#6366f1;color:#ffffff;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:800;display:inline-block">#${this.trTask.frequency_rank}</span>` : ''}
          </span>
        </div>

        <div class="tr-sentence-pl-box">
          <div class="tr-sentence-pl-text">🇵🇱 "${cur.sentence_pl}"</div>
          <button class="sq-speak-sentence-btn" style="margin-top:8px" onclick="Speech.speak('${cur.sentence_pl.replace(/'/g, "\\'")}', 'pl-PL')">
            🔊 Odsłuchaj po polsku
          </button>
        </div>

        <div style="display:flex;justify-content:center;gap:10px;margin:16px 0">
          <button class="tr-mode-toggle ${this.trInputMode==='voice'?'active':''}" onclick="Exercise.toggleTrMode('voice')">🎙️ Odpowiedź głosem</button>
          <button class="tr-mode-toggle ${this.trInputMode==='text'?'active':''}" onclick="Exercise.toggleTrMode('text')">✍️ Odpowiedź pisemnie</button>
        </div>

        <div id="trInputContainer"></div>

        <div id="trFeedbackContainer"></div>
      </div>
    `;

    this.renderTrInputArea();
    this.setScore();
  },

  toggleTrMode(mode) {
    if (this.trIsRecording) this.stopTrVoiceRecording();
    this.trInputMode = mode;
    this.renderTrQuestion();
  },

  trAccumulatedTranscript: '',

  renderTrInputArea() {
    const container = document.getElementById('trInputContainer');
    if (!container) return;

    if (this.trInputMode === 'voice') {
      container.innerHTML = `
        <div class="tr-voice-area">
          <button id="trMicBtn" class="tr-mic-btn" onclick="Exercise.toggleTrVoiceRecording()">
            🎙️
          </button>
          <p id="trMicStatus" style="font-size:13px;color:var(--text2);margin-top:10px">
            Naciśnij mikrofon i wypowiedz tłumaczenie po angielsku (możesz robić pauzy)
          </p>
          <div class="tr-transcript-box" id="trTranscript">Wypowiedziane słowa pojawią się tutaj...</div>
          <button class="btn btn-primary" id="trSubmitVoiceBtn" style="margin-top:12px;width:100%;display:none;padding:14px;font-size:16px;font-weight:700" onclick="Exercise.submitTrTranslation()">
            Zakończ i sprawdź odpowiedź ➔
          </button>
        </div>
      `;
    } else {
      container.innerHTML = `
        <div class="tr-text-area">
          <textarea id="trTextInput" class="login-input" style="width:100%;height:90px;font-size:16px;padding:12px;border-radius:12px;resize:none" placeholder="Wpisz tutaj tłumaczenie po angielsku..."></textarea>
          <button class="btn btn-primary" style="margin-top:12px;width:100%;padding:12px" onclick="Exercise.submitTrTranslation()">
            Sprawdź tłumaczenie ➔
          </button>
        </div>
      `;
      setTimeout(() => {
        const inp = document.getElementById('trTextInput');
        if (inp) inp.focus();
      }, 100);
    }
  },

  toggleTrVoiceRecording() {
    if (this.trIsRecording) {
      this.stopTrVoiceRecording();
    } else {
      this.startTrVoiceRecording();
    }
  },

  startTrVoiceRecording() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Twoja przeglądarka nie obsługuje rozpoznawania mowy. Skorzystaj z trybu pisemnego.');
      return;
    }

    this.trIsRecording = true;
    this.trAccumulatedTranscript = '';

    const micBtn = document.getElementById('trMicBtn');
    const micStatus = document.getElementById('trMicStatus');
    const transcriptBox = document.getElementById('trTranscript');
    const submitBtn = document.getElementById('trSubmitVoiceBtn');

    if (micBtn) micBtn.classList.add('recording');
    if (micStatus) micStatus.textContent = '🔴 Słucham... Mów powoli (możesz robić pauzy). Gdy skończysz, kliknij przycisk sprawdzenia!';

    const initRecognition = () => {
      if (!this.trIsRecording) return;

      try {
        this.trRecognition = new SpeechRecognition();
        this.trRecognition.lang = 'en-US';
        this.trRecognition.continuous = true;
        this.trRecognition.interimResults = true;

        this.trRecognition.onresult = (event) => {
          let currentSessionText = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            currentSessionText += event.results[i][0].transcript;
          }
          let fullText = (this.trAccumulatedTranscript + ' ' + currentSessionText).trim();
          if (transcriptBox) {
            transcriptBox.textContent = fullText;
            transcriptBox.style.color = 'var(--text1)';
          }
          if (submitBtn && fullText.length > 0) {
            submitBtn.style.display = 'block';
          }
        };

        this.trRecognition.onerror = (event) => {
          console.warn('Speech recognition error:', event.error);
          if (event.error === 'not-allowed') {
            alert('Dostęp do mikrofonu został zablokowany w przeglądarce.');
            this.stopTrVoiceRecording();
          }
        };

        this.trRecognition.onend = () => {
          // Jeśli użytkownik NIE wyłączył mikrofonu przyciskiem, kontynuuj nagrywanie (auto-restart)!
          if (this.trIsRecording) {
            if (transcriptBox && transcriptBox.textContent && !transcriptBox.textContent.includes('Wypowiedziane słowa pojawią się tutaj...')) {
              this.trAccumulatedTranscript = transcriptBox.textContent.trim();
            }
            try {
              this.trRecognition.start();
            } catch(e) {
              setTimeout(() => {
                if (this.trIsRecording) initRecognition();
              }, 250);
            }
          }
        };

        this.trRecognition.start();
      } catch(e) {
        console.error('Error starting speech recognition:', e);
      }
    };

    initRecognition();
  },

  stopTrVoiceRecording() {
    this.trIsRecording = false;
    if (this.trRecognition) {
      try { this.trRecognition.stop(); } catch(e){}
      this.trRecognition = null;
    }
    const micBtn = document.getElementById('trMicBtn');
    const micStatus = document.getElementById('trMicStatus');
    if (micBtn) micBtn.classList.remove('recording');
    if (micStatus) micStatus.textContent = 'Nagrywanie wstrzymane. Sprawdź tekst i kliknij przycisk poniżej.';
  },

  async submitTrTranslation() {
    let userText = '';
    if (this.trInputMode === 'voice') {
      if (this.trIsRecording) this.stopTrVoiceRecording();
      const tBox = document.getElementById('trTranscript');
      userText = tBox ? tBox.textContent.trim() : '';
    } else {
      const inp = document.getElementById('trTextInput');
      userText = inp ? inp.value.trim() : '';
    }

    if (!userText || userText.includes('Wypowiedziane słowa pojawią się tutaj...')) {
      alert('Proszę najpierw wpisać lub wypowiedzieć tłumaczenie!');
      return;
    }

    const cur = this.trTask.sentences[this.trCurrentSentenceIdx];
    const feedbackBox = document.getElementById('trFeedbackContainer');
    if (feedbackBox) {
      feedbackBox.innerHTML = `
        <div style="text-align:center;padding:16px">
          <div class="spinner spinner-small" style="margin:0 auto 6px"></div>
          <span style="font-size:13px;color:var(--text3)">Gemini ocenia Twoje tłumaczenie…</span>
        </div>`;
    }

    try {
      const evalRes = await API.post('/api/gemini/evaluate_sentence_translation', {
        sentence_pl: cur.sentence_pl,
        expected_en: cur.expected_en,
        user_translation: userText,
        word: this.trTask.word || ''
      });

      const score = evalRes.score || 0;
      const isOk = evalRes.is_correct;
      if (isOk) this.score++;

      const safeExpected = (evalRes.expected_en || cur.expected_en).replace(/'/g, "\\'");

      if (feedbackBox) {
        feedbackBox.innerHTML = `
          <div class="tr-feedback-card ${isOk ? 'correct' : 'warning'}">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
              <span style="font-size:18px;font-weight:900;color:${isOk ? 'var(--green)' : 'var(--yellow)'}">
                ${isOk ? '✨ Świetnie!' : '⚠️ Prawie dobrze'} (${score}%)
              </span>
              ${evalRes.xp_earned > 0 ? `<span style="color:var(--green);font-weight:800">+${evalRes.xp_earned} XP</span>` : ''}
            </div>

            <p style="color:var(--text1);font-size:14px;margin-bottom:8px">${evalRes.feedback_pl || ''}</p>

            <div style="background:rgba(255,255,255,0.05);border-radius:10px;padding:10px;margin:8px 0">
              <div style="font-size:12px;color:var(--text3);margin-bottom:2px">Wzorcowe tłumaczenie:</div>
              <div style="font-size:15px;font-weight:700;color:#f3f4f6;display:flex;justify-content:space-between;align-items:center">
                <span>💬 ${evalRes.expected_en || cur.expected_en}</span>
                <button class="sq-speak-sentence-btn" onclick="Speech.speak('${safeExpected}')">🔊 Odsłuchaj</button>
              </div>
            </div>

            ${evalRes.grammar_tip ? `<div style="font-size:12px;color:#fbbf24;margin-top:6px">💡 Tip: ${evalRes.grammar_tip}</div>` : ''}

            <button class="btn btn-primary" style="width:100%;margin-top:14px" onclick="Exercise.nextTrSentence()">
              Następne zdanie ➔
            </button>
          </div>
        `;
      }

      Speech.speak(evalRes.expected_en || cur.expected_en);
    } catch(e) {
      if (feedbackBox) {
        feedbackBox.innerHTML = `<div style="color:var(--red);padding:10px">Nie udało się ocenić tłumaczenia.</div>`;
      }
    }
  },

  nextTrSentence() {
    this.trCurrentSentenceIdx++;
    const sentences = (this.trTask && this.trTask.sentences) || [];
    if (this.trCurrentSentenceIdx >= sentences.length) {
      // Auto-load next word and unique sentence!
      this.loadTrTask();
    } else {
      this.renderTrQuestion();
    }
  }
});
