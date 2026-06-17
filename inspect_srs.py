import sqlite3
conn = sqlite3.connect('data/words.db')
conn.row_factory = sqlite3.Row
rows = conn.execute('SELECT id, word, ef, interval, repetitions, next_review, last_review FROM srs_cards WHERE last_review IS NOT NULL ORDER BY last_review DESC').fetchall()
print('Reviewed cards:')
for r in rows:
    print(f"  id={r['id']} word={r['word']:12s} ef={r['ef']} interval={r['interval']} reps={r['repetitions']} next={r['next_review']} last={r['last_review']}")
conn.close()
