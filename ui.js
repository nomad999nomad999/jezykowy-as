/* ── UI ── */
const UI = {
  goTo(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('page-' + page).classList.add('active');
    const nb = document.getElementById('nav-' + page);
    if (nb) nb.classList.add('active');
    const titles = { home: 'Językowy AS', classify: 'Nowe słowa', lists: 'Moje listy', exercises: 'Ćwiczenia', stats: 'Postęp' };
    document.getElementById('pageTitle').textContent = titles[page] || '';
    if (page === 'home') Home.load();
    if (page === 'stats') Stats.load();
    if (page === 'lists') Lists.load();
  },

  openSettings() {
    const enabled = localStorage.getItem('gemini_api_enabled') !== 'false';
    const key = localStorage.getItem('gemini_api_key') || '';
    
    const enabledCheckbox = document.getElementById('settingsGeminiEnabled');
    const keySection = document.getElementById('settingsGeminiKeySection');
    const keyInput = document.getElementById('settingsGeminiKey');

    enabledCheckbox.checked = enabled;
    keyInput.value = key;
    keySection.style.display = enabled ? 'block' : 'none';

    enabledCheckbox.onchange = (e) => {
      keySection.style.display = e.target.checked ? 'block' : 'none';
    };

    document.getElementById('settingsModal').classList.remove('hidden');
  },

  closeSettings() {
    document.getElementById('settingsModal').classList.add('hidden');
  },

  saveSettings() {
    const enabled = document.getElementById('settingsGeminiEnabled').checked;
    const key = document.getElementById('settingsGeminiKey').value.trim();
    localStorage.setItem('gemini_api_enabled', enabled ? 'true' : 'false');
    localStorage.setItem('gemini_api_key', key);
    alert('Ustawienia zapisane pomyślnie! 💾');
    this.closeSettings();
  }
};

/* ── Stats ── */
const Stats = {
  async load() {
    const [d, lb, history, exercises, hardest, review, promotions, vocabChart, quests, achievements] = await Promise.all([
      API.get('/api/stats'),
      API.get('/api/leaderboard'),
      API.get('/api/stats/history?days=14'),
      API.get('/api/stats/exercises'),
      API.get('/api/stats/hardest'),
      API.get('/api/stats/review'),
      API.get('/api/stats/promotions'),
      API.get('/api/stats/vocab-chart'),
      API.get('/api/quests'),
      API.get('/api/achievements'),
    ]);

    // Misje Dzienne
    const questsEl = document.getElementById('questsList');
    if (questsEl && quests && quests.length) {
      const done = quests.filter(q => q.completed).length;
      const badge = document.getElementById('questsBadge');
      if (badge) badge.textContent = `${done}/3 ukończone`;
      questsEl.innerHTML = quests.map(q => {
        const pct = Math.min(100, Math.round(q.progress / q.target * 100));
        const isDone = q.completed;
        return `<div class="quest-card ${isDone ? 'quest-done' : ''}">
          <div class="quest-top">
            <span class="quest-icon">${q.icon}</span>
            <div class="quest-info">
              <div class="quest-desc">${q.description}</div>
              <div class="quest-prog-text">${q.progress}/${q.target}</div>
            </div>
            <div class="quest-xp">${isDone ? '✅' : ''}+${q.xp_reward} XP</div>
          </div>
          <div class="quest-bar-wrap">
            <div class="quest-bar-fill" style="width:${pct}%"></div>
          </div>
        </div>`;
      }).join('');
    }

    // Odznaki
    const badgesEl = document.getElementById('badgesGrid');
    if (badgesEl && achievements && achievements.length) {
      const earnedCount = achievements.filter(b => b.earned).length;
      const badgeLabel = document.getElementById('badgesEarned');
      if (badgeLabel) badgeLabel.textContent = `${earnedCount}/${achievements.length} zdobytych`;
      badgesEl.innerHTML = achievements.map(b => `
        <div class="badge-item ${b.earned ? 'badge-earned' : 'badge-locked'}" title="${b.desc}${b.earned_at ? '\nZdobyta: ' + b.earned_at.slice(0,10) : ''}">
          <div class="badge-icon">${b.earned ? b.icon : '🔒'}</div>
          <div class="badge-name">${b.name}</div>
          ${b.earned ? '<div class="badge-check">✓</div>' : ''}
        </div>`).join('');
    }

    // Główne liczby
    document.getElementById('stZnam').textContent = d.znam;
    document.getElementById('stTroche').textContent = d.troche;
    document.getElementById('stNie').textContent = d.nie_znam;
    document.getElementById('stXP').textContent = d.xp;
    document.getElementById('xpDisplay').textContent = d.xp + ' XP';
    document.getElementById('levelBadge').textContent = d.level;
    document.getElementById('streakBadge').textContent = `🔥 ${d.streak.current_streak}`;
    document.getElementById('stStreak').textContent = d.streak.current_streak;
    document.getElementById('stLongest').textContent = `Rekord: ${d.streak.longest_streak} dni`;

    // Postęp COCA
    const pct = d.coca_total > 0 ? Math.round(d.coca_classified / d.coca_total * 100) : 0;
    document.getElementById('cocaBar').style.width = pct + '%';
    document.getElementById('cocaLabel').textContent = `${d.coca_classified} / ${d.coca_total} słów COCA`;

    // CEFR na podstawie liczby znanych słów COCA (realistyczne progi)
    const zn = d.znam;
    let cefr = 'A1';
    if (zn >= 3000) cefr = 'C2';
    else if (zn >= 2000) cefr = 'C1';
    else if (zn >= 1300) cefr = 'B2+';
    else if (zn >= 800)  cefr = 'B2';
    else if (zn >= 400)  cefr = 'B1';
    else if (zn >= 150)  cefr = 'A2';
    document.getElementById('cefrBadge').textContent = cefr;

    // Wykres znajomości słownika
    const vcEl = document.getElementById('vocabChart');
    if (vcEl && vocabChart && vocabChart.length) {
      const tierNames = { top100:'TOP 100', top500:'TOP 101–500', top1000:'TOP 501–1000', top2000:'TOP 1001–2000', top3000:'TOP 2001–3000' };
      vcEl.innerHTML = vocabChart.map(t => {
        const classified = t.znam + t.troche + t.nie_znam;
        const pctZ = t.total > 0 ? (t.znam / t.total * 100).toFixed(0) : 0;
        const pctT = t.total > 0 ? (t.troche / t.total * 100).toFixed(0) : 0;
        const pctN = t.total > 0 ? (t.nie_znam / t.total * 100).toFixed(0) : 0;
        const pctU = t.total > 0 ? Math.max(0, 100 - pctZ - pctT - pctN) : 100;
        return `<div class="vc-row">
          <div class="vc-label">
            <span class="vc-tier">${tierNames[t.label] || t.label}</span>
            <span class="vc-count">${t.znam}/${t.total} znanych</span>
          </div>
          <div class="vc-bar-wrap">
            <div class="vc-bar">
              <div class="vc-seg vc-green"  style="width:${pctZ}%" title="✅ Znam: ${t.znam}"></div>
              <div class="vc-seg vc-yellow" style="width:${pctT}%" title="⚠️ Trochę: ${t.troche}"></div>
              <div class="vc-seg vc-red"    style="width:${pctN}%" title="❌ Nie znam: ${t.nie_znam}"></div>
              <div class="vc-seg vc-gray"   style="width:${pctU}%" title="Nieskl.: ${t.total - classified}"></div>
            </div>
            <span class="vc-pct">${pctZ}%</span>
          </div>
        </div>`;
      }).join('') + `
      <div class="vc-legend">
        <span class="vc-leg-item"><span class="vc-dot vc-green"></span>Znam</span>
        <span class="vc-leg-item"><span class="vc-dot vc-yellow"></span>Trochę</span>
        <span class="vc-leg-item"><span class="vc-dot vc-red"></span>Nie znam</span>
        <span class="vc-leg-item"><span class="vc-dot vc-gray"></span>Nieskl.</span>
      </div>`;
    }


    // Historia aktywności (mini wykres słupkowy)
    const histEl = document.getElementById('activityHistory');
    if (histEl) {
      if (!history.length) {
        histEl.innerHTML = '<p style="text-align:center;color:var(--text3);font-size:13px">Brak danych — zacznij ćwiczyć!</p>';
      } else {
        // Odwróć kolejność: dziś po lewej, przeszłość po prawej
        const sortedHistory = [...history].reverse();
        const maxXp = Math.max(...sortedHistory.map(h => h.xp || 1), 1);
        histEl.innerHTML = sortedHistory.map(h => {
          const xp = h.xp || 0;
          const barH = Math.max(8, Math.round((xp / maxXp) * 60));
          const color = xp >= 100 ? 'var(--green)' : xp >= 30 ? 'var(--yellow)' : xp > 0 ? 'var(--red)' : 'var(--border)';
          const day = h.day ? h.day.slice(5) : '';
          const label = xp > 0 ? xp + ' XP' : '—';
          return `<div class="hist-bar-wrap" title="${h.day}: ${xp} XP">
            <div class="hist-acc">${label}</div>
            <div class="hist-bar" style="height:${barH}px;background:${color}"></div>
            <div class="hist-label">${day}</div>
          </div>`;
        }).join('');
      }
    }


    // Awanse słów
    const statusLabel = { NIE_ZNAM:'❌ Nie znam', TROCHE:'⚠️ Trochę', ZNAM:'✅ Znam' };
    const statusColor = { NIE_ZNAM:'var(--red)', TROCHE:'var(--yellow)', ZNAM:'var(--green)' };
    const promoTotalsEl = document.getElementById('promotionTotals');
    const promoFeedEl = document.getElementById('promotionFeed');
    if (promoTotalsEl) {
      const tot = promotions.totals || [];
      // Filtruj tylko awanse (nie degradacje)
      const upgrades = tot.filter(t =>
        (t.from_status==='NIE_ZNAM' && t.to_status==='TROCHE') ||
        (t.from_status==='NIE_ZNAM' && t.to_status==='ZNAM') ||
        (t.from_status==='TROCHE' && t.to_status==='ZNAM')
      );
      const downgrades = tot.filter(t =>
        (t.from_status==='ZNAM' && (t.to_status==='TROCHE'||t.to_status==='NIE_ZNAM')) ||
        (t.from_status==='TROCHE' && t.to_status==='NIE_ZNAM')
      );
      const totalPromos = upgrades.reduce((s,t)=>s+t.cnt,0);
      if (!tot.length) {
        promoTotalsEl.innerHTML = '<p style="color:var(--text3);font-size:13px;text-align:center">Brak awansów — przenieś słowo na wyższą listę!</p>';
      } else {
        promoTotalsEl.innerHTML = `<div class="promo-summary">
          <div class="promo-total-big">${totalPromos} <span>awansów łącznie</span></div>
          <div class="promo-total-rows">` +
          upgrades.map(t => `<div class="promo-total-row promo-up">
            <span style="color:${statusColor[t.from_status]}">${statusLabel[t.from_status]}</span>
            <span class="promo-arrow">→</span>
            <span style="color:${statusColor[t.to_status]}">${statusLabel[t.to_status]}</span>
            <span class="promo-cnt">${t.cnt}x</span>
          </div>`).join('') +
          downgrades.map(t => `<div class="promo-total-row promo-down">
            <span style="color:${statusColor[t.from_status]}">${statusLabel[t.from_status]}</span>
            <span class="promo-arrow">↓</span>
            <span style="color:${statusColor[t.to_status]}">${statusLabel[t.to_status]}</span>
            <span class="promo-cnt">${t.cnt}x</span>
          </div>`).join('') +
          '</div></div>';
      }
    }
    if (promoFeedEl) {
      const rec = promotions.recent || [];
      if (!rec.length) {
        promoFeedEl.innerHTML = '';
      } else {
        const statusIcon = { NIE_ZNAM:'❌', TROCHE:'⚠️', ZNAM:'✅' };
        promoFeedEl.innerHTML = '<div class="promo-feed-title">Ostatnie 15 zmian:</div>' +
          rec.map(p => {
            const isUp = (p.from_status==='NIE_ZNAM'&&(p.to_status==='TROCHE'||p.to_status==='ZNAM'))||(p.from_status==='TROCHE'&&p.to_status==='ZNAM');
            return `<div class="promo-feed-row ${isUp?'promo-feed-up':'promo-feed-down'}">
              <span class="promo-word">${p.word_text}</span>
              <span class="promo-change">${statusIcon[p.from_status]}${isUp?'→':'↓'}${statusIcon[p.to_status]}</span>
              <span class="promo-date">${p.day}</span>
            </div>`;
          }).join('');
      }
    }

    // Dokładność per ćwiczenie
    const exNames = { flashcards:'🃏 Fiszki', multiple_choice:'🎯 Wybór', fill_blank:'✍️ Luka', match_pairs:'🔗 Pary', speed_round:'⚡ Speed', context:'🧩 AI' };
    const exEl = document.getElementById('exerciseStats');
    if (exEl) {
      if (!exercises.length) {
        exEl.innerHTML = '<p style="color:var(--text3);font-size:13px;text-align:center">Brak sesji ćwiczeń</p>';
      } else {
        exEl.innerHTML = exercises.map(e => {
          const acc = e.accuracy || 0;
          const color = acc >= 70 ? 'var(--green)' : acc >= 40 ? 'var(--yellow)' : 'var(--red)';
          return `<div class="ex-stat-row">
            <span class="ex-stat-name">${exNames[e.exercise_type] || e.exercise_type}</span>
            <div class="ex-stat-bar-wrap"><div class="ex-stat-bar" style="width:${acc}%;background:${color}"></div></div>
            <span class="ex-stat-pct" style="color:${color}">${acc}%</span>
          </div>`;
        }).join('');
      }
    }

    // Najtrudniejsze słowa
    const hardEl = document.getElementById('hardestWords');
    if (hardEl) {
      if (!hardest.length) {
        hardEl.innerHTML = '<p style="color:var(--text3);font-size:13px;text-align:center">Ćwicz więcej aby zobaczyć statystyki!</p>';
      } else {
        hardEl.innerHTML = hardest.map(w => {
          const acc = w.accuracy ?? 0;
          const color = acc >= 70 ? 'var(--green)' : acc >= 40 ? 'var(--yellow)' : 'var(--red)';
          return `<div class="word-stat-row">
            <div><span class="word-stat-word">${w.word}</span><span class="word-stat-trans">${w.translation}</span></div>
            <span class="word-stat-acc" style="color:${color}">${acc}% (${w.review_count}x)</span>
          </div>`;
        }).join('');
      }
    }

    // Słowa do powtórki
    const revEl = document.getElementById('reviewWords');
    if (revEl) {
      if (!review.length) {
        revEl.innerHTML = '<p style="color:var(--green);font-size:13px;text-align:center">✅ Wszystko pod kontrolą!</p>';
      } else {
        revEl.innerHTML = review.map(w => `
          <div class="word-stat-row">
            <div>
              <span class="word-stat-word">${w.word}</span>
              <span class="word-stat-trans">${w.translation}</span>
            </div>
            <span class="word-stat-acc" style="color:var(--red)">${w.accuracy}% ⚠️</span>
          </div>`).join('');
      }
    }

    // Leaderboard
    const medals = ['🥇', '🥈', '🥉'];
    document.getElementById('leaderboard').innerHTML = lb.map((u, i) => `
      <div class="lb-item ${u.id == Session.userId ? 'me' : ''}">
        <div class="lb-rank">${medals[i] || (i + 1)}</div>
        <div class="lb-name">${u.username} ${u.id == Session.userId ? '(Ty)' : ''}</div>
        <div><div class="lb-xp">${u.xp} XP</div><div class="lb-level">${u.level} • Zna: ${u.znam_count || 0}</div></div>
      </div>`).join('');
  }
};

/* ── Classify ── */
/* ── Classify ── */
const Classify = {
  batch: [],
  idx: 0,
  batchStats: { ZNAM: 0, TROCHE: 0, NIE_ZNAM: 0, skipped: 0 },
  async load() {
    const uid = localStorage.getItem('uid') || 'guest';
    const seen = localStorage.getItem(`coca_onboarding_seen_${uid}`);
    if (!seen) {
      document.getElementById('cocaOnboarding').classList.remove('hidden');
      return;
    }
    const container = document.getElementById('classifyCards');
    if (container) {
      container.innerHTML = '<div style="text-align:center;padding:40px"><div class="spinner" style="margin:auto"></div></div>';
    }
    try {
      this.batch = await API.get('/api/classify/batch?n=15');
      this.idx = 0;
      this.batchStats = { ZNAM: 0, TROCHE: 0, NIE_ZNAM: 0, skipped: 0 };
      this.render();
    } catch(e) {
      console.error("Failed to load classify batch:", e);
    }
  },
  closeOnboarding() {
    const uid = localStorage.getItem('uid') || 'guest';
    localStorage.setItem(`coca_onboarding_seen_${uid}`, '1');
    document.getElementById('cocaOnboarding').classList.add('hidden');
    this.load();
  },
  async render() {
    const container = document.getElementById('classifyCards');
    const done = document.getElementById('classifyDone');
    const info = document.getElementById('classifyInfo');
    
    if (this.batch && this.batch.length > 0 && this.idx >= this.batch.length) {
      this.showSummary();
      return;
    }

    if (!this.batch || !this.batch.length) {
      if (container) container.innerHTML = '';
      if (info) info.textContent = '';
      if (done) done.classList.remove('hidden');
      return;
    }
    
    if (done) done.classList.add('hidden');
    const w = this.batch[this.idx];
    if (info) info.textContent = `Słowo ${this.idx + 1} z ${this.batch.length}`;
    
    const progressPct = Math.round((this.idx / this.batch.length) * 100);
    const progressBar = document.getElementById('classifyProgressBar');
    if (progressBar) progressBar.style.width = progressPct + '%';

    const r = w.frequency_rank;
    const color =
      r <= 300  ? '#f97316' :
      r <= 500  ? '#eab308' :
      r <= 1000 ? '#22c55e' :
      r <= 2000 ? '#3b82f6' :
      r <= 3000 ? '#a855f7' : '#6b7280';
    const rankLabel = r && r < 9999 ? `#${r}` : '?';

    // Auto speak
    setTimeout(() => Speech.speak(w.word), 150);

    if (container) {
      container.innerHTML = `
        <div class="classify-card single-classify-card">
          <div class="cc-meta">
            <span class="cc-rank" style="background:${color}22;color:${color}" title="Ranking COCA">${rankLabel}</span>
          </div>
          <div class="cc-word-section">
            <div class="cc-word">${w.word}</div>
            <button class="sq-speak-btn" onclick="Speech.speak('${w.word.replace(/'/g,"\\'")}');">🔊 Odsłuchaj</button>
          </div>
          <div class="cc-translation-section">
            <div class="cc-translation">${w.translation}</div>
          </div>
          <div class="cc-btns single-row">
            <button class="btn-znam" onclick="Classify.classifyClick('${w.word.replace(/'/g,"\\'")}','${w.translation.replace(/'/g,"\\\\'")}','ZNAM')">✅ Znam</button>
            <button class="btn-troche" onclick="Classify.classifyClick('${w.word.replace(/'/g,"\\'")}','${w.translation.replace(/'/g,"\\\\'")}','TROCHE')">⚠️ Trochę</button>
            <button class="btn-nie" onclick="Classify.classifyClick('${w.word.replace(/'/g,"\\'")}','${w.translation.replace(/'/g,"\\\\'")}','NIE_ZNAM')">❌ Nie znam</button>
          </div>
          <button class="btn-skip" style="margin-top:20px;width:100%" onclick="Classify.skipClick('${w.word.replace(/'/g,"\\'")}')">⏭️ Pomiń to słowo</button>
        </div>
      `;
    }
  },
  classifyClick(word, translation, status) {
    if (!this.batchStats) {
      this.batchStats = { ZNAM: 0, TROCHE: 0, NIE_ZNAM: 0, skipped: 0 };
    }
    this.batchStats[status]++;

    // Fire API call in background
    API.post('/api/classify/word', { word, translation, status }).then(res => {
      if (res && res.xp > 0) showXP(`+${res.xp} XP`);
      if (res && res.milestone) {
        showClassifyMilestone(res.milestone.count);
      }
      if (res && res.quests_done && res.quests_done.length > 0) {
        res.quests_done.forEach((q, i) => {
          setTimeout(() => showQuestComplete(q), i * 1200);
        });
      }
      if (res && res.badges_earned && res.badges_earned.length > 0) {
        const delay = (res.quests_done ? res.quests_done.length : 0) * 1200;
        res.badges_earned.forEach((b, i) => {
          setTimeout(() => showBadgeEarned(b), delay + i * 1500);
        });
      }
    }).catch(e => console.error("Classify error:", e));

    // Advance immediately
    this.idx++;
    this.render();
  },
  skipClick(word) {
    if (!this.batchStats) {
      this.batchStats = { ZNAM: 0, TROCHE: 0, NIE_ZNAM: 0, skipped: 0 };
    }
    this.batchStats.skipped++;

    // Fire API call in background
    API.post('/api/classify/skip', { word }).catch(e => console.error("Skip error:", e));
    
    // Advance immediately
    this.idx++;
    this.render();
  },
  showSummary() {
    const container = document.getElementById('classifyCards');
    const info = document.getElementById('classifyInfo');
    if (info) info.textContent = "Podsumowanie partii";
    
    // update progress bar to 100%
    const progressBar = document.getElementById('classifyProgressBar');
    if (progressBar) progressBar.style.width = '100%';

    const stats = this.batchStats || { ZNAM: 0, TROCHE: 0, NIE_ZNAM: 0, skipped: 0 };
    if (container) {
      container.innerHTML = `
        <div class="classify-card single-classify-card summary-card" style="text-align:center; padding: 30px 20px; width:100%;">
          <div style="font-size:52px; margin-bottom: 16px;">🎯</div>
          <h2 style="color:var(--text1); margin-bottom: 8px; font-weight:800; font-size:24px;">Świetnie!</h2>
          <p style="color:var(--text3); font-size:15px; margin-bottom: 24px;">Kolejna porcja słów została sklasyfikowana.</p>
          
          <div style="display:flex; flex-direction:column; gap:12px; margin-bottom: 30px; text-align: left; max-width: 280px; width:100%; margin-left: auto; margin-right: auto;">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid var(--surface2); padding-bottom: 8px;">
              <span style="color:var(--green); font-weight:600;">✅ Znam</span>
              <strong style="color:var(--text1); font-size:18px;">${stats.ZNAM}</strong>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid var(--surface2); padding-bottom: 8px;">
              <span style="color:var(--yellow); font-weight:600;">⚠️ Trochę</span>
              <strong style="color:var(--text1); font-size:18px;">${stats.TROCHE}</strong>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid var(--surface2); padding-bottom: 8px;">
              <span style="color:var(--red); font-weight:600;">❌ Nie znam</span>
              <strong style="color:var(--text1); font-size:18px;">${stats.NIE_ZNAM}</strong>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; padding-bottom: 8px;">
              <span style="color:var(--text3); font-weight:600;">⏭️ Pominięte</span>
              <strong style="color:var(--text1); font-size:18px;">${stats.skipped}</strong>
            </div>
          </div>
          
          <button class="btn btn-primary" style="width:100%; font-size:16px; padding:14px; border-radius:12px;" onclick="Classify.loadNextBatch()">
            Kolejna partia (15 słówek) ➔
          </button>
        </div>
      `;
    }
  },
  async loadNextBatch() {
    const container = document.getElementById('classifyCards');
    const info = document.getElementById('classifyInfo');
    if (info) info.textContent = "Wczytywanie kolejnej partii...";
    if (container) container.innerHTML = '<div style="text-align:center;padding:40px"><div class="spinner" style="margin:auto"></div></div>';
    try {
      this.batch = await API.get('/api/classify/batch?n=15');
      this.idx = 0;
      this.batchStats = { ZNAM: 0, TROCHE: 0, NIE_ZNAM: 0, skipped: 0 };
      this.render();
    } catch(e) {
      console.error("Failed to fetch next classify batch:", e);
    }
  }
};

/* ── Lists ── */
const Lists = {
  currentStatus: 'NIE_ZNAM',
  async load() { this.currentStatus = 'NIE_ZNAM'; await this.fetchAndRender(this.currentStatus); await this.loadLearnedCount(); },
  async loadLearnedCount() {
    const words = await API.get('/api/words/learned');
    const el = document.getElementById('learnedCount');
    if (el) el.textContent = words.length;
  },
  switch(btn, status) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    this.currentStatus = status;
    document.getElementById('searchInput').value = '';
    this.fetchAndRender(status);
  },
  async showLearned(btn) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    this.currentStatus = '__learned__';
    document.getElementById('searchInput').value = '';
    const words = await API.get('/api/words/learned');
    this.renderLearnedList(words);
  },
  async fetchAndRender(status) {
    const words = await API.get('/api/words?status=' + status);
    this.renderList(words);
  },
  _rankHtml(w) {
    const rank = w.frequency_rank && w.frequency_rank < 9999 ? w.frequency_rank : null;
    if (!rank) return '';
    const c = rank <= 300 ? '#f97316' : rank <= 500 ? '#eab308' : rank <= 1000 ? '#22c55e' : rank <= 2000 ? '#3b82f6' : rank <= 3000 ? '#a855f7' : '#6b7280';
    return ` <span class="wi-rank" style="color:${c};font-size:11px;font-weight:600;opacity:0.85">#${rank}</span>`;
  },
  renderList(words) {
    const el = document.getElementById('wordsList');
    if (!words.length) { el.innerHTML = '<p style="text-align:center;color:var(--text3);padding:40px">Brak słów</p>'; return; }
    el.innerHTML = words.map(w => `
      <div class="word-item" onclick="WordModal.open(${w.id},'${w.word.replace(/'/g,"\\'")}','${(w.translation||'').replace(/'/g,"\\'")}','${w.status}')">
        <div><div class="wi-word">${w.word}${this._rankHtml(w)}</div><div class="wi-trans">${w.translation || '—'}</div></div>
        <div class="wi-dot dot-${w.status}"></div>
      </div>`).join('');
  },
  renderLearnedList(words) {
    const el = document.getElementById('wordsList');
    if (!words.length) {
      el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text3)"><div style="font-size:48px">🎓</div><p style="margin-top:12px">Jeszcze żadne słowo nie zostało wyuczone przez ćwiczenia.<br><small>Gdy przeniesiesz słowo z NIE_ZNAM lub TROCHĘ do ZNAM — pojawi się tutaj.</small></p></div>';
      return;
    }
    el.innerHTML = `<div style="padding:10px 0 4px;color:var(--text2);font-size:12px;font-weight:600">${words.length} wyuczonych słów — od najnowszego</div>` +
      words.map(w => {
        const acc = w.review_count > 0 ? Math.round(w.correct_count / w.review_count * 100) : null;
        const dateStr = w.learned_at ? w.learned_at.slice(0,10) : '';
        return `<div class="word-item learned-item" onclick="WordModal.open(${w.id},'${w.word.replace(/'/g,"\\'")}','${(w.translation||'').replace(/'/g,"\\'")}','${w.status}')">
          <div>
            <div class="wi-word">${w.word}${this._rankHtml(w)} <span class="learned-tag">🎓</span></div>
            <div class="wi-trans">${w.translation || '—'}</div>
            <div class="wi-meta">${dateStr}${acc !== null ? ` · ${acc}% poprawności` : ''}</div>
          </div>
          <div class="wi-dot dot-ZNAM"></div>
        </div>`;
      }).join('');
  },
  async search(q) {
    if (this.currentStatus === '__learned__') {
      if (!q) { const words = await API.get('/api/words/learned'); this.renderLearnedList(words); return; }
      const words = await API.get('/api/words/learned');
      this.renderLearnedList(words.filter(w => w.word.toLowerCase().includes(q.toLowerCase()) || (w.translation||'').toLowerCase().includes(q.toLowerCase())));
      return;
    }
    if (!q) { this.fetchAndRender(this.currentStatus); return; }
    // Przekazuj aktualny status do wyszukiwania — słowo musi być w tej liście
    const url = '/api/words/search?q=' + encodeURIComponent(q) + '&status=' + encodeURIComponent(this.currentStatus);
    this.renderList(await API.get(url));
  }
};

/* ── Word Modal ── */
const WordModal = {
  wordId: null, word: '',
  async open(id, word, translation, status) {
    this.wordId = id; this.word = word;
    document.getElementById('wmWord').textContent = word;
    document.getElementById('wmTranslation').textContent = translation || '(brak tłumaczenia)';
    const sentenceEl = document.getElementById('wmSentence');
    if (translation) {
      sentenceEl.textContent = 'Ładowanie…';
    } else {
      sentenceEl.textContent = '';
    }
    document.getElementById('wordModal').classList.remove('hidden');
    if (translation) {
      const s = await API.get(`/api/gemini/sentence?word=${encodeURIComponent(word)}&translation=${encodeURIComponent(translation)}`);
      const el = document.getElementById('wmSentence');
      if (el) el.innerHTML = `<em>${s.sentence}</em><br><small style="color:var(--text3)">${s.sentence_pl}</small>`;
    }
  },
  close() { document.getElementById('wordModal').classList.add('hidden'); },
  speak() { Speech.speak(this.word); },
  async setStatus(status) {
    const res = await API.post(`/api/words/${this.wordId}/status`, { status });
    this.close();
    Lists.load();
    // Pokaż XP popup jeśli był awans
    if (res && res.xp > 0) {
      const mult = res.multiplier > 1 ? ` 🔥×${res.multiplier}` : '';
      showXP(`+${res.xp} XP${mult}`);
      // Aktualizuj licznik XP w nagłówku
      const xpEl = document.getElementById('xpDisplay');
      if (xpEl && res.total_xp) xpEl.textContent = res.total_xp + ' XP';
    }
    // Pokaż milestone jeśli osiągnięty
    if (res && res.milestone) {
      setTimeout(() => showMilestone(res.milestone.count, res.milestone.bonus), 800);
    }
  },
  async deleteWord() {
    if (confirm(`Czy na pewno chcesz usunąć słowo "${this.word}" ze wszystkich swoich list? (Słowo wróci do puli nieznanych/nowych)`)) {
      await API.post(`/api/words/${this.wordId}/delete`);
      this.close();
      Lists.load();
    }
  }
};

function showXP(text) {
  const el = document.createElement('div');
  el.className = 'xp-popup';
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1600);
}

function showMilestone(count, bonus) {
  const el = document.createElement('div');
  el.className = 'milestone-popup';
  el.innerHTML = `🏆 Milestone!<br><strong>${count} wyuczonych słów!</strong><br>+${bonus} XP bonus!`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}


function showClassifyMilestone(count) {
  const presets = {
    50:   ['🎉','Świetna robota!',`Adi jest pod wrażeniem — sklasyfikowałeś ${count} najpopularniejszych słów!`],
    100:  ['🔥','Niesamowite!',`${count} słów COCA za tobą — angielski rośnie w siłę!`],
    150:  ['⭐','150 słów!',`Znasz top ${count} najczęstszych słów po angielsku!`],
    200:  ['💪','200 słów!','Adi jest z Ciebie dumny — jesteś w połowie drogi do top 500!'],
    250:  ['🚀','Ćwierć tysiąca!','Prawie połowa top 500 najczęstszych słów!'],
    300:  ['🏅','TOP 300!','Znasz top 300 najczęstszych angielskich słów!'],
    400:  ['🎯','400 słów!','Jeszcze trochę do legendarnego top 500!'],
    500:  ['🏆','TOP 500!','Sklasyfikowałeś 500 najpopularniejszych słów — doskonały wynik!'],
    750:  ['👑','750 słów!','Adi obserwuje — zaawansowany poziom osiągnięty!'],
    1000: ['🎓','1000 słów!','Adi pyta: Gotowy na B2? Tysiąc słów COCA — cel w zasięgu ręki!'],
  };
  const [emoji, title, sub] = presets[count] || ['🎉',`${count} słów!`,`Adi śledzi Twój postęp — ${count} najpopularniejszych słów COCA!`];
  const el = document.createElement('div');
  el.className = 'classify-milestone-popup';
  el.innerHTML = `<div style="font-size:42px;margin-bottom:8px">${emoji}</div><div class="cm-title">${title}</div><div class="cm-sub">${sub}</div><div class="cm-adi">— Adi 🃏</div>`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 5500);
}

function showQuestComplete(q) {
  const el = document.createElement('div');
  el.className = 'quest-complete-popup';
  el.innerHTML = `
    <div class="qcp-icon">${q.icon}</div>
    <div class="qcp-body">
      <div class="qcp-title">Adi docenia Twój wysiłek! 💪</div>
      <div class="qcp-desc">${q.desc}</div>
      <div class="qcp-xp">+${q.xp} XP</div>
    </div>`;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('qcp-show'), 10);
  setTimeout(() => { el.classList.remove('qcp-show'); setTimeout(() => el.remove(), 400); }, 4000);
}

function showBadgeEarned(badge) {
  const el = document.createElement('div');
  el.className = 'badge-earned-popup';
  el.innerHTML = `
    <div class="bep-glow"></div>
    <div class="bep-icon">${badge.icon}</div>
    <div class="bep-body">
      <div class="bep-label">🃏 Adi przyznaje Ci odznakę!</div>
      <div class="bep-name">${badge.name}</div>
      <div class="bep-desc">${badge.desc}</div>
    </div>`;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('bep-show'), 10);
  setTimeout(() => { el.classList.remove('bep-show'); setTimeout(() => el.remove(), 500); }, 5000);
}
