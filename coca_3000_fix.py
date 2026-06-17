"""
Uzupelnia coca_words dla zakresow 1001-3000 JEDNYM wywolaniem API.
Oszczedne - 1 request zamiast 100+.
"""
import sqlite3, os, json

DB = os.path.join(os.path.dirname(__file__), "data", "words.db")

def get_api_key():
    for line in open(os.path.join(os.path.dirname(__file__), ".env")):
        if line.startswith("GEMINI_API_KEY"):
            return line.split("=",1)[1].strip().strip('"')
    return ""

def main():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row

    # Stan obecny
    existing_words = {r["word"] for r in conn.execute("SELECT word FROM coca_words")}
    ranks_in_db = {r["frequency_rank"] for r in conn.execute("SELECT frequency_rank FROM coca_words")}

    missing_count = sum(1 for r in range(1001, 3001) if r not in ranks_in_db)
    print(f"Brakuje {missing_count} slow w zakresie 1001-3000")
    print(f"Slow ogolnie w bazie: {len(existing_words)}")

    if missing_count == 0:
        print("Baza kompletna!")
        conn.close()
        return

    api_key = get_api_key()
    if not api_key:
        print("Brak klucza API!")
        conn.close()
        return

    from google import genai
    from google.genai import types
    client = genai.Client(api_key=api_key)

    # Jedno duze zapytanie dla 1001-2000
    for range_start, range_end in [(1001, 1500), (1501, 2000), (2001, 2500), (2501, 3000)]:
        # Sprawdz ile brakuje w tym zakresie
        missing_in_range = [r for r in range(range_start, range_end+1) if r not in ranks_in_db]
        if not missing_in_range:
            print(f"Zakres {range_start}-{range_end}: kompletny")
            continue

        count = len(missing_in_range)
        print(f"\nZakres {range_start}-{range_end}: brakuje {count} slow...")

        prompt = (
            f"List {count} English words from COCA corpus frequency ranks {range_start} to {range_end}. "
            f"Return ONLY a JSON array. Each item: {{\"rank\": number, \"word\": \"english\", \"translation\": \"polish\"}}. "
            f"Polish translation max 4 words. Exactly {count} unique words, one per rank from {range_start} to {range_end}."
        )

        try:
            resp = client.models.generate_content(
                model="gemini-flash-lite-latest",
                contents=prompt,
                config=types.GenerateContentConfig(
                    max_output_tokens=8000,
                    response_mime_type="application/json"
                )
            )
            text = resp.text.strip()
            s = text.find("["); e = text.rfind("]") + 1
            if s < 0 or e <= s:
                print(f"  Brak JSON w odpowiedzi")
                continue

            data = json.loads(text[s:e])
            print(f"  Otrzymano {len(data)} slow")

            to_insert = []
            for item in data:
                word = str(item.get("word","")).strip().lower()
                trans = str(item.get("translation","")).strip()
                rank = int(item.get("rank", range_start))
                if word and word not in existing_words:
                    to_insert.append((word, trans, rank))
                    existing_words.add(word)
                    ranks_in_db.add(rank)

            if to_insert:
                conn.executemany(
                    "INSERT OR IGNORE INTO coca_words (word,translation,frequency_rank) VALUES (?,?,?)",
                    to_insert
                )
                conn.commit()
                print(f"  Dodano {len(to_insert)} nowych slow")

        except Exception as ex:
            print(f"  Blad: {ex}")

    # Podsumowanie
    final = conn.execute("SELECT COUNT(*) FROM coca_words WHERE frequency_rank <= 3000").fetchone()[0]
    print(f"\nSlow COCA (rank<=3000): {final}/3000")

    for lo, hi in [(1,100),(101,500),(501,1000),(1001,1500),(1501,2000),(2001,2500),(2501,3000)]:
        c = conn.execute("SELECT COUNT(*) FROM coca_words WHERE frequency_rank BETWEEN ? AND ?", (lo,hi)).fetchone()[0]
        total = hi - lo + 1
        print(f"  {lo:4d}-{hi:4d}: {c:4d}/{total} ({100*c//total}%)")

    conn.close()
    print("\nGotowe! Zrestartuj serwer.")

if __name__ == "__main__":
    main()
