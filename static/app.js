/* ── Reclassify bar helper ── */
function reclassifyBar(wordId, word) {
  return `<div class="reclassify-bar">
    <span>Przenieś:</span>
    <button style="background:var(--green-dim);color:var(--green)" onclick="Exercise.reclassify(${wordId},'ZNAM',this)">✅ Znam</button>
    <button style="background:var(--yellow-dim);color:var(--yellow)" onclick="Exercise.reclassify(${wordId},'TROCHE',this)">⚠️ Trochę</button>
    <button style="background:var(--red-dim);color:var(--red)" onclick="Exercise.reclassify(${wordId},'NIE_ZNAM',this)">❌ Nie znam</button>
  </div>`;
}

/* ── INIT ── */
async function startApp() {
  document.getElementById('accountPickerScreen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('xpDisplay').textContent = (Session.xp || 0) + ' XP';

  // Load stats and classify — independently resilient
  let stats = null;
  try { stats = await API.get('/api/stats'); } catch(e) {}
  try { await Classify.load(); } catch(e) {}

  // Populate header
  if (stats) {
    document.getElementById('xpDisplay').textContent = (stats.xp || 0) + ' XP';
    const streakEl = document.getElementById('streakBadge');
    if (streakEl) streakEl.textContent = '🔥 ' + (stats.streak?.current_streak || stats.streak || 0);
  }

  // Load non-blocking
  try { Stats.load(); } catch(e) {}
  try { Home.load(stats); } catch(e) { console.warn('Home.load error:', e); }

  // Navigate to home
  UI.goTo('home');
}

window.addEventListener('load', async () => {
  try {
    // Zainicjalizuj lokalną bazę danych IndexedDB (Dexie) przed startem aplikacji
    await DB.init();
  } catch(e) {
    console.error("DB.init failed:", e);
  }
  document.getElementById('splash').style.display = 'none';
  if (Session.load()) {
    try { await startApp(); }
    catch (e) { Session.clear(); Auth.showPicker(); }
  } else {
    Auth.showPicker();
  }
});

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

// Automatyczne odnawianie Wake Locka po powrocie do widocznej karty
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible' && Exercise.type === 'hands_free' && Exercise.isPlaying) {
    await Exercise.requestWakeLock();
  }
});
