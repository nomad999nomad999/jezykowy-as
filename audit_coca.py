"""
Sprawdza jakie pliki expand/fill_coca sa dostepne i ile slow maja.
Potem sprawdza co jest w bazie vs co bylo dodane.
"""
import sqlite3, os, ast, re

DB = os.path.join('data', 'words.db')
conn = sqlite3.connect(DB)
conn.row_factory = sqlite3.Row

# Poka jakie rangi sa w bazie - gaps
print("=== Analiza brakujacych rangi ===")
ranks_in_db = set(r['frequency_rank'] for r in conn.execute('SELECT frequency_rank FROM coca_words').fetchall())
print(f"Total COCA words in DB: {len(ranks_in_db)}")
print(f"Max rank: {max(ranks_in_db)}")

missing = []
for i in range(1, 3001):
    if i not in ranks_in_db:
        missing.append(i)

print(f"\nMissing ranks in 1-3000: {len(missing)}")
if missing[:20]:
    print(f"First 20 missing: {missing[:20]}")
if missing[-20:]:
    print(f"Last 20 missing: {missing[-20:]}")

# Sprawdz zakresy
for lo, hi in [(1,100),(101,300),(301,500),(501,1000),(1001,1500),(1501,2000),(2001,2500),(2501,3000)]:
    present = sum(1 for r in range(lo, hi+1) if r in ranks_in_db)
    total = hi - lo + 1
    print(f"  Rank {lo:4d}-{hi:4d}: {present:4d}/{total:4d} ({100*present//total}%)")

conn.close()
