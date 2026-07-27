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
    # Gemini 2.5 flash first (faster), fall back to 1.5
    models = ["gemini-2.5-flash", "gemini-1.5-flash"]
    for model_name in models:
        for attempt in range(max_retries):
            try:
                resp = _client.models.generate_content(model=model_name, contents=prompt)
                return resp.text.strip()
            except Exception as e:
                err_str = str(e)
                is_rate_limit = "429" in err_str or "quota" in err_str.lower() or "rate" in err_str.lower()
                print(f"Gemini {model_name} attempt {attempt+1} failed: {e}")
                if is_rate_limit:
                    # Rate limit - nie próbuj tego modelu dalej, przejdź do następnego
                    break
                if attempt < max_retries - 1:
                    time.sleep(1.5)  # krótka przerwa przed następną próbą
        # krótka pauza między modelami
        time.sleep(0.5)
    return ""  # pusty string = fallback w wywołującej funkcji


def generate_example_sentence(word: str, translation: str) -> dict:
    """Generuje przykładowe zdanie – za każdym razem inny kontekst."""
    ctx = random.choice(_CONTEXTS)
    style = random.choice([
        "Use a humorous tone.",
        "Use a serious, formal tone.",
        "Make it a question.",
        "Use past tense.",
        "Use future tense.",
        "Make it about a specific person named Alex or Maria.",
        "Make it a short dialogue fragment.",
        "Use a surprising or unexpected scenario.",
    ])
    prompt = f"""You are an English teacher for a Polish speaker learning English.
Word: "{word}" (Polish: "{translation}")
Context: {ctx}. {style}

Generate a JSON response with:
1. "sentence": A natural example sentence using the word (max 12 words). MUST use the word "{word}" exactly. Do NOT use the phrase "is very important".
2. "sentence_pl": Polish translation of the sentence
3. "tip": A short memory tip in Polish (max 10 words)

Respond ONLY with valid JSON, no markdown, no extra text.
Example: {{"sentence": "She had no doubt about her decision.", "sentence_pl": "Nie miała wątpliwości co do swojej decyzji.", "tip": "Doubt = wątpliwość, jak 'dubbing' – coś niepewnego"}}"""

    raw = _ask(prompt)
    try:
        start = raw.find("{")
        end = raw.rfind("}")
        if start != -1 and end != -1:
            raw = raw[start:end+1]
        return json.loads(raw)
    except Exception:
        # Lepsze fallbacki - różnorodne zdania z użyciem słowa
        fallbacks = [
            (f"She didn't know how to {word} the problem.", f"Nie wiedziała, jak {translation} ten problem."),
            (f"He tried to {word} it carefully.", f"Starał się ostrożnie {translation}."),
            (f"They decided to {word} the situation.", f"Postanowili {translation} sytuację."),
            (f"The teacher explained {word} with examples.", f"Nauczyciel wyjaśnił '{translation}' na przykładach."),
            (f"Can you {word} this for me?", f"Czy możesz mi to {translation}?"),
        ]
        import random as _r
        sent, sent_pl = _r.choice(fallbacks)
        return {
            "sentence": sent,
            "sentence_pl": sent_pl,
            "tip": f"{word} = {translation}"
        }


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
    try:
        start = raw.find("{")
        end = raw.rfind("}")
        if start != -1 and end != -1:
            raw = raw[start:end+1]
        return json.loads(raw)
    except Exception:
        hint = word[0] + "_" * (len(word) - 1) if word else "?"
        return {
            "sentence": f"She needs to _____ this situation carefully.",
            "answer": word,
            "hint": hint,
            "sentence_pl": f"Musi ostrożnie {translation} tę sytuację."
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
    try:
        start = raw.find("{")
        end = raw.rfind("}")
        if start != -1 and end != -1:
            raw = raw[start:end+1]
        data = json.loads(raw)
        # Ensure exactly 4 options with correct included
        if "options" not in data or len(data["options"]) < 2:
            opts = [translation] + (distractors[:3] if distractors else ["radość", "strach", "pewność"])
            random.shuffle(opts)
            data["options"] = opts[:4]
        if translation not in data["options"]:
            data["options"][0] = translation
            random.shuffle(data["options"])
        return data
    except Exception:
        opts = [translation] + (distractors[:3] if distractors else ["radość", "strach", "pewność"])
        random.shuffle(opts)
        ctx_sentences = [
            f"Alex used the word **{word}** when talking to his colleague.",
            f"Maria read about **{word}** in a book about language learning.",
            f"The teacher explained what **{word}** means with an example.",
        ]
        return {
            "text": random.choice(ctx_sentences),
            "question": "Co oznacza pogrubione słowo?",
            "correct": translation,
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
    try:
        start = raw.find("{")
        end = raw.rfind("}")
        if start != -1 and end != -1:
            raw = raw[start:end+1]
        data = json.loads(raw)
        sentence = data.get("sentence", "")
        translation_pl = data.get("translation_pl", "")
        if not sentence or word.lower() not in sentence.lower():
            raise ValueError("Word not in sentence")
        # Scramble the words
        words = sentence.split()
        scrambled = words[:]
        random.shuffle(scrambled)
        # Make sure scrambled is not identical to original (at least swap if same)
        attempts = 0
        while scrambled == words and attempts < 5:
            random.shuffle(scrambled)
            attempts += 1
        return {"sentence": sentence, "words_scrambled": scrambled, "translation_pl": translation_pl}
    except Exception as e:
        print(f"generate_sentence_builder fallback for '{word}': {e}")
        # Fallback: simple template sentence
        fallbacks = [
            f"She could not {word} the situation at all.",
            f"He decided to {word} everything carefully.",
            f"They always {word} this problem together.",
            f"The teacher asked us to {word} the exercise.",
            f"I need to {word} this before tomorrow.",
        ]
        sentence = random.choice(fallbacks)
        words = sentence.split()
        scrambled = words[:]
        random.shuffle(scrambled)
        return {
            "sentence": sentence,
            "words_scrambled": scrambled,
            "translation_pl": f"(tłumaczenie dla: {translation})"
        }



_DAILY_FACT_CATEGORIES = {
    "biology": ("Biology", "Biologia"),
    "evolutionary_biology": ("Evolutionary Biology", "Biologia ewolucyjna"),
    "nature": ("Nature", "Przyroda"),
    "physics": ("Physics", "Fizyka"),
    "technology": ("Technology", "Technika"),
}


def generate_daily_fact(category_en: str, category_pl: str, user_words: list) -> dict:
    """Generuje ciekawostke naukowa z wyroznionymis slowami uzytkownika + quiz T/F."""
    words_str = ", ".join(f'"{w["word"]}" ({w.get("translation","?")})' for w in user_words[:15])
    prompt = f"""You are creating educational English content for a Polish speaker learning English.

Category: {category_en} ({category_pl})
User's vocabulary to practice (pick 3-5 and use them naturally): {words_str}

Return ONLY valid JSON (no markdown):
{{
  "title": "Specific topic title (4-6 English words)",
  "fact": "3-4 sentences (80-130 words). B1-B2 English level. Use 3-5 user words naturally. Mark each used target word with **double asterisks** like **word**.",
  "used_words": [
    {{"word": "used_word", "translation": "polskie tlumaczenie", "context": "short phrase using it"}}
  ],
  "questions": [
    {{"statement": "One-sentence T/F statement about the fact only.", "answer": true, "explanation": "Krotkie wyjasnienie po polsku."}},
    {{"statement": "Another statement.", "answer": false, "explanation": "Wyjasnienie."}},
    {{"statement": "Third statement.", "answer": true, "explanation": "Wyjasnienie."}}
  ]
}}

Rules:
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
        return data
    except Exception as ex:
        print(f"generate_daily_fact fallback: {ex}")
        w = user_words[0] if user_words else {"word": "develop", "translation": "rozwijac"}
        return {
            "title": f"{category_en}: Key Facts",
            "fact": f"Scientists study how living things **{w['word']}** in different environments. Many organisms adapt to survive in extreme conditions. Research shows that even small environmental changes can have significant effects. Understanding these processes is essential for protecting our planet.",
            "used_words": [{"word": w["word"], "translation": w.get("translation","?"), "context": f"how things {w['word']}"}],
            "questions": [
                {"statement": "Small environmental changes can have significant effects.", "answer": True, "explanation": "Tekst wprost to stwierdza."},
                {"statement": "Scientists fully understand all adaptation processes.", "answer": False, "explanation": "Tekst mowi ze 'badaja', nie ze w pelni rozumieja."},
                {"statement": "Understanding natural processes helps protect our planet.", "answer": True, "explanation": "Tekst konczy sie tym stwierdzeniem."}
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
    prompt = f"""You are an English teacher. Create a real-life English dialogue simulation scenario.
Topic: {topic}
User vocabulary to practice (pick 2-3 to highlight if they fit, or suggest general phrases): {words_str}

Return ONLY valid JSON (no markdown):
{{
  "topic_pl": "Nazwa tematu po polsku (np. W kawiarni)",
  "description": "Krótki opis sytuacji po polsku (2 zdania, np. Jesteś w kawiarni w Londynie. Chcesz zamówić kawę i deser.)",
  "goal": "Cel rozmowy dla użytkownika po polsku (np. Zamów cappuccino i muffin, zapytaj o hasło do Wi-Fi.)",
  "target_words": [
    {{"word": "target_word", "translation": "polskie tłumaczenie"}}
  ],
  "expected_phrases": [
    "Expected word or phrase 1",
    "Expected word or phrase 2"
  ],
  "bot_first_msg": "Greeting message from the bot in English to start the dialogue..."
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
    
    prompt = f"""You are an English teacher evaluating a student's spoken English in an interactive dialogue.
Scenario Goal: {goal}
Target words/phrases student should try to use: {", ".join(expected_phrases)}

Dialogue history so far:
{history_str}
Student's latest response (transcribed from speech): "{user_input}"

Analyze the student's latest response and return ONLY valid JSON (no markdown):
{{
  "correctness_score": 85, // Integer 0-100 based on grammatical correctness and naturalness
  "vocabulary_score": 100, // Integer 0-100 based on whether they used the target words/phrases from the list correctly in this turn. Set to 0 if none of the target words/phrases were used/attempted in this turn.
  "score": 92, // Integer 0-100, overall score (average of correctness_score and vocabulary_score, or equal to correctness_score if vocabulary_score is 0)
  "feedback_pl": "Krótka ocena po polsku (np. Super! Poprawnie użyłeś słowa. Uważaj tylko na przedimek 'a' przed rzeczownikami.)",
  "better_version": "A more natural/correct way a native speaker would say this in English...",
  "bot_reply": "The bot's next reply in English, keeping the conversation going...",
  "is_goal_achieved": false // true if the conversation goal has been completed (usually 3-4 turns total)
}}
"""
    raw = _ask(prompt)
    try:
        s = raw.find("{"); e = raw.rfind("}")
        if s != -1 and e != -1:
            raw = raw[s:e+1]
        data = json.loads(raw)
        
        # Ensure we have the split scores
        c_score = data.get("correctness_score")
        v_score = data.get("vocabulary_score")
        
        if c_score is None:
            c_score = data.get("score", 90)
        if v_score is None:
            has_words = any(w.lower() in user_input.lower() for w in expected_phrases)
            v_score = 100 if has_words else 0
            
        data["correctness_score"] = c_score
        data["vocabulary_score"] = v_score
        
        # Recalculate/ensure overall score
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
            "correctness_score": 90,
            "vocabulary_score": v_score,
            "score": 90 if v_score == 0 else (90 + v_score) // 2,
            "feedback_pl": "Dobra odpowiedź! Kontynuuj rozmowę.",
            "better_version": user_input,
            "bot_reply": "I see. Tell me more about it.",
            "is_goal_achieved": len(chat_history) >= 6
        }


