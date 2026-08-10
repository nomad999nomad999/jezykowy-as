/* ── Session ── */
const Session = {
  userId: null, username: null, xp: 0,
  load() {
    this.userId = parseInt(localStorage.getItem('uid')) || null;
    this.username = localStorage.getItem('uname') || null;
    this.xp = parseInt(localStorage.getItem('uxp')) || 0;
    return this.userId !== null;
  },
  save(uid, name, xp) {
    this.userId = uid; this.username = name; this.xp = xp;
    localStorage.setItem('uid', uid);
    localStorage.setItem('uname', name);
    localStorage.setItem('uxp', xp);
    localStorage.setItem('last_uname', name);
  },
  clear() {
    localStorage.removeItem('uid'); localStorage.removeItem('uname'); localStorage.removeItem('uxp');
    this.userId = null;
  }
};

/* ── API helper ── */
window.API = window.API || {
  async get(url) {
    const r = await fetch(url, { headers: { 'X-User-Id': Session.userId || '' } });
    return r.json();
  },
  async post(url, data) {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Id': Session.userId || '' },
      body: JSON.stringify(data)
    });
    return r.json();
  }
};
const API = window.API;

/* ── Speech ── */
const Speech = {
  activeUtterance: null,
  voices: [],

  init() {
    if (!window.speechSynthesis) return;
    this.loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = () => this.loadVoices();
    }
  },

  loadVoices() {
    if (!window.speechSynthesis) return;
    try {
      this.voices = window.speechSynthesis.getVoices() || [];
    } catch(e) {}
  },

  getVoice(langCode) {
    if (!this.voices || this.voices.length === 0) {
      this.loadVoices();
    }
    const prefix = langCode.split('-')[0].toLowerCase();
    const exact = this.voices.find(v => v.lang && v.lang.toLowerCase().replace('_', '-').startsWith(langCode.toLowerCase()));
    if (exact) return exact;
    const partial = this.voices.find(v => v.lang && v.lang.toLowerCase().startsWith(prefix));
    if (partial) return partial;
    return null;
  },

  speak(word, cancelExisting = true, customRate = 0.85) {
    return new Promise((resolve) => {
      if (!window.speechSynthesis) { resolve(); return; }
      
      try {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
        if (cancelExisting && window.speechSynthesis.speaking) {
          window.speechSynthesis.cancel();
        }
      } catch(e) {}

      const u = new SpeechSynthesisUtterance(word);
      u.lang = 'en-US';
      u.rate = customRate || 0.85;

      const voice = this.getVoice('en-US');
      if (voice) u.voice = voice;

      this.activeUtterance = u;

      let resolved = false;
      const finish = () => {
        if (!resolved) {
          resolved = true;
          this.activeUtterance = null;
          resolve();
        }
      };

      u.onend = finish;
      u.onerror = (err) => {
        console.warn('SpeechSynthesis error:', err);
        finish();
      };

      const delay = (cancelExisting && window.speechSynthesis.speaking) ? 60 : 10;
      setTimeout(() => {
        try {
          window.speechSynthesis.speak(u);
        } catch(e) {
          finish();
        }
      }, delay);

      setTimeout(finish, 8000);
    });
  },

  speakPl(text, cancelExisting = true) {
    return new Promise((resolve) => {
      if (!window.speechSynthesis) { resolve(); return; }
      
      try {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
        if (cancelExisting && window.speechSynthesis.speaking) {
          window.speechSynthesis.cancel();
        }
      } catch(e) {}

      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'pl-PL';
      u.rate = 0.95;

      const voice = this.getVoice('pl-PL');
      if (voice) u.voice = voice;

      this.activeUtterance = u;

      let resolved = false;
      const finish = () => {
        if (!resolved) {
          resolved = true;
          this.activeUtterance = null;
          resolve();
        }
      };

      u.onend = finish;
      u.onerror = (err) => {
        console.warn('SpeechSynthesis error:', err);
        finish();
      };

      const delay = (cancelExisting && window.speechSynthesis.speaking) ? 60 : 10;
      setTimeout(() => {
        try {
          window.speechSynthesis.speak(u);
        } catch(e) {
          finish();
        }
      }, delay);

      setTimeout(finish, 10000);
    });
  }
};

if (typeof window !== 'undefined') {
  Speech.init();
  const unlockAudio = () => {
    if (window.speechSynthesis) {
      try {
        window.speechSynthesis.resume();
        Speech.loadVoices();
      } catch(e) {}
    }
    document.removeEventListener('touchstart', unlockAudio);
    document.removeEventListener('click', unlockAudio);
  };
  document.addEventListener('touchstart', unlockAudio, { once: true });
  document.addEventListener('click', unlockAudio, { once: true });
}

/* ── XP popup ── */
const XP = {
  show(amount) {
    if (!amount) return;
    const el = document.getElementById('xpPopup');
    el.textContent = `+${amount} XP`;
    el.classList.remove('hidden');
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    setTimeout(() => el.classList.add('hidden'), 1600);
    Session.xp += amount;
    localStorage.setItem('uxp', Session.xp);
    document.getElementById('xpDisplay').textContent = Session.xp + ' XP';
  }
};

/* ── Account Picker ── */
const Auth = {
  async showPicker() {
    const screen = document.getElementById('accountPickerScreen');
    screen.classList.remove('hidden');
    const grid = document.getElementById('accountGrid');
    grid.innerHTML = '<div class="spinner" style="margin:40px auto"></div>';
    const users = await API.get('/api/auth/users');
    const avatars = ['👤','🧑','👩','🧒','👦','🧑‍💻','👩‍💻','🧑‍🎓'];
    const lastUname = localStorage.getItem('last_uname') || '';
    const isAdmin = lastUname.toLowerCase() === 'adrian';

    grid.innerHTML = users.map((u, i) => {
      const isAdrianCard = u.id === 1 || u.username.toLowerCase() === 'adrian';
      const isOwnCard = lastUname.toLowerCase() === u.username.toLowerCase();
      const showDelete = !isAdrianCard && (isAdmin || isOwnCard);
      
      const deleteBtn = showDelete ? `
        <span class="account-delete" title="Usuń konto" onclick="Auth.deleteAccount(event, ${u.id}, '${u.username.replace(/'/g,"\\'")}')">🗑️</span>
      ` : '';

      return `
        <button class="account-card" onclick="Auth.selectUser(${u.id},'${u.username.replace(/'/g,"\\'")}',${u.xp})">
          ${deleteBtn}
          <div class="account-avatar">${avatars[i % avatars.length]}</div>
          <div class="account-name">${u.username}</div>
          <div class="account-xp">${u.xp} XP</div>
          <div class="account-level">${u.level}</div>
        </button>
      `;
    }).join('') +
      `<button class="account-card account-new" onclick="Auth.showNew()">
        <div class="account-avatar">➕</div>
        <div class="account-name">Nowe konto</div>
        <div class="account-xp" style="color:var(--text3)">Zacznij od zera</div>
      </button>`;
  },

  async deleteAccount(event, uid, username) {
    if (event) event.stopPropagation();
    
    const lastUname = localStorage.getItem('last_uname') || '';
    const isAdmin = lastUname.toLowerCase() === 'adrian';
    
    let confirmed = false;
    if (isAdmin) {
      confirmed = confirm(`Czy na pewno chcesz bezpowrotnie usunąć konto "${username}" oraz wszystkie jego postępy?`);
    } else {
      const input = prompt(`Czy na pewno chcesz usunąć swoje konto? Wpisz nazwę konta ("${username}"), aby potwierdzić:`);
      confirmed = input && input.trim().toLowerCase() === username.toLowerCase();
    }
    
    if (!confirmed) return;
    
    const res = await API.post('/api/auth/delete', { user_id: uid, username: username });
    if (res && res.error) {
      alert(res.error);
    } else {
      if (lastUname.toLowerCase() === username.toLowerCase()) {
        Session.clear();
        localStorage.removeItem('last_uname');
      }
      Auth.showPicker();
    }
  },

  async selectUser(uid, name, xp) {
    const res = await API.post('/api/auth/select', { user_id: uid });
    if (!res.ok) { alert(res.error); return; }
    Session.save(res.user_id, res.username, res.xp);
    document.getElementById('accountPickerScreen').classList.add('hidden');
    startApp();
  },

  showNew() {
    document.getElementById('newAccountForm').classList.remove('hidden');
    document.getElementById('newAccountName').focus();
  },

  async createAccount() {
    const name = document.getElementById('newAccountName').value.trim();
    const err = document.getElementById('newAccountError');
    err.classList.add('hidden');
    if (!name) { err.textContent = 'Podaj imię'; err.classList.remove('hidden'); return; }
    const res = await API.post('/api/auth/create', { username: name });
    if (res.error) { err.textContent = res.error; err.classList.remove('hidden'); return; }
    Session.save(res.user_id, res.username, res.xp);
    document.getElementById('accountPickerScreen').classList.add('hidden');
    startApp();
  },

  logout() {
    Session.clear();
    document.getElementById('app').classList.add('hidden');
    document.getElementById('newAccountForm').classList.add('hidden');
    document.getElementById('newAccountName').value = '';
    Auth.showPicker();
  }
};
