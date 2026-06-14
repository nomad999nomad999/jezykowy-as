/**
 * db.js - Silnik bazy danych IndexedDB (Dexie.js) dla serverless wersji apki
 * Nadpisuje obiekt API, aby wszystkie żądania były obsługiwane lokalnie.
 */

const SUPABASE_URL = "https://zsrcngqalsrmrvorozyd.supabase.co";
const SUPABASE_KEY = "sb_publishable_8hx2csT7Vz9Vv6bHFhH2NQ_iFOlFv7E";

// Pomocnicze funkcje do bezpośredniego pobierania z API Gemini w przeglądarce
async function fetchDirectGeminiSentence(word, translation, apiKey) {
  const contexts = [
    "daily life", "business meeting", "traveling abroad", "casual conversation",
    "reading a book", "watching a movie", "shopping at a store", "asking for directions"
  ];
  const styles = [
    "Use simple vocabulary.", "Write a slightly humorous sentence.", "Make it a question.",
    "Make it a statement.", "Include a common pronoun.", "Keep it descriptive."
  ];
  const ctx = contexts[Math.floor(Math.random() * contexts.length)];
  const style = styles[Math.floor(Math.random() * styles.length)];

  const prompt = `You are an English teacher for a Polish speaker learning English.
Word: "${word}" (Polish: "${translation}")
Context: ${ctx}. ${style}

Generate a JSON response with:
1. "sentence": A natural example sentence using the word (max 12 words). MUST use the word "${word}" exactly. Do NOT use the phrase "is very important".
2. "sentence_pl": Polish translation of the sentence
3. "tip": A short memory tip in Polish (max 10 words)

Respond ONLY with valid JSON, no markdown, no extra text.
Example: {"sentence": "She had no doubt about her decision.", "sentence_pl": "Nie miała wątpliwości co do swojej decyzji.", "tip": "Doubt = wątpliwość, jak 'dubbing' – coś niepewnego"}`;

  // Try models in order, with retry on 429 (rate limit)
  const models = ["gemini-2.5-flash", "gemini-1.5-flash"];
  let lastError = null;

  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        // 429 = rate limit – wait and retry on next model
        if (response.status === 429) {
          console.warn(`Gemini ${model} rate limit (429), trying next model...`);
          lastError = new Error("Rate limit 429");
          break; // break inner loop, move to next model
        }

        if (!response.ok) {
          let errMsg = `HTTP ${response.status}`;
          try { const e = await response.json(); errMsg = e?.error?.message || errMsg; } catch (_) {}
          throw new Error(errMsg);
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error("Empty Gemini response");

        let raw = text.trim();
        const s = raw.indexOf("{"), e2 = raw.lastIndexOf("}");
        if (s !== -1 && e2 !== -1) raw = raw.substring(s, e2 + 1);
        const parsed = JSON.parse(raw);
        if (!parsed.sentence) throw new Error("Missing sentence in response");
        return parsed;

      } catch (e) {
        console.warn(`Gemini ${model} attempt ${attempt + 1} failed:`, e.message);
        lastError = e;
        if (attempt === 0) await new Promise(r => setTimeout(r, 1500)); // brief wait before retry
      }
    }
    // Small delay between models to avoid burst rate limiting
    await new Promise(r => setTimeout(r, 800));
  }
  throw lastError || new Error("All Gemini models failed");
}

async function fetchDirectGeminiSentenceBuilder(word, translation, apiKey) {
  const styles = ["Use past tense.", "Use present tense.", "Make it a question.", "Keep it simple."];
  const style = styles[Math.floor(Math.random() * styles.length)];
  const prompt = `You are an English teacher for a Polish speaker.
Word: "${word}" (Polish: "${translation}")
${style}

Generate a JSON:
1. "sentence": Short natural sentence (6-10 words) using "${word}" exactly. Period at end only.
2. "translation_pl": Polish translation of the sentence.

Respond ONLY with valid JSON, no markdown.
Example: {"sentence": "She had no doubt about her decision.", "translation_pl": "Nie miała wątpliwości co do swojej decyzji."}`;

  const models = ["gemini-2.5-flash", "gemini-1.5-flash"];
  let lastError = null;
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        if (response.status === 429) { lastError = new Error("Rate limit"); break; }
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error("Empty response");
        let raw = text.trim();
        const s = raw.indexOf("{"), e2 = raw.lastIndexOf("}");
        if (s !== -1 && e2 !== -1) raw = raw.substring(s, e2 + 1);
        const parsed = JSON.parse(raw);
        if (!parsed.sentence || !parsed.sentence.toLowerCase().includes(word.toLowerCase())) throw new Error("Word missing from sentence");
        // Scramble words client-side
        const words = parsed.sentence.split(" ");
        const scrambled = [...words].sort(() => Math.random() - 0.5);
        return { sentence: parsed.sentence, words_scrambled: scrambled, translation_pl: parsed.translation_pl || "" };
      } catch (e) {
        lastError = e;
        if (attempt === 0) await new Promise(r => setTimeout(r, 1000));
      }
    }
    await new Promise(r => setTimeout(r, 600));
  }
  throw lastError || new Error("All models failed");
}

async function fetchDirectGeminiFillBlank(word, translation, apiKey) {

  const contexts = [
    "daily life", "business meeting", "traveling abroad", "casual conversation",
    "reading a book", "watching a movie", "shopping at a store", "asking for directions"
  ];
  const ctx = contexts[Math.floor(Math.random() * contexts.length)];
  const prompt = `You are an English teacher for a Polish speaker.
Word: "${word}" (Polish: "${translation}")
Context: ${ctx}

Generate a fill-in-the-blank exercise. JSON response with:
1. "sentence": A sentence with "_____" replacing the word (max 14 words). The blank MUST be where "${word}" goes.
2. "answer": exactly "${word}"
3. "hint": first letter + dashes, e.g. "d____" for "doubt"
4. "sentence_pl": Polish translation of the full sentence (with the word filled in)

Respond ONLY with valid JSON, no markdown.
Example: {"sentence": "I have no _____ about his honesty.", "answer": "doubt", "hint": "d____", "sentence_pl": "Nie mam żadnych wątpliwości co do jego uczciwości."}`;

  const models = ["gemini-1.5-flash", "gemini-2.5-flash"];
  let lastError = null;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }]
        })
      });

      if (!response.ok) {
        let errMsg = `Status ${response.status}`;
        try {
          const errData = await response.json();
          if (errData && errData.error && errData.error.message) {
            errMsg = errData.error.message;
          }
        } catch (e) {}
        throw new Error(errMsg);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("Empty response from Gemini");

      let raw = text.trim();
      const start = raw.indexOf("{");
      const end = raw.lastIndexOf("}");
      if (start !== -1 && end !== -1) {
        raw = raw.substring(start, end + 1);
      }
      return JSON.parse(raw);
    } catch (e) {
      console.warn(`Model ${model} failed:`, e.message);
      lastError = e;
    }
  }
  throw lastError || new Error("All models failed");
}

async function fetchDirectGeminiDailyFact(category, userWords, apiKey) {
  const cats = {
    biology: ["Biology", "Biologia"],
    evolutionary_biology: ["Evolutionary Biology", "Biologia ewolucyjna"],
    nature: ["Nature", "Przyroda"],
    physics: ["Physics", "Fizyka"],
    technology: ["Technology", "Technika"]
  };
  const [catEn, catPl] = cats[category] || ["Biology", "Biologia"];
  const wordsStr = userWords.slice(0, 15).map(w => `"${w.word}" (${w.translation || '?'})`).join(", ");

  const prompt = `You are creating educational English content for a Polish speaker learning English.

Category: ${catEn} (${catPl})
User's vocabulary to practice (pick 3-5 and use them naturally): ${wordsStr}

CRITICAL RULE: You MUST ONLY select target words to practice from the "User's vocabulary to practice" list above. Do NOT highlight (**word**) or include in "used_words" any words that are not present in the provided list. If the list is empty, then you can use common words, but if it has words, use ONLY those words.

Return ONLY valid JSON (no markdown):
{
  "title": "Specific topic title (4-6 English words)",
  "fact": "3-4 sentences (80-130 words). B1-B2 English level. Use 3-5 target words from the list naturally. Mark each used target word with **double asterisks** like **word**.",
  "used_words": [
    {"word": "used_word", "translation": "polskie tlumaczenie", "context": "short phrase using it"}
  ],
  "questions": [
    {"statement": "One-sentence T/F statement about the fact only.", "answer": true, "explanation": "Krotkie wyjasnienie po polsku."},
    {"statement": "Another statement.", "answer": false, "explanation": "Wyjasnienie."},
    {"statement": "Third statement.", "answer": true, "explanation": "Wyjasnienie."}
  ]
}

Rules:
- Exactly 3 questions, mix of true/false (not all same answer)
- Questions answerable ONLY from the fact text
- Fact must be genuinely interesting and accurate
- Explanations in Polish`;

  const models = ["gemini-2.5-flash", "gemini-1.5-flash"];
  let lastError = null;

  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        if (response.status === 429) {
          console.warn(`Gemini ${model} rate limit (429), trying next model...`);
          lastError = new Error("Rate limit 429");
          break;
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error("Empty Gemini response");

        let raw = text.trim();
        const s = raw.indexOf("{"), e = raw.lastIndexOf("}");
        if (s !== -1 && e !== -1) raw = raw.substring(s, e + 1);
        const parsed = JSON.parse(raw);
        if (!parsed.fact || !parsed.questions || parsed.questions.length < 3) {
          throw new Error("Missing fact or questions in response");
        }
        return parsed;

      } catch (e) {
        console.warn(`Gemini ${model} attempt ${attempt + 1} failed:`, e.message);
        lastError = e;
        if (attempt === 0) await new Promise(r => setTimeout(r, 1500));
      }
    }
    await new Promise(r => setTimeout(r, 800));
  }
  throw lastError || new Error("All Gemini models failed");
}

const DB = {
  db: null,
  isInitialized: false,

  async init() {
    if (this.isInitialized) return;

    console.log("Inicjalizacja Dexie...");
    
    // Tworzenie instancji Dexie
    this.db = new Dexie("EnglishMasterDB");
    
    // Definiowanie czystych, uproszczonych indeksów (bez zbędnych pól)
    this.db.version(1).stores({
      users: "++id, &username",
      words: "++id, user_id, status, word, [user_id+word]",
      coca_words: "++id, &word, frequency_rank",
      sessions: "++id, user_id, exercise_type",
      streak: "++id, user_id",
      daily_quests: "++id, user_id, quest_date, quest_type",
      achievements: "++id, user_id, badge_id",
      skipped_coca_words: "++id, user_id, word, [user_id+word]",
      word_of_day: "++id, wod_date",
      srs_cards: "++id, user_id, word_id, next_review, [user_id+word_id]",
      word_promotions: "++id, user_id"
    });

    try {
      await this.db.open();
      console.log("Baza danych IndexedDB otwarta pomyślnie.");
    } catch (err) {
      console.warn("Błąd otwierania bazy danych, usuwanie i ponowne tworzenie...", err);
      try {
        await Dexie.delete("EnglishMasterDB");
        this.db = new Dexie("EnglishMasterDB");
        this.db.version(1).stores({
          users: "++id, &username",
          words: "++id, user_id, status, word, [user_id+word]",
          coca_words: "++id, &word, frequency_rank",
          sessions: "++id, user_id, exercise_type",
          streak: "++id, user_id",
          daily_quests: "++id, user_id, quest_date, quest_type",
          achievements: "++id, user_id, badge_id",
          skipped_coca_words: "++id, user_id, word, [user_id+word]",
          word_of_day: "++id, wod_date",
          srs_cards: "++id, user_id, word_id, next_review, [user_id+word_id]",
          word_promotions: "++id, user_id"
        });
        await this.db.open();
        console.log("Baza danych IndexedDB odtworzona pomyślnie.");
      } catch (deleteErr) {
        console.error("Krytyczny błąd resetowania bazy danych:", deleteErr);
        throw deleteErr;
      }
    }

    // 2. Pierwsze uruchomienie - import słownika i postępów
    const initFlag = "db_initialized_v4";
    if (!localStorage.getItem(initFlag)) {
      console.log("Pierwsze uruchomienie: Rozpoczynanie importu danych...");

      // A. Wczytanie słownika COCA
      try {
        const resCoca = await fetch("coca_words.json");
        if (resCoca.ok) {
          const cocaWords = await resCoca.json();
          console.log(`Pobrano ${cocaWords.length} słów COCA z pliku JSON. Zapisywanie...`);
          await this.db.coca_words.clear();
          await this.db.coca_words.bulkPut(cocaWords);
          console.log("Słownik COCA zapisany w IndexedDB.");
        } else {
          console.error("Nie udało się pobrać coca_words.json, status:", resCoca.status);
        }
      } catch (err) {
        console.error("Błąd pobierania coca_words.json:", err);
      }

      // B. Wczytanie dotychczasowych postępów wszystkich użytkowników
      try {
        const resProg = await fetch("initial_progress.json");
        if (resProg.ok) {
          const profiles = await resProg.json();
          console.log("Pobrano plik z postępami. Rozpoczynanie importu...");
          
          for (const [userIdStr, data] of Object.entries(profiles)) {
            const uid = parseInt(userIdStr);
            if (!data.user) continue;
            
            // Jeśli użytkownik już istnieje w bazie lokalnej, omijamy go, żeby nie nadpisać jego postępów!
            const localExists = await this.db.users.get(uid);
            if (localExists) {
              console.log(`Użytkownik ${data.user.username} (ID: ${uid}) już istnieje lokalnie. Pomijam import.`);
              continue;
            }

            await this.db.users.put({
              id: uid,
              username: data.user.username,
              xp: data.user.xp || 0,
              level: data.user.level || "Beginner 🌱",
              created_at: data.user.created_at || new Date().toISOString()
            });

            // Słowa użytkownika
            if (data.words && data.words.length > 0) {
              const mappedWords = data.words.map(w => ({
                word: w.word,
                translation: w.translation,
                status: w.status,
                source: w.source || "coca",
                user_id: uid,
                added_date: w.added_date || new Date().toISOString(),
                last_reviewed: w.last_reviewed || null,
                review_count: w.review_count || 0,
                correct_count: w.correct_count || 0,
                learned_at: w.learned_at || null,
                frequency_rank: w.frequency_rank || 9999
              }));
              await this.db.words.bulkAdd(mappedWords);
            }

            // Sesje
            if (data.sessions && data.sessions.length > 0) {
              const mappedSessions = data.sessions.map(s => ({
                user_id: uid,
                session_date: s.session_date,
                exercise_type: s.exercise_type,
                words_practiced: s.words_practiced,
                correct: s.correct,
                duration_sec: s.duration_sec,
                xp_earned: s.xp_earned
              }));
              await this.db.sessions.bulkAdd(mappedSessions);
            }

            // Streak
            if (data.streak) {
              await this.db.streak.put({
                user_id: uid,
                current_streak: data.streak.current_streak || 0,
                longest_streak: data.streak.longest_streak || 0,
                last_activity: data.streak.last_activity || null
              });
            }

            // Odznaki
            if (data.achievements && data.achievements.length > 0) {
              const mappedAch = data.achievements.map(a => ({
                user_id: uid,
                badge_id: a.badge_id,
                earned_at: a.earned_at || new Date().toISOString()
              }));
              await this.db.achievements.bulkAdd(mappedAch);
            }

            // Pominięte słowa
            if (data.skipped_coca_words && data.skipped_coca_words.length > 0) {
              const mappedSkip = data.skipped_coca_words.map(s => ({
                user_id: uid,
                word: s.word,
                skipped_at: s.skipped_at || new Date().toISOString()
              }));
              await this.db.skipped_coca_words.bulkAdd(mappedSkip);
            }

            // SRS
            if (data.srs_cards && data.srs_cards.length > 0) {
              const mappedSrs = data.srs_cards.map(s => ({
                user_id: uid,
                word_id: s.word_id,
                word: s.word,
                translation: s.translation,
                ef: s.ef || 2.5,
                interval: s.interval || 1,
                repetitions: s.repetitions || 0,
                next_review: s.next_review || new Date().toISOString().slice(0, 10),
                last_review: s.last_review || null
              }));
              for (const card of mappedSrs) {
                const localWord = await this.db.words.where({ user_id: uid, word: card.word }).first();
                if (localWord) {
                  card.word_id = localWord.id;
                  await this.db.srs_cards.put(card);
                }
              }
            }
            console.log("Pomyślnie zaimportowano postępy użytkownika: " + data.user.username);
          }

          if (!localStorage.getItem("uid")) {
            const firstId = Object.keys(profiles)[0];
            if (firstId) {
              localStorage.setItem("uid", firstId);
              localStorage.setItem("uname", profiles[firstId].user.username);
              localStorage.setItem("uxp", profiles[firstId].user.xp || 0);
            }
          }
        } else {
          console.error("Nie znaleziono initial_progress.json, status:", resProg.status);
        }
      } catch (err) {
        console.error("Błąd importu postępów:", err);
      }

      // Opcjonalne czyszczenie lokalnej bazy na wypadek starych kont (zostawiamy tylko Adrian i Madzia)
      try {
        const allLocalUsers = await this.db.users.toArray();
        for (const u of allLocalUsers) {
          const nameLower = u.username.toLowerCase();
          if (nameLower !== "adrian" && nameLower !== "madzia") {
            const uid = u.id;
            console.log(`Usuwanie starego konta: ${u.username} (ID: ${uid})`);
            await this.db.users.delete(uid);
            await this.db.words.where({ user_id: uid }).delete();
            await this.db.sessions.where({ user_id: uid }).delete();
            await this.db.streak.where({ user_id: uid }).delete();
            await this.db.achievements.where({ user_id: uid }).delete();
            await this.db.skipped_coca_words.where({ user_id: uid }).delete();
            await this.db.srs_cards.where({ user_id: uid }).delete();
          }
        }
      } catch (err) {
        console.error("Błąd podczas czyszczenia starych kont:", err);
      }

      localStorage.setItem(initFlag, "1");
    }

    // 3. Sprawdź i załaduj misje dzienne oraz słowo dnia na dzisiaj
    const todayStr = new Date().toISOString().slice(0, 10);
    const uid = parseInt(localStorage.getItem("uid")) || 1;
    await this.ensureDailyQuests(uid, todayStr);
    await this.ensureWordOfDay(todayStr);

    this.isInitialized = true;
    console.log("Lokalna baza danych gotowa!");
  },

  // Pomocniczy generator seeda deterministycznego
  getStringSeed(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  },

  // Generowanie misji dziennych z daty
  async ensureDailyQuests(userId, todayStr) {
    let existing = await this.db.daily_quests.where({ user_id: userId, quest_date: todayStr }).toArray();
    if (existing.length > 0 && existing.length < 5) {
      await this.db.daily_quests.where({ user_id: userId, quest_date: todayStr }).delete();
      existing = [];
    }
    if (existing.length === 0) {
      const seed = this.getStringSeed(todayStr + String(userId));

      // Generuj poszczególne części misji:
      // 1. Sklasyfikuj nowe słowa (wybierz losowo 1 z 3 wariantów)
      const classifyVariants = [
        { type: "classify",        desc: "Sklasyfikuj 15 nowych słów",                        target: 15,  xp: 40,  icon: "🔍" },
        { type: "classify",        desc: "Sklasyfikuj 30 nowych słów",                        target: 30,  xp: 75,  icon: "🔍" },
        { type: "classify",        desc: "Sklasyfikuj 50 nowych słów",                        target: 50,  xp: 120, icon: "🔍" }
      ];
      const classifyQuest = classifyVariants[seed % classifyVariants.length];
      
      // 2. Sesja (zawsze obecna)
      const sessionQuest = { type: "session", desc: "Ukończ 2 dowolne ćwiczenia", target: 2, xp: 70, icon: "🏋️" };
      
      // 3. Pozostałe aktywności (do rotacji)
      const rotationPool = [
        { type: "speed_round",     desc: "Ukończ Speed Round",                                target: 1,   xp: 65,  icon: "⚡" },
        { type: "match_pairs",     desc: "Ukończ Dopasuj pary",                               target: 1,   xp: 55,  icon: "🔗" },
        { type: "super_quiz",      desc: "Ukończ Super-Quiz",                                 target: 1,   xp: 80,  icon: "🏆" },
        { type: "srs",             desc: "Ukończ powtórkę SRS",                               target: 1,   xp: 65,  icon: "🧠" },
        { type: "flashcards",      desc: "Ćwicz Fiszki (min. 10 słów)",                       target: 10,  xp: 50,  icon: "🃏" },
        { type: "fill_blank",      desc: "Ukończ Test pisowni",                               target: 1,   xp: 65,  icon: "✍️" },
        { type: "promote_words",   desc: "Przenieś 3 słowa do listy \"Poznałem\"",            target: 3,   xp: 100, icon: "🎓" },
        { type: "combo_trio",      desc: "Ukończ Super-Quiz, Dopasuj pary i Speed Round",     target: 3,   xp: 150, icon: "🔥" },
        { type: "multiple_choice", desc: "Ukończ Wybór wielokrotny",                          target: 1,   xp: 55,  icon: "🎯" },
        { type: "quick_challenge", desc: "Ukończ Szybkie Wyzwanie",                          target: 1,   xp: 60,  icon: "⏱️" },
        { type: "daily_fact",      desc: "Ukończ Ciekawostkę Dnia",                           target: 1,   xp: 70,  icon: "🧪" },
        { type: "sentence_builder", desc: "Ukończ Budowanie zdań",                            target: 1,   xp: 60,  icon: "🔤" },
        { type: "hands_free",      desc: "Ukończ Audionaukę",                                 target: 1,   xp: 50,  icon: "🎧" },
        { type: "context",         desc: "Ukończ Wyzwanie Kontekstu",                         target: 1,   xp: 60,  icon: "🧩" },
        { type: "audio_quiz",      desc: "Ukończ Audio Quiz",                                 target: 1,   xp: 60,  icon: "🔊" }
      ];

      // Przetasuj pulę rotacyjną używając seeda (LCG)
      const shuffled = [...rotationPool];
      let s = seed;
      for (let i = shuffled.length - 1; i > 0; i--) {
        s = ((s * 1664525) + 1013904223) & 0x7fffffff;
        const j = Math.abs(s) % (i + 1);
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      // Wybierz 3 dodatkowe misje o różnych typach
      const chosen = [classifyQuest, sessionQuest];
      const usedTypes = new Set(["classify", "session"]);
      for (const q of shuffled) {
        if (chosen.length >= 5) break;
        if (!usedTypes.has(q.type)) {
          usedTypes.add(q.type);
          chosen.push(q);
        }
      }

      for (const q of chosen) {
        await this.db.daily_quests.add({
          user_id: userId,
          quest_date: todayStr,
          quest_type: q.type,
          description: q.desc,
          icon: q.icon,
          target: q.target,
          progress: 0,
          completed: 0,
          xp_reward: q.xp
        });
      }
    }
  },

  // Generowanie słowa dnia deterministycznie
  async ensureWordOfDay(todayStr) {
    const cached = await this.db.word_of_day.where({ wod_date: todayStr }).first();
    if (!cached) {
      const coca = await this.db.coca_words.where("frequency_rank").between(200, 1500, true, true).toArray();
      if (coca.length > 0) {
        const seed = this.getStringSeed(todayStr);
        const w = coca[seed % coca.length];
        const funFacts = [
          "To jedno z najczęściej używanych słów w amerykańskim angielskim!",
          "Usłyszysz je w prawie każdej angielskiej rozmowie.",
          "Znajomość tego słowa znacznie ułatwia rozumienie filmów i seriali.",
          "To słowo pojawia się średnio kilkaset razy na każde 100 000 słów tekstu.",
          "Opanuj to słowo - używa go każdy rodzimy mówca angielskiego!",
          "W top 1000 słów COCA - fundament anglojęzycznej komunikacji.",
          "Bez tego słowa trudno wyrazić wiele codziennych myśli po angielsku.",
          "Znajomość 1000 takich słów = rozumiesz 85% codziennych rozmów."
        ];
        const fact = funFacts[seed % funFacts.length];
        await this.db.word_of_day.add({
          wod_date: todayStr,
          word: w.word,
          translation: w.translation,
          rank: w.frequency_rank,
          fun_fact: fact
        });
      }
    }
  },

  // Zaktualizowanie postępu misji
  async updateQuestProgress(userId, questType, amount = 1) {
    const todayStr = new Date().toISOString().slice(0, 10);
    const quests = await this.db.daily_quests.where({ user_id: userId, quest_date: todayStr, quest_type: questType, completed: 0 }).toArray();
    const completedNow = [];

    for (const q of quests) {
      const newProgress = Math.min(q.progress + amount, q.target);
      const newlyDone = newProgress >= q.target;
      await this.db.daily_quests.update(q.id, { progress: newProgress, completed: newlyDone ? 1 : 0 });
      if (newlyDone) {
        completedNow.push({ desc: q.description, xp: q.xp_reward, icon: q.icon });
        await this.addUserXp(userId, q.xp_reward);
      }
    }

    // combo_trio: ukończenie speed_round, match_pairs lub super_quiz liczy też do misji trio
    if (['speed_round', 'match_pairs', 'super_quiz'].includes(questType)) {
      const comboQuests = await this.db.daily_quests.where({ user_id: userId, quest_date: todayStr, quest_type: 'combo_trio', completed: 0 }).toArray();
      for (const q of comboQuests) {
        const newProgress = Math.min(q.progress + 1, q.target);
        const newlyDone = newProgress >= q.target;
        await this.db.daily_quests.update(q.id, { progress: newProgress, completed: newlyDone ? 1 : 0 });
        if (newlyDone) {
          completedNow.push({ desc: q.description, xp: q.xp_reward, icon: q.icon });
          await this.addUserXp(userId, q.xp_reward);
        }
      }
    }

    return completedNow;
  },

  // Dodawanie XP i przeliczanie poziomu
  async addUserXp(userId, amount) {
    const user = await this.db.users.get(userId);
    if (!user) return;
    const newXp = (user.xp || 0) + amount;
    const calculatedLevel = Math.floor(newXp / 500) + 1;
    let lvlLabel = "Beginner 🌱";
    if (calculatedLevel >= 20) lvlLabel = `Elita 🏆 (Lvl ${calculatedLevel})`;
    else if (calculatedLevel >= 15) lvlLabel = `Master 👑 (Lvl ${calculatedLevel})`;
    else if (calculatedLevel >= 10) lvlLabel = `Expert 🎓 (Lvl ${calculatedLevel})`;
    else if (calculatedLevel >= 6) lvlLabel = `Advanced 🚀 (Lvl ${calculatedLevel})`;
    else if (calculatedLevel >= 3) lvlLabel = `Intermediate 📚 (Lvl ${calculatedLevel})`;
    else if (calculatedLevel >= 2) lvlLabel = `Learner 🥈 (Lvl ${calculatedLevel})`;
    else lvlLabel = `Beginner 🌱 (Lvl ${calculatedLevel})`;

    await this.db.users.update(userId, { xp: newXp, level: lvlLabel });
    localStorage.setItem("uxp", newXp);

    this.syncLeaderboardOnline(user.username, newXp, lvlLabel);

    return { xp: newXp, level: lvlLabel };
  },

  // Funkcja placeholder do chmurowego rankingu Supabase (opcjonalna dla użytkownika)
  async syncLeaderboardOnline(username, xp, level) {
    const supabaseUrl = SUPABASE_URL;
    const supabaseKey = SUPABASE_KEY;
    if (!supabaseUrl || !supabaseKey) return;
    
    try {
      await fetch(`${supabaseUrl}/rest/v1/leaderboard`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`,
          "Prefer": "resolution=merge-duplicates"
        },
        body: JSON.stringify({ username, xp, level, updated_at: new Date().toISOString() })
      });
    } catch(e) {
      console.warn("Supabase Sync failed:", e);
    }
  },

  // Sprawdzanie i nagradzanie odznak
  async checkAndAwardBadges(userId, sessionCorrect = null, sessionWords = null, sessionType = null) {
    const _ALL_BADGES = [
      ["first_step",       "🎉", "Pierwszy krok",       "Sklasyfikuj pierwsze słowo"],
      ["classified_50",    "📚", "Pięćdziesiątka",       "50 słów sklasyfikowanych"],
      ["classified_200",   "📖", "Bibliofil",            "200 słów sklasyfikowanych"],
      ["classified_500",   "🎓", "Słownikarz",           "500 słów sklasyfikowanych"],
      ["learned_10",       "⭐", "Pierwsze kroki",       "10 słów w kategorii Znam"],
      ["learned_100",      "🏅", "Setka",                "100 słów w kategorii Znam"],
      ["learned_500",      "🏆", "Półfinalista",         "500 słów w kategorii Znam"],
      ["top100_complete",  "👑", "TOP 100",              "Znasz wszystkie słowa z TOP 100 COCA"],
      ["streak_3",         "🔥", "Seria 3 dni",          "3 dni nauki z rzędu"],
      ["streak_7",         "🔥🔥", "Tygodnik",           "7 dni nauki z rzędu"],
      ["streak_30",        "💎", "Miesiąc nauki",        "30 dni nauki z rzędu"],
      ["early_bird",       "🌅", "Ranny ptaszek",        "Nauka przed godz. 8:00"],
      ["night_owl",        "🌙", "Nocna sowa",           "Nauka po godz. 23:00"],
      ["perfect_session",  "🎯", "Perfekcja",            "100% poprawnych w sesji (min 5 słów)"],
      ["speed_ace",        "⚡", "Błyskawica",           "20+ poprawnych w Speed Round"]
    ];

    const hour = new Date().getHours();
    const classified = await this.db.words.where({ user_id: userId }).count();
    const znam = await this.db.words.where({ user_id: userId, status: "ZNAM" }).count();
    
    const streakRow = await this.db.streak.where({ user_id: userId }).first();
    const streakVal = streakRow ? streakRow.current_streak : 0;
    
    const top100Total = await this.db.coca_words.where("frequency_rank").between(1, 100, true, true).count();
    let top100Known = 0;
    const knownWords = await this.db.words.where({ user_id: userId, status: "ZNAM" }).toArray();
    for (const kw of knownWords) {
      const match = await this.db.coca_words.where({ word: kw.word }).first();
      if (match && match.frequency_rank <= 100) {
        top100Known++;
      }
    }

    const perfect = (sessionCorrect !== null && sessionWords !== null && sessionWords >= 5 && sessionCorrect === sessionWords);
    const speedAce = (sessionType === "speed_round" && sessionCorrect !== null && sessionCorrect >= 20);

    const conditions = {
      "first_step":      classified >= 1,
      "classified_50":   classified >= 50,
      "classified_200":  classified >= 200,
      "classified_500":  classified >= 500,
      "learned_10":      znam >= 10,
      "learned_100":     znam >= 100,
      "learned_500":     znam >= 500,
      "top100_complete": top100Total > 0 && top100Known >= top100Total,
      "streak_3":        streakVal >= 3,
      "streak_7":        streakVal >= 7,
      "streak_30":       streakVal >= 30,
      "early_bird":      5 <= hour && hour < 8,
      "night_owl":       hour >= 23 || hour < 2,
      "perfect_session": perfect,
      "speed_ace":       speedAce
    };

    const earnedNew = [];
    const alreadyEarned = new Set((await this.db.achievements.where({ user_id: userId }).toArray()).map(a => a.badge_id));

    for (const [badge_id, icon, name, desc] of _ALL_BADGES) {
      if (conditions[badge_id] && !alreadyEarned.has(badge_id)) {
        await this.db.achievements.add({
          user_id: userId,
          badge_id,
          earned_at: new Date().toISOString()
        });
        earnedNew.push({ badge_id, icon, name, desc });
      }
    }
    return earnedNew;
  },

  // Zaktualizowanie streaka na podstawie aktywności
  async updateStreak(userId) {
    const todayStr = new Date().toISOString().slice(0, 10);
    const streakRow = await this.db.streak.where({ user_id: userId }).first();

    if (!streakRow) {
      const newRow = { user_id: userId, current_streak: 1, longest_streak: 1, last_activity: todayStr };
      await this.db.streak.put(newRow);
      return newRow;
    }

    const last = streakRow.last_activity;
    if (last === todayStr) {
      return streakRow;
    }

    const lastDate = new Date(last);
    const todayDate = new Date(todayStr);
    const diffTime = Math.abs(todayDate - lastDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let current = streakRow.current_streak;
    if (diffDays === 1) {
      current += 1;
    } else if (diffDays > 1) {
      current = 1;
    }

    const longest = Math.max(current, streakRow.longest_streak || 0);
    const updated = {
      id: streakRow.id,
      user_id: userId,
      current_streak: current,
      longest_streak: longest,
      last_activity: todayStr
    };
    await this.db.streak.put(updated);
    return updated;
  },

  // Spaced Repetition Algorithm SM-2 helper
  sm2(ef, interval, repetitions, quality) {
    let newInterval = 1;
    let newEf = ef;
    let newReps = repetitions;

    if (quality >= 3) {
      if (repetitions === 0) {
        newInterval = 1;
      } else if (repetitions === 1) {
        newInterval = 6;
      } else {
        newInterval = Math.max(1, Math.round(interval * ef));
      }
      newEf = Math.max(1.3, ef + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
      newReps = repetitions + 1;
    } else {
      newInterval = 1;
      newEf = Math.max(1.3, ef - 0.2);
      newReps = 0;
    }
    return { ef: newEf, interval: newInterval, repetitions: newReps };
  },

  // Zapewnienie, że w srs_cards są odpowiednie słowa z words
  async seedSrsForUser(userId) {
    const studyWords = await this.db.words.where("status").anyOf("NIE_ZNAM", "TROCHE").toArray();
    const studyWordsUser = studyWords.filter(w => w.user_id === userId);
    
    for (const w of studyWordsUser) {
      const card = await this.db.srs_cards.where({ user_id: userId, word_id: w.id }).first();
      if (!card) {
        await this.db.srs_cards.add({
          user_id: userId,
          word_id: w.id,
          word: w.word,
          translation: w.translation,
          ef: 2.5,
          interval: 1,
          repetitions: 0,
          next_review: new Date().toISOString().slice(0, 10),
          last_review: null
        });
      }
    }

    const knownWords = await this.db.words.where({ user_id: userId, status: "ZNAM" }).toArray();
    const knownIds = knownWords.map(w => w.id);
    if (knownIds.length > 0) {
      const toDelete = await this.db.srs_cards.where("word_id").anyOf(knownIds).toArray();
      const toDeleteUser = toDelete.filter(c => c.user_id === userId);
      for (const c of toDeleteUser) {
        await this.db.srs_cards.delete(c.id);
      }
    }
  },

  // Główny wirtualny router API
  async route(method, url, data) {
    const urlObj = new URL(url, window.location.origin);
    const path = urlObj.pathname;
    const params = urlObj.searchParams;
    const userId = parseInt(localStorage.getItem("uid")) || 1;

    if (!this.isInitialized) {
      await this.init();
    }

    try {
      // 1. GET /api/auth/users
      if (method === "GET" && path === "/api/auth/users") {
        const users = await this.db.users.toArray();
        return users;
      }

      // 2. POST /api/auth/select
      if (method === "POST" && path === "/api/auth/select") {
        const u = await this.db.users.get(data.user_id);
        if (!u) return { ok: false, error: "Użytkownik nie istnieje!" };
        return { ok: true, user_id: u.id, username: u.username, xp: u.xp };
      }

      // 3. POST /api/auth/create
      if (method === "POST" && path === "/api/auth/create") {
        const exists = await this.db.users.where("username").equalsIgnoreCase(data.username).first();
        if (exists) return { error: "Ta nazwa użytkownika jest już zajęta." };
        
        const newId = await this.db.users.add({
          username: data.username,
          xp: 0,
          level: "Beginner 🌱",
          created_at: new Date().toISOString()
        });

        await this.db.streak.put({
          user_id: newId,
          current_streak: 0,
          longest_streak: 0,
          last_activity: null
        });

        return { user_id: newId, username: data.username, xp: 0 };
      }

      // 3b. POST /api/auth/delete
      if (method === "POST" && path === "/api/auth/delete") {
        const uid = data.user_id;
        if (uid === 1 || data.username.toLowerCase() === "adrian") {
          return { ok: false, error: "Nie można usunąć głównego konta Adrian!" };
        }
        
        await this.db.transaction('rw', 
          [this.db.users, this.db.words, this.db.sessions, this.db.streak, this.db.achievements, this.db.skipped_coca_words, this.db.srs_cards], 
          async () => {
            await this.db.users.delete(uid);
            await this.db.words.where({ user_id: uid }).delete();
            await this.db.sessions.where({ user_id: uid }).delete();
            await this.db.streak.where({ user_id: uid }).delete();
            await this.db.achievements.where({ user_id: uid }).delete();
            await this.db.skipped_coca_words.where({ user_id: uid }).delete();
            await this.db.srs_cards.where({ user_id: uid }).delete();
          }
        );

        // Usuń również z Supabase rankingu
        const supabaseUrl = SUPABASE_URL;
        const supabaseKey = SUPABASE_KEY;
        if (supabaseUrl && supabaseKey && data.username) {
          try {
            await fetch(`${supabaseUrl}/rest/v1/leaderboard?username=eq.${encodeURIComponent(data.username)}`, {
              method: "DELETE",
              headers: {
                "apikey": supabaseKey,
                "Authorization": `Bearer ${supabaseKey}`
              }
            });
          } catch(e) {
            console.warn("Failed to delete from Supabase leaderboard:", e);
          }
        }

        return { ok: true };
      }

      // 4. GET /api/stats
      if (method === "GET" && path === "/api/stats") {
        const znam = await this.db.words.where({ user_id: userId, status: "ZNAM" }).count();
        const troche = await this.db.words.where({ user_id: userId, status: "TROCHE" }).count();
        const nie_znam = await this.db.words.where({ user_id: userId, status: "NIE_ZNAM" }).count();
        const total_classified = znam + troche + nie_znam;

        const coca_total = await this.db.coca_words.count();
        const coca_classified = await this.db.words.where({ user_id: userId, source: "coca" }).count();

        const user = await this.db.users.get(userId);
        const streakRow = await this.db.streak.where({ user_id: userId }).first();

        const todayStr = new Date().toISOString().slice(0, 10);
        const allWords = await this.db.words.where({ user_id: userId }).toArray();
        const today_classified = allWords.filter(w => w.added_date && w.added_date.slice(0,10) === todayStr).length;

        return {
          znam,
          troche,
          nie_znam,
          total_classified,
          coca_total: coca_total || 3000,
          coca_classified,
          xp: user ? user.xp : 0,
          level: user ? user.level : "Beginner 🌱",
          streak: streakRow ? {
            current_streak: streakRow.current_streak,
            longest_streak: streakRow.longest_streak,
            last_activity: streakRow.last_activity
          } : { current_streak: 0, longest_streak: 0, last_activity: null },
          today_classified
        };
      }

      // 5. GET /api/leaderboard
      if (method === "GET" && path === "/api/leaderboard") {
        const supabaseUrl = SUPABASE_URL;
        const supabaseKey = SUPABASE_KEY;
        if (supabaseUrl && supabaseKey) {
          try {
            const res = await fetch(`${supabaseUrl}/rest/v1/leaderboard?select=username,xp,level&order=xp.desc&limit=20`, {
              headers: { "apikey": supabaseKey, "Authorization": `Bearer ${supabaseKey}` }
            });
            if (res.ok) {
              const data = await res.json();
              return data.map((u, i) => ({ id: i + 9999, username: u.username, xp: u.xp, level: u.level }));
            }
          } catch(e) {
            console.warn("Supabase Fetch failed, falling back to local leaderboard:", e);
          }
        }
        
        const users = await this.db.users.toArray();
        users.sort((a,b) => (b.xp || 0) - (a.xp || 0));
        return users;
      }

      // 6. GET /api/stats/review
      if (method === "GET" && path === "/api/stats/review") {
        const words = await this.db.words.where({ user_id: userId }).toArray();
        const toReview = words
          .filter(w => w.review_count >= 2 && (w.correct_count / w.review_count) < 0.6)
          .map(w => ({
            id: w.id,
            word: w.word,
            translation: w.translation,
            accuracy: Math.round((w.correct_count / w.review_count) * 100),
            review_count: w.review_count
          }));
        toReview.sort((a,b) => a.accuracy - b.accuracy);
        return toReview.slice(0, 20);
      }

      // 7. GET /api/stats/hardest
      if (method === "GET" && path === "/api/stats/hardest") {
        const words = await this.db.words.where({ user_id: userId }).toArray();
        const hardest = words
          .filter(w => w.review_count >= 1)
          .map(w => ({
            id: w.id,
            word: w.word,
            translation: w.translation,
            accuracy: Math.round((w.correct_count / w.review_count) * 100),
            review_count: w.review_count
          }));
        hardest.sort((a,b) => a.accuracy - b.accuracy || b.review_count - a.review_count);
        return hardest.slice(0, 10);
      }

      // 8. GET /api/stats/history
      if (method === "GET" && path === "/api/stats/history") {
        const days = parseInt(params.get("days")) || 14;
        const sessions = await this.db.sessions.where({ user_id: userId }).toArray();
        
        const historyMap = {};
        const now = new Date();
        for (let i = days - 1; i >= 0; i--) {
          const d = new Date(now);
          d.setDate(now.getDate() - i);
          const dStr = d.toISOString().slice(0, 10);
          historyMap[dStr] = { day: dStr, total: 0, correct: 0, xp: 0 };
        }

        for (const s of sessions) {
          const day = s.session_date ? s.session_date.slice(0, 10) : "";
          if (historyMap[day]) {
            historyMap[day].total += s.words_practiced || 0;
            historyMap[day].correct += s.correct || 0;
            historyMap[day].xp += s.xp_earned || 0;
          }
        }

        return Object.values(historyMap).sort((a,b) => a.day.localeCompare(b.day));
      }

      // 9. GET /api/stats/exercises
      if (method === "GET" && path === "/api/stats/exercises") {
        const sessions = await this.db.sessions.where({ user_id: userId }).toArray();
        const grouped = {};
        for (const s of sessions) {
          const type = s.exercise_type;
          if (!grouped[type]) {
            grouped[type] = { exercise_type: type, sessions: 0, total_words: 0, total_correct: 0 };
          }
          grouped[type].sessions++;
          grouped[type].total_words += s.words_practiced;
          grouped[type].total_correct += s.correct;
        }

        return Object.values(grouped).map(g => ({
          exercise_type: g.exercise_type,
          sessions: g.sessions,
          total_words: g.total_words,
          total_correct: g.total_correct,
          accuracy: g.total_words > 0 ? Math.round((g.total_correct / g.total_words) * 100) : 0
        }));
      }

      // 10. GET /api/stats/promotions
      if (method === "GET" && path === "/api/stats/promotions") {
        const promos = await this.db.word_promotions.where({ user_id: userId }).toArray();
        const grouped = {};
        for (const p of promos) {
          const key = `${p.from_status}->${p.to_status}`;
          if (!grouped[key]) {
            grouped[key] = { from_status: p.from_status, to_status: p.to_status, cnt: 0 };
          }
          grouped[key].cnt++;
        }

        promos.sort((a,b) => b.promoted_at.localeCompare(a.promoted_at));
        const recent = promos.slice(0, 15).map(p => ({
          word_text: p.word_text,
          from_status: p.from_status,
          to_status: p.to_status,
          day: p.promoted_at.slice(0, 10)
        }));

        return {
          totals: Object.values(grouped),
          recent: recent
        };
      }

      // 11. GET /api/words
      if (method === "GET" && path === "/api/words") {
        const status = params.get("status");
        let list = await this.db.words.where({ user_id: userId }).toArray();
        if (status) {
          list = list.filter(w => w.status === status);
        }
        list.sort((a,b) => (a.frequency_rank || 9999) - (b.frequency_rank || 9999));
        return list;
      }

      // 12. GET /api/words/search
      if (method === "GET" && path === "/api/words/search") {
        const q = (params.get("q") || "").toLowerCase();
        const status = params.get("status");
        let list = await this.db.words.where({ user_id: userId }).toArray();
        if (status) {
          list = list.filter(w => w.status === status);
        }
        if (q) {
          list = list.filter(w => w.word.toLowerCase().includes(q) || (w.translation || "").toLowerCase().includes(q));
        }
        list.sort((a,b) => (a.frequency_rank || 9999) - (b.frequency_rank || 9999));
        return list.slice(0, 50);
      }

      // 13. GET /api/words/learned
      if (method === "GET" && path === "/api/words/learned") {
        const list = await this.db.words.where({ user_id: userId }).toArray();
        const learned = list.filter(w => w.learned_at);
        learned.sort((a,b) => b.learned_at.localeCompare(a.learned_at));
        return learned;
      }

      // 14. POST /api/words/:id/status
      const wordStatusMatch = path.match(/^\/api\/words\/(\d+)\/status$/);
      if (method === "POST" && wordStatusMatch) {
        const wordId = parseInt(wordStatusMatch[1]);
        const newStatus = data.status;
        const w = await this.db.words.get(wordId);
        if (!w) return { error: "Word not found" };

        const oldStatus = w.status;
        if (oldStatus !== newStatus) {
          await this.db.word_promotions.add({
            user_id: userId,
            word_id: wordId,
            word_text: w.word,
            from_status: oldStatus,
            to_status: newStatus,
            promoted_at: new Date().toISOString()
          });

          const updates = { status: newStatus, last_reviewed: new Date().toISOString() };
          if (newStatus === "ZNAM") {
            if (oldStatus !== "ZNAM") {
              updates.learned_at = new Date().toISOString();
              // Śledź misję dzienną "Przenieś słowa do Poznałem"
              await this.updateQuestProgress(userId, 'promote_words', 1);
            }
          } else {
            updates.learned_at = null;
          }
          await this.db.words.update(wordId, updates);

          let xpAward = 0;
          if (oldStatus === "NIE_ZNAM" && newStatus === "TROCHE") xpAward = 15;
          else if (oldStatus === "TROCHE" && newStatus === "ZNAM") xpAward = 30;
          else if (oldStatus === "NIE_ZNAM" && newStatus === "ZNAM") xpAward = 25;

          let resXp = { xp: 0, level: "Beginner" };
          if (xpAward > 0) {
            resXp = await this.addUserXp(userId, xpAward);
          }

          const totalLearned = await this.db.words.where({ user_id: userId, status: "ZNAM" }).count();
          const milestones = [10, 25, 50, 100, 200, 500, 1000];
          const bonuses = { 10: 500, 25: 1500, 50: 3000, 100: 7500, 200: 15000, 500: 50000, 1000: 100000 };
          let ms = null;
          if (milestones.includes(totalLearned) && newStatus === "ZNAM") {
            const bonus = bonuses[totalLearned];
            resXp = await this.addUserXp(userId, bonus);
            ms = { count: totalLearned, bonus: bonus };
          }

          return { ok: true, xp: xpAward, total_xp: resXp.xp, level: resXp.level, milestone: ms };
        }

        return { ok: true };
      }

      // 14b. POST /api/words/:id/delete
      const wordDeleteMatch = path.match(/^\/api\/words\/(\d+)\/delete$/);
      if (method === "POST" && wordDeleteMatch) {
        const wordId = parseInt(wordDeleteMatch[1]);
        await this.db.words.delete(wordId);
        await this.db.word_promotions.where({ user_id: userId, word_id: wordId }).delete();
        const srsCard = await this.db.srs_cards.where({ user_id: userId, word_id: wordId }).first();
        if (srsCard) {
          await this.db.srs_cards.delete(srsCard.id);
        }
        return { ok: true };
      }

      // 15. GET /api/classify/batch
      if (method === "GET" && path === "/api/classify/batch") {
        const n = parseInt(params.get("n")) || 15;
        const userWords = new Set((await this.db.words.where({ user_id: userId }).toArray()).map(w => w.word));
        const skipped = new Set((await this.db.skipped_coca_words.where({ user_id: userId }).toArray()).map(s => s.word));
        
        const allCoca = await this.db.coca_words.orderBy("frequency_rank").toArray();
        const batch = [];
        for (const w of allCoca) {
          if (!userWords.has(w.word) && !skipped.has(w.word)) {
            batch.push(w);
            if (batch.length >= n) break;
          }
        }
        return batch;
      }

      // 16. POST /api/classify/word
      if (method === "POST" && path === "/api/classify/word") {
        const { word, translation, status } = data;
        const match = await this.db.coca_words.where({ word }).first();
        const rank = match ? match.frequency_rank : 9999;

        const existing = await this.db.words.where({ user_id: userId, word }).first();
        if (!existing) {
          await this.db.words.add({
            word,
            translation,
            status,
            source: "coca",
            user_id: userId,
            added_date: new Date().toISOString(),
            last_reviewed: null,
            review_count: 0,
            correct_count: 0,
            learned_at: null,
            frequency_rank: rank
          });
        } else {
          await this.db.words.update(existing.id, { status });
        }

        const resXp = await this.addUserXp(userId, 2);
        const qDone = await this.updateQuestProgress(userId, "classify", 1);
        const bEarned = await this.checkAndAwardBadges(userId);

        const countClassified = await this.db.words.where({ user_id: userId }).count();
        let milestone = null;
        if ([50, 100, 150, 200, 250, 300, 400, 500, 750, 1000].includes(countClassified)) {
          milestone = { count: countClassified };
        }

        return {
          ok: true,
          xp: 3,
          total_xp: resXp.xp,
          milestone,
          quests_done: qDone.map(q => ({ icon: q.icon, desc: q.desc, xp: q.xp })),
          badges_earned: bEarned
        };
      }

      // 17. POST /api/classify/skip
      if (method === "POST" && path === "/api/classify/skip") {
        const { word } = data;
        await this.db.skipped_coca_words.put({
          user_id: userId,
          word,
          skipped_at: new Date().toISOString()
        });
        return { ok: true };
      }

      // 18. GET /api/classify/skipped
      if (method === "GET" && path === "/api/classify/skipped") {
        const list = await this.db.skipped_coca_words.where({ user_id: userId }).toArray();
        list.sort((a,b) => b.skipped_at.localeCompare(a.skipped_at));
        return list;
      }

      // 19. POST /api/classify/unskip
      if (method === "POST" && path === "/api/classify/unskip") {
        const { word } = data;
        const match = await this.db.skipped_coca_words.where({ user_id: userId, word }).first();
        if (match) {
          await this.db.skipped_coca_words.delete(match.id);
        }
        return { ok: true };
      }

      // Helper: Recency Boost – słowa dawno niewidziane trafiają pierwsze
      // (lustrzane odbicie logiki backendowej: ORDER BY COALESCE(last_reviewed,'2000-01-01') ASC, RANDOM())
      const recencySort = arr => {
        const shuffle = a => a.sort(() => Math.random() - 0.5);
        return shuffle(arr).sort((a, b) => {
          const da = a.last_reviewed ? new Date(a.last_reviewed).getTime() : 0;
          const db2 = b.last_reviewed ? new Date(b.last_reviewed).getTime() : 0;
          return da - db2; // stare/nigdy niewidziane pierwsze
        });
      };

      // 20. GET /api/exercise/flashcards
      if (method === "GET" && path === "/api/exercise/flashcards") {
        const words = await this.db.words.where("status").anyOf("NIE_ZNAM", "TROCHE").toArray();
        const userWords = words.filter(w => w.user_id === userId && w.translation);
        return recencySort(userWords).slice(0, 15);
      }

      // 21. GET /api/exercise/multiple_choice
      if (method === "GET" && path === "/api/exercise/multiple_choice") {
        const words = await this.db.words.where("status").anyOf("NIE_ZNAM", "TROCHE").toArray();
        const userWords = words.filter(w => w.user_id === userId && w.translation);
        if (userWords.length === 0) return [];

        const shuffle = arr => arr.sort(() => Math.random() - 0.5);
        const n = parseInt(params.get("n") || "10", 10);
        const selected = recencySort(userWords).slice(0, n);
        
        const allTranslations = [...new Set(userWords.map(w => w.translation))];
        const allCoca = await this.db.coca_words.toArray();
        const cocaTranslations = allCoca.map(c => c.translation).filter(t => t);

        const result = [];
        for (const w of selected) {
          const correct = w.translation;
          const options = new Set([correct]);
          const pool = shuffle([...allTranslations, ...cocaTranslations]);
          for (const opt of pool) {
            if (options.size >= 4) break;
            if (opt && opt.trim() !== correct.trim()) {
              options.add(opt);
            }
          }

          result.push({
            id: w.id,
            word: w.word,
            translation: correct,
            options: shuffle(Array.from(options)),
            status: w.status,
            frequency_rank: w.frequency_rank
          });
        }
        return result;
      }

      // 22. GET /api/exercise/match_pairs
      if (method === "GET" && path === "/api/exercise/match_pairs") {
        const words = await this.db.words.where("status").anyOf("NIE_ZNAM", "TROCHE").toArray();
        const userWords = words.filter(w => w.user_id === userId && w.translation);
        return recencySort(userWords).slice(0, 6);
      }

      // 23. GET /api/exercise/speed_round
      if (method === "GET" && path === "/api/exercise/speed_round") {
        const words = await this.db.words.where("status").anyOf("NIE_ZNAM", "TROCHE").toArray();
        const userWords = words.filter(w => w.user_id === userId && w.translation);
        if (userWords.length === 0) return [];

        const shuffle = arr => arr.sort(() => Math.random() - 0.5);
        const selected = recencySort(userWords).slice(0, 30);
        
        const allTranslations = [...new Set(userWords.map(w => w.translation))];
        const result = [];

        for (const w of selected) {
          const correct = w.translation;
          const options = new Set([correct]);
          const pool = shuffle(allTranslations);
          for (const opt of pool) {
            if (options.size >= 4) break;
            if (opt && opt.trim() !== correct.trim()) {
              options.add(opt);
            }
          }
          result.push({
            id: w.id,
            word: w.word,
            translation: correct,
            options: shuffle(Array.from(options))
          });
        }
        return result;
      }

      // 24. POST /api/session
      if (method === "POST" && path === "/api/session") {
        const { type, words, correct, duration } = data;
        let rate = 3;
        if (type === "multiple_choice") rate = 4;
        else if (type === "fill_blank") rate = 6;
        else if (type === "match_pairs") rate = 4;
        else if (type === "speed_round") rate = 5;
        else if (type === "audio_quiz") rate = 5;
        else if (type === "hands_free") rate = 2;
        else if (type === "quick_challenge") rate = 5;
        else if (type === "srs") rate = 4; // SRS: per-card XP ~3-5, average 4

        // If frontend passes xp_earned directly (e.g. SRS accumulated), use it
        let xpEarned = (data.xp_earned !== undefined && data.xp_earned !== null)
          ? data.xp_earned
          : correct * rate;

        await this.db.sessions.add({
          user_id: userId,
          session_date: new Date().toISOString(),
          exercise_type: type,
          words_practiced: words,
          correct,
          duration_sec: duration,
          xp_earned: xpEarned
        });

        let resXp = { xp: 0, level: "Beginner" };
        if (xpEarned > 0) {
          resXp = await this.addUserXp(userId, xpEarned);
        } else {
          const u = await this.db.users.get(userId);
          resXp = { xp: u ? u.xp : 0, level: u ? u.level : "Beginner" };
        }

        const streak = await this.updateStreak(userId);
        const qDone1 = await this.updateQuestProgress(userId, "session", 1);
        const qDone2 = await this.updateQuestProgress(userId, type, 1);
        let qDone = [...qDone1, ...qDone2];
        if (type === "flashcards" && words > 0) {
          const qDone3 = await this.updateQuestProgress(userId, "flashcards", words);
          qDone = [...qDone, ...qDone3];
        }

        const bEarned = await this.checkAndAwardBadges(userId, correct, words, type);

        return {
          ok: true,
          xp_earned: xpEarned,
          total_xp: resXp.xp,
          streak: streak.current_streak,
          quests_done: qDone.map(q => ({ icon: q.icon, desc: q.desc, xp: q.xp })),
          badges_earned: bEarned
        };
      }

      // 25. POST /api/review_result
      if (method === "POST" && path === "/api/review_result") {
        const { word_id, correct } = data;
        const w = await this.db.words.get(word_id);
        if (w) {
          await this.db.words.update(word_id, {
            review_count: (w.review_count || 0) + 1,
            correct_count: (w.correct_count || 0) + (correct ? 1 : 0),
            last_reviewed: new Date().toISOString()
          });
        }
        return { ok: true };
      }

      // 26. GET /api/stats/vocab-chart
      if (method === "GET" && path === "/api/stats/vocab-chart") {
        const tiers = [
          { label: "top100",  lo: 1,    hi: 100 },
          { label: "top500",  lo: 101,  hi: 500 },
          { label: "top1000", lo: 501,  hi: 1000 },
          { label: "top2000", lo: 1001, hi: 2000 },
          { label: "top3000", lo: 2001, hi: 3000 }
        ];

        const userWords = await this.db.words.where({ user_id: userId }).toArray();
        const result = [];

        for (const t of tiers) {
          const totalInTier = await this.db.coca_words.where("frequency_rank").between(t.lo, t.hi, true, true).count();
          
          let znam = 0, troche = 0, nie_znam = 0;
          for (const uw of userWords) {
            if (uw.frequency_rank >= t.lo && uw.frequency_rank <= t.hi) {
              if (uw.status === "ZNAM") znam++;
              else if (uw.status === "TROCHE") troche++;
              else if (uw.status === "NIE_ZNAM") nie_znam++;
            }
          }

          result.push({
            label: t.label,
            range: `#${t.lo}–#${t.hi}`,
            total: totalInTier || (t.hi - t.lo + 1),
            znam,
            troche,
            nie_znam
          });
        }
        return result;
      }

      // 27. GET /api/word-of-day
      if (method === "GET" && path === "/api/word-of-day") {
        const todayStr = new Date().toISOString().slice(0, 10);
        const wod = await this.db.word_of_day.where({ wod_date: todayStr }).first();
        if (wod) return wod;
        
        const w = await this.db.coca_words.where("frequency_rank").between(200, 1500, true, true).first();
        return {
          wod_date: todayStr,
          word: w ? w.word : "hello",
          translation: w ? w.translation : "cześć",
          rank: w ? w.frequency_rank : 1,
          fun_fact: "Ciesz się dzisiejszym dniem!"
        };
      }

      // 28. GET /api/quests
      if (method === "GET" && path === "/api/quests") {
        const todayStr = new Date().toISOString().slice(0, 10);
        await this.ensureDailyQuests(userId, todayStr);
        const list = await this.db.daily_quests.where({ user_id: userId, quest_date: todayStr }).toArray();
        return list;
      }

      // 29. GET /api/achievements
      if (method === "GET" && path === "/api/achievements") {
        const earned = new Set((await this.db.achievements.where({ user_id: userId }).toArray()).map(a => a.badge_id));
        const earnedAtMap = {};
        const listEarned = await this.db.achievements.where({ user_id: userId }).toArray();
        for (const e of listEarned) {
          earnedAtMap[e.badge_id] = e.earned_at;
        }

        const _ALL_BADGES = [
          ["first_step",       "🎉", "Pierwszy krok",       "Sklasyfikuj pierwsze słowo"],
          ["classified_50",    "📚", "Pięćdziesiątka",       "50 słów sklasyfikowanych"],
          ["classified_200",   "📖", "Bibliofil",            "200 słów sklasyfikowanych"],
          ["classified_500",   "🎓", "Słownikarz",           "500 słów sklasyfikowanych"],
          ["learned_10",       "⭐", "Pierwsze kroki",       "10 słów w kategorii Znam"],
          ["learned_100",      "🏅", "Setka",                "100 słów w kategorii Znam"],
          ["learned_500",      "🏆", "Półfinalista",         "500 słów w kategorii Znam"],
          ["top100_complete",  "👑", "TOP 100",              "Znasz wszystkie słowa z TOP 100 COCA"],
          ["streak_3",         "🔥", "Seria 3 dni",          "3 dni nauki z rzędu"],
          ["streak_7",         "🔥🔥", "Tygodnik",           "7 dni nauki z rzędu"],
          ["streak_30",        "💎", "Miesiąc nauki",        "30 dni nauki z rzędu"],
          ["early_bird",       "🌅", "Ranny ptaszek",        "Nauka przed godz. 8:00"],
          ["night_owl",        "🌙", "Nocna sowa",           "Nauka po godz. 23:00"],
          ["perfect_session",  "🎯", "Perfekcja",            "100% poprawnych w sesji (min 5 słów)"],
          ["speed_ace",        "⚡", "Błyskawica",           "20+ poprawnych w Speed Round"]
        ];

        return _ALL_BADGES.map(([badge_id, icon, name, desc]) => ({
          badge_id,
          icon,
          name,
          desc,
          earned: earned.has(badge_id),
          earned_at: earnedAtMap[badge_id] || null
        }));
      }

      // 30. GET /api/exercise/srs
      if (method === "GET" && path === "/api/exercise/srs") {
        await this.seedSrsForUser(userId);
        const todayStr = new Date().toISOString().slice(0, 10);
        const list = await this.db.srs_cards.where({ user_id: userId }).toArray();
        const due = list.filter(c => c.next_review <= todayStr);
        // Sort by date ASC, shuffle cards with same date for variety
        due.sort((a, b) => {
          const dateCmp = a.next_review.localeCompare(b.next_review);
          if (dateCmp !== 0) return dateCmp;
          return Math.random() - 0.5; // random order for same-date cards
        });
        // Map id -> srs_id so frontend rateSRS() works correctly
        return due.slice(0, 20).map(c => ({ ...c, srs_id: c.id }));
      }

      // 31. GET /api/stats/srs-count
      if (method === "GET" && path === "/api/stats/srs-count") {
        await this.seedSrsForUser(userId);
        const todayStr = new Date().toISOString().slice(0, 10);
        const list = await this.db.srs_cards.where({ user_id: userId }).toArray();
        const dueCount = list.filter(c => c.next_review <= todayStr).length;
        return { count: dueCount };
      }

      // 32. POST /api/srs/result
      if (method === "POST" && path === "/api/srs/result") {
        const srsIdRaw = data.srs_id;
        const quality = parseInt(data.quality) || 0;
        // Dexie primary key must be a number - ensure correct type
        const srsId = typeof srsIdRaw === 'number' ? srsIdRaw : parseInt(srsIdRaw);
        if (!srsId || isNaN(srsId)) return { error: "Invalid srs_id: " + srsIdRaw };
        const card = await this.db.srs_cards.get(srsId);
        if (!card) return { error: "SRS card not found: " + srsId };

        const { ef, interval, repetitions } = this.sm2(card.ef || 2.5, card.interval || 1, card.repetitions || 0, quality);
        
        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + interval);
        const nextDateStr = nextDate.toISOString().slice(0, 10);

        await this.db.srs_cards.update(srsId, {
          ef,
          interval,
          repetitions,
          next_review: nextDateStr,
          last_review: new Date().toISOString().slice(0, 10)
        });

        if (quality >= 3) {
          const xpGained = quality >= 5 ? 5 : quality >= 4 ? 4 : 3;
          await this.addUserXp(userId, xpGained);
        }

        return { next_review: nextDateStr, interval, ef: Math.round(ef * 100) / 100 };
      }

      // 33. GET /api/gemini/sentence (Spróbuj pobrać z serwera, w razie braku połączenia użyj offline fallback)
      if (method === "GET" && path === "/api/gemini/sentence") {
        const word = params.get("word");
        const translation = params.get("translation");
        
        const apiEnabled = localStorage.getItem("gemini_api_enabled") !== "false";
        if (apiEnabled) {
          // A. Spróbuj pobrać bezpośrednio z API Google (jeśli zapisano klucz w Ustawieniach)
          const localApiKey = localStorage.getItem("gemini_api_key");
          if (localApiKey) {
            try {
              console.log("Pobieram zdanie bezpośrednio z API Gemini (klucz lokalny)...");
              const data = await fetchDirectGeminiSentence(word, translation, localApiKey);
              if (data && data.sentence) {
                return data;
              }
            } catch (e) {
              // Silent fail - use server or offline fallback, don't block Hands-Free loop
              console.warn("Gemini direct API failed, trying server fallback:", e.message);
            }
          }
          
          // B. W przeciwnym razie spróbuj pobrać z lokalnego serwera
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);
            const response = await fetch(url, {
              headers: { 'X-User-Id': userId.toString() },
              signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (response.ok) {
              const data = await response.json();
              if (data && data.sentence) {
                return data;
              }
            }
          } catch (e) {
            console.log("Rzeczywiste API Gemini niedostępne, używam offline fallback:", e);
          }
        }
        
        // Zróżnicowane szablony offline
        const templates = [
          { sentence: `I want to understand the meaning of the word "${word}".`, sentence_pl: `Chcę zrozumieć znaczenie słowa "${translation}".` },
          { sentence: `Can you repeat the word "${word}" one more time?`, sentence_pl: `Czy możesz powtórzyć słowo "${translation}" jeszcze raz?` },
          { sentence: `This is a very important sentence with the word "${word}".`, sentence_pl: `To jest bardzo ważne zdanie ze słowem "${translation}".` },
          { sentence: `She tried to write "${word}" on the whiteboard.`, sentence_pl: `Próbowała napisać "${translation}" na tablicy.` },
          { sentence: `He did not know how to translate "${word}" yesterday.`, sentence_pl: `Wczoraj nie wiedział, jak przetłumaczyć "${translation}".` },
          { sentence: `Please show me an example of how to use "${word}".`, sentence_pl: `Proszę pokaż mi przykład, jak użyć słowa "${translation}".` }
        ];
        const hash = Array.from(word || "").reduce((acc, char) => acc + char.charCodeAt(0), 0);
        return templates[hash % templates.length];
      }

      // 34. GET /api/gemini/fill_blank (Spróbuj pobrać z serwera, w razie braku połączenia użyj offline fallback)
      if (method === "GET" && path === "/api/gemini/fill_blank") {
        const word = params.get("word");
        const translation = params.get("translation");
        
        const apiEnabled = localStorage.getItem("gemini_api_enabled") !== "false";
        if (apiEnabled) {
          // A. Spróbuj pobrać bezpośrednio z API Google (jeśli zapisano klucz w Ustawieniach)
          const localApiKey = localStorage.getItem("gemini_api_key");
          if (localApiKey) {
            try {
              console.log("Pobieram zdanie z luką bezpośrednio z API Gemini (klucz lokalny)...");
              const data = await fetchDirectGeminiFillBlank(word, translation, localApiKey);
              if (data && data.sentence) {
                return data;
              }
            } catch (e) {
              // Silent fail - use server or offline fallback
              console.warn("Gemini fill_blank direct API failed:", e.message);
            }
          }

          // B. W przeciwnym razie spróbuj pobrać z lokalnego serwera
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);
            const response = await fetch(url, {
              headers: { 'X-User-Id': userId.toString() },
              signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (response.ok) {
              const data = await response.json();
              if (data && data.sentence) {
                return data;
              }
            }
          } catch (e) {
            console.log("Rzeczywiste API Gemini niedostępne, używam offline fallback:", e);
          }
        }
        
        const hint = word ? (word[0] + "_".repeat(word.length - 1)) : "";
        return {
          sentence: `Can you write the word "_____" meaning "${translation}"?`,
          sentence_pl: `Czy potrafisz napisać słowo oznaczające "${translation}"?`,
          answer: word,
          hint: hint
        };
      }

      // 35. GET /api/gemini/sentence_builder
      if (method === "GET" && path === "/api/gemini/sentence_builder") {
        const word = params.get("word");
        const translation = params.get("translation");

        const apiEnabled = localStorage.getItem("gemini_api_enabled") !== "false";
        if (apiEnabled) {
          const localApiKey = localStorage.getItem("gemini_api_key");
          if (localApiKey) {
            try {
              const data = await fetchDirectGeminiSentenceBuilder(word, translation, localApiKey);
              if (data && data.sentence) return data;
            } catch (e) {
              console.warn("SentenceBuilder direct Gemini failed:", e.message);
            }
          }
          // Try server
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);
            const response = await fetch(url, {
              headers: { 'X-User-Id': userId.toString() },
              signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (response.ok) {
              const data = await response.json();
              if (data && data.sentence) return data;
            }
          } catch (e) {
            console.log("Server unavailable for sentence_builder, using offline:", e.message);
          }
        }

        // Offline fallback
        const templates = [
          `She could not ${word} the situation at all.`,
          `He decided to ${word} everything carefully.`,
          `They always ${word} this problem together.`,
          `The teacher asked us to ${word} the exercise.`,
          `I need to ${word} this before tomorrow.`,
          `We should ${word} it as soon as possible.`,
        ];
        const sentence = templates[Math.floor(Math.random() * templates.length)];
        const words = sentence.split(" ");
        const scrambled = [...words].sort(() => Math.random() - 0.5);
        return { sentence, words_scrambled: scrambled, translation_pl: `(offline: ${translation})` };
      }

      // 36. GET /api/exercise/daily_fact
      if (method === "GET" && path === "/api/exercise/daily_fact") {
        const category = params.get("category") || "biology";

        const apiEnabled = localStorage.getItem("gemini_api_enabled") !== "false";
        if (apiEnabled) {
          const localApiKey = localStorage.getItem("gemini_api_key");
          if (localApiKey) {
            try {
              console.log("Pobieram ciekawostkę bezpośrednio z API Gemini (klucz lokalny)...");
              const allWords = await this.db.words.where({ user_id: userId }).toArray();
              const preferredWords = allWords.filter(w => 
                w.translation && 
                (w.status === "NIE_ZNAM" || w.status === "TROCHE" || (w.status === "ZNAM" && w.learned_at))
              );
              let pool = recencySort(preferredWords).slice(0, 20);
              
              if (pool.length < 15) {
                const fallbackWords = allWords.filter(w =>
                  w.translation &&
                  w.status === "ZNAM" &&
                  !w.learned_at
                );
                const sortedFallback = recencySort(fallbackWords);
                pool = pool.concat(sortedFallback.slice(0, 20 - pool.length));
              }
              
              console.log("Daily Fact Debug:", {
                userId,
                wordsInDb: allWords.length,
                userWordsInDb: pool.length,
                usingFallback: pool.length === 0
              });
              if (pool.length === 0) {
                const allCoca = await this.db.coca_words.toArray();
                pool = allCoca.map(c => ({ word: c.word, translation: c.translation }));
              }
              const shuffledWords = [...pool].sort(() => Math.random() - 0.5);
              const data = await fetchDirectGeminiDailyFact(category, shuffledWords, localApiKey);
              if (data && data.fact) return data;
            } catch (e) {
              console.warn("Direct Gemini daily_fact failed, trying server/offline:", e.message);
            }
          }
        }

        // Try server first
        try {
          const controller = new AbortController();
          const tid = setTimeout(() => controller.abort(), 12000);
          const resp = await fetch(url, { headers: { 'X-User-Id': userId.toString() }, signal: controller.signal });
          clearTimeout(tid);
          if (resp.ok) { const d = await resp.json(); if (d && d.fact) return d; }
        } catch(e) { console.log("daily_fact server unavailable, using offline:", e.message); }

        // Offline fallbacks (one per category)
        const OFFLINE = {
          biology: {
            title: "How Cells Communicate",
            fact: "Cells in the human body constantly **communicate** with each other using chemical signals. This **process** allows organs to **coordinate** their functions effectively. Without this communication, the body would not be able to **maintain** a stable internal environment. Scientists call this ability to stay balanced **homeostasis**.",
            used_words: [
              {word:"communicate",translation:"komunikować się",context:"cells communicate using signals"},
              {word:"process",translation:"proces",context:"this process allows organs"},
              {word:"maintain",translation:"utrzymywać",context:"ability to maintain balance"}
            ],
            questions: [
              {statement:"Cells communicate using chemical signals.",answer:true,explanation:"Tekst wyraźnie to stwierdza."},
              {statement:"Without cell communication organs work better.",answer:false,explanation:"Tekst mówi, że bez komunikacji ciało nie mogłoby utrzymać równowagi."},
              {statement:"Homeostasis means maintaining a stable internal environment.",answer:true,explanation:"Tekst kończy to wyjaśniając."}
            ]
          },
          evolutionary_biology: {
            title: "Island Animals and Evolution",
            fact: "Animals on islands often **develop** unusual traits because they **adapt** to local conditions without natural **predators**. Over many generations these changes become permanent. The **process** of **isolated** evolution can produce creatures found nowhere else on Earth. Darwin observed this on the Galápagos Islands.",
            used_words: [
              {word:"develop",translation:"rozwijać",context:"animals develop unusual traits"},
              {word:"adapt",translation:"adaptować się",context:"adapt to local conditions"},
              {word:"isolated",translation:"izolowany",context:"isolated evolution"}
            ],
            questions: [
              {statement:"Island animals evolve without natural predators.",answer:true,explanation:"Tekst tak stwierdza."},
              {statement:"Darwin visited the Amazon rainforest to study evolution.",answer:false,explanation:"Tekst mówi o Wyspach Galapagos, nie o Amazonce."},
              {statement:"Island evolution can produce unique species.",answer:true,explanation:"Tekst mówi o stworzeniach, których nie ma nigdzie indziej."}
            ]
          },
          nature: {
            title: "How Trees Share Resources",
            fact: "Trees in a forest **communicate** and share nutrients through an underground **network** of fungi. Older trees can **support** younger ones by sending sugar through these connections. Scientists call this the 'Wood Wide Web'. This **cooperation** helps the entire forest **survive** difficult conditions like drought.",
            used_words: [
              {word:"network",translation:"sieć",context:"underground network of fungi"},
              {word:"support",translation:"wspierać",context:"older trees support younger ones"},
              {word:"survive",translation:"przeżyć",context:"forest survive difficult conditions"}
            ],
            questions: [
              {statement:"Trees share nutrients through underground fungal networks.",answer:true,explanation:"Tekst to opisuje."},
              {statement:"Only young trees benefit from the Wood Wide Web.",answer:false,explanation:"Cały las korzysta z tego systemu."},
              {statement:"The fungal network helps forests survive drought.",answer:true,explanation:"Tekst wprost to stwierdza."}
            ]
          },
          physics: {
            title: "Light as Both Wave and Particle",
            fact: "Light behaves as both a wave and a **particle**, depending on how scientists **observe** it. This strange **property** is called wave-particle duality. It means that light does not fit neatly into a single **category**. This **discovery** was one of the most surprising findings in modern physics.",
            used_words: [
              {word:"observe",translation:"obserwować",context:"how scientists observe it"},
              {word:"property",translation:"właściwość",context:"strange property of light"},
              {word:"category",translation:"kategoria",context:"does not fit a single category"}
            ],
            questions: [
              {statement:"Light always behaves only as a wave.",answer:false,explanation:"Tekst mówi, że zachowuje się zarówno jako fala, jak i cząsteczka."},
              {statement:"Wave-particle duality is a property of light.",answer:true,explanation:"Tekst tak to definiuje."},
              {statement:"Wave-particle duality was a surprising discovery in physics.",answer:true,explanation:"Tekst mówi, że było to jedno z najbardziej zaskakujących odkryć."}
            ]
          },
          technology: {
            title: "How Wi-Fi Transmits Data",
            fact: "Wi-Fi **transmits** data by sending radio waves through the air at high **frequency**. Devices **receive** these signals and **convert** them into digital information. The **process** happens billions of times per second. Modern Wi-Fi can **support** dozens of devices simultaneously in one location.",
            used_words: [
              {word:"transmits",translation:"przesyła",context:"Wi-Fi transmits data"},
              {word:"frequency",translation:"częstotliwość",context:"high frequency radio waves"},
              {word:"convert",translation:"konwertować",context:"convert them into digital information"}
            ],
            questions: [
              {statement:"Wi-Fi uses radio waves to transmit data.",answer:true,explanation:"Tekst to wyjaśnia."},
              {statement:"Wi-Fi can only support one device at a time.",answer:false,explanation:"Tekst mówi o dziesiątkach urządzeń jednocześnie."},
              {statement:"Wi-Fi converts radio signals into digital information.",answer:true,explanation:"Tekst to stwierdza."}
            ]
          }
        };
        return OFFLINE[category] || OFFLINE.biology;
      }

      return { error: `Not Found: ${method} ${path}` };



    } catch (err) {
      console.error(`Błąd wirtualnego API: ${method} ${path}:`, err);
      return { error: "Internal Database Error" };
    }
  }
};

const Backup = {
  async export() {
    try {
      if (!DB.db) {
        alert("Baza danych nie jest gotowa!");
        return;
      }
      
      const backupData = {
        app: "Językowy AS",
        version: "1.0",
        timestamp: new Date().toISOString(),
        tables: {}
      };
      
      const tablesToExport = [
        "users",
        "words",
        "sessions",
        "streak",
        "daily_quests",
        "achievements",
        "skipped_coca_words",
        "srs_cards",
        "word_promotions"
      ];
      
      for (const table of tablesToExport) {
        backupData.tables[table] = await DB.db[table].toArray();
      }
      
      const jsonString = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement("a");
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `jezykowy_as_kopia_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 0);
      
    } catch (err) {
      console.error("Błąd eksportu kopii zapasowej:", err);
      alert("Wystąpił błąd podczas generowania kopii zapasowej: " + err.message);
    }
  },
  
  async import(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const backupData = JSON.parse(e.target.result);
        
        if (!backupData || backupData.app !== "Językowy AS" || !backupData.tables) {
          alert("Błędny format pliku kopii zapasowej! Upewnij się, że wgrywasz plik wyeksportowany z tej aplikacji.");
          return;
        }
        
        const confirmRestore = confirm(
          `Czy na pewno chcesz wczytać kopię zapasową z dnia ${new Date(backupData.timestamp).toLocaleString()}?\n` +
          `⚠️ Uwaga: Bieżące dane w tej przeglądarce zostaną zastąpione danymi z pliku!`
        );
        
        if (!confirmRestore) {
          event.target.value = "";
          return;
        }
        
        const tablesToRestore = [
          "users",
          "words",
          "sessions",
          "streak",
          "daily_quests",
          "achievements",
          "skipped_coca_words",
          "srs_cards",
          "word_promotions"
        ];
        
        // Wykonanie zapisu w transakcji Dexie
        await DB.db.transaction("rw", tablesToRestore, async () => {
          for (const table of tablesToRestore) {
            if (backupData.tables[table]) {
              await DB.db[table].clear();
              if (backupData.tables[table].length > 0) {
                await DB.db[table].bulkAdd(backupData.tables[table]);
              }
            }
          }
        });
        
        // Znajdź czy aktualny zalogowany użytkownik istnieje w zaimportowanej kopii
        const currentUname = typeof Session !== 'undefined' ? Session.username : null;
        let matchedUser = null;
        if (currentUname && backupData.tables.users) {
          matchedUser = backupData.tables.users.find(u => u.username.toLowerCase() === currentUname.toLowerCase());
        }
        
        alert("Kopia zapasowa wczytana pomyślnie! Aplikacja zostanie odświeżona.");
        
        if (matchedUser && typeof Session !== 'undefined') {
          // Zachowaj zalogowanego użytkownika
          Session.save(matchedUser.id, matchedUser.username, matchedUser.xp);
        } else if (typeof Session !== 'undefined') {
          // Jeśli profil nie istnieje w zaimportowanej kopii, wyloguj
          Session.clear();
        }
        
        window.location.reload();
        
      } catch (err) {
        console.error("Błąd importu kopii zapasowej:", err);
        alert("Wystąpił błąd podczas wczytywania pliku: " + err.message);
      } finally {
        event.target.value = "";
      }
    };
    reader.readAsText(file);
  }
};

// Nadpisanie globalnego pomocnika API z auth.js
window.API = {
  async get(url) {
    return DB.route("GET", url);
  },
  async post(url, data) {
    return DB.route("POST", url, data);
  }
};
