import sqlite3, os
db = os.path.join(r'c:\Users\adria\.antigravity\Nauka angielskiego\data', 'words.db')
conn = sqlite3.connect(db)
conn.row_factory = sqlite3.Row

tables = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
print('Tabele:', tables)
for t in tables:
    cols = [r[1] for r in conn.execute(f"PRAGMA table_info({t})").fetchall()]
    cnt = conn.execute(f"SELECT COUNT(*) as c FROM {t}").fetchone()[0]
    print(f"  {t} ({cnt} rows): {', '.join(cols)}")
