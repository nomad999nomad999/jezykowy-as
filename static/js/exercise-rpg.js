Object.assign(Exercise, {
  async startRpgAdventure() {
    this.score = 0;
    this.xpEarned = 0;
    this.total = 5;
    this.startTime = Date.now();
    this._rpgStage = 1;
    this._rpgHearts = 3;
    this._rpgPreviousStory = "";
    this._rpgTheme = null;
    this._rpgTargetWord = null;
    this._rpgStepData = null;
    this.setScore();
    this._rpgRenderThemePicker();
  },

  _rpgRenderThemePicker() {
    const themes = [
      { key: "Space Odyssey", icon: "🚀", name: "Odyseja kosmiczna", desc: "Zasoby kosmiczne, anomalie, obcy i walka o przetrwanie." },
      { key: "Fantasy Kingdom", icon: "🧙‍♂️", name: "Królestwo fantasy", desc: "Magiczne stwory, smoki, elfy i zamkowe lochy." },
      { key: "Detective Mystery", icon: "🕵️‍♂️", name: "Zagadka kryminalna", desc: "Śledztwo, wskazówki, podejrzani i szukanie sprawcy." },
      { key: "Zombie Apocalypse", icon: "🧟‍♂️", name: "Apokalipsa zombie", desc: "Barykady, racje żywnościowe, hordy umarlaków." },
      { key: "Primeval Man", icon: "🍖", name: "Człowiek pierwotny", desc: "Ogień, mamuty, pierwsze narzędzia i jaskinie." },
      { key: "Dinosaurs Era", icon: "🦖", name: "Era dinozaurów", desc: "Welociraptory, T-Rex, ucieczka przez prehistoryczną dżunglę." }
    ];

    document.getElementById('modalBody').innerHTML = `
      <div style="padding:20px;text-align:center;max-width:440px;margin:0 auto">
        <div style="font-size:44px;margin-bottom:8px">⚔️</div>
        <h3 style="color:var(--text1);margin-bottom:6px;font-size:18px">Przygoda RPG z AI</h3>
        <p style="color:var(--text3);font-size:13px;line-height:1.5;margin-bottom:20px">
          Przeżyj 5-etapową historię RPG. Podejmuj decyzje, które testują Twoją znajomość słówek. Masz 3 serduszka — każda błędna odpowiedź kosztuje jedno!
        </p>
        <div style="font-size:12px;color:var(--text3);font-weight:700;text-transform:uppercase;margin-bottom:10px">Wybierz motyw przygody:</div>
        <div class="rpg-theme-grid">
          ${themes.map(t => `
            <button class="rpg-theme-btn" onclick="Exercise._rpgSelectTheme('${t.key}')">
              <span class="rpg-theme-icon">${t.icon}</span>
              <span class="rpg-theme-name">${t.name}</span>
            </button>
          `).join('')}
        </div>
      </div>`;
  },

  async _rpgSelectTheme(theme) {
    this._rpgTheme = theme;
    document.getElementById('modalBody').innerHTML = `
      <div style="text-align:center;padding:60px 20px">
        <div class="spinner" style="margin:auto"></div>
        <p style="color:var(--text3);margin-top:16px;font-size:14px">Wczytywanie słówek do przygody…</p>
      </div>`;
    
    const words = await API.get('/api/exercise/multiple_choice?n=5');
    if (!words || !words.length) {
      document.getElementById('modalBody').innerHTML = `
        <div style="text-align:center;padding:30px 20px">
          <p style="color:var(--text3);margin-bottom:20px">Brak słów do ćwiczenia. Sklasyfikuj więcej słów w zakładce klasyfikacji!</p>
          <button class="btn btn-primary" onclick="Exercise.close()">Zamknij</button>
        </div>`;
      return;
    }

    let gameWords = [...words];
    const defaultWords = [
      { word: "adventure", translation: "przygoda" },
      { word: "courage", translation: "odwaga" },
      { word: "survive", translation: "przetrwać" },
      { word: "explore", translation: "eksplorować" },
      { word: "discover", translation: "odkryć" }
    ];
    while (gameWords.length < 5) {
      const pad = defaultWords[gameWords.length % defaultWords.length];
      gameWords.push(pad);
    }
    this.data = gameWords.slice(0, 5);
    this._rpgStage = 1;
    this._rpgHearts = 3;
    this._rpgPreviousStory = "";
    
    await this._rpgLoadStage();
  },

  async _rpgLoadStage() {
    document.getElementById('modalBody').innerHTML = `
      <div style="text-align:center;padding:60px 20px">
        <div class="spinner" style="margin:auto"></div>
        <p style="color:var(--text3);margin-top:16px;font-size:14px">🧠 Gemini generuje etap ${this._rpgStage}/5…</p>
      </div>`;
    
    const w = this.data[this._rpgStage - 1];
    const res = await API.post('/api/gemini/rpg_adventure', {
      theme: this._rpgTheme,
      stage: this._rpgStage,
      previous_story: this._rpgPreviousStory,
      word: w.word,
      translation: w.translation
    });

    if (!res || res.error) {
      document.getElementById('modalBody').innerHTML = `
        <div style="text-align:center;padding:30px 20px">
          <p style="color:var(--red);margin-bottom:20px">Błąd: ${res?.error || 'Brak odpowiedzi'}</p>
          <button class="btn btn-primary" onclick="Exercise.close()">Zamknij</button>
        </div>`;
      return;
    }

    this._rpgStepData = res;
    this._rpgRenderStage();
  },

  _rpgRenderStage() {
    const step = this._rpgStepData;
    const w = this.data[this._rpgStage - 1];
    
    // Serca
    let heartsHtml = "";
    for (let i = 0; i < 3; i++) {
      if (i < this._rpgHearts) {
        heartsHtml += `<span class="rpg-heart" style="display:inline-block">❤️</span>`;
      } else {
        heartsHtml += `<span style="font-size:18px;opacity:0.3;display:inline-block">🖤</span>`;
      }
    }

    // Wyróżnienie słowa w tekście angielskim
    let storyHtml = step.story || "";
    storyHtml = storyHtml.replace(/\*\*([^*]+)\*\*/g, '<strong style="color:#c084fc;font-size:16px">$1</strong>');

    document.getElementById('modalBody').innerHTML = `
      <div style="padding:16px 12px;max-width:440px;margin:0 auto">
        <div class="rpg-status-bar">
          <span class="rpg-stage-indicator">Etap ${this._rpgStage} z 5</span>
          <div class="rpg-hearts-container">${heartsHtml}</div>
        </div>

        <div style="background:rgba(124, 58, 237, 0.08);border:1px solid rgba(124, 58, 237, 0.25);border-radius:12px;padding:10px 14px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-size:10px;font-weight:800;color:#a78bfa;text-transform:uppercase;letter-spacing:1px">Słowo kluczowe</div>
            <div style="font-size:16px;font-weight:900;color:#ffffff">${w.word}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:10px;font-weight:800;color:var(--text3);text-transform:uppercase;letter-spacing:1px">Tłumaczenie</div>
            <div style="font-size:14px;font-weight:700;color:#c084fc">${w.translation}</div>
          </div>
        </div>

        <div class="rpg-story-card">
          <div class="rpg-story-title">Historia</div>
          <div style="color:#ffffff;line-height:1.75">${storyHtml}</div>
          ${step.story_pl ? `<div class="rpg-story-pl">${step.story_pl}</div>` : ''}
        </div>

        <div style="font-size:12px;color:var(--text3);font-weight:700;text-transform:uppercase;margin:12px 0 6px">Co robisz?</div>
        <div class="rpg-choices-list">
          ${step.choices.map((c, idx) => `
            <button class="rpg-choice-btn" id="rpgChoiceBtn_${idx}" onclick="Exercise._rpgSelectChoice(${idx})">
              <span class="rpg-choice-text">${c.text}</span>
              <span class="rpg-choice-pl">${c.text_pl || ''}</span>
            </button>
          `).join('')}
        </div>
        <div id="rpgFeedback" style="margin-top:12px"></div>
      </div>`;
  },

  _rpgSelectChoice(choiceIdx) {
    const step = this._rpgStepData;
    const choice = step.choices[choiceIdx];
    const feedbackEl = document.getElementById('rpgFeedback');
    if (!feedbackEl) return;

    // Zablokuj klikniętą opcję (albo wszystkie jeśli poprawna)
    if (choice.is_correct) {
      // Wyłącz wszystkie
      step.choices.forEach((_, i) => {
        const btn = document.getElementById(`rpgChoiceBtn_${i}`);
        if (btn) btn.disabled = true;
      });
      
      const choiceBtn = document.getElementById(`rpgChoiceBtn_${choiceIdx}`);
      if (choiceBtn) choiceBtn.classList.add('rpg-choice-correct');

      this.score++;
      this.xpEarned += 10;
      this.setScore();

      feedbackEl.innerHTML = `
        <div class="rpg-feedback-alert" style="background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.3);color:var(--green)">
          <span style="font-size:20px">💚</span>
          <div>
            <strong>Dobry wybór!</strong> ${choice.effect || "Ruszacie dalej!"}
          </div>
        </div>
        <button class="btn btn-primary" style="width:100%;margin-top:10px;padding:14px" onclick="Exercise._rpgNext(${choiceIdx})">
          Kontynuuj przygodę →
        </button>`;
    } else {
      // Błędna odpowiedź
      const choiceBtn = document.getElementById(`rpgChoiceBtn_${choiceIdx}`);
      if (choiceBtn) {
        choiceBtn.classList.add('rpg-choice-wrong');
        choiceBtn.disabled = true;
      }

      this._rpgHearts--;
      
      // Odśwież serduszka w status barze
      let heartsHtml = "";
      for (let i = 0; i < 3; i++) {
        if (i < this._rpgHearts) {
          heartsHtml += `<span class="rpg-heart" style="display:inline-block">❤️</span>`;
        } else {
          heartsHtml += `<span style="font-size:18px;opacity:0.3;display:inline-block">🖤</span>`;
        }
      }
      const container = document.querySelector('.rpg-hearts-container');
      if (container) container.innerHTML = heartsHtml;

      if (this._rpgHearts <= 0) {
        // Wszystkie przyciski wyłączone
        step.choices.forEach((_, i) => {
          const btn = document.getElementById(`rpgChoiceBtn_${i}`);
          if (btn) btn.disabled = true;
        });

        feedbackEl.innerHTML = `
          <div class="rpg-feedback-alert" style="background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.3);color:var(--red)">
            <span style="font-size:20px">☠️</span>
            <div>
              <strong>Koniec gry!</strong> ${choice.effect || "Straciłeś ostatnie serduszko."}
            </div>
          </div>
          <button class="btn btn-primary" style="width:100%;margin-top:10px;padding:14px" onclick="Exercise._rpgShowResult(false)">
            Pokaż podsumowanie 💀
          </button>`;
      } else {
        feedbackEl.innerHTML = `
          <div class="rpg-feedback-alert" style="background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.3);color:var(--red)">
            <span style="font-size:20px">💔</span>
            <div>
              <strong>Błędna decyzja!</strong> ${choice.effect || "Tracisz serduszko."} Wybierz inną akcję!
            </div>
          </div>`;
      }
    }
  },

  async _rpgNext(correctChoiceIdx) {
    const step = this._rpgStepData;
    const choice = step.choices[correctChoiceIdx];
    
    // Zapisz historię dla Gemini
    this._rpgPreviousStory += `\nNarrative: ${step.story}\nAction: ${choice.text}\nResult: Success.`;
    
    this._rpgStage++;
    if (this._rpgStage > 5) {
      this._rpgShowResult(true);
    } else {
      await this._rpgLoadStage();
    }
  },

  _rpgShowResult(victory) {
    const pct = Math.round(this.score / 5 * 100);
    const emoji = victory ? '👑' : '💀';
    const title = victory ? 'Przygoda ukończona pomyślnie!' : 'Zginąłeś w głębinach przygody!';
    const desc = victory 
      ? `Brawo! Pokonałeś wszystkie niebezpieczeństwa i pomyślnie doprowadziłeś historię do końca (${this.score}/5 poprawnych).`
      : `Straciłeś wszystkie serduszka na etapie ${this._rpgStage} z 5. Spróbuj jeszcze raz!`;

    document.getElementById('modalBody').innerHTML = `
      <div style="text-align:center;padding:30px 20px;max-width:400px;margin:0 auto">
        <div style="font-size:64px;margin-bottom:16px;filter:drop-shadow(0 4px 10px rgba(0,0,0,0.3))">${emoji}</div>
        <h3 style="color:var(--text1);margin-bottom:8px;font-size:18px">${title}</h3>
        <p style="color:var(--text3);font-size:13.5px;line-height:1.5;margin-bottom:20px">${desc}</p>
        
        <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:16px;padding:16px;margin-bottom:24px;display:flex;justify-content:space-around">
          <div>
            <div style="font-size:10px;font-weight:800;color:var(--text3);text-transform:uppercase;margin-bottom:4px">Poprawne akcje</div>
            <div style="font-size:24px;font-weight:900;color:#ffffff">${this.score}/5</div>
          </div>
          <div style="border-left:1px solid var(--border)"></div>
          <div>
            <div style="font-size:10px;font-weight:800;color:var(--text3);text-transform:uppercase;margin-bottom:4px">Zdobyte doświadczenie</div>
            <div style="font-size:24px;font-weight:900;color:var(--accent)">+${this.xpEarned} XP</div>
          </div>
        </div>

        <div style="display:flex;gap:10px;justify-content:center">
          <button class="btn btn-primary" style="flex:1;padding:12px" onclick="Exercise.startRpgAdventure()">
            Graj ponownie 🔄
          </button>
          <button class="btn btn-outline" style="flex:1;padding:12px" onclick="Exercise.close()">
            Zakończ
          </button>
        </div>
      </div>`;
  },

  tutDone() {
    localStorage.setItem('tutorial_v1_done', '1');
    const ov = document.getElementById('tutorialOverlay');
    if (ov) { ov.style.opacity = '0'; setTimeout(() => ov.classList.add('hidden'), 300); }
  }
});
