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
        if (!parsed.sentence || !parsed.sentence.trim()) throw new Error("Missing sentence");
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

async function fetchDirectGeminiDailyFact(category, userWords, apiKey, seenTopics) {
  const cats = {
    biology: ["Biology", "Biologia"],
    evolutionary_biology: ["Evolutionary Biology", "Biologia ewolucyjna"],
    nature: ["Nature & Wildlife", "Przyroda i Świat zwierząt"],
    physics: ["Physics & Quantum Realm", "Fizyka i Kosmos"],
    technology: ["Technology & Innovation", "Technika i AI"],
    primitive_human: ["Primitive Humans & Archaeology", "Człowiek pierwotny i Archeologia"],
    polish_business: ["Polish Business & Economy", "Polski biznes i Gospodarka"],
    history: ["World History & Civilizations", "Historia świata i Cywilizacje"],
    psychology: ["Psychology & Mind", "Psychologia i Mózg"],
    culture: ["Culture & Pop Culture", "Popkultura i Sztuka"]
  };
  const [catEn, catPl] = cats[category] || ["Biology", "Biologia"];
  const wordsStr = userWords.slice(0, 15).map(w => `"${w.word}" (${w.translation || '?'})`).join(", ");
  const seenInstruction = seenTopics && seenTopics.trim()
    ? `\nDO NOT generate a fact about these already-seen topics: ${seenTopics}. Choose a COMPLETELY DIFFERENT topic within "${catEn}".`
    : '';

  const prompt = `You are creating educational English content for a Polish speaker learning English.

STRICT CATEGORY & CONCRETENESS REQUIREMENT:
1. TOPIC: The fact MUST be 100% about "${catEn}" (${catPl}).${seenInstruction}
2. MAXIMUM CONCRETENESS & SPECIFICITY:
   - ABSOLUTELY NO vague corporate fluff or generic statements (e.g. NEVER write generic lines like "Poland's economic growth has been remarkable", "allowed companies to reach new markets", "strong performance", "important for the future").
   - MUST name REAL SPECIFIC ENTITIES (company names, brands, products, services, famous inventors, or scientific discoveries).
   - MUST include CONCRETE DATA (exact numbers, percentages, years/dates, dollar/euro values, or production units).
   - For "Polish Business & Economy": Focus on real Polish companies (e.g. InPost 24,000+ parcel lockers, CD Projekt Red $500M+ Witcher/Cyberpunk sales, Allegro e-commerce, Solaris 23,000+ electric buses in Berlin/Milan, Orlen energy, Wilk Elektronik GoodRAM, DocPlanner, ElevenLabs AI) with real financial numbers and export achievements!
   - For other topics: Use specific species, discovery years, chemical formulas, space telescopes, or physical laws!

User's vocabulary to practice (pick 2-4 and use them naturally): ${wordsStr}

CRITICAL RULES:
1. Write a fascinating, highly specific fact with real numbers, proper names, and exact services/goods.
2. Use ONLY words from the vocabulary list above (mark with **double asterisks**). If none fit naturally, skip them.
3. Include a Polish translation of the full fact in "fact_pl".
4. Include Polish translations in "statement_pl" for each question.

Return ONLY valid JSON (no markdown):
{
  "title": "Specific topic title strictly about ${catEn} (4-6 English words)",
  "fact": "3-4 sentences (80-130 words). Must contain real names, numbers/data, and specific products/services. B1-B2 English level. Mark each used target word with **double asterisks**.",
  "fact_pl": "Complete Polish translation of the fact paragraph.",
  "used_words": [
    {"word": "used_word", "translation": "polskie tlumaczenie", "context": "short phrase using it"}
  ],
  "questions": [
    {"statement": "T/F statement 1 based only on the fact.", "statement_pl": "Polish translation of statement 1.", "answer": true, "explanation": "Krotkie wyjasnienie po polsku."},
    {"statement": "T/F statement 2.", "statement_pl": "Polish translation of statement 2.", "answer": false, "explanation": "Wyjasnienie."},
    {"statement": "T/F statement 3.", "statement_pl": "Polish translation of statement 3.", "answer": true, "explanation": "Wyjasnienie."}
  ]
}

Rules:
- Exactly 3 questions, mix of true/false
- Questions answerable ONLY from the fact text
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

async function fetchDirectGeminiRpgStep(theme, stage, previousStory, targetWord, targetTranslation, apiKey) {
  const stagesDesc = {
    1: "Intro / Beginning of the journey. Establish the scene and introducing the challenge.",
    2: "Journey / Obstacle. Encountering a minor problem or barrier.",
    3: "Climax / Deep danger. A tense encounter or high risk.",
    4: "Escape / Finding a way out / Resolution of the danger.",
    5: "Final resolution / Epilogue. Celebrating victory or achieving the goal."
  };
  const stageText = stagesDesc[stage] || "Continuing the journey.";
  const prompt = `You are generating an interactive RPG text adventure for a Polish student learning English.
Theme/Setting: ${theme}
Current Stage: ${stage} of 5 (${stageText})
Target Vocabulary Word to practice: "${targetWord}" (Polish translation: "${targetTranslation}")

Story so far:
${previousStory || "This is the start of the adventure."}

CRITICAL RULES:
1. Write a short story continuation (2-3 sentences, 50-80 words) in English. It MUST naturally use the word "${targetWord}" exactly, marked with **double asterisks** like **${targetWord}**.
2. Provide exactly 3 choices for how the player proceeds next.
3. Only ONE choice can be correct (leads to success, uses/understands "${targetWord}" properly). Set "is_correct": true for this one.
4. The other two choices must be incorrect (leads to minor failure or danger, misunderstands "${targetWord}", or is contextually unsafe). Set "is_correct": false for these.
5. Provide the Polish translation of the story ("story_pl") and translations/effects for all choices.
6. Return ONLY a valid JSON object. Do NOT wrap in markdown code blocks.

Expected JSON Structure:
{
  "story": "The narrative text in English...",
  "story_pl": "Tłumaczenie fabuły na język polski...",
  "choices": [
    {
      "text": "Action option 1 in English...",
      "text_pl": "Tłumaczenie opcji 1 na polski...",
      "is_correct": true,
      "effect": "Opis sukcesu po polsku (np. Uciekasz bezpiecznie! +10 XP)"
    },
    {
      "text": "Action option 2 in English...",
      "text_pl": "Tłumaczenie opcji 2 na polski...",
      "is_correct": false,
      "effect": "Opis porażki po polsku (np. Potwór cię dogania! Tracisz serduszko -1 Heart)"
    },
    {
      "text": "Action option 3 in English...",
      "text_pl": "Tłumaczenie opcji 3 na polski...",
      "is_correct": false,
      "effect": "Opis porażki po polsku (np. Zła decyzja! Tracisz serduszko -1 Heart)"
    }
  ]
}`;

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
        if (!parsed.story || !parsed.choices || parsed.choices.length < 3) {
          throw new Error("Missing story or choices in response");
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
      word_promotions: "++id, user_id",
      weekly_challenges: "++id, user_id, week_key, quest_type"
    });

    this.db.version(2).stores({
      weekly_challenges: "++id, user_id, week_key, quest_type"
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
          word_promotions: "++id, user_id",
          weekly_challenges: "++id, user_id, week_key, quest_type"
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
    if (existing.length > 0 && existing.length < 7) {
      await this.db.daily_quests.where({ user_id: userId, quest_date: todayStr }).delete();
      existing = [];
    }
    if (existing.length === 0) {
      const seed = this.getStringSeed(todayStr + String(userId));

      // ── 1. Sklasyfikuj nowe słowa (losowy wariant) ────────────────────────────────────────────
      const classifyVariants = [
        { type: "classify", desc: "Sklasyfikuj 15 nowych słów",  target: 15,  xp: 40,  icon: "🔍" },
        { type: "classify", desc: "Sklasyfikuj 30 nowych słów",  target: 30,  xp: 75,  icon: "🔍" },
      ];
      const classifyQuest = classifyVariants[seed % classifyVariants.length];

      // ── 2. Misja sesji (zawsze obecna) ─────────────────────────────────────────────────────
      const sessionQuest = { type: "session", desc: "Ukończ 2 dowolne ćwiczenia", target: 2, xp: 70, icon: "🏋️" };

      // ── 3. Super-Quiz — zawsze jeden z 3 rotacyjnych slotów (gwarantowany) ──────
      const superQuizVariants = [
        { type: "super_quiz", desc: "Ukończ Super-Quiz",                  target: 1, xp: 80,  icon: "🏆" },
        { type: "super_quiz", desc: "Ukończ 2 rundy Super-Quizu",         target: 2, xp: 140, icon: "🏆" },
      ];
      const superQuizQuest = superQuizVariants[seed % superQuizVariants.length];

      // ── 4. Pula rotacyjna (2 misje z poniższej listy) ──────────────────────────────
      const rotationPool = [
        // Ciekawostka Dnia
        { type: "daily_fact",          desc: "Ukończ Ciekawostkę Dnia",                         target: 1, xp: 70,  icon: "🧪" },
        { type: "daily_fact",          desc: "Ukończ 2 Ciekawostki Dnia",                        target: 2, xp: 120, icon: "🧪" },
        // Tłumaczenie zdań
        { type: "sentence_translation", desc: "Przetłumacz 3 zdania",                            target: 3, xp: 90,  icon: "🗣️" },
        { type: "sentence_translation", desc: "Przetłumacz 5 zdań",                              target: 5, xp: 130, icon: "🗣️" },
        // Speed Round
        { type: "speed_round",         desc: "Ukończ Speed Round",                               target: 1, xp: 65,  icon: "⚡" },
        { type: "speed_round",         desc: "Zdobadź 10 pkt w Speed Round",                     target: 10, xp: 100, icon: "⚡" },
        // Dopasuj pary
        { type: "match_pairs",         desc: "Ukończ Dopasuj Pary",                              target: 1, xp: 55,  icon: "🔗" },
        // SRS
        { type: "srs",                 desc: "Ukończ powtórkę SRS",                              target: 1, xp: 65,  icon: "🧠" },
        { type: "srs",                 desc: "Ukończ 3 powtórki SRS",                            target: 3, xp: 110, icon: "🧠" },
        // Test pisowni
        { type: "fill_blank",          desc: "Ukończ Test Pisowni",                              target: 1, xp: 65,  icon: "✍️" },
        // Promowanie słów
        { type: "promote_words",       desc: "Przenieś 3 słowa do listy \"Poznałem\"",           target: 3, xp: 100, icon: "🎓" },
        { type: "promote_words",       desc: "Przenieś 5 słów do listy \"Poznałem\"",            target: 5, xp: 150, icon: "🎓" },
        // Szybkie wyzwanie
        { type: "quick_challenge",     desc: "Ukończ Szybkie Wyzwanie",                          target: 1, xp: 60,  icon: "⏱️" },
        // Budowanie zdań
        { type: "sentence_builder",    desc: "Ukończ Budowanie Zdań",                            target: 1, xp: 60,  icon: "🔤" },
        // Audionaukę
        { type: "hands_free",          desc: "Ukończ Audionaukę",                                target: 1, xp: 50,  icon: "🎧" },
        // Combo Trio — ukończ 3 różne ćwiczenia w jednej sesji
        { type: "combo_trio",          desc: "Ukończ Speed Round, Match Pairs i Super-Quiz",     target: 3, xp: 120, icon: "🎯" },
        // Flashcards
        { type: "flashcards",          desc: "Przejrzyj 20 fiszek",                              target: 20, xp: 60,  icon: "🃏" },
        { type: "flashcards",          desc: "Przejrzyj 50 fiszek",                              target: 50, xp: 120, icon: "🃏" },
        // Wymowa / Trener wymowy
        { type: "pronunciation",       desc: "Ukończ Trening Wymowy",                            target: 1, xp: 75,  icon: "🎤" },
        // Seria XP — zdobadź XP w ciągu dnia
        { type: "daily_xp",            desc: "Zdobadź 100 XP dziś",                              target: 100, xp: 80, icon: "⭐" },
        { type: "daily_xp",            desc: "Zdobadź 200 XP dziś",                              target: 200, xp: 150, icon: "🌟" },
      ];

      // Przetasuj pulę rotacyjną używając seeda (LCG)
      const shuffled = [...rotationPool];
      let s = seed;
      for (let i = shuffled.length - 1; i > 0; i--) {
        s = ((s * 1664525) + 1013904223) & 0x7fffffff;
        const j = Math.abs(s) % (i + 1);
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      // Sloty: [classify, session, super_quiz, rotacja1, rotacja2, rotacja3, rotacja4]
      const chosen = [classifyQuest, sessionQuest, superQuizQuest];
      const usedTypes = new Set(["classify", "session", "super_quiz"]);
      for (const q of shuffled) {
        if (chosen.length >= 7) break;
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

  getWeekKey(d = new Date()) {
    const target = new Date(d.valueOf());
    const dayNr = (d.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
      target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
    }
    const weekNr = 1 + Math.round((firstThursday - target.valueOf()) / 604800000);
    return `${target.getFullYear()}-W${String(weekNr).padStart(2, '0')}`;
  },

  async ensureWeeklyChallenges(userId) {
    const weekKey = this.getWeekKey();
    let existing = [];
    try {
      existing = await this.db.weekly_challenges.where({ user_id: userId, week_key: weekKey }).toArray();
    } catch(e) {
      console.warn("weekly_challenges store initializing...");
      return;
    }
    if (existing.length === 0) {
      const defaultWeekly = [
        { quest_type: "classify_weekly", description: "Sklasyfikuj 60 nowych słów w tym tygodniu", target: 60, icon: "🔍", xp_reward: 250 },
        { quest_type: "session_weekly",  description: "Ukończ 10 dowolnych ćwiczeń w tym tygodniu", target: 10, icon: "🏋️", xp_reward: 300 },
        { quest_type: "xp_weekly",       description: "Zdobądź 600 XP w tym tygodniu",             target: 600, icon: "⭐", xp_reward: 450 }
      ];
      for (const q of defaultWeekly) {
        await this.db.weekly_challenges.add({
          user_id: userId,
          week_key: weekKey,
          quest_type: q.quest_type,
          description: q.description,
          icon: q.icon,
          target: q.target,
          progress: 0,
          completed: 0,
          xp_reward: q.xp_reward
        });
      }
    }
  },

  async updateWeeklyChallengeProgress(userId, questType, amount = 1) {
    const weekKey = this.getWeekKey();
    let quests = [];
    try {
      quests = await this.db.weekly_challenges.where({ user_id: userId, week_key: weekKey, quest_type: questType }).toArray();
    } catch(e) { return []; }
    const completedNow = [];
    for (const q of quests) {
      if (q.completed) continue;
      const newProgress = Math.min(q.progress + amount, q.target);
      const newlyDone = newProgress >= q.target;
      await this.db.weekly_challenges.update(q.id, { progress: newProgress, completed: newlyDone ? 1 : 0 });
      if (newlyDone) {
        completedNow.push({ desc: q.description, xp: q.xp_reward, icon: q.icon });
        await this.addUserXp(userId, q.xp_reward);
      }
    }
    return completedNow;
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

          const uFinal = await this.db.users.get(userId);
          const finalXp = uFinal ? uFinal.xp : (resXp ? resXp.xp : 0);
          const finalLvl = uFinal ? uFinal.level : "Beginner 🌱";
          return { ok: true, xp: xpAward, total_xp: finalXp, level: finalLvl, milestone: ms };
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

        const qDone = await this.updateQuestProgress(userId, "classify", 1);
        const resXp = await this.addUserXp(userId, 2);
        const bEarned = await this.checkAndAwardBadges(userId);
        const uFinal = await this.db.users.get(userId);
        const finalXp = uFinal ? uFinal.xp : resXp.xp;

        const countClassified = await this.db.words.where({ user_id: userId }).count();
        let milestone = null;
        if ([50, 100, 150, 200, 250, 300, 400, 500, 750, 1000].includes(countClassified)) {
          milestone = { count: countClassified };
        }

        return {
          ok: true,
          xp: 3,
          total_xp: finalXp,
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
        let qAmt = 1;
        if (type === "speed_round") {
          qAmt = Math.max(1, correct !== undefined ? correct : (data.score || 0));
        }
        const qDone2 = await this.updateQuestProgress(userId, type, qAmt);
        let qDone = [...qDone1, ...qDone2];
        if (type === "flashcards" && words > 0) {
          const qDone3 = await this.updateQuestProgress(userId, "flashcards", words);
          qDone = [...qDone, ...qDone3];
        }
        // sentence_translation: track individual sentences count (data.sentences_count)
        if (type === "sentence_translation" && data.sentences_count > 0) {
          const qSent = await this.updateQuestProgress(userId, "sentence_translation", data.sentences_count - 1);
          qDone = [...qDone, ...qSent];
        }
        // daily_xp: update progress with XP earned this session
        if (xpEarned > 0) {
          const qXp = await this.updateQuestProgress(userId, "daily_xp", xpEarned);
          qDone = [...qDone, ...qXp];
        }

        const bEarned = await this.checkAndAwardBadges(userId, correct, words, type);
        const uFinal = await this.db.users.get(userId);
        const finalXp = uFinal ? uFinal.xp : resXp.xp;

        return {
          ok: true,
          xp_earned: xpEarned,
          total_xp: finalXp,
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

        const speedQuests = await this.db.daily_quests.where({ user_id: userId, quest_date: todayStr, quest_type: "speed_round" }).toArray();
        for (const sq of speedQuests) {
          if (sq.target > 1) {
            const todaySessions = await this.db.sessions.where({ user_id: userId, exercise_type: "speed_round" }).toArray();
            const todaySpeed = todaySessions.filter(s => s.session_date && s.session_date.slice(0, 10) === todayStr);
            const totalPointsToday = todaySpeed.reduce((sum, s) => sum + (s.correct || 0), 0);
            
            if (totalPointsToday > 0) {
              const newProg = Math.min(totalPointsToday, sq.target);
              const newlyDone = newProg >= sq.target;
              if (sq.progress !== newProg || (newlyDone && !sq.completed)) {
                await this.db.daily_quests.update(sq.id, {
                  progress: newProg,
                  completed: newlyDone ? 1 : (sq.completed || 0)
                });
              }
            }
          }
        }

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

      // 32.5 GET /api/weekly_challenges
      if (method === "GET" && path === "/api/weekly_challenges") {
        await this.ensureWeeklyChallenges(userId);
        const weekKey = this.getWeekKey();
        const list = await this.db.weekly_challenges.where({ user_id: userId, week_key: weekKey }).toArray();
        const now = new Date();
        const dayOfWeek = now.getDay();
        const daysLeft = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
        return { week_key: weekKey, days_left: daysLeft, challenges: list };
      }

      // GET /api/exercise/debate/init
      if (method === "GET" && path === "/api/exercise/debate/init") {
        const topic = params.get("topic") || "Is Remote Work Better Than Office Work?";
        const stance = params.get("stance") || "FOR";
        
        try {
          const controller = new AbortController();
          const tid = setTimeout(() => controller.abort(), 12000);
          const resp = await fetch(url, { headers: { 'X-User-Id': userId.toString() }, signal: controller.signal });
          clearTimeout(tid);
          if (resp.ok) { const d = await resp.json(); if (d && d.ai_opening_en) return d; }
        } catch(e) {}

        return {
          topic: topic,
          ai_stance: stance === 'FOR' ? 'Anti Stance' : 'Pro Stance',
          ai_opening_en: `While discussing '${topic}', we must critically examine whether the advantages truly balance out the potential risks.`,
          ai_opening_pl: `Dyskutując o '${topic}', musimy krytycznie zbadać, czy zalety rzeczywiście równoważą potencjalne ryzyka.`,
          key_vocab: [
            { word: "perspective", translation: "perspektywa" },
            { word: "advantage", translation: "zaleta" },
            { word: "consequence", translation: "konsekwencja" }
          ]
        };
      }

      // POST /api/exercise/debate/reply
      if (method === "POST" && path === "/api/exercise/debate/reply") {
        const { topic, user_input, turn_number } = data;
        const turnNum = turn_number || 1;
        
        try {
          const controller = new AbortController();
          const tid = setTimeout(() => controller.abort(), 12000);
          const resp = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-User-Id": userId.toString() },
            body: JSON.stringify(data),
            signal: controller.signal
          });
          clearTimeout(tid);
          if (resp.ok) { const d = await resp.json(); if (d && d.ai_reply_en) return d; }
        } catch(e) {}

        const wordCount = (user_input || '').split(' ').filter(Boolean).length;
        const score = Math.min(95, Math.max(65, 60 + wordCount * 3));
        return {
          feedback_pl: `Twój argument jest przekonujący (${wordCount} słów). Świetna struktura riposty!`,
          argument_score: score,
          ai_reply_en: `That is an interesting counterargument. However, how do you address the long-term impact on overall quality?`,
          ai_reply_pl: `To ciekawy kontrargument. Jednak jak odniesiesz się do długofalowego wpływu na ogólną jakość?`,
          is_debate_complete: turnNum >= 3
        };
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
              const seenTitles = params.get("seen") || "";
              const data = await fetchDirectGeminiDailyFact(category, shuffledWords, localApiKey, seenTitles);
              if (data && data.fact) return data;
            } catch (e) {
              console.warn("Direct Gemini daily_fact failed, trying server/offline:", e.message);
            }
          }
        }

        // Try server first
        try {
          const controller = new AbortController();
          const tid = setTimeout(() => controller.abort(), 35000);
          const activeUid = (typeof Session !== 'undefined' && Session.userId) ? Session.userId : (parseInt(localStorage.getItem('uid')) || userId || 1);
          const resp = await fetch(url, { headers: { 'X-User-Id': activeUid.toString() }, signal: controller.signal });
          clearTimeout(tid);
          if (resp.ok) { const d = await resp.json(); if (d && d.fact) return d; }
        } catch(e) { console.log("daily_fact server unavailable, using offline:", e.message); }

        // Offline fallbacks with seen_topics exclusion
        const seenParam = (params.get("seen") || "").toLowerCase();
        const OFFLINE = {
          polish_business: [
            {
              title: "InPost & CD Projekt: Polish Global Tech",
              fact: "Polish logistics giant InPost operates over 24,000 automated parcel lockers across Europe, transforming modern e-commerce delivery. Meanwhile, CD Projekt Red **achieved** international acclaim by exporting *The Witcher 3*, generating over $500 million in revenue. These innovative firms **produce** high-tech services and export goods to global **markets**.",
              fact_pl: "Polski gigant logistyczny InPost obsługuje ponad 24 000 paczkomatów w całej Europie, rewolucjonizując dostawy e-commerce. Tymczasem studio CD Projekt Red osiągnęło międzynarodowy poklask, eksportując Wiedźmina 3 i generując ponad 500 milionów dolarów przychodu. Te innowacyjne firmy tworzą zaawansowane usługi i eksportują towary na rynki międzynarodowe.",
              used_words: [
                {word:"achieved",translation:"osiągnęli",context:"achieved international acclaim"},
                {word:"produce",translation:"produkować / tworzyć",context:"produce high-tech services"},
                {word:"markets",translation:"rynki",context:"global markets"}
              ],
              questions: [
                {statement:"InPost operates over 24,000 automated parcel lockers in Europe.",statement_pl:"InPost obsługuje ponad 24 000 paczkomatów w Europie.",answer:true,explanation:"Tekst podaje liczbę 24 000 paczkomatów."},
                {statement:"CD Projekt Red is a company that manufactures traditional steel pipes.",statement_pl:"CD Projekt Red to firma produkująca tradycyjne stalowe rury.",answer:false,explanation:"Tekst mówi, że CD Projekt Red to studio gier wideo."},
                {statement:"The Witcher 3 generated over $500 million in sales.",statement_pl:"Wiedźmin 3 wygenerował ponad 500 milionów dolarów sprzedaży.",answer:true,explanation:"Tekst potwierdza przychód z gry Wiedźmin 3."}
              ]
            },
            {
              title: "Solaris Electric Buses in European Cities",
              fact: "Solaris Bus & Coach, founded near Poznań, has manufactured over 23,000 buses since 1996. Their zero-emission electric buses now **operate** in major European capitals like Berlin, Milan, and Madrid. The company **provides** clean energy solutions to **improve** urban public transport.",
              fact_pl: "Solaris Bus & Coach, założony pod Poznaniem, wyprodukował ponad 23 000 autobusów od 1996 roku. Ich bezemisyjne autobusy elektryczne kursują obecnie w głównych europejskich stolicach, takich jak Berlin, Mediolan i Madryt.",
              used_words: [
                {word:"operate",translation:"kursować / działać",context:"buses operate in capitals"},
                {word:"provides",translation:"dostarcza",context:"provides clean energy"},
                {word:"improve",translation:"ulepszać",context:"improve urban transport"}
              ],
              questions: [
                {statement:"Solaris Bus & Coach was founded near Poznań.",statement_pl:"Solaris Bus & Coach powstał pod Poznaniem.",answer:true,explanation:"Tekst wskazuje na okolicę Poznania."},
                {statement:"Solaris electric buses operate only in small Polish villages.",statement_pl:"Autobusy elektryczne Solaris kursują tylko w małych polskich wsiach.",answer:false,explanation:"Tekst wymienia stolicze miasta europejskie jak Berlin, Mediolan czy Madryt."},
                {statement:"Solaris produced over 23,000 buses since 1996.",statement_pl:"Solaris wyprodukował ponad 23 000 autobusów od 1996 roku.",answer:true,explanation:"Tekst potwierdza liczbę 23 000 autobusów."}
              ]
            }
          ],
          primitive_human: [
            {
              title: "Göbekli Tepe: Prehistoric Stone Architecture",
              fact: "Over 11,500 years ago, hunter-gatherers in Göbekli Tepe built 16-ton carved stone pillars before the invention of farming. Archaeologists **discovered** that prehistoric communities **developed** complex social organization during the Ice Age. These early humans shared tools and **created** monumental stone circles.",
              fact_pl: "Ponad 11 500 lat temu zbieracze-łowcy w Göbekli Tepe wznieśli 16-tonowe rzeźbione kamienne filary jeszcze przed wynalezieniem rolnictwa. Archeolodzy odkryli, że prehistoryczne społeczności wykształciły złożoną organizację społeczną.",
              used_words: [
                {word:"discovered",translation:"odkryli",context:"archaeologists discovered"},
                {word:"developed",translation:"rozwijali",context:"developed social organization"},
                {word:"created",translation:"stworzyli",context:"created stone circles"}
              ],
              questions: [
                {statement:"Göbekli Tepe pillars weigh up to 16 tons.",statement_pl:"Filary w Göbekli Tepe ważą do 16 ton.",answer:true,explanation:"Tekst mówi o 16-tonowych rzeźbionych kamieniach."},
                {statement:"Göbekli Tepe was built by 21st century modern computer programmers.",statement_pl:"Göbekli Tepe wznieśli XXI-wieczni programiści komputerowi.",answer:false,explanation:"Tekst mówi o zbieraczach-łowcach sprzed 11 500 lat."},
                {statement:"The site predates the invention of farming.",statement_pl:"Stanowisko powstało przed wynalezieniem rolnictwa.",answer:true,explanation:"Tekst wyraźnie to stwierdza."}
              ]
            }
          ],
          technology: [
            {
              title: "Frontier Supercomputer and AI Chips",
              fact: "The Frontier supercomputer in Tennessee performs over 1.1 quintillion calculations per second using advanced AMD processors. Engineers **design** microchips to train massive AI models that **analyze** satellite data. This computing power helps **predict** climate shifts and discover new life-saving drugs.",
              fact_pl: "Superkomputer Frontier w Tennessee wykonuje ponad 1,1 kwintyliona obliczeń na sekundę przy użyciu zaawansowanych procesorów AMD. Inżynierowie projektują mikrochipy do szkolenia modeli sztucznej inteligencji.",
              used_words: [
                {word:"design",translation:"projektować",context:"engineers design microchips"},
                {word:"analyze",translation:"analizować",context:"analyze satellite data"},
                {word:"predict",translation:"przewidywać",context:"predict climate shifts"}
              ],
              questions: [
                {statement:"Frontier performs over 1.1 quintillion calculations per second.",statement_pl:"Frontier wykonuje ponad 1,1 kwintyliona obliczeń na sekundę.",answer:true,explanation:"Tekst podaje tę dokładną wydajność."},
                {statement:"Frontier runs on mechanical clockwork gears.",statement_pl:"Frontier działa na mechanicznych kołach zębatych.",answer:false,explanation:"Komputer wykorzystuje procesory AMD."},
                {statement:"Supercomputers assist in drug discovery.",statement_pl:"Superkomputery pomagają w odkrywaniu leków.",answer:true,explanation:"Tekst wspomina o lekach ratujących życie."}
              ]
            }
          ],
          biology: [
            {
              title: "How Cells Communicate",
              fact: "Cells in the human body constantly **communicate** with each other using chemical signals. This **process** allows organs to **coordinate** their functions effectively. Without this communication, the body would not be able to **maintain** a stable internal environment. Scientists call this ability to stay balanced **homeostasis**.",
              fact_pl: "Komórki w ciele człowieka stale komunikują się ze sobą za pomocą sygnałów chemicznych. Ten proces pozwala narządom skutecznie koordynować swoje funkcje. Bez tej komunikacji ciało nie byłoby w stanie utrzymać stabilnego środowiska wewnętrznego.",
              used_words: [
                {word:"communicate",translation:"komunikować się",context:"cells communicate using signals"},
                {word:"process",translation:"proces",context:"this process allows organs"},
                {word:"maintain",translation:"utrzymywać",context:"ability to maintain balance"}
              ],
              questions: [
                {statement:"Cells communicate using chemical signals.",statement_pl:"Komórki komunikują się za pomocą sygnałów chemicznych.",answer:true,explanation:"Tekst wyraźnie to stwierdza."},
                {statement:"Without cell communication organs work better.",statement_pl:"Bez komunikacji komórkowej narządy pracują lepiej.",answer:false,explanation:"Tekst mówi, że bez komunikacji ciało nie mogłoby utrzymać równowagi."},
                {statement:"Homeostasis means maintaining a stable internal environment.",statement_pl:"Homeostaza oznacza utrzymywanie stabilnego środowiska wewnętrznego.",answer:true,explanation:"Tekst kończy to wyjaśniając."}
              ]
            },
            {
              title: "CRISPR-Cas9 and DNA Double Helix",
              fact: "In 2020, scientists won the Nobel Prize for discovering CRISPR-Cas9, a molecular tool for precise DNA editing. The double helix **structure** enables cells to **replicate** genetic data. Using fluorescent proteins, researchers **verify** how enzymes repair damaged genes.",
              fact_pl: "W 2020 roku naukowcy otrzymali Nagrodę Nobla za odkrycie CRISPR-Cas9 – narzędzia cząsteczkowego do edycji DNA. Podwójna helisa umożliwia komórkom replikację danych genetycznych.",
              used_words: [
                {word:"structure",translation:"struktura",context:"double helix structure"},
                {word:"replicate",translation:"replikować",context:"replicate genetic data"},
                {word:"verify",translation:"weryfikować",context:"researchers verify enzymes"}
              ],
              questions: [
                {statement:"CRISPR-Cas9 team won a Nobel Prize in 2020.",statement_pl:"Zespół CRISPR-Cas9 zdobył Nagrodę Nobla w 2020 roku.",answer:true,explanation:"Tekst to potwierdza."},
                {statement:"DNA editing was invented in 1750.",statement_pl:"Edycję DNA wynaleziono w 1750 roku.",answer:false,explanation:"Tekst mówi o Nagrodzie Nobla z 2020 r."},
                {statement:"Enzymes can repair damaged genetic material.",statement_pl:"Enzymy mogą naprawiać uszkodzony materiał genetyczny.",answer:true,explanation:"Tekst to potwierdza."}
              ]
            }
          ],
          evolutionary_biology: [
            {
              title: "Galápagos Finches and Natural Selection",
              fact: "On the Galápagos Islands, Charles Darwin documented 13 distinct species of finches with specialized beaks. Small-beaked finches survived drought periods by eating small seeds, demonstrating how populations **adapt** over time. Geneticists recently **identified** the ALX1 gene responsible for beak shape variations.",
              fact_pl: "Na wyspach Galapagos Karol Darwin udokumentował 13 osobnych gatunków zięb z wyspecjalizowanymi dziobami. Zięby o małych dziobach przetrwały suszę, jedząc małe nasiona, co pokazuje ewolucyjną adaptację.",
              used_words: [
                {word:"adapt",translation:"przystosowywać się",context:"populations adapt over time"},
                {word:"identified",translation:"zidentyfikowali",context:"geneticists identified the gene"}
              ],
              questions: [
                {statement:"Darwin documented 13 finch species on the Galápagos Islands.",statement_pl:"Darwin udokumentował 13 gatunków zięb na Galapagos.",answer:true,explanation:"Tekst podaje dokładnie 13 gatunków."},
                {statement:"Darwin studied finches in Antarctica.",statement_pl:"Darwin badał zięby na Antarktydzie.",answer:false,explanation:"Tekst mówi o Wyspach Galapagos."},
                {statement:"ALX1 gene influences beak shape variation.",statement_pl:"Gen ALX1 wpływa na zmienność kształtu dzioba.",answer:true,explanation:"Tekst wspomina o genetycznym powiązaniu z genem ALX1."}
              ]
            }
          ]
        };
        const catList = OFFLINE[category] || OFFLINE.biology;
        const fresh = catList.filter(item => !seenParam.includes(item.title.toLowerCase()));
        return fresh.length > 0 ? fresh[Math.floor(Math.random() * fresh.length)] : catList[0];
      }

      // 37. POST /api/gemini/rpg_adventure
      if (method === "POST" && path === "/api/gemini/rpg_adventure") {
        const theme = data.theme || "Space Odyssey";
        const stage = parseInt(data.stage || 1);
        const previousStory = data.previous_story || "";
        const word = data.word || "";
        const translation = data.translation || "";

        const apiEnabled = localStorage.getItem("gemini_api_enabled") !== "false";
        if (apiEnabled) {
          const localApiKey = localStorage.getItem("gemini_api_key");
          if (localApiKey) {
            try {
              console.log("Pobieram krok RPG bezpośrednio z API Gemini (klucz lokalny)...");
              const res = await fetchDirectGeminiRpgStep(theme, stage, previousStory, word, translation, localApiKey);
              if (res && res.story) return res;
            } catch (e) {
              console.warn("Direct Gemini RPG failed, trying server/offline:", e.message);
            }
          }
        }

        // Try server
        try {
          const controller = new AbortController();
          const tid = setTimeout(() => controller.abort(), 12000);
          const resp = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-User-Id": userId.toString()
            },
            body: JSON.stringify(data),
            signal: controller.signal
          });
          clearTimeout(tid);
          if (resp.ok) {
            const d = await resp.json();
            if (d && d.story) return d;
          }
        } catch (e) {
          console.log("RPG server unavailable, using offline:", e.message);
        }

        // Offline templates for PWA mode
        const OFFLINE_RPG = {
          "Space Odyssey": {
            1: {
              story: `As your ship enters the dark void of the **Space Odyssey**, your sensors detect an unknown anomaly. You must **${word}** the navigational systems to avoid collision.`,
              story_pl: `Gdy twój statek wkracza w ciemną pustkę Odysei Kosmicznej, czujniki wykrywają nieznaną anomalię. Musisz dostosować/obsłużyć systemy nawigacyjne, aby uniknąć kolizji.`,
              choices: [
                { text: `Immediately try to ${word} the navigational panel and correct the course.`, text_pl: `Natychmiast spróbuj obsłużyć panel nawigacyjny i skorygować kurs.`, is_correct: true, effect: "Udało się! Statek omija niebezpieczeństwo! (+10 XP)" },
                { text: `Abandon the ship and run to the escape pods.`, text_pl: `Porzuć statek i uciekaj do kapsuł ratunkowych.`, is_correct: false, effect: "Kapsuły są zablokowane! Tracisz serduszko (-1 Heart)" },
                { text: `Turn off all power and wait.`, text_pl: `Wyłącz całe zasilanie i czekaj.`, is_correct: false, effect: "Dryfujesz wprost na asteroidę! Tracisz serduszko (-1 Heart)" }
              ]
            },
            2: {
              story: `You bypass the anomaly, but now the fuel levels are critical. To keep moving, you must **${word}** the energy from the life support systems.`,
              story_pl: `Omijasz anomalię, ale teraz poziom paliwa jest krytyczny. Aby kontynuować ruch, musisz przekierować/zarządzać energią z systemów podtrzymywania życia.`,
              choices: [
                { text: `Carefully ${word} the energy to the main engines.`, text_pl: `Ostrożnie przekieruj energię do głównych silników.`, is_correct: true, effect: "Udało się! Silniki znowu pracują stabilnie! (+10 XP)" },
                { text: `Destroy the panel in frustration.`, text_pl: `Zniszcz panel z frustracji.`, is_correct: false, effect: "Uszkodziłeś statek! Tracisz serduszko (-1 Heart)" },
                { text: `Do nothing and go to sleep.`, text_pl: `Nic nie rób i idź spać.`, is_correct: false, effect: "Systemy podtrzymywania życia powoli gasną! Tracisz serduszko (-1 Heart)" }
              ]
            },
            3: {
              story: `An alien vessel appears on the radar, demanding communication. They look hostile. Your commander advises you to **${word}** a message immediately.`,
              story_pl: `Obcy statek pojawia się na radarze, żądając komunikacji. Wyglądają wrogo. Twój dowódca radzi, abyś natychmiast wysłał/sformułował odpowiednią wiadomość.`,
              choices: [
                { text: `Quickly ${word} a diplomatic response in their language.`, text_pl: `Szybko sformułuj/wyślij dyplomatyczną odpowiedź w ich języku.`, is_correct: true, effect: "Obcy przyjmują wiadomość i opuszczają broń! (+10 XP)" },
                { text: `Fire all weapons at their ship.`, text_pl: `Wystrzel całą broń w ich statek.`, is_correct: false, effect: "Ich tarcze odbijają strzał i kontratakują! Tracisz serduszko (-1 Heart)" },
                { text: `Transmit loud rock music.`, text_pl: `Nadaj głośną muzykę rockową.`, is_correct: false, effect: "Obcy uznają to za zniewagę i strzelają! Tracisz serduszko (-1 Heart)" }
              ]
            },
            4: {
              story: `The aliens guide you through a dangerous asteroid belt. However, your shields are failing. You need to **${word}** the defense matrix.`,
              story_pl: `Obcy prowadzą cię przez niebezpieczny pas asteroid. Jednak twoje tarcze słabną. Musisz wzmocnić/obsłużyć matrycę obronną.`,
              choices: [
                { text: `Activate and ${word} the backup shield generator.`, text_pl: `Aktywuj i obsłuż zapasowy generator tarcz.`, is_correct: true, effect: "Tarcze wracają do pełnej sprawności! (+10 XP)" },
                { text: `Try to push asteroid out of the way.`, text_pl: `Spróbuj odepchnąć asteroidę.`, is_correct: false, effect: "To niemożliwe! Tracisz serduszko (-1 Heart)" },
                { text: `Scream at the sensors.`, text_pl: `Krzycz na czujniki.`, is_correct: false, effect: "Asteroida uderza w kadłub! Tracisz serduszko (-1 Heart)" }
              ]
            },
            5: {
              story: `You reach the orbit of the destination planet. The journey was long, but you **${word}** arrived at your new home.`,
              story_pl: `Docierasz na orbitę docelowej planety. Podróż była długa, ale ostatecznie dotarłeś do swojego nowego domu.`,
              choices: [
                { text: `Celebrate as you ${word} touch down on the surface.`, text_pl: `Świętuj, gdy ostatecznie lądujesz na powierzchni.`, is_correct: true, effect: "Wspaniały finał! Zwycięstwo! (+50 XP)" },
                { text: `Crash land on purpose.`, text_pl: `Rozbij się celowo podczas lądowania.`, is_correct: false, effect: "Porażka na samym końcu! Tracisz serduszko (-1 Heart)" },
                { text: `Refuse to land.`, text_pl: `Odmów lądowania.`, is_correct: false, effect: "Kończy się tlen! Tracisz serduszko (-1 Heart)" }
              ]
            }
          },
          "Fantasy Kingdom": {
            1: {
              story: `You stand at the gates of the **Fantasy Kingdom**. A massive guard blocks your path. You must **${word}** a magic scroll to convince him to let you enter.`,
              story_pl: `Stoisz u bram Królestwa Fantasy. Potężny strażnik blokuje ci drogę. Musisz użyć/pokazać magiczny zwój, aby przekonać go do wpuszczenia cię.`,
              choices: [
                { text: `Present and ${word} the glowing magic scroll.`, text_pl: `Zaprezentuj i użyj świecący magiczny zwój.`, is_correct: true, effect: "Strażnik kłania się i otwiera bramę! (+10 XP)" },
                { text: `Try to fight the guard.`, text_pl: `Spróbuj walczyć ze strażnikiem.`, is_correct: false, effect: "Strażnik jest zbyt silny! Tracisz serduszko (-1 Heart)" },
                { text: `Run away crying.`, text_pl: `Uciekaj z płaczem.`, is_correct: false, effect: "Gubisz się w ciemnym lesie! Tracisz serduszko (-1 Heart)" }
              ]
            },
            2: {
              story: `Inside the kingdom, you find a wounded elf. To save her life, you must **${word}** her with your healing potions.`,
              story_pl: `Wewnątrz królestwa znajdujesz ranną elfkę. Aby uratować jej życie, musisz pomóc jej/podać lecznicze eliksiry.`,
              choices: [
                { text: `Quickly ${word} the elf and dress her wounds.`, text_pl: `Szybko pomóż elfce i opatrz jej rany.`, is_correct: true, effect: "Elfka budzi się i dziękuje ci, dając wskazówki! (+10 XP)" },
                { text: `Steal her gold.`, text_pl: `Ukradnij jej złoto.`, is_correct: false, effect: "Zostałeś przeklęty! Tracisz serduszko (-1 Heart)" },
                { text: `Leave her alone.`, text_pl: `Zostaw ją samą.`, is_correct: false, effect: "Duchy lasu są zagniewane! Tracisz serduszko (-1 Heart)" }
              ]
            },
            3: {
              story: `The elf warns you about a dragon in the mountains. She says you must **${word}** a plan to defeat it before climbing up.`,
              story_pl: `Elfka ostrzega cię przed smokiem w górach. Mówi, że musisz przygotować/sformułować plan pokonania go przed wspinaczką.`,
              choices: [
                { text: `Sit down and ${word} a smart tactical strategy.`, text_pl: `Usiądź i sformułuj sprytną strategię taktyczną.`, is_correct: true, effect: "Twój plan jest genialny! Jesteś gotowy na smoka! (+10 XP)" },
                { text: `Charge blindly up the mountain.`, text_pl: `Szarżuj ślepo pod górę.`, is_correct: false, effect: "Smok zaskakuje cię ogniem! Tracisz serduszko (-1 Heart)" },
                { text: `Try to bribe the dragon.`, text_pl: `Spróbuj przekupić smoka.`, is_correct: false, effect: "Smok nie interesuje się miedziakami! Tracisz serduszko (-1 Heart)" }
              ]
            },
            4: {
              story: `You face the dragon! It prepares to breathe fire. You need to **${word}** your shield spell immediately.`,
              story_pl: `Stajesz oko w oko ze smokiem! Przygotowuje się do zionięcia ogniem. Musisz natychmiast aktywować/obsłużyć czar tarczy.`,
              choices: [
                { text: `Cast and ${word} the legendary fire shield spell.`, text_pl: `Rzuć i obsłuż legendarny czar tarczy ognia.`, is_correct: true, effect: "Ogień odbija się od tarczy bez szkody! (+10 XP)" },
                { text: `Throw a rock at its nose.`, text_pl: `Rzuć kamieniem w jego nos.`, is_correct: false, effect: "To tylko go rozzłościło! Tracisz serduszko (-1 Heart)" },
                { text: `Hide behind a dry bush.`, text_pl: `Ukryj się za suchym krzakiem.`, is_correct: false, effect: "Krzak natychmiast spłonął! Tracisz serduszko (-1 Heart)" }
              ]
            },
            5: {
              story: `The dragon is defeated! The king is grateful. You **${word}** achieve peace in the realm and become a hero.`,
              story_pl: `Smok został pokonany! Król jest wdzięczny. Ostatecznie osiągasz pokój w krainie i zostajesz bohaterem.`,
              choices: [
                { text: `Celebrate as you ${word} receive the royal crown.`, text_pl: `Świętuj, gdy ostatecznie otrzymujesz królewską koronę.`, is_correct: true, effect: "Zwycięstwo! Królestwo jest bezpieczne! (+50 XP)" },
                { text: `Insult the king's beard.`, text_pl: `Obraź brodę króla.`, is_correct: false, effect: "Trafiasz do lochu! Tracisz serduszko (-1 Heart)" },
                { text: `Give the gold back to the dragon.`, text_pl: `Oddaj złoto smokowi.`, is_correct: false, effect: "Smok ożywa i cię pożera! Tracisz serduszko (-1 Heart)" }
              ]
            }
          },
          "Primeval Man": {
            1: {
              story: `In the era of the **Primeval Man**, your tribe is cold. You must **${word}** fire using friction.`,
              story_pl: `W czasach człowieka pierwotnego twoje plemię marznie. Musisz wytworzyć/stworzyć ogień za pomocą tarcia.`,
              choices: [
                { text: `Rub dry sticks to ${word} the first sparks.`, text_pl: `Pocieraj suche patyki, aby wytworzyć pierwsze iskry.`, is_correct: true, effect: "Ogień płonie! Plemię cię uwielbia! (+10 XP)" },
                { text: `Scream at the cold sky.`, text_pl: `Krzycz na zimne niebo.`, is_correct: false, effect: "Tylko zmarzłeś! Tracisz serduszko (-1 Heart)" },
                { text: `Eat raw ice.`, text_pl: `Jedz surowy lód.`, is_correct: false, effect: "Rozchorowałeś się! Tracisz serduszko (-1 Heart)" }
              ]
            },
            2: {
              story: `A mammoth approaches the camp. To protect the children, you must **${word}** a trap quickly.`,
              story_pl: `Mamut zbliża się do obozu. Aby chronić dzieci, musisz szybko zbudować/zorganizować pułapkę.`,
              choices: [
                { text: `Dig a deep pit to ${word} a mammoth trap.`, text_pl: `Wykop głęboki dół, aby przygotować pułapkę na mamuta.`, is_correct: true, effect: "Mamut wpadł w pułapkę! Plemię ma jedzenie! (+10 XP)" },
                { text: `Try to hug the mammoth.`, text_pl: `Spróbuj przytulić mamuta.`, is_correct: false, effect: "Zostałeś rozdeptany! Tracisz serduszko (-1 Heart)" },
                { text: `Throw berries at it.`, text_pl: `Rzuć w niego jagodami.`, is_correct: false, effect: "Mamut się rozzłościł! Tracisz serduszko (-1 Heart)" }
              ]
            },
            3: {
              story: `Another tribe approaches peacefully. They want to trade. You must **${word}** your intentions using hand gestures.`,
              story_pl: `Inne plemię zbliża się pokojowo. Chcą handlować. Musisz zakomunikować/przedstawić swoje intencje za pomocą gestów.`,
              choices: [
                { text: `Smile and use signs to ${word} peace.`, text_pl: `Uśmiechnij się i użyj znaków, aby zakomunikować pokój.`, is_correct: true, effect: "Wymiana handlowa zakończona sukcesem! (+10 XP)" },
                { text: `Throw a spear at their leader.`, text_pl: `Rzuć włócznią w ich przywódcę.`, is_correct: false, effect: "Wywołujesz wojnę! Tracisz serduszko (-1 Heart)" },
                { text: `Hide in a cave.`, text_pl: `Ukryj się w jaskini.`, is_correct: false, effect: "Uznali cię za tchórza i zabrali zapasy! Tracisz serduszko (-1 Heart)" }
              ]
            },
            4: {
              story: `A sudden storm floods the valley. You need to **${word}** the high caves to survive the night.`,
              story_pl: `Naglą burza zalewa dolinę. Musisz dotrzeć/zabezpieczyć wysokie jaskinie, aby przeżyć noc.`,
              choices: [
                { text: `Climb the rocks to ${word} safety in the high cave.`, text_pl: `Wskakuj na skały, aby zabezpieczyć/dotrzeć do bezpiecznej jaskini.`, is_correct: true, effect: "Jesteś bezpieczny i suchy! (+10 XP)" },
                { text: `Try to swim in the mud river.`, text_pl: `Spróbuj pływać w błotnej rzece.`, is_correct: false, effect: "Nurt jest zbyt silny! Tracisz serduszko (-1 Heart)" },
                { text: `Sleep under a tree.`, text_pl: `Śpij pod drzewem.`, is_correct: false, effect: "Piorun uderza w pobliżu! Tracisz serduszko (-1 Heart)" }
              ]
            },
            5: {
              story: `The storm passes. You paint your victory on the walls. Your tribe has **${word}** survived the winter.`,
              story_pl: `Burza mija. Malujesz zwycięstwo na ścianach. Twoje plemię ostatecznie przetrwało zimę.`,
              choices: [
                { text: `Rejoice as you ${word} see the warm spring sun.`, text_pl: `Raduj się, gdy ostatecznie widzisz ciepłe wiosenne słońce.`, is_correct: true, effect: "Zwycięstwo pierwotnego człowieka! (+50 XP)" },
                { text: `Eat poisonous red mushrooms.`, text_pl: `Zjedz trujące czerwone grzyby.`, is_correct: false, effect: "Straszny ból brzucha na koniec! Tracisz serduszko (-1 Heart)" },
                { text: `Jump off the cliff to celebrate.`, text_pl: `Skocz z klifu, by świętować.`, is_correct: false, effect: "To był zły skok! Tracisz serduszko (-1 Heart)" }
              ]
            }
          },
          "Dinosaurs Era": {
            1: {
              story: `You find yourself in the **Dinosaurs Era**. A huge Brachiosaurus is eating leaves above you. You must **${word}** your movements to avoid making noise.`,
              story_pl: `Znajdujesz się w Erze Dinozaurów. Wielki Brachiozaur je liście nad tobą. Musisz kontrolować/dostosować swoje ruchy, aby nie hałasować.`,
              choices: [
                { text: `Slowly and carefully ${word} your steps in the grass.`, text_pl: `Powoli i ostrożnie dostosuj swoje kroki w trawie.`, is_correct: true, effect: "Dinozaur cię nie zauważa! (+10 XP)" },
                { text: `Run screaming towards it.`, text_pl: `Biegnij z krzykiem w jego stronę.`, is_correct: false, effect: "Ogromny ogon uderza w ziemię obok ciebie! Tracisz serduszko (-1 Heart)" },
                { text: `Blow a whistle.`, text_pl: `Dmij w gwizdek.`, is_correct: false, effect: "Płosząc stado, zostajesz potrącony! Tracisz serduszko (-1 Heart)" }
              ]
            },
            2: {
              story: `A pack of Velociraptors appears in the jungle. To escape, you must **${word}** them by throwing a heavy stone.`,
              story_pl: `Stado Welociraptorów pojawia się w dżungli. Aby uciec, musisz odwrócić ich uwagę/zdezorientować ich, rzucając ciężki kamień.`,
              choices: [
                { text: `Throw the stone to the left to ${word} the pack.`, text_pl: `Rzuć kamień w lewo, aby odwrócić uwagę/zdezorientować stado.`, is_correct: true, effect: "Raptory biegną za dźwiękiem, a ty uciekasz! (+10 XP)" },
                { text: `Try to challenge them to a race.`, text_pl: `Spróbuj wyzwać je na wyścig.`, is_correct: false, effect: "Są o wiele szybsze! Tracisz serduszko (-1 Heart)" },
                { text: `Pretend to be a tree.`, text_pl: `Udawaj drzewo.`, is_correct: false, effect: "Raptory mają świetny węch! Tracisz serduszko (-1 Heart)" }
              ]
            },
            3: {
              story: `You reach a wide river. A sleeping Spinosaurus is blocking the shallow path. You must **${word}** a raft using bamboo logs.`,
              story_pl: `Docierasz do szerokiej rzeki. Śpiący Spinozaur blokuje płytką ścieżkę. Musisz zbudować/zorganizować tratwę z pędów bambusa.`,
              choices: [
                { text: `Tie the logs to ${word} a sturdy raft.`, text_pl: `Powiąż kłody, aby przygotować/zbudować solidną tratwę.`, is_correct: true, effect: "Płyniesz bezpiecznie w dół rzeki! (+10 XP)" },
                { text: `Try to step over the Spinosaurus' tail.`, text_pl: `Spróbuj przejść nad ogonem Spinozaura.`, is_correct: false, effect: "Obudził się! Tracisz serduszko (-1 Heart)" },
                { text: `Throw water at him.`, text_pl: `Rzuć w niego wodą.`, is_correct: false, effect: "Uwielbia wodę i jest wściekły! Tracisz serduszko (-1 Heart)" }
              ]
            },
            4: {
              story: `A Tyrannosaurus Rex starts chasing you! Its roar is deafening. You must **${word}** inside a hollow tree trunk.`,
              story_pl: `Tyranozaur Rex zaczyna cię gonić! Jego ryk jest ogłuszający. Musisz ukryć się/zabezpieczyć pozycję wewnątrz pustego pnia.`,
              choices: [
                { text: `Dive quickly to ${word} yourself inside the deep hollow trunk.`, text_pl: `Zanurkuj szybko, aby zabezpieczyć się/ukryć w głębi pustego pnia.`, is_correct: true, effect: "T-Rex przechodzi obok nie widząc cię! (+10 XP)" },
                { text: `Try to outrun him in a straight line.`, text_pl: `Spróbuj go wyprzedzić biegnąc prosto.`, is_correct: false, effect: "Dogonił cię! Tracisz serduszko (-1 Heart)" },
                { text: `Throw sand in his eyes.`, text_pl: `Rzuć mu piaskiem w oczy.`, is_correct: false, effect: "Jego ramiona są za krótkie, ale zęby zbyt długie! Tracisz serduszko (-1 Heart)" }
              ]
            },
            5: {
              story: `You find a mysterious portal glowing in a cave. You step through and **${word}** return to the modern world.`,
              story_pl: `Znajdujesz tajemniczy, świecący portal w jaskini. Przechodzisz przez niego i ostatecznie wracasz do współczesnego świata.`,
              choices: [
                { text: `Step in and rejoice as you ${word} reach home.`, text_pl: `Wejdź i raduj się, gdy ostatecznie docierasz do domu.`, is_correct: true, effect: "Zwycięstwo! Przetrwałeś Erę Dinozaurów! (+50 XP)" },
                { text: `Destroy the portal with a club.`, text_pl: `Zniszcz portal maczugą.`, is_correct: false, effect: "Zostajesz uwięziony na zawsze! Tracisz serduszko (-1 Heart)" },
                { text: `Go back to fight T-Rex.`, text_pl: `Wróć, aby walczyć z T-Rexem.`, is_correct: false, effect: "To była zła decyzja! Tracisz serduszko (-1 Heart)" }
              ]
            }
          }
        };

        // Fallback generic mapping for other themes (Detective, Zombie)
        const selectedTheme = OFFLINE_RPG[theme] ? theme : "Space Odyssey";
        const stepData = OFFLINE_RPG[selectedTheme][stage] || OFFLINE_RPG[selectedTheme][1];
        
        return {
          story: stepData.story,
          story_pl: stepData.story_pl,
          choices: stepData.choices
        };
      }
      // Fallback: forward unmatched routes to Flask server
      try {
        const headers = { 'X-User-Id': localStorage.getItem('uid') || '' };
        if (method === "POST") {
          headers['Content-Type'] = 'application/json';
          const res = await window.fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(data)
          });
          return await res.json();
        } else {
          const res = await window.fetch(url, {
            method: 'GET',
            headers: headers
          });
          return await res.json();
        }
      } catch (fetchErr) {
        console.warn(`Unmatched route fallback failed for ${method} ${path}:`, fetchErr);
        return { error: `Not Found/Offline: ${method} ${path}` };
      }
    } catch (err) {
      console.error(`Błąd wirtualnego API: ${method} ${path}:`, err);
      return { error: "Internal Database Error" };
    }
  }
};

const Backup = {
  version: "2026.08.13",

  async export() {
    try {
      if (!DB.db) {
        alert("Baza danych nie jest gotowa!");
        return;
      }
      
      const backupData = {
        app: "Językowy AS",
        version: this.version,
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
        
        const backupVersion = backupData.version || "1.0";
        let versionWarning = "";
        if (backupVersion !== this.version) {
          versionWarning = `⚠️ Uwaga: Plik kopii zapasowej pochodzi z wersji ${backupVersion}, natomiast bieżąca wersja aplikacji to ${this.version}.\n`;
        }
        
        const confirmRestore = confirm(
          `Czy na pewno chcesz wczytać kopię zapasową z dnia ${new Date(backupData.timestamp).toLocaleString()}?\n` +
          `Wersja kopii zapasowej: ${backupVersion}\n` +
          versionWarning +
          `⚠️ Bieżące dane w tej przeglądarce zostaną zastąpione danymi z pliku!`
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
