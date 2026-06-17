import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

addition = '''

_DAILY_FACT_CATEGORIES = {
    "biology": ("Biology", "Biologia"),
    "evolutionary_biology": ("Evolutionary Biology", "Biologia ewolucyjna"),
    "nature": ("Nature", "Przyroda"),
    "physics": ("Physics", "Fizyka"),
    "technology": ("Technology", "Technika"),
}


def generate_daily_fact(category_en: str, category_pl: str, user_words: list) -> dict:
    """Generuje ciekawostke naukowa z wyroznionymis slowami uzytkownika + quiz T/F."""
    words_str = ", ".join(f\'"{w["word"]}" ({w.get("translation","?")})\' for w in user_words[:15])
    prompt = f"""You are creating educational English content for a Polish speaker learning English.

Category: {category_en} ({category_pl})
User\'s vocabulary to practice (pick 3-5 and use them naturally): {words_str}

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
            "fact": f"Scientists study how living things **{w[\'word\']}** in different environments. Many organisms adapt to survive in extreme conditions. Research shows that even small environmental changes can have significant effects. Understanding these processes is essential for protecting our planet.",
            "used_words": [{"word": w["word"], "translation": w.get("translation","?"), "context": f"how things {w[\'word\']}"}],
            "questions": [
                {"statement": "Small environmental changes can have significant effects.", "answer": True, "explanation": "Tekst wprost to stwierdza."},
                {"statement": "Scientists fully understand all adaptation processes.", "answer": False, "explanation": "Tekst mowi ze \'badaja\', nie ze w pelni rozumieja."},
                {"statement": "Understanding natural processes helps protect our planet.", "answer": True, "explanation": "Tekst konczy sie tym stwierdzeniem."}
            ]
        }
'''

with open('gemini_tasks.py', 'a', encoding='utf-8') as f:
    f.write(addition)
print('OK: appended generate_daily_fact to gemini_tasks.py')
