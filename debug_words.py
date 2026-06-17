import requests, sqlite3

# Klasyfikuj slowo przez API jako user Test (id=2)
r1 = requests.post('http://localhost:5000/api/classify/word',
    json={'word':'keep','translation':'trzymac','status':'TROCHE'},
    headers={'X-User-Id':'2'})
print('classify keep:', r1.json())

r2 = requests.post('http://localhost:5000/api/classify/word',
    json={'word':'action','translation':'akcja','status':'NIE_ZNAM'},
    headers={'X-User-Id':'2'})
print('classify action:', r2.json())

# Sprawdz w bazie
conn = sqlite3.connect('data/words.db')
rows = conn.execute("SELECT word, status, user_id FROM words WHERE word IN ('keep','action') ORDER BY user_id").fetchall()
print('W bazie keep i action:')
for r in rows:
    print(' user=' + str(r[0]) + ' word=' + str(r[1]) + ' status=' + str(r[2]))

# Ile slow ma Test teraz?
cnt = conn.execute("SELECT status, COUNT(*) FROM words WHERE user_id=2 GROUP BY status").fetchall()
print('Statystyki Test:', [(r[0], r[1]) for r in cnt])
conn.close()
