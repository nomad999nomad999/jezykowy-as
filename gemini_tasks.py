import os
import json
import random
from google import genai
from dotenv import load_dotenv

load_dotenv()
_client = genai.Client(api_key=os.getenv("GEMINI_API_KEY", ""))

_CONTEXTS = [
    "at work", "at school", "at home", "while traveling", "in a restaurant",
    "during a conversation with a friend", "in a news article", "in a story about sports",
    "in a medical context", "during shopping", "in a technology discussion",
    "in a political debate", "at a party", "in a job interview", "while cooking",
    "during a phone call", "in an email", "while watching TV", "at the gym",
    "in a business meeting"
]

def _ask(prompt: str, max_retries: int = 2) -> str:
    """Wysyła prompt do Gemini z obsługą rate limit (429) i przełączaniem modeli."""
    import time
    models = ["gemini-2.5-flash", "gemini-flash-latest", "gemini-flash-lite-latest"]
    for model_name in models:
        for attempt in range(max_retries):
            try:
                resp = _client.models.generate_content(model=model_name, contents=prompt)
                if resp and resp.text:
                    return resp.text.strip()
            except Exception as e:
                err_str = str(e)
                is_rate_limit = "429" in err_str or "quota" in err_str.lower() or "rate" in err_str.lower()
                print(f"Gemini {model_name} attempt {attempt+1} failed: {e}")
                if is_rate_limit:
                    break
                if attempt < max_retries - 1:
                    time.sleep(1.0)
        time.sleep(0.3)
    return ""


def _parse_json(raw: str):
    if not raw:
        return None
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        if len(lines) >= 2:
            cleaned = "\n".join(lines[1:-1]) if lines[-1].startswith("```") else "\n".join(lines[1:])
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start != -1 and end != -1:
        cleaned = cleaned[start:end+1]
    try:
        return json.loads(cleaned)
    except Exception:
        return None


def _smart_fallback_sentence(word: str, translation: str) -> dict:
    w_lower = word.lower().strip()
    clean_tr = translation.split(";")[0].split(",")[0].strip() if translation else word

    # Reflexive pronouns (ourselves, myself, etc.)
    if w_lower in ["ourselves", "myself", "yourself", "yourselves", "himself", "herself", "itself", "themselves"]:
        pronoun_map = {
            "ourselves": ("We decided to complete this project by ourselves.", "Postanowiliśmy dokończyć ten projekt sami."),
            "myself": ("I will handle this situation by myself.", "Poradzę sobie z tą sytuacją sam."),
            "yourself": ("Take care of yourself during the trip.", "Dbaj o siebie podczas podróży."),
            "yourselves": ("Please make yourselves comfortable.", "Rozgośćcie się, proszę."),
            "himself": ("He fixed the car by himself.", "Sam naprawił samochód."),
            "herself": ("She prepared the entire meal by herself.", "Sama przygotowała cały posiłek."),
            "itself": ("The system updates itself automatically.", "System aktualizuje się automatycznie."),
            "themselves": ("They solved the difficult problem by themselves.", "Samodzielnie rozwiązali ten trudny problem.")
        }
        sent, sent_pl = pronoun_map[w_lower]
        return {
            "sentence": sent,
            "sentence_pl": sent_pl,
            "tip": f"{word} = {clean_tr}"
        }

    # Universal fallbacks for any part of speech
    fallbacks = [
        (f"The word '{word}' means '{clean_tr}' in English.", f"Słowo '{word}' oznacza '{clean_tr}' po angielsku."),
        (f"We can use the word '{word}' in everyday conversation.", f"Możemy używać słowa '{word}' w codziennych rozmowach."),
        (f"Do you know how to use '{word}' in a sentence?", f"Czy wiesz, jak użyć słowa '{word}' w zdaniu?"),
        (f"He asked about the meaning of '{word}'.", f"Zapytał o znaczenie słowa '{word}'."),
        (f"She explained what '{word}' means with a good example.", f"Wyjaśniła, co oznacza '{word}' na dobrym przykładzie.")
    ]
    sent, sent_pl = random.choice(fallbacks)
    return {
        "sentence": sent,
        "sentence_pl": sent_pl,
        "tip": f"{word} = {clean_tr}"
    }


def generate_example_sentence(word: str, translation: str) -> dict:
    """Generuje przykładowe zdanie – za każdym razem inny kontekst."""
    ctx = random.choice(_CONTEXTS)
    style = random.choice([
        "Use a natural conversational tone.",
        "Make it an engaging everyday scenario.",
        "Use past tense.",
        "Use present continuous tense.",
        "Make it a question asking for someone's opinion.",
        "Include a specific workplace, family, or travel scenario.",
        "Use a friendly dialogue tone.",
    ])
    prompt = f"""You are an English teacher for a Polish speaker learning English.
Word: "{word}" (Polish translation: "{translation}")
Context: {ctx}. {style}

Generate a JSON response with:
1. "sentence": An engaging, natural example sentence (8-14 words) using the word "{word}" naturally and grammatically. MUST use the word "{word}" exactly (or its natural form). Do NOT use generic template sentences like "I want to practice...".
2. "sentence_pl": Natural Polish translation of the sentence.
3. "tip": A short pronunciation or memory tip in Polish (max 10 words).

Respond ONLY with valid JSON, no markdown, no extra text.
Example: {{"sentence": "She decided to investigate the mysterious noise in the attic.", "sentence_pl": "Postanowiła zbadać tajemniczy hałas na poddaszu.", "tip": "Investigate = zbadać / dociekać"}}"""

    raw = _ask(prompt)
    parsed = _parse_json(raw)
    if parsed and isinstance(parsed, dict) and "sentence" in parsed and "sentence_pl" in parsed:
        return parsed
    return _smart_fallback_sentence(word, translation)


def generate_fill_blank(word: str, translation: str) -> dict:
    """Generuje zdanie z luką — różne konteksty każde wywołanie."""
    ctx = random.choice(_CONTEXTS)
    prompt = f"""You are an English teacher for a Polish speaker.
Word: "{word}" (Polish: "{translation}")
Context: {ctx}

Generate a fill-in-the-blank exercise. JSON response with:
1. "sentence": A sentence with "_____" replacing the word (max 14 words). The blank MUST be where "{word}" goes.
2. "answer": exactly "{word}"
3. "hint": first letter + dashes, e.g. "d____" for "doubt"
4. "sentence_pl": Polish translation of the full sentence (with the word filled in)

Respond ONLY with valid JSON, no markdown.
Example: {{"sentence": "I have no _____ about his honesty.", "answer": "doubt", "hint": "d____", "sentence_pl": "Nie mam żadnych wątpliwości co do jego uczciwości."}}"""

    raw = _ask(prompt)
    parsed = _parse_json(raw)
    if parsed and isinstance(parsed, dict) and "sentence" in parsed:
        return parsed
    
    clean_tr = translation.split(";")[0].split(",")[0].strip() if translation else word
    hint = word[0] + "_" * (len(word) - 1) if word else "?"
    return {
        "sentence": f"Do you know the meaning of the word '_____ '?",
        "answer": word,
        "hint": hint,
        "sentence_pl": f"Czy znasz znaczenie słowa '{clean_tr}'?"
    }


def generate_context_challenge(word: str, translation: str, distractors: list) -> dict:
    """Generuje kontekstowe zadanie: krótki tekst + pytanie ABCD."""
    ctx = random.choice(_CONTEXTS)
    scenario = random.choice([
        "Tell a short story about a person facing a challenge.",
        "Describe a professional situation.",
        "Write about an everyday life moment.",
        "Describe a news event.",
        "Write about a travel experience.",
        "Describe a sports moment.",
        "Write about a friendship.",
        "Describe a learning experience.",
    ])
    distractor_str = ", ".join(f'"{d}"' for d in distractors[:3])
    prompt = f"""You are an English teacher.
Target word: "{word}" (Polish: "{translation}")
Distractor translations: {distractor_str}
Context: {ctx}. {scenario}

Generate a context challenge. JSON response with:
1. "text": A short paragraph (2-3 natural sentences) using "{word}" in bold as **{word}**. 
   RULES: Do NOT write "is very important". Use the word naturally in a real situation.
2. "question": A Polish question asking what the bold word means (vary the phrasing)
3. "correct": "{translation}"
4. "options": Array of exactly 4 Polish translations (correct + 3 wrong from distractors), shuffled randomly

Respond ONLY with valid JSON, no markdown.
Example: {{"text": "She had no **doubt** that she made the right choice. The decision felt natural.", "question": "Co oznacza pogrubione słowo?", "correct": "wątpliwość", "options": ["wątpliwość", "radość", "pewność", "strach"]}}"""

    raw = _ask(prompt)
    parsed = _parse_json(raw)
    if parsed and isinstance(parsed, dict) and "text" in parsed:
        if "options" not in parsed or len(parsed["options"]) < 2:
            opts = [translation] + (distractors[:3] if distractors else ["radość", "strach", "pewność"])
            random.shuffle(opts)
            parsed["options"] = opts[:4]
        if translation not in parsed["options"]:
            parsed["options"][0] = translation
            random.shuffle(parsed["options"])
        return parsed

    clean_tr = translation.split(";")[0].split(",")[0].strip() if translation else word
    opts = [clean_tr] + (distractors[:3] if distractors else ["radość", "strach", "pewność"])
    random.shuffle(opts)
    return {
        "text": f"Alex asked about the word **{word}** in class. The teacher explained its meaning clearly.",
        "question": "Co oznacza pogrubione słowo?",
        "correct": clean_tr,
        "options": opts[:4]
    }


def generate_sentence_builder(word: str, translation: str) -> dict:
    """Generuje zdanie do ćwiczenia Budowanie Zdań — zwraca zdanie + rozsypane słowa."""
    try:
        ctx = random.choice(_CONTEXTS)
        style = random.choice([
            "Use past tense.", "Use present tense.", "Make it a question.",
            "Use future tense.", "Make it about a specific person.",
            "Use a surprising scenario.", "Keep it simple and clear.",
        ])
        prompt = f"""You are an English teacher for a Polish speaker learning English.
Word: "{word}" (Polish: "{translation}")
Context: {ctx}. {style}

Generate a JSON with:
1. "sentence": A natural English sentence using "{word}" (6-10 words). MUST contain "{word}" naturally. No special punctuation except period at end.
2. "translation_pl": Polish translation of that sentence.

Rules:
- The sentence must use the word "{word}"
- Keep it short (6-10 words)
- Natural, everyday English

Respond ONLY with valid JSON, no markdown.
Example: {{"sentence": "She had no doubt about her decision.", "translation_pl": "Nie miała wątpliwości co do swojej decyzji."}}"""

        raw = _ask(prompt)
        parsed = _parse_json(raw)
        if parsed and isinstance(parsed, dict) and "sentence" in parsed and parsed["sentence"].strip():
            sentence = parsed["sentence"].strip()
            translation_pl = parsed.get("translation_pl", "")
            words = sentence.split()
            scrambled = words[:]
            random.shuffle(scrambled)
            attempts = 0
            while scrambled == words and len(words) > 1 and attempts < 5:
                random.shuffle(scrambled)
                attempts += 1
            return {"sentence": sentence, "words_scrambled": scrambled, "translation_pl": translation_pl}
    except Exception as ex:
        print(f"generate_sentence_builder error: {ex}")

    fallback_obj = _smart_fallback_sentence(word, translation)
    sentence = fallback_obj["sentence"]
    words = sentence.split()
    scrambled = words[:]
    random.shuffle(scrambled)
    return {
        "sentence": sentence,
        "words_scrambled": scrambled,
        "translation_pl": fallback_obj.get("sentence_pl", "")
    }



_DAILY_FACT_CATEGORIES = {
    "primitive_human": ("Primitive Humans & Archaeology", "Człowiek pierwotny i Archeologia"),
    "polish_business": ("Polish Business & Economy", "Polski biznes i Gospodarka"),
    "biology": ("Biology", "Biologia"),
    "evolutionary_biology": ("Evolutionary Biology", "Biologia ewolucyjna"),
    "nature": ("Nature & Wildlife", "Przyroda i Świat zwierząt"),
    "physics": ("Physics & Quantum Realm", "Fizyka i Kosmos"),
    "technology": ("Technology & Innovation", "Technika i AI"),
    "history": ("World History & Civilizations", "Historia świata"),
    "psychology": ("Psychology & Mind", "Psychologia i Mózg"),
    "culture": ("Culture & Pop Culture", "Popkultura i Sztuka"),
}


def generate_daily_fact(category_en: str, category_pl: str, user_words: list, seen_topics: str = "") -> dict:
    """Generuje ciekawostkę naukową/biznesową z konkretnymi danymi, nazwami firm/osiągnięć i wyróżnionymi słowami."""
    words_str = ", ".join(f'"{w["word"]}" ({w.get("translation","?")})' for w in user_words[:15])
    
    seen_instruction = ""
    if seen_topics and seen_topics.strip():
        seen_instruction = f"\nDO NOT repeat or generate facts about these previously covered topics: {seen_topics}. Choose a completely DIFFERENT, novel topic within '{category_en}'!"

    prompt = f"""You are an expert science communicator and English teacher.

STRICT TOPIC & CONCRETENESS REQUIREMENT:
1. TOPIC: The educational fact MUST be 100% strictly about the category: "{category_en}" ({category_pl}).
2. MAXIMUM CONCRETENESS & REAL-WORLD SPECIFICITY:
   - ABSOLUTELY NO vague corporate fluff or generic statements (e.g. NEVER write generic lines like "Poland's economic growth has been remarkable", "allowed companies to reach new markets", "strong performance", "important for the future").
   - MUST include REAL, SPECIFIC PROPER NOUNS (company names, brand names, famous pioneers, scientists, inventions, products, services, or places).
   - MUST include SPECIFIC CONCRETE DATA (exact numbers, percentages, dollar/euro/złoty values, years/dates, counts, or technical specs).
   - For "Polish Business & Economy": Focus on real Polish giants, unicorns, and exports with real numbers! Examples: InPost (24,000+ Paczkomaty parcel lockers in UK/France), CD Projekt Red ($3.5B+ Witcher & Cyberpunk 2077 sales), Allegro (e-commerce marketplace), Orlen (refineries & energy), Solaris Bus (23,000+ electric buses in 20+ EU cities), Wilk Elektronik / GoodRAM (memory modules made in Łaziska Górne), DocPlanner / ZnanyLekarz (doctor booking platform), ElevenLabs (AI voice tech), Techland (Dying Light games), Żabka (autonomous stores), Maspex.
   - For other categories: Name specific species, discovery years, chemical formulas, space telescopes, physical laws, or historical dates!

User's vocabulary list to practice: {words_str}
Instructions: Pick 2-4 target words from the list above that naturally fit into this specific fact about "{category_en}". If a word does not fit, skip it and pick words that DO fit. Mark every used target word with **double asterisks** like **word**.
{seen_instruction}

Return ONLY valid JSON (no markdown wrapper, no extra text):
{{
  "title": "Specific topic title strictly within {category_en} (4-6 English words)",
  "fact": "3-4 informative, highly specific, data-rich sentences (80-120 words) strictly about {category_en}. Must contain real names, numbers/data, and specific goods/services. Use 2-4 target words naturally, marked with **word**.",
  "fact_pl": "Kompletne, dokładne i naturalne tłumaczenie całego powyższego akapitu na język polski (z zachowaniem nazewnictwa i konkretnych danych).",
  "used_words": [
    {{"word": "used_word", "translation": "polskie tłumaczenie", "context": "short phrase using it"}}
  ],
  "questions": [
    {{"statement": "T/F statement 1 in English based on the fact.", "statement_pl": "Tłumaczenie oświadczenia 1 na język polski.", "answer": true, "explanation": "Krótkie wyjaśnienie po polsku."}},
    {{"statement": "T/F statement 2 in English based on the fact.", "statement_pl": "Tłumaczenie oświadczenia 2 na język polski.", "answer": false, "explanation": "Krótkie wyjaśnienie po polsku."}},
    {{"statement": "T/F statement 3 in English based on the fact.", "statement_pl": "Tłumaczenie oświadczenia 3 na język polski.", "answer": true, "explanation": "Krótkie wyjaśnienie po polsku."}}
  ]
}}

Rules:
- "fact_pl" MUST be included directly in the JSON output.
- Every question item in "questions" MUST contain both "statement" (EN) and "statement_pl" (PL).
- Exactly 3 questions with a mix of True and False answers.
- Explanations in Polish."""

    raw = _ask(prompt)
    parsed = _parse_json(raw)
    if parsed and isinstance(parsed, dict) and "fact" in parsed and len(parsed.get("questions", [])) >= 3:
        if not parsed.get("fact_pl"):
            parsed["fact_pl"] = parsed["fact"].replace("**", "")
        for q in parsed.get("questions", []):
            if not q.get("statement_pl"):
                q["statement_pl"] = q.get("statement", "")
        return parsed

    # Dynamic fallback based on category if AI is temporarily unavailable or response was malformed
    w1 = user_words[0] if len(user_words) > 0 else {"word": "discover", "translation": "odkryć"}
    w2 = user_words[1] if len(user_words) > 1 else {"word": "develop", "translation": "rozwijać"}

    fallback_topics = {
        "Primitive Humans & Archaeology": {
            "title": f"Göbekli Tepe: Prehistoric Stone Architecture",
            "fact": f"Over 11,500 years ago, hunter-gatherers at Göbekli Tepe constructed massive 16-ton carved stone pillars before the invention of agriculture. Archaeologists **{w1['word']}** evidence showing prehistoric communities possessed complex social structures. These early humans shared toolmaking techniques to **{w2['word']}** survival strategies during the Ice Age.",
            "fact_pl": f"Ponad 11 500 lat temu zbieracze-łowcy w Göbekli Tepe wznieśli ogromne 16-tonowe rzeźbione kamienne filary jeszcze przed wynalezieniem rolnictwa. Archeolodzy odkryli dowody pokazujące, że prehistoryczne społeczności posiadały złożone struktury społeczne. Ci pierwsi ludzie dzielili się technikami narzędziowymi, aby rozwijać strategie przetrwania w epoce lodowcowej.",
            "used_words": [
                {"word": w1["word"], "translation": w1.get("translation", "?"), "context": f"archaeologists {w1['word']}"},
                {"word": w2["word"], "translation": w2.get("translation", "?"), "context": f"strategies to {w2['word']}"}
            ],
            "questions": [
                {"statement": "Göbekli Tepe stone pillars were built over 11,500 years ago.", "statement_pl": "Kamienne filary w Göbekli Tepe wybudowano ponad 11 500 lat temu.", "answer": True, "explanation": "Tekst podaje dokładnie tę datę."},
                {"statement": "Göbekli Tepe was built by 21st-century modern factory workers.", "statement_pl": "Göbekli Tepe wybudowali XXI-wieczni robotnicy fabryczni.", "answer": False, "explanation": "Strukturę stworzyli prehistoryczni zbieracze-łowcy."},
                {"statement": "Stone pillars at the site weigh up to 16 tons.", "statement_pl": "Kamienne filary na stanowisku ważą do 16 ton.", "answer": True, "explanation": "Tekst wspomina o 16-tonowych filarach."}
            ]
        },
        "Polish Business & Economy": {
            "title": "InPost & CD Projekt: Polish Global Success",
            "fact": f"Polish logistics leader InPost operates over 24,000 automated parcel lockers across Europe, revolutionizing e-commerce delivery. Meanwhile, CD Projekt Red **{w1['word']}** international acclaim by exporting *The Witcher 3*, generating over $500 million in global sales. Polish innovators continue to **{w2['word']}** high-tech services and export goods worldwide.",
            "fact_pl": f"Polski lider logistyczny InPost obsługuje ponad 24 000 paczkomatów w całej Europie, rewolucjonizując dostawy e-commerce. Tymczasem studio CD Projekt Red zdobyło międzynarodowy poklask, eksportując Wiedźmina 3 i generując ponad 500 milionów dolarów przychodu. Polscy innowatorzy stale rozwijają zaawansowane usługi i eksportują towary na cały świat.",
            "used_words": [
                {"word": w1["word"], "translation": w1.get("translation", "?"), "context": f"CD Projekt {w1['word']}"},
                {"word": w2["word"], "translation": w2.get("translation", "?"), "context": f"continue to {w2['word']}"}
            ],
            "questions": [
                {"statement": "InPost operates over 24,000 parcel lockers across Europe.", "statement_pl": "InPost obsługuje ponad 24 000 paczkomatów w Europie.", "answer": True, "explanation": "Tekst potwierdza sieć ponad 24 000 paczkomatów."},
                {"statement": "CD Projekt Red manufactures traditional wooden furniture.", "statement_pl": "CD Projekt Red produkuje tradycyjne meble drewniane.", "answer": False, "explanation": "CD Projekt Red to producent i eksporter gier wideo."},
                {"statement": "The Witcher 3 generated over $500 million in revenue.", "statement_pl": "Wiedźmin 3 wygenerował ponad 500 milionów dolarów przychodu.", answer: True, "explanation": "Tekst podaje przychód ze sprzedaży gry."}
            ]
        }
    }

    default_fb = fallback_topics.get(category_en, {
        "title": f"{category_en}: Scientific Insights",
        "fact": f"Researchers in {category_en.lower()} strive to **{w1['word']}** fundamental principles governing natural systems. New findings allow scientists to **{w2['word']}** better models for future discovery. Understanding these mechanisms helps advance modern science.",
        "fact_pl": f"Badacze w dziedzinie {category_pl.lower()} dążą do zrozumienia podstawowych zasad rządzących systemami naturalnymi. Nowe odkrycia pozwalają naukowcom rozwijać lepsze modele dla przyszłych odkryć.",
        "used_words": [
            {"word": w1["word"], "translation": w1.get("translation", "?"), "context": f"strive to {w1['word']}"},
            {"word": w2["word"], "translation": w2.get("translation", "?"), "context": f"allow to {w2['word']}"}
        ],
        "questions": [
            {"statement": f"Scientific research advances our understanding of {category_en.lower()}.", "statement_pl": f"Badania naukowe rozwijają naszą wiedzę w dziedzinie {category_pl.lower()}.", "answer": True, "explanation": "Tekst wyjaśnia powiązanie między badaniami a wiedzą."},
            {"statement": "Scientists have stopped making new discoveries in this field.", "statement_pl": "Naukowcy przestali dokonywać nowych odkryć w tej dziedzinie.", "answer": False, "explanation": "Tekst mówi o nowych odkryciach i ulepszaniu modeli."},
            {"statement": "New models help researchers understand complex mechanisms.", "statement_pl": "Nowe modele pomagają badaczom zrozumieć złożone mechanizmy.", "answer": True, "explanation": "Lepsze modele służą do przyszłych odkryć."}
        ]
    })

    return default_fb


def generate_rpg_step(theme: str, stage: int, previous_story: str, target_word: str, target_translation: str) -> dict:
    """
    Generates a single stage of an RPG adventure using the Gemini API.
    Incorporates the target_word in the narrative and provides 3 choices.
    """
    stages_desc = {
        1: "Intro / Beginning of the journey. Establish the scene and introducing the challenge.",
        2: "Journey / Obstacle. Encountering a minor problem or barrier.",
        3: "Climax / Deep danger. A tense encounter or high risk.",
        4: "Escape / Finding a way out / Resolution of the danger.",
        5: "Final resolution / Epilogue. Celebrating victory or achieving the goal."
    }
    stage_text = stages_desc.get(stage, "Continuing the journey.")
    
    prompt = f"""You are generating an interactive RPG text adventure for a Polish student learning English.
Theme/Setting: {theme}
Current Stage: {stage} of 5 ({stage_text})
Target Vocabulary Word to practice: "{target_word}" (Polish translation: "{target_translation}")

Story so far:
{previous_story or "This is the start of the adventure."}

CRITICAL RULES:
1. Write a short story continuation (2-3 sentences, 50-80 words) in English. It MUST naturally use the word "{target_word}" exactly, marked with **double asterisks** like **{target_word}**.
2. Provide exactly 3 choices for how the player proceeds next.
3. Only ONE choice can be correct (leads to success, uses/understands "{target_word}" properly). Set "is_correct": true for this one.
4. The other two choices must be incorrect (leads to minor failure or danger, misunderstands "{target_word}", or is contextually unsafe). Set "is_correct": false for these.
5. Provide the Polish translation of the story ("story_pl") and translations/effects for all choices.
6. Return ONLY a valid JSON object. Do NOT wrap in markdown code blocks.

Expected JSON Structure:
{{
  "story": "The narrative text in English...",
  "story_pl": "Tłumaczenie fabuły na język polski...",
  "choices": [
    {{
      "text": "Action option 1 in English...",
      "text_pl": "Tłumaczenie opcji 1 na polski...",
      "is_correct": true,
      "effect": "Opis sukcesu po polsku (np. Uciekasz bezpiecznie! +10 XP)"
    }},
    {{
      "text": "Action option 2 in English...",
      "text_pl": "Tłumaczenie opcji 2 na polski...",
      "is_correct": false,
      "effect": "Opis porażki po polsku (np. Potwór cię dogania! Tracisz serduszko -1 Heart)"
    }},
    {{
      "text": "Action option 3 in English...",
      "text_pl": "Tłumaczenie opcji 3 na polski...",
      "is_correct": false,
      "effect": "Opis porażki po polsku (np. Zła decyzja! Tracisz serduszko -1 Heart)"
    }}
  ]
}}"""

    raw = _ask(prompt)
    try:
        s = raw.find("{"); e = raw.rfind("}")
        if s != -1 and e != -1:
            raw = raw[s:e+1]
        data = json.loads(raw)
        if not data.get("story") or len(data.get("choices", [])) < 3:
            raise ValueError("Bad structure")
        return data
    except Exception as ex:
        print(f"generate_rpg_step fallback: {ex}")
        return {
            "story": f"You carefully proceed with your adventure in the {theme}. To move forward, you must **{target_word}** the team.",
            "story_pl": f"Ostrożnie kontynuujesz swoją przygodę w tematyce {theme}. Aby ruszyć dalej, musisz {target_translation} zespołowi.",
            "choices": [
                {
                    "text": f"Decide to {target_word} the team and lead them safely.",
                    "text_pl": f"Zdecyduj się {target_translation} zespołowi i poprowadź go bezpiecznie.",
                    "is_correct": True,
                    "effect": "Udało się! Ruszacie dalej bezpieczni! (+10 XP)"
                },
                {
                    "text": "Ignore the team and run forward alone.",
                    "text_pl": "Zignoruj zespół i pobiegnij sam przodem.",
                    "is_correct": False,
                    "effect": "Wpadłeś w pułapkę! Tracisz serduszko (-1 Heart)"
                },
                {
                    "text": "Wait here doing nothing.",
                    "text_pl": "Czekaj tutaj nic nie robiąc.",
                    "is_correct": False,
                    "effect": "Czas ucieka, a niebezpieczeństwo nadchodzi! Tracisz serduszko (-1 Heart)"
                }
            ]
        }


def generate_dialogue_init(topic: str, user_words: list) -> dict:
    """Generuje scenariusz dialogu z określonym tematem i słowami kluczowymi."""
    words_str = ", ".join(f'"{w["word"]}" ({w.get("translation","?")})' for w in user_words[:10])
    
    topic_prompt = f"Topic requested: {topic}"
    if topic in ["random", "Random", "Losowa sytuacja", "Losowa Sytuacja", "random_surprise"]:
        topic_prompt = "Topic: Pick a completely surprising, creative, fun real-world roleplay scenario (e.g. returning a defective gadget at an electronics store in London, renting a sports car, ordering street food in NYC, negotiating with a landlord, asking for directions at a train station)."

    prompt = f"""You are an English teacher. Create a real-life English dialogue simulation scenario.
{topic_prompt}
User vocabulary to practice: {words_str}

Return ONLY valid JSON (no markdown):
{{
  "topic_pl": "Nazwa tematu po polsku (np. W kawiarni)",
  "description": "Krótki opis sytuacji po polsku (2 zdania)",
  "goal": "Cel rozmowy dla użytkownika po polsku (np. Zamów kawę i zapytaj o Wi-Fi)",
  "target_words": [
    {{"word": "target_word", "translation": "polskie tłumaczenie"}}
  ],
  "expected_phrases": [
    "Expected word or phrase 1",
    "Expected word or phrase 2"
  ],
  "bot_first_msg": "Initial roleplay greeting/question from the bot in English to open the scene..."
}}
"""
    raw = _ask(prompt)
    try:
        s = raw.find("{"); e = raw.rfind("}")
        if s != -1 and e != -1:
            raw = raw[s:e+1]
        return json.loads(raw)
    except Exception as ex:
        print(f"generate_dialogue_init fallback: {ex}")
        w = user_words[0]["word"] if user_words else "order"
        wt = user_words[0].get("translation", "zamawiać") if user_words else "zamawiać"
        return {
            "topic_pl": f"Temat: {topic}",
            "description": "Rozmowa w języku angielskim w codziennej sytuacji.",
            "goal": f"Porozmawiaj z botem i użyj słowa '{w}'.",
            "target_words": [{"word": w, "translation": wt}],
            "expected_phrases": [w],
            "bot_first_msg": "Hello! How can I help you today?"
        }


def evaluate_dialogue_turn(chat_history: list, user_input: str, expected_phrases: list, goal: str) -> dict:
    """Ocenia wypowiedź użytkownika pod kątem poprawności, daje feedback i kolejną odpowiedź bota."""
    history_str = ""
    for msg in chat_history:
        history_str += f"{msg['role'].upper()}: {msg['text']}\n"
    
    prompt = f"""You are a strict, highly realistic English evaluator in an interactive dialogue simulation.
Scenario Goal: {goal}
Target words/phrases student should try to use: {", ".join(expected_phrases)}

Dialogue history so far:
{history_str}
Student's latest response: "{user_input}"

CRITICAL EVALUATION AND CONVERSATION RULES:
1. "correctness_score": Integer 0-100. BE STRICT AND REALISTIC! If the answer has grammatical errors, bad sentence structure, or is just a lazy 1-2 word reply, rate correctness between 35 and 65. Do NOT give 85-100 unless the answer is genuinely correct and well-formed.
2. "vocabulary_score": Integer 0-100. Set to 100 if student correctly used any target word/phrase. Set to 0 if no target words were used.
3. "score": Overall turn score (average of correctness and vocabulary if vocabulary > 0, else equal to correctness).
4. "bot_reply": CRITICAL! Do NOT repeat generic filler phrases like "I see, tell me more about it" or "That's good". You MUST actively continue the roleplay scenario in character, ask a specific next question, or push the dialogue towards completing the goal!

Analyze the response and return ONLY valid JSON (no markdown):
{{
  "correctness_score": 65,
  "vocabulary_score": 0,
  "score": 65,
  "feedback_pl": "Ocena po polsku (np. Uważaj na gramatykę: użyj 'I would like' zamiast 'I want'.)",
  "better_version": "A more natural, correct way a native speaker would say this...",
  "bot_reply": "Specific in-character response advancing the scene...",
  "is_goal_achieved": false
}}
"""
    raw = _ask(prompt)
    try:
        s = raw.find("{"); e = raw.rfind("}")
        if s != -1 and e != -1:
            raw = raw[s:e+1]
        data = json.loads(raw)
        
        c_score = data.get("correctness_score")
        v_score = data.get("vocabulary_score")
        
        if c_score is None:
            c_score = data.get("score", 70)
        if v_score is None:
            has_words = any(w.lower() in user_input.lower() for w in expected_phrases)
            v_score = 100 if has_words else 0
            
        data["correctness_score"] = c_score
        data["vocabulary_score"] = v_score
        
        if v_score == 0:
            data["score"] = c_score
        else:
            data["score"] = (c_score + v_score) // 2
            
        return data
    except Exception as ex:
        print(f"evaluate_dialogue_turn fallback: {ex}")
        has_words = any(w.lower() in user_input.lower() for w in expected_phrases)
        v_score = 100 if has_words else 0
        return {
            "correctness_score": 65,
            "vocabulary_score": v_score,
            "score": 65 if v_score == 0 else (65 + v_score) // 2,
            "feedback_pl": "Dobra próba. Pamiętaj o pełnych zdaniach!",
            "better_version": user_input,
            "bot_reply": "That sounds interesting! What specifically do you have in mind regarding our goal?",
            "is_goal_achieved": len(chat_history) >= 6
        }


def evaluate_pronunciation(target_sentence: str, spoken_text: str, target_word: str = "") -> dict:
    """Ocenia wymowę i płynność wypowiedzi na podstawie transkrypcji speech-to-text."""
    if not spoken_text.strip():
        return {
            "score": 0,
            "feedback_pl": "Nie wykryto głosu. Upewnij się, że mikrofon jest włączony i spróbuj ponownie!",
            "status_words": []
        }
    
    prompt = f"""You are a master English speech and pronunciation coach for a Polish student.
Target English sentence to read: "{target_sentence}"
What the student actually spoke (speech-to-text transcript): "{spoken_text}"
Target word practiced: "{target_word}"

Analyze the student's pronunciation and fluency:
1. Compare target sentence with spoken transcript. Calculate an accuracy score (0-100).
2. Compare word by word. For each word in target sentence, label as "correct", "mispronounced", or "omitted".
3. Provide constructive, encouraging feedback in POLISH (2-3 sentences). Give actionable phonetic advice for Polish learners (e.g. /θ/ sound, long vowels, silent letters) if any word was mispronounced.

Return ONLY valid JSON (no markdown):
{{
  "score": 85,
  "feedback_pl": "Wskazówki po polsku...",
  "status_words": [
    {{"word": "word1", "status": "correct"}},
    {{"word": "word2", "status": "mispronounced"}}
  ]
}}
"""
    raw = _ask(prompt)
    try:
        s = raw.find("{"); e = raw.rfind("}")
        if s != -1 and e != -1:
            raw = raw[s:e+1]
        res = json.loads(raw)
        if "score" in res and "feedback_pl" in res:
            return res
    except Exception as ex:
        print(f"evaluate_pronunciation fallback: {ex}")
    
    # Fallback comparison if AI fails or formatting error
    target_words = target_sentence.lower().replace(".", "").replace(",", "").split()
    spoken_words = spoken_text.lower().replace(".", "").replace(",", "").split()
    matches = sum(1 for w in target_words if w in spoken_words)
    score = int((matches / max(1, len(target_words))) * 100)
    
    status_words = []
    for w in target_sentence.split():
        clean = w.lower().replace(".", "").replace(",", "")
        st = "correct" if clean in spoken_words else "mispronounced"
        status_words.append({"word": w, "status": st})
        
    return {
        "score": score,
        "feedback_pl": f"Wykryto: '{spoken_text}'. Dopasowanie wyniosło {score}%. " + ("Świetna robota!" if score >= 80 else "Ćwicz dalej wymowę!"),
        "status_words": status_words
    }


def generate_sentence_translation_task(word: str, translation: str, difficulty: str = "medium", count: int = 1) -> dict:
    """Generuje zadanie tłumaczenia zdań (z polskiego na angielski) na określonym poziomie trudności."""
    diff_desc = {
        "easy": "Easy level (A1-A2). Short, simple sentences (4-7 words). Basic grammar.",
        "medium": "Medium level (B1-B2). Everyday conversational sentences (8-12 words). Standard tenses.",
        "hard": "Hard level (C1-C2). Advanced complex sentences (12-18 words). Advanced grammar, idioms, or conditional clauses."
    }.get(difficulty, "Medium level (B1-B2)")

    prompt = f"""You are creating an English-learning translation exercise for a Polish speaker.
Target English Word: "{word}" (Polish meaning: "{translation}")
Difficulty: {difficulty} ({diff_desc})
Number of sentences to generate: {count}

CRITICAL RULES:
1. Generate natural, engaging Polish sentence(s) ("sentence_pl") that test how to translate into English using the target word "{word}" (or its natural English variation).
2. DO NOT use generic or repetitive templates like "I want to practice...", "Do you know the meaning...", "I am learning...". Create a realistic, practical real-life sentence (8-14 words).
3. Provide the ideal English model translation ("expected_en").
4. Provide 2-3 acceptable alternative English translations ("alternatives_en").

Return ONLY valid JSON (no markdown):
{{
  "word": "{word}",
  "translation": "{translation}",
  "difficulty": "{difficulty}",
  "sentences": [
    {{
      "sentence_pl": "Polskie zdanie do przetłumaczenia...",
      "expected_en": "Ideal English translation...",
      "alternatives_en": ["Alt translation 1...", "Alt translation 2..."]
    }}
  ]
}}
"""
    raw = _ask(prompt)
    res = _parse_json(raw)
    if res and isinstance(res, dict) and "sentences" in res and len(res["sentences"]) > 0:
        return res

    # Dynamic fallback if Gemini is offline or failed
    fb1 = _smart_fallback_sentence(word, translation)
    fallback_sentences = [
        {
            "sentence_pl": fb1["sentence_pl"],
            "expected_en": fb1["sentence"],
            "alternatives_en": [f"I am learning how to use the word '{word}'."]
        }
    ]
    if count >= 2:
        clean_tr = translation.split(";")[0].split(",")[0].strip() if translation else word
        fallback_sentences.append({
            "sentence_pl": f"Czy znasz dokładne znaczenie słowa '{clean_tr}'?",
            "expected_en": f"Do you know the exact meaning of the word '{word}'?",
            "alternatives_en": [f"Do you know what the word '{word}' means?"]
        })
    return {
        "word": word,
        "translation": translation,
        "difficulty": difficulty,
        "sentences": fallback_sentences[:count]
    }


def evaluate_sentence_translation(sentence_pl: str, expected_en: str, user_translation: str, target_word: str = "") -> dict:
    """Ocenia tłumaczenie użytkownika (głosowe lub pisemne) z polskiego na angielski z rygorystycznym sprawdzaniem kompletności zdania."""
    prompt = f"""You are a strict yet constructive English language evaluator analyzing a Polish student's English translation.

Original Polish sentence to translate: "{sentence_pl}"
Model English translation: "{expected_en}"
Student's attempt (typed or spoken): "{user_translation}"
Target word being practiced: "{target_word}"

STRICT GRADING RULES:
1. COMPLETENESS CHECK (CRITICAL): Does the student's attempt translate the ENTIRE Polish sentence?
   - If the student only translates a fragment or phrase (e.g., missing subject, verb, or major clause like "Zakup nowego samochodu to..."), max score is 50%, and "is_correct" MUST be false!
2. ACCURACY & GRAMMAR (0-100 score):
   - 90-100: Complete sentence, correct meaning, proper grammar, target word used well.
   - 75-89: Complete sentence, correct meaning, minor typo or minor word order issue.
   - 50-74: Incomplete sentence (phrase fragment) OR significant grammatical errors.
   - 0-49: Wrong meaning, incorrect target word, or major parts missing.
3. SET "is_correct": true ONLY IF score >= 75 AND the student translated a full sentence (not a fragment).
4. PROVIDE FEEDBACK IN POLISH ("feedback_pl"):
   - If incomplete, explicitly tell the student that they only translated a fragment (e.g., "Przetłumaczyłeś tylko fragment zdania...").
5. GRAMMAR TIP IN POLISH ("grammar_tip"): 1 short sentence.

Return ONLY valid JSON (no markdown):
{{
  "score": 45,
  "is_correct": false,
  "feedback_pl": "Przetłumaczyłeś tylko końcowy fragment zdania ('spory wydatek dla nas'). Zabrakło początkowej części zdania odnoszącej się do zakupu samochodu ('Buying a new car is...').",
  "expected_en": "{expected_en}",
  "user_translation": "{user_translation}",
  "grammar_tip": "Pamiętaj, aby zawsze tłumaczyć całe zdanie wraz z podmiotem i orzeczeniem."
}}
"""
    raw = _ask(prompt)
    try:
        s = raw.find("{"); e = raw.rfind("}")
        if s != -1 and e != -1:
            raw = raw[s:e+1]
        res = json.loads(raw)
        if "score" in res and "feedback_pl" in res:
            # Post-check completeness safety net
            u_w = user_translation.lower().strip().split()
            e_w = expected_en.lower().strip().split()
            if len(e_w) >= 5 and len(u_w) < len(e_w) * 0.55:
                res["score"] = min(res["score"], 50)
                res["is_correct"] = False
                if "fragment" not in res["feedback_pl"].lower():
                    res["feedback_pl"] = f"Przetłumaczyłeś tylko część zdania ({len(u_w)} z {len(e_w)} słów). " + res["feedback_pl"]
            return res
    except Exception as ex:
        print(f"evaluate_sentence_translation fallback: {ex}")

    # Basic fallback scoring with strict length check
    u_clean = user_translation.lower().strip().replace(".", "").replace(",", "")
    e_clean = expected_en.lower().strip().replace(".", "").replace(",", "")
    u_words = u_clean.split()
    e_words = e_clean.split()
    matches = sum(1 for w in u_words if w in e_words)
    score = int((matches / max(1, len(e_words))) * 100)
    
    # Strictly cap score if fragment
    if len(e_words) >= 4 and len(u_words) < len(e_words) * 0.6:
        score = min(score, 45)

    is_ok = score >= 75
    return {
        "score": score,
        "is_correct": is_ok,
        "feedback_pl": f"Twój wynik: {score}%. " + ("Świetne pełne tłumaczenie!" if is_ok else "Przetłumaczono tylko część zdania. Zwróć uwagę na wzorcową odpowiedź."),
        "expected_en": expected_en,
        "user_translation": user_translation,
        "grammar_tip": "Zawsze staraj się przetłumaczyć całe zdanie po angielsku."
    }


def generate_debate_init(topic: str, user_stance: str = "FOR") -> dict:
    """Generates an initial debate topic stance, opening argument, and target vocabulary."""
    prompt = f"""You are a charismatic, sharp English debate opponent in a debate training app.
Debate Topic: "{topic}"
User Stance: "{user_stance}" (User argues FOR or AGAINST)
Your Stance: Take the OPPOSITE stance of the user eloquently!

Generate a structured opening response in JSON:
1. "topic": the debate topic
2. "ai_stance": short description of AI's position in English
3. "ai_opening_en": sharp, polite 2-3 sentence opening argument in English
4. "ai_opening_pl": Polish translation of your opening argument
5. "key_vocab": array of 3 useful English words/phrases for this debate with Polish translations [{{"word": "...", "translation": "..."}}]

Return ONLY valid JSON:
{{
  "topic": "{topic}",
  "ai_stance": "Pro-office / Anti-remote work",
  "ai_opening_en": "While working from home seems comfortable, it leads to social isolation and kills spontaneous team collaboration.",
  "ai_opening_pl": "Choć praca z domu wydaje się wygodna, prowadzi do izolacji społecznej i zabija spontaniczną współpracę zespołową.",
  "key_vocab": [
    {{"word": "isolation", "translation": "izolacja"}},
    {{"word": "collaboration", "translation": "współpraca"}},
    {{"word": "spontaneous", "translation": "spontaniczny"}}
  ]
}}
"""
    raw = _ask(prompt)
    try:
        s = raw.find("{"); e = raw.rfind("}")
        if s != -1 and e != -1:
            raw = raw[s:e+1]
        res = json.loads(raw)
        if "ai_opening_en" in res:
            return res
    except Exception as ex:
        print(f"generate_debate_init error: {ex}")

    return {
        "topic": topic,
        "ai_stance": "Opposite Stance",
        "ai_opening_en": f"Regarding '{topic}', there are strong counterarguments to consider. Remote interaction often lacks personal connection.",
        "ai_opening_pl": f"W kwestii '{topic}' należy rozważyć silne kontrargumenty. Zdalnej interakcji często brakuje osobistej więzi.",
        "key_vocab": [
            {"word": "counterargument", "translation": "kontrargument"},
            {"word": "perspective", "translation": "perspektywa"},
            {"word": "interaction", "translation": "interakcja"}
        ]
    }


def evaluate_debate_turn(topic: str, chat_history: list, user_input: str, turn_number: int = 1) -> dict:
    """Evaluates user's debate turn, provides feedback in Polish, and generates AI's counter-argument."""
    history_str = "\n".join([f"{msg.get('role','').upper()}: {msg.get('text','')}" for msg in chat_history[-6:]])

    prompt = f"""You are a skilled English debate partner analyzing a Polish student's response in an English debate.
Topic: "{topic}"
Debate History:
{history_str}

Student's Latest Response: "{user_input}"
Turn Number: {turn_number} of 3

REQUIREMENTS:
1. "feedback_pl": Polish constructive feedback (1-2 sentences) commenting on the strength of their argument, grammar, or word choice.
2. "argument_score": score from 0 to 100 on argument clarity and English quality.
3. "ai_reply_en": Your eloquent, polite counterargument in English (2-3 sentences). Push back constructively or raise a new point!
4. "ai_reply_pl": Polish translation of your counterargument.
5. "is_debate_complete": boolean (true if turn_number >= 3, else false)

Return ONLY valid JSON:
{{
  "feedback_pl": "Świetny argument! Trafnie zauważyłeś korzyści finansowe. Mała poprawka: mówimy 'spend time on', a nie 'in'.",
  "argument_score": 85,
  "ai_reply_en": "You make a fair point about cost savings. However, does saving money justify the loss of face-to-face mentorship for junior employees?",
  "ai_reply_pl": "Masz słuszność co do oszczędności finansowych. Jednak czy oszczędzanie pieniędzy usprawiedliwia utratę bezpośredniego mentoringu dla młodszych pracowników?",
  "is_debate_complete": false
}}
"""
    raw = _ask(prompt)
    try:
        s = raw.find("{"); e = raw.rfind("}")
        if s != -1 and e != -1:
            raw = raw[s:e+1]
        res = json.loads(raw)
        if "ai_reply_en" in res and "feedback_pl" in res:
            return res
    except Exception as ex:
        print(f"evaluate_debate_turn error: {ex}")

    return {
        "feedback_pl": f"Dobry argument ({len(user_input.split())} słów). Kontynuuj debatuje po angielsku!",
        "argument_score": 80,
        "ai_reply_en": "That is an interesting angle. Nonetheless, we must evaluate whether the benefits truly outweigh the challenges.",
        "ai_reply_pl": "To ciekawy punkt widzenia. Niemniej jednak musimy ocenić, czy korzyści rzeczywiście przeważają nad wyzwaniami.",
        "is_debate_complete": turn_number >= 3
    }





