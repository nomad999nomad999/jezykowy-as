/* ── EXERCISE: AI Voice Coach (Trener wymowy) ── */
Object.assign(Exercise, {
  vcWords: [],
  vcIndex: 0,
  vcCurrentWord: null,
  vcSentence: "",
  vcSpokenText: "",
  vcIsRecording: false,
  vcRecognition: null,

  async startVoiceCoach() {
    this.vcWords = [];
    this.vcIndex = 0;
    this.score = 0;
    this.total = 0;
    this.startTime = Date.now();

    // Fetch user words for practice
    try {
      const words = await API.get('/api/exercise/flashcards');
      if (words && words.length > 0) {
        this.vcWords = words;
      }
    } catch(e) { console.error("Error loading voice coach words:", e); }

    if (!this.vcWords || this.vcWords.length === 0) {
      this.vcWords = [
        { id: 1, word: "opportunity", translation: "okazja / możliwość" },
        { id: 2, word: "thought", translation: "myśl / sądziłem" },
        { id: 3, word: "comfortable", translation: "wygodny" },
        { id: 4, word: "schedule", translation: "harmonogram / grafik" },
        { id: 5, word: "thoroughly", translation: "gruntownie / dokładnie" }
      ];
    }

    this.total = this.vcWords.length;
    this.setScore();
    await this.vcLoadCurrentWord();
  },

  async vcLoadCurrentWord() {
    if (this.vcIndex >= this.vcWords.length) {
      return this.showResult(" – Trening Wymowy AI zakończony!");
    }

    this.vcCurrentWord = this.vcWords[this.vcIndex];
    this.vcSpokenText = "";
    this.vcIsRecording = false;

    // Show loading state while fetching AI sentence
    document.getElementById('modalBody').innerHTML = `
      <div style="text-align:center;padding:40px">
        <div class="spinner" style="margin:auto"></div>
        <div style="margin-top:16px;color:var(--text-muted)">AI przygotowuje zdanie do treningu wymowy...</div>
      </div>
    `;

    // Try fetching sentence from Gemini, fallback if offline
    try {
      const res = await API.post('/api/gemini/sentence', { word: this.vcCurrentWord.word });
      if (res && res.sentence) {
        this.vcSentence = res.sentence;
      } else {
        this.vcSentence = `I want to practice the word ${this.vcCurrentWord.word} today.`;
      }
    } catch(e) {
      this.vcSentence = `I want to practice using ${this.vcCurrentWord.word} in a sentence.`;
    }

    this.vcRenderCard();
  },

  vcRenderCard() {
    const w = this.vcCurrentWord;
    const body = document.getElementById('modalBody');

    body.innerHTML = `
      <div class="voice-coach-container" style="max-width:540px;margin:0 auto;padding:12px;text-align:center;">
        
        <!-- Target Word Badge -->
        <div style="background:var(--card-bg);border:1px solid var(--border-color);border-radius:16px;padding:16px;margin-bottom:16px;box-shadow:0 4px 12px rgba(0,0,0,0.05);">
          <div style="font-size:0.85rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;font-weight:600;margin-bottom:4px;">Słowo kluczowe</div>
          <div style="font-size:1.8rem;font-weight:800;color:var(--primary-color);line-height:1.2;">
            ${w.word}
            ${w.frequency_rank && w.frequency_rank < 9999 ? `<span class="fc-rank" style="font-size:14px;margin-left:6px;vertical-align:middle">#${w.frequency_rank}</span>` : ''}
          </div>
          <div style="font-size:1rem;color:var(--text-muted);margin-top:4px;">${w.translation || ''}</div>
        </div>

        <!-- Target Sentence Card -->
        <div style="background:linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(168,85,247,0.08) 100%);border:1.5px solid rgba(99,102,241,0.2);border-radius:20px;padding:20px;margin-bottom:20px;position:relative;">
          <div style="font-size:0.85rem;color:var(--primary-color);font-weight:700;margin-bottom:8px;">🎯 Przeczytaj to zdanie na głos:</div>
          <div id="vcTargetSentence" style="font-size:1.25rem;font-weight:600;color:var(--text-main);line-height:1.5;margin-bottom:14px;">
            "${this.vcSentence}"
          </div>
          <button class="btn btn-secondary" style="border-radius:24px;padding:8px 18px;font-weight:600;display:inline-flex;align-items:center;gap:6px;" onclick="Speech.speak('${this.vcSentence.replace(/'/g, "\\'")}', 'en-US', 0.82)">
            🔊 Odsłuchaj wzorzec wymowy
          </button>
        </div>

        <!-- Recording & Speech Recognition Section -->
        <div style="margin-bottom:24px;">
          <button id="vcRecordBtn" class="btn" style="width:100%;max-width:320px;padding:16px 24px;font-size:1.1rem;font-weight:700;border-radius:30px;background:linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);color:#fff;box-shadow:0 6px 20px rgba(59,130,246,0.35);transition:all 0.2s ease;display:inline-flex;align-items:center;justify-content:center;gap:10px;" onclick="Exercise.vcToggleRecording()">
            🎤 <span id="vcRecordBtnText">Naciśnij i mów</span>
          </button>

          <!-- Waveform pulse indicator -->
          <div id="vcPulseWave" class="hidden" style="margin-top:16px;display:flex;justify-content:center;align-items:center;gap:6px;height:24px;">
            <span class="vc-wave-bar" style="width:4px;height:12px;background:var(--primary-color);border-radius:2px;animation:vcPulse 0.8s infinite ease-in-out;"></span>
            <span class="vc-wave-bar" style="width:4px;height:22px;background:var(--primary-color);border-radius:2px;animation:vcPulse 0.8s 0.2s infinite ease-in-out;"></span>
            <span class="vc-wave-bar" style="width:4px;height:16px;background:var(--primary-color);border-radius:2px;animation:vcPulse 0.8s 0.4s infinite ease-in-out;"></span>
            <span class="vc-wave-bar" style="width:4px;height:24px;background:var(--primary-color);border-radius:2px;animation:vcPulse 0.8s 0.1s infinite ease-in-out;"></span>
            <span class="vc-wave-bar" style="width:4px;height:14px;background:var(--primary-color);border-radius:2px;animation:vcPulse 0.8s 0.3s infinite ease-in-out;"></span>
          </div>
          <div id="vcStatusText" style="font-size:0.9rem;color:var(--text-muted);margin-top:8px;">Kliknij mikrofon i odczytaj zdanie po angielsku</div>
        </div>

        <!-- Recognized Spoken Text Box -->
        <div id="vcLiveTranscriptBox" class="hidden" style="background:var(--bg-card);border:1px dashed var(--border-color);border-radius:14px;padding:12px;margin-bottom:16px;text-align:left;">
          <div style="font-size:0.75rem;color:var(--text-muted);font-weight:600;margin-bottom:4px;">Wykryta wypowiedź (transkrypcja):</div>
          <div id="vcLiveTranscript" style="font-size:1.05rem;font-style:italic;color:var(--text-main);">...</div>
        </div>

        <!-- AI Evaluation Result Area -->
        <div id="vcResultArea" class="hidden"></div>

        <!-- Next / Skip Row -->
        <div style="margin-top:20px;display:flex;gap:12px;justify-content:center;">
          <button class="btn btn-outline" style="border-radius:20px;padding:10px 20px;" onclick="Exercise.vcNextWord()">⏭️ Pomiń zdanie</button>
        </div>

      </div>
    `;

    // Inject wave pulse animation CSS if not present
    if (!document.getElementById('vcStyle')) {
      const st = document.createElement('style');
      st.id = 'vcStyle';
      st.innerHTML = `
        @keyframes vcPulse {
          0%, 100% { transform: scaleY(0.4); opacity: 0.5; }
          50% { transform: scaleY(1.3); opacity: 1; }
        }
        .word-tag-correct { background: rgba(34,197,94,0.15); color: #16a34a; border: 1px solid rgba(34,197,94,0.3); border-radius: 6px; padding: 2px 6px; font-weight: 600; display: inline-block; margin: 2px; }
        .word-tag-mispronounced { background: rgba(239,68,68,0.15); color: #dc2626; border: 1px solid rgba(239,68,68,0.3); border-radius: 6px; padding: 2px 6px; font-weight: 600; display: inline-block; margin: 2px; }
      `;
      document.head.appendChild(st);
    }
  },

  vcToggleRecording() {
    if (this.vcIsRecording) {
      this.vcStopRecording();
    } else {
      this.vcStartRecording();
    }
  },

  vcStartRecording() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      alert("Twoja przeglądarka nie obsługuje mikrofonowego rozpoznawania mowy (Web Speech API). Użyj przeglądarki Chrome, Edge lub Safari.");
      return;
    }

    try {
      this.vcRecognition = new SpeechRec();
      this.vcRecognition.lang = 'en-US';
      this.vcRecognition.interimResults = true;
      this.vcRecognition.maxAlternatives = 1;

      this.vcIsRecording = true;
      const btn = document.getElementById('vcRecordBtn');
      const btnText = document.getElementById('vcRecordBtnText');
      const wave = document.getElementById('vcPulseWave');
      const statusText = document.getElementById('vcStatusText');
      const liveBox = document.getElementById('vcLiveTranscriptBox');
      const liveTrans = document.getElementById('vcLiveTranscript');

      if (btn) btn.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
      if (btnText) btnText.textContent = '⏹️ Zakończ nagrywanie';
      if (wave) wave.classList.remove('hidden');
      if (statusText) statusText.textContent = 'Słucham... Mów teraz po angielsku!';
      if (liveBox) liveBox.classList.remove('hidden');

      this.vcRecognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }
        this.vcSpokenText = transcript;
        if (liveTrans) liveTrans.textContent = transcript || '...';
      };

      this.vcRecognition.onerror = (event) => {
        console.warn("Speech recognition error:", event.error);
        if (event.error === 'no-speech') {
          if (statusText) statusText.textContent = 'Nie wykryto mowy. Spróbuj mówić głośniej!';
        } else if (event.error === 'not-allowed') {
          alert("Dostęp do mikrofonu został zablokowany w przeglądarce. Zezwól na mikrofon w ustawieniach strony.");
          this.vcStopRecording();
        }
      };

      this.vcRecognition.onend = () => {
        if (this.vcIsRecording) {
          this.vcStopRecording();
        }
      };

      this.vcRecognition.start();
    } catch(e) {
      console.error("Failed to start speech recognition:", e);
      this.vcIsRecording = false;
    }
  },

  vcStopRecording() {
    this.vcIsRecording = false;
    if (this.vcRecognition) {
      try { this.vcRecognition.stop(); } catch(e){}
    }

    const btn = document.getElementById('vcRecordBtn');
    const btnText = document.getElementById('vcRecordBtnText');
    const wave = document.getElementById('vcPulseWave');
    const statusText = document.getElementById('vcStatusText');

    if (btn) btn.style.background = 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)';
    if (btnText) btnText.textContent = '🎤 Analizuj ponowne nagranie';
    if (wave) wave.classList.add('hidden');
    if (statusText) statusText.textContent = 'Analizuję wymowę...';

    // Submit spoken text for AI evaluation
    this.vcEvaluatePronunciation();
  },

  async vcEvaluatePronunciation() {
    const resArea = document.getElementById('vcResultArea');
    if (!resArea) return;

    if (!this.vcSpokenText.trim()) {
      resArea.classList.remove('hidden');
      resArea.innerHTML = `
        <div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:14px;padding:16px;margin-top:16px;color:#dc2626;">
          ⚠️ Nie wykryto mowy. Upewnij się, że mówisz wyraźnie do mikrofonu i spróbuj ponownie!
        </div>
      `;
      return;
    }

    resArea.classList.remove('hidden');
    resArea.innerHTML = `
      <div style="background:var(--card-bg);border:1px solid var(--border-color);border-radius:16px;padding:20px;margin-top:16px;text-align:center;">
        <div class="spinner" style="margin:auto"></div>
        <div style="margin-top:12px;color:var(--text-muted);font-weight:600;">AI Voice Coach ocenia Twoją akcent i płynność...</div>
      </div>
    `;

    let evalData = null;
    try {
      evalData = await API.post('/api/gemini/voice_coach', {
        target_sentence: this.vcSentence,
        spoken_text: this.vcSpokenText,
        target_word: this.vcCurrentWord.word
      });
    } catch(e) {
      console.error("Voice coach API error:", e);
    }

    if (!evalData) {
      // Fallback client-side comparison
      const targetWords = this.vcSentence.lower().replace(/[.,]/g,'').split(' ');
      const spokenWords = this.vcSpokenText.lower().replace(/[.,]/g,'').split(' ');
      let matches = 0;
      const status_words = targetWords.map(w => {
        const ok = spokenWords.includes(w);
        if (ok) matches++;
        return { word: w, status: ok ? 'correct' : 'mispronounced' };
      });
      const score = Math.round((matches / Math.max(1, targetWords.length)) * 100);
      evalData = {
        score: score,
        feedback_pl: `Twój wynik to ${score}%. ${score >= 70 ? 'Bardzo dobrze!' : 'Ćwicz dalej wymowę trudniejszych słówek.'}`,
        status_words: status_words
      };
    }

    // Award XP and increment score if good attempt
    if (evalData.score >= 60) {
      this.score++;
      this.setScore();
      const xpGiven = evalData.score >= 85 ? 20 : 10;
      this.xpEarned += xpGiven;
      if (typeof XP !== 'undefined' && XP.show) XP.show(xpGiven);
    }

    // Color code score badge
    const scoreColor = evalData.score >= 80 ? '#22c55e' : evalData.score >= 50 ? '#eab308' : '#ef4444';
    const scoreBadge = evalData.score >= 80 ? '🌟 Świetna wymowa!' : evalData.score >= 50 ? '👍 Dobra próba' : '💪 Trening czyni mistrza';

    // Render word tags
    let wordTagsHtml = '';
    if (evalData.status_words && evalData.status_words.length > 0) {
      wordTagsHtml = evalData.status_words.map(w => {
        const cls = w.status === 'correct' ? 'word-tag-correct' : 'word-tag-mispronounced';
        const icon = w.status === 'correct' ? '✓' : '×';
        return `<span class="${cls}">${w.word} ${icon}</span>`;
      }).join(' ');
    } else {
      wordTagsHtml = `<div style="font-size:1rem;color:var(--text-main); font-weight:600;">"${this.vcSpokenText}"</div>`;
    }

    resArea.innerHTML = `
      <div style="background:var(--card-bg);border:1.5px solid ${scoreColor}44;border-radius:20px;padding:20px;margin-top:20px;text-align:left;box-shadow:0 6px 16px rgba(0,0,0,0.06);">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;border-bottom:1px solid var(--border-color);padding-bottom:10px;">
          <div>
            <span style="font-size:0.85rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;">Płynność i Akcent</span>
            <div style="font-size:1.1rem;font-weight:800;color:${scoreColor};">${scoreBadge}</div>
          </div>
          <div style="font-size:2rem;font-weight:900;color:${scoreColor};">${evalData.score}%</div>
        </div>

        <div style="margin-bottom:14px;">
          <div style="font-size:0.8rem;color:var(--text-muted);font-weight:600;margin-bottom:6px;">Analiza słowo po słowie:</div>
          <div>${wordTagsHtml}</div>
        </div>

        <div style="background:linear-gradient(135deg, rgba(99,102,241,0.06) 0%, rgba(168,85,247,0.06) 100%);border-left:4px solid var(--primary-color);padding:12px 14px;border-radius:8px;margin-bottom:16px;">
          <div style="font-size:0.85rem;font-weight:700;color:var(--primary-color);margin-bottom:4px;">💡 Wskazówka od AI Voice Coach:</div>
          <div style="font-size:0.95rem;color:var(--text-main);line-height:1.4;">${evalData.feedback_pl}</div>
        </div>

        <button class="btn btn-primary" style="width:100%;border-radius:24px;padding:12px;font-size:1rem;font-weight:700;" onclick="Exercise.vcNextWord()">
          Następne słowo ➔
        </button>
      </div>
    `;
  },

  vcNextWord() {
    this.vcIndex++;
    this.vcLoadCurrentWord();
  }
});
