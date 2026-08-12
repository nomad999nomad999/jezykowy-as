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
1. "sentence": A natural English sentence using "{word}" (6-10 words). MUST contain "{word}" exactly. No special punctuation except period at end.
2. "translation_pl": Polish translation of that sentence.

Rules:
- The sentence must use exactly the word "{word}" (not a different form)
- Keep it short (6-10 words)
- Natural, everyday English

Respond ONLY with valid JSON, no markdown.
Example: {{"sentence": "She had no doubt about her decision.", "translation_pl": "Nie miała wątpliwości co do swojej decyzji."}}"""

    raw = _ask(prompt)
    parsed = _parse_json(raw)
    if parsed and isinstance(parsed, dict) and "sentence" in parsed and word.lower() in parsed["sentence"].lower():
        sentence = parsed["sentence"]
        translation_pl = parsed.get("translation_pl", "")
        words = sentence.split()
        scrambled = words[:]
        random.shuffle(scrambled)
        attempts = 0
        while scrambled == words and attempts < 5:
            random.shuffle(scrambled)
            attempts += 1
        return {"sentence": sentence, "words_scrambled": scrambled, "translation_pl": translation_pl}

    fallback_obj = _smart_fallback_sentence(word, translation)
    sentence = fallback_obj["sentence"]
    words = sentence.split()
    scrambled = words[:]
    random.shuffle(scrambled)
    return {
        "sentence": sentence,
        "words_scrambled": scrambled,
        "translation_pl": fallback_obj["sentence_pl"]
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


def generate_daily_fact(category_en: str, category_pl: str, user_words: list) -> dict:
    """Generuje ciekawostkę naukową z wyróżnionymi słowami użytkownika, polskim tłumaczeniem akapitu, tłumaczeniem pytań + quiz T/F."""
    words_str = ", ".join(f'"{w["word"]}" ({w.get("translation","?")})' for w in user_words[:15])
    prompt = f"""You are creating educational English content for a Polish speaker learning English.

Category: {category_en} ({category_pl})
User's vocabulary to practice (pick 3-5 and use them naturally): {words_str}

Return ONLY valid JSON (no markdown):
{{
  "title": "Specific topic title (4-6 English words)",
  "fact": "3-4 sentences (80-130 words). B1-B2 English level. Use 3-5 user words naturally. Mark each used target word with **double asterisks** like **word**.",
  "fact_pl": "Kompletne, dokładne i naturalne tłumaczenie całego powyższego akapitu na język polski.",
  "used_words": [
    {{"word": "used_word", "translation": "polskie tłumaczenie", "context": "short phrase using it"}}
  ],
  "questions": [
    {{"statement": "One-sentence T/F statement in English about the fact.", "statement_pl": "Dokładne tłumaczenie zdania pytania na język polski.", "answer": true, "explanation": "Krótkie wyjaśnienie po polsku."}},
    {{"statement": "Another statement in English.", "statement_pl": "Tłumaczenie po polsku.", "answer": false, "explanation": "Wyjaśnienie."}},
    {{"statement": "Third statement in English.", "statement_pl": "Tłumaczenie po polsku.", "answer": true, "explanation": "Wyjaśnienie."}}
  ]
}}

Rules:
- Include "fact_pl" which is a full, accurate Polish translation of the entire fact text so the learner can understand difficult words.
- Each item in "questions" MUST contain "statement" (English) AND "statement_pl" (full Polish translation of the statement).
- Exactly 3 questions, mix of true/false (not all same answer)
- Questions answerable ONLY from the fact text
- Fact must be genuinely interesting and accurate
- Explanations in Polish"""

    raw = _ask(prompt)
    try:
        s = raw.find("{"); e = raw.rfind("}")
        if s != -1 and e != -1:
            raw = raw[s:e+1]
        data = json.loads(raw)
        if not data.get("fact") or len(data.get("questions", [])) < 3:
            raise ValueError("Bad structure")
        if not data.get("fact_pl"):
            clean_fact = data["fact"].replace("**", "")
            data["fact_pl"] = _ask(f"Przetłumacz ten tekst na język polski:\n{clean_fact}") or f"Tłumaczenie: {clean_fact}"
        # Make sure every question has statement_pl
        for q in data.get("questions", []):
            if not q.get("statement_pl"):
                q["statement_pl"] = _ask(f"Przetłumacz to zdanie na język polski:\n{q.get('statement', '')}") or q.get("statement", "")
        return data
    except Exception as ex:
        print(f"generate_daily_fact fallback: {ex}")
        w = user_words[0] if user_words else {"word": "develop", "translation": "rozwijać"}
        return {
            "title": f"{category_en}: Key Facts",
            "fact": f"Scientists study how living things **{w['word']}** in different environments. Many organisms adapt to survive in extreme conditions. Research shows that even small environmental changes can have significant effects. Understanding these processes is essential for protecting our planet.",
            "fact_pl": f"Naukowcy badają, jak żywe organizmy rozwijają się w różnych środowiskach. Wiele organizmów przystosowuje się, aby przetrwać w ekstremalnych warunkach. Badania pokazują, że nawet małe zmiany środowiskowe mogą mieć znaczący wpływ. Zrozumienie tych procesów jest kluczowe dla ochrony naszej planety.",
            "used_words": [{"word": w["word"], "translation": w.get("translation","?"), "context": f"how things {w['word']}"}],
            "questions": [
                {"statement": "Small environmental changes can have significant effects.", "statement_pl": "Niewielkie zmiany środowiskowe mogą mieć znaczące skutki.", "answer": True, "explanation": "Tekst wprost to stwierdza."},
                {"statement": "Scientists fully understand all adaptation processes.", "statement_pl": "Naukowcy w pełni rozumieją wszystkie procesy adaptacji.", "answer": False, "explanation": "Tekst mówi że 'badają', nie że w pełni rozumieją."},
                {"statement": "Understanding natural processes helps protect our planet.", "statement_pl": "Zrozumienie procesów naturalnych pomaga chronić naszą planetę.", "answer": True, "explanation": "Tekst kończy się tym stwierdzeniem."}
            ]
        }


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
Number of sentences to generate: {count} (generate exactly {count} sentence object(s) in "sentences" array)

Requirements:
1. Generate natural Polish sentence(s) ("sentence_pl") that test how to translate into English using the target word "{word}" (or its natural English variation).
2. Provide the ideal English model translation ("expected_en").
3. Provide 2-3 acceptable alternative English translations ("alternatives_en").

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

    # Fallback if Gemini is offline or failed
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




