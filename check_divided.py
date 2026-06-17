import sqlite3, os
db = os.path.join(r'c:\Users\adria\.antigravity\Nauka angielskiego\data', 'words.db')
conn = sqlite3.connect(db)
conn.row_factory = sqlite3.Row

uid = 5  # Madzia

# 1. Sprawdz luki w coca_words (ciągłość rankingów)
print("=== LUKI W TABELI coca_words ===")
ranks = [r['frequency_rank'] for r in conn.execute(
    "SELECT frequency_rank FROM coca_words ORDER BY frequency_rank"
).fetchall()]
gaps = []
for i in range(len(ranks)-1):
    if ranks[i+1] - ranks[i] > 1:
        gaps.append((ranks[i], ranks[i+1], ranks[i+1]-ranks[i]-1))

if gaps:
    print(f"Luki w rankingach (pierwszych 20):")
    for (a, b, cnt) in gaps[:20]:
        print(f"  rank {a} → {b}  (brakuje {cnt} slow)")
    print(f"\nLącznie: {len(gaps)} luk, min rank={ranks[0]}, max rank={ranks[-1]}, total={len(ranks)}")
else:
    print(f"  Brak luk! Rankingi ciągłe od {ranks[0]} do {ranks[-1]}")

# 2. Co Madzia ma już sklasyfikowane (ranks 100-200)
print("\n=== Co Madzia ma sklasyfikowane ranks 100-200 ===")
classified = conn.execute("""
    SELECT w.word, w.status, w.frequency_rank,
           COALESCE(c.frequency_rank, w.frequency_rank) as coca_rank
    FROM words w
    LEFT JOIN coca_words c ON c.word = w.word
    WHERE w.user_id=?
    AND COALESCE(c.frequency_rank, w.frequency_rank) BETWEEN 100 AND 200
    ORDER BY COALESCE(c.frequency_rank, w.frequency_rank)
""", (uid,)).fetchall()
print(f"Sklasyfikowanych słów w rankach 100-200: {len(classified)}")
for r in classified:
    print(f"  rank={r['coca_rank']} '{r['word']}' status={r['status']}")

# 3. Co jest w coca_words ranks 100-200 ale NIE u Madzi
print("\n=== Słowa COCA rank 100-200 NIEOBECNE u Madzi ===")
missing = conn.execute("""
    SELECT c.word, c.frequency_rank
    FROM coca_words c
    WHERE c.frequency_rank BETWEEN 100 AND 200
    AND c.word NOT IN (SELECT word FROM words WHERE user_id=?)
    AND c.word NOT IN (SELECT word FROM skipped_coca_words WHERE user_id=?)
    ORDER BY c.frequency_rank
""", (uid, uid)).fetchall()
print(f"Brakujących słów: {len(missing)}")
for r in missing:
    print(f"  rank={r['frequency_rank']} '{r['word']}'")

# 4. Skipped words dla Madzi
print("\n=== Pominięte słowa (skipped) przez Madzię ===")
skipped = conn.execute("""
    SELECT s.word, c.frequency_rank
    FROM skipped_coca_words s
    LEFT JOIN coca_words c ON c.word = s.word
    WHERE s.user_id=?
    ORDER BY c.frequency_rank
""", (uid,)).fetchall()
print(f"Pominięte: {len(skipped)}")
for r in skipped[:20]:
    print(f"  rank={r['frequency_rank']} '{r['word']}'")

# 5. Jakie słowa byłyby następne w kolejce dla Madzi
print("\n=== NASTĘPNA KOLEJKA dla Madzi (top 20 wg ranku) ===")
next_batch = conn.execute("""
    SELECT c.word, c.frequency_rank
    FROM coca_words c
    WHERE c.word NOT IN (SELECT word FROM words WHERE user_id=?)
    AND c.word NOT IN (SELECT word FROM skipped_coca_words WHERE user_id=?)
    ORDER BY c.frequency_rank
    LIMIT 20
""", (uid, uid)).fetchall()
for r in next_batch:
    print(f"  rank={r['frequency_rank']} '{r['word']}'")

conn.close()
