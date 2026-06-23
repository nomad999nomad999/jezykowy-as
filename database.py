"""
Baza danych SQLite – Nauka Angielskiego (multi-user).
Migracja bezpieczna – istniejące dane dostają user_id=1 (pierwszy użytkownik).
"""
import sqlite3, os, hashlib
from datetime import datetime, date, timedelta

DB_PATH = os.path.join(os.path.dirname(__file__), "data", "words.db")

def get_conn():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn

def _col_exists(conn, table, col):
    cols = [r["name"] for r in conn.execute(f"PRAGMA table_info({table})").fetchall()]
    return col in cols

def init_db():
    with get_conn() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                xp INTEGER DEFAULT 0,
                level TEXT DEFAULT 'Beginner'
            );
            CREATE TABLE IF NOT EXISTS words (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                word TEXT NOT NULL,
                translation TEXT DEFAULT '',
                status TEXT NOT NULL DEFAULT 'NIE_ZNAM',
                source TEXT DEFAULT 'coca',
                user_id INTEGER DEFAULT 1,
                added_date TEXT DEFAULT CURRENT_TIMESTAMP,
                last_reviewed TEXT,
                review_count INTEGER DEFAULT 0,
                correct_count INTEGER DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS coca_words (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                word TEXT NOT NULL,
                translation TEXT NOT NULL,
                frequency_rank INTEGER NOT NULL
            );
            CREATE UNIQUE INDEX IF NOT EXISTS idx_coca_word ON coca_words(word);
            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER DEFAULT 1,
                session_date TEXT DEFAULT CURRENT_TIMESTAMP,
                exercise_type TEXT,
                words_practiced INTEGER DEFAULT 0,
                correct INTEGER DEFAULT 0,
                duration_sec INTEGER DEFAULT 0,
                xp_earned INTEGER DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS streak (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER DEFAULT 1,
                last_activity TEXT,
                current_streak INTEGER DEFAULT 0,
                longest_streak INTEGER DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT
            );
            CREATE TABLE IF NOT EXISTS word_promotions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER DEFAULT 1,
                word_id INTEGER,
                word_text TEXT,
                from_status TEXT,
                to_status TEXT,
                promoted_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS skipped_coca_words (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER DEFAULT 1,
                word TEXT NOT NULL,
                skipped_at TEXT DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, word)
            );
        """)
        # Migracja – dodaj user_id do starych tabel jeśli brak
        for table, col in [("words","user_id"), ("sessions","user_id"), ("streak","user_id")]:
            if not _col_exists(conn, table, col):
                conn.execute(f"ALTER TABLE {table} ADD COLUMN {col} INTEGER DEFAULT 1")
        # Migracja – dodaj xp_earned do sessions jeśli brak
        if not _col_exists(conn, "sessions", "xp_earned"):
            conn.execute("ALTER TABLE sessions ADD COLUMN xp_earned INTEGER DEFAULT 0")
        # KRYTYCZNA MIGRACJA: usuń stary indeks idx_word(word) który blokuje multi-user!
        # Ten indeks pozwalał na tylko 1 wystąpienie słowa w całej tabeli (bez user_id)
        conn.execute("DROP INDEX IF EXISTS idx_word")
        # Prawidłowy indeks: unikalność per (word, user_id)
        conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_word_user ON words(word, user_id)")

        # Migracja – dodaj learned_at do words jeśli brak
        if not _col_exists(conn, "words", "learned_at"):
            conn.execute("ALTER TABLE words ADD COLUMN learned_at TEXT DEFAULT NULL")
        # Migracja – dodaj frequency_rank do words jeśli brak, i uzupełnij z coca_words
        if not _col_exists(conn, "words", "frequency_rank"):
            conn.execute("ALTER TABLE words ADD COLUMN frequency_rank INTEGER DEFAULT 9999")
            conn.execute("""
                UPDATE words SET frequency_rank = (
                    SELECT c.frequency_rank FROM coca_words c WHERE c.word = words.word
                ) WHERE EXISTS (
                    SELECT 1 FROM coca_words c WHERE c.word = words.word
                )
            """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_words_rank ON words(user_id, frequency_rank)")

        # Migracja – usuń kolumnę password z users (SQLite nie obsługuje DROP COLUMN wprost)
        if _col_exists(conn, 'users', 'password'):
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS users_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT NOT NULL UNIQUE,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    xp INTEGER DEFAULT 0,
                    level TEXT DEFAULT 'Beginner'
                );
                INSERT OR IGNORE INTO users_new (id, username, created_at, xp, level)
                    SELECT id, username, created_at, xp, level FROM users;
                DROP TABLE users;
                ALTER TABLE users_new RENAME TO users;
            """)
        # Streak dla user_id=1 jeśli brak
        conn.execute("INSERT OR IGNORE INTO streak (user_id,last_activity,current_streak,longest_streak) VALUES (1,NULL,0,0)")
        # Tabela Słowa Dnia
        conn.execute("""
            CREATE TABLE IF NOT EXISTS word_of_day (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                wod_date TEXT UNIQUE,
                word TEXT, translation TEXT, rank INTEGER,
                fun_fact TEXT
            )""")

# ─── Auth ─────────────────────────────────────────────────────────────────────
def create_user(username):
    """Tworzy nowe konto. Zwraca user_id lub None jeśli nazwa zajęta."""
    with get_conn() as conn:
        try:
            conn.execute("INSERT INTO users (username) VALUES (?)", (username,))
            uid = conn.execute("SELECT id FROM users WHERE username=?", (username,)).fetchone()["id"]
            conn.execute("INSERT OR IGNORE INTO streak (user_id,current_streak,longest_streak) VALUES (?,0,0)", (uid,))
            return uid
        except sqlite3.IntegrityError:
            return None

def ensure_adrian():
    """Upewnia się że konto Adrian (user_id=1) istnieje i mapuje na stare dane."""
    with get_conn() as conn:
        row = conn.execute("SELECT id FROM users WHERE id=1").fetchone()
        if not row:
            conn.execute("INSERT INTO users (id, username) VALUES (1, 'Adrian')")
            conn.execute("INSERT OR IGNORE INTO streak (user_id,current_streak,longest_streak) VALUES (1,0,0)")

def get_all_users():
    with get_conn() as conn:
        rows = conn.execute("SELECT id, username, xp, level FROM users ORDER BY id").fetchall()
        return [dict(r) for r in rows]

def get_user_by_id(uid):
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()
        return dict(row) if row else None

def get_leaderboard():
    with get_conn() as conn:
        rows = conn.execute("""
            SELECT u.id, u.username, u.xp, u.level,
                   (SELECT COUNT(*) FROM words w WHERE w.user_id = u.id AND w.status = 'ZNAM') as znam_count
            FROM users u
            ORDER BY u.xp DESC
            LIMIT 20
        """).fetchall()
        return [dict(r) for r in rows]

def add_xp(user_id, amount):
    """Dodaj XP z mnożnikiem streak. Zwraca (nowe_xp, poziom, faktyczny_bonus, mnożnik)."""
    with get_conn() as conn:
        streak_row = conn.execute("SELECT current_streak FROM streak WHERE user_id=?", (user_id,)).fetchone()
        streak = streak_row["current_streak"] if streak_row else 0
        # Silniejszy mnożnik – mocna motywacja do utrzymania serii
        multiplier = 2.0 if streak >= 14 else 1.5 if streak >= 7 else 1.25 if streak >= 3 else 1.0
        actual = max(1, round(amount * multiplier))
        conn.execute("UPDATE users SET xp = xp + ? WHERE id=?", (actual, user_id))
        row = conn.execute("SELECT xp FROM users WHERE id=?", (user_id,)).fetchone()
        xp = row["xp"] if row else 0
        # Progi poziomów dostosowane do nowej ekonomii XP
        lvl = "Beginner 🌱"
        if xp >= 50000: lvl = "Master 👑"
        elif xp >= 20000: lvl = "Expert 💡"
        elif xp >= 5000: lvl = "Advanced 🥇"
        elif xp >= 1000: lvl = "Learner 🥈"
        conn.execute("UPDATE users SET level=? WHERE id=?", (lvl, user_id))
        return xp, lvl, actual, round(multiplier, 2)

# ─── Import ───────────────────────────────────────────────────────────────────
def is_imported():
    with get_conn() as conn:
        row = conn.execute("SELECT value FROM settings WHERE key='imported'").fetchone()
        return row is not None and row["value"] == "1"

def mark_imported():
    with get_conn() as conn:
        conn.execute("INSERT OR REPLACE INTO settings (key,value) VALUES ('imported','1')")

def add_word(word, translation, status, source="coca", user_id=1):
    word = word.strip().lower()
    if not word: return
    conn = get_conn()
    try:
        # Pobierz prawdziwy rank COCA
        rank_row = conn.execute("SELECT frequency_rank FROM coca_words WHERE word=?", (word,)).fetchone()
        freq_rank = rank_row["frequency_rank"] if rank_row else 9999
        conn.execute("BEGIN")
        conn.execute(
            "INSERT OR IGNORE INTO words (word,translation,status,source,user_id,frequency_rank) VALUES (?,?,?,?,?,?)",
            (word, translation, status, source, user_id, freq_rank))
        conn.execute("COMMIT")
    except Exception as e:
        try: conn.execute("ROLLBACK")
        except: pass
        print(f"[add_word ERROR] {word}: {e}")
    finally:
        conn.close()

def load_coca_words(words_list):
    with get_conn() as conn:
        conn.executemany("INSERT OR IGNORE INTO coca_words (word,translation,frequency_rank) VALUES (?,?,?)", words_list)

def load_basic_words(words_list):
    """Ładuje/aktualizuje najważniejsze słowa z INSERT OR REPLACE — zawsze poprawne rangi."""
    with get_conn() as conn:
        conn.executemany("""
            INSERT INTO coca_words (word,translation,frequency_rank) VALUES (?,?,?)
            ON CONFLICT(word) DO UPDATE SET
                frequency_rank=excluded.frequency_rank,
                translation=excluded.translation
        """, words_list)

# ─── Words ────────────────────────────────────────────────────────────────────
def update_status(word_id, new_status, user_id=1):
    """Zmień status słowa i przyznaj XP za awans. Zwraca info o XP i milestone."""
    with get_conn() as conn:
        row = conn.execute("SELECT status, word FROM words WHERE id=? AND user_id=?", (word_id, user_id)).fetchone()
        if not row: return {"xp":0, "milestone": None}
        old_status, word_text = row["status"], row["word"]
        if old_status == new_status: return {"xp":0, "milestone": None}
        # Loguj awans
        conn.execute(
            "INSERT INTO word_promotions (user_id,word_id,word_text,from_status,to_status) VALUES (?,?,?,?,?)",
            (user_id, word_id, word_text, old_status, new_status))
        # Ustaw learned_at gdy słowo przechodzi DO ZNAM
        if new_status == "ZNAM":
            if old_status != "ZNAM":
                conn.execute(
                    "UPDATE words SET status=?,last_reviewed=CURRENT_TIMESTAMP,learned_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?",
                    (new_status, word_id, user_id))
            else:
                conn.execute("UPDATE words SET status=?,last_reviewed=CURRENT_TIMESTAMP WHERE id=? AND user_id=?",
                             (new_status, word_id, user_id))
        else:
            conn.execute(
                "UPDATE words SET status=?,last_reviewed=CURRENT_TIMESTAMP,learned_at=NULL WHERE id=? AND user_id=?",
                (new_status, word_id, user_id))
    # XP za awans – rzadkie, więc wysoko punktowane
    xp_base = 0
    if   old_status == "NIE_ZNAM" and new_status == "TROCHE": xp_base = 15   # pierwsze rozpoznanie
    elif old_status == "TROCHE"   and new_status == "ZNAM":   xp_base = 30   # pełne opanowanie
    elif old_status == "NIE_ZNAM" and new_status == "ZNAM":   xp_base = 25   # bezpośrednio do ZNAM
    # Degradacje: brak XP (to cofnięcie postępu)
    if xp_base > 0:
        new_xp, lvl, actual, mult = add_xp(user_id, xp_base)
        # Milestone bonusy (jednorazowe) – rosnące z progiem
        learned_count = _get_learned_count(user_id)
        milestone = None
        for m, bonus in [(10,500),(25,1500),(50,3000),(100,7500),(200,15000),(500,50000),(1000,100000)]:
            if learned_count == m:
                add_xp(user_id, bonus)
                milestone = {"count": m, "bonus": bonus}
                break
        return {"xp": actual, "multiplier": mult, "total_xp": new_xp, "level": lvl, "milestone": milestone}
    return {"xp": 0, "milestone": None}

def delete_word(word_id, user_id=1):
    """Usuwa słowo ze wszystkich list i powiązanych tabel (promotions, srs_cards)."""
    with get_conn() as conn:
        conn.execute("BEGIN")
        conn.execute("DELETE FROM words WHERE id=? AND user_id=?", (word_id, user_id))
        conn.execute("DELETE FROM word_promotions WHERE word_id=? AND user_id=?", (word_id, user_id))
        conn.execute("DELETE FROM srs_cards WHERE word_id=? AND user_id=?", (word_id, user_id))
        conn.execute("COMMIT")

def _get_learned_count(user_id):
    with get_conn() as conn:
        row = conn.execute("SELECT COUNT(*) as c FROM words WHERE user_id=? AND learned_at IS NOT NULL", (user_id,)).fetchone()
        return row["c"] if row else 0

def get_classified_count(user_id=1):
    """Łączna liczba sklasyfikowanych słów przez użytkownika."""
    with get_conn() as conn:
        row = conn.execute("SELECT COUNT(*) as c FROM words WHERE user_id=? AND source='coca'", (user_id,)).fetchone()
        return row["c"] if row else 0

def get_words_by_status(status, user_id=1):
    with get_conn() as conn:
        rows = conn.execute("""
            SELECT w.id, w.word,
                   COALESCE(NULLIF(w.translation,''), c.translation, '') AS translation,
                   w.status, w.source, w.user_id,
                   w.added_date, w.last_reviewed, w.review_count, w.correct_count, w.learned_at,
                   COALESCE(c.frequency_rank, w.frequency_rank, 9999) AS frequency_rank
            FROM words w
            LEFT JOIN coca_words c ON c.word = w.word
            WHERE w.status=? AND w.user_id=?
            ORDER BY COALESCE(c.frequency_rank, w.frequency_rank, 9999)
        """, (status, user_id)).fetchall()
        return [dict(r) for r in rows]

def get_learned_words(user_id=1):
    """Słowa faktycznie wyuczone: przeszły do ZNAM z innego statusu (learned_at IS NOT NULL)."""
    with get_conn() as conn:
        rows = conn.execute("""
            SELECT w.id, w.word,
                   COALESCE(NULLIF(w.translation,''), c.translation, '') AS translation,
                   w.status, w.source, w.user_id,
                   w.added_date, w.last_reviewed, w.review_count, w.correct_count, w.learned_at,
                   COALESCE(c.frequency_rank, w.frequency_rank, 9999) AS frequency_rank
            FROM words w
            LEFT JOIN coca_words c ON c.word = w.word
            WHERE w.user_id=? AND w.learned_at IS NOT NULL
            ORDER BY w.learned_at DESC
        """, (user_id,)).fetchall()
        return [dict(r) for r in rows]

def get_promotion_stats(user_id=1):
    """Statystyki awansów słów."""
    with get_conn() as conn:
        # Sumaryczne awanse per typ przejścia
        totals = conn.execute("""
            SELECT from_status, to_status, COUNT(*) as cnt
            FROM word_promotions
            WHERE user_id=?
            GROUP BY from_status, to_status""", (user_id,)).fetchall()
        # Ostatnie 15 awansów
        recent = conn.execute("""
            SELECT word_text, from_status, to_status,
                   DATE(promoted_at) as day, promoted_at
            FROM word_promotions
            WHERE user_id=?
            ORDER BY promoted_at DESC
            LIMIT 15""", (user_id,)).fetchall()
        # Awanse per dzień (ostatnie 14 dni)
        daily = conn.execute("""
            SELECT DATE(promoted_at) as day, COUNT(*) as cnt
            FROM word_promotions
            WHERE user_id=?
              AND DATE(promoted_at) >= DATE('now','-14 days')
            GROUP BY DATE(promoted_at)
            ORDER BY day""", (user_id,)).fetchall()
        return {
            "totals": [dict(r) for r in totals],
            "recent": [dict(r) for r in recent],
            "daily": [dict(r) for r in daily]
        }

def get_all_words(user_id=1, status=None):
    _cols = """
        w.id, w.word,
        COALESCE(NULLIF(w.translation,''), c.translation, '') AS translation,
        w.status, w.source, w.user_id,
        w.added_date, w.last_reviewed, w.review_count, w.correct_count, w.learned_at,
        COALESCE(c.frequency_rank, w.frequency_rank, 9999) AS frequency_rank
    """
    with get_conn() as conn:
        if status:
            rows = conn.execute(f"""
                SELECT {_cols}
                FROM words w
                LEFT JOIN coca_words c ON c.word = w.word
                WHERE w.user_id=? AND w.status=?
                ORDER BY COALESCE(c.frequency_rank, w.frequency_rank, 9999)
            """, (user_id, status)).fetchall()
        else:
            rows = conn.execute(f"""
                SELECT {_cols}
                FROM words w
                LEFT JOIN coca_words c ON c.word = w.word
                WHERE w.user_id=?
                ORDER BY COALESCE(c.frequency_rank, w.frequency_rank, 9999)
            """, (user_id,)).fetchall()
        return [dict(r) for r in rows]

def backfill_word_ranks(user_id=None):
    """Uzupełnia frequency_rank dla słów które go nie mają (backfill z coca_words)."""
    with get_conn() as conn:
        if user_id:
            conn.execute("""
                UPDATE words SET frequency_rank = (
                    SELECT c.frequency_rank FROM coca_words c WHERE c.word = words.word
                ) WHERE user_id=? AND (frequency_rank IS NULL OR frequency_rank = 9999)
                  AND EXISTS (SELECT 1 FROM coca_words c WHERE c.word = words.word)
            """, (user_id,))
        else:
            conn.execute("""
                UPDATE words SET frequency_rank = (
                    SELECT c.frequency_rank FROM coca_words c WHERE c.word = words.word
                ) WHERE (frequency_rank IS NULL OR frequency_rank = 9999)
                  AND EXISTS (SELECT 1 FROM coca_words c WHERE c.word = words.word)
            """)
        return conn.execute("SELECT changes()").fetchone()[0]

def get_stats(user_id=1):
    from datetime import date
    today = date.today().isoformat()
    with get_conn() as conn:
        znam  = conn.execute("SELECT COUNT(*) as c FROM words WHERE status='ZNAM' AND user_id=?", (user_id,)).fetchone()["c"]
        troche= conn.execute("SELECT COUNT(*) as c FROM words WHERE status='TROCHE' AND user_id=?", (user_id,)).fetchone()["c"]
        nie   = conn.execute("SELECT COUNT(*) as c FROM words WHERE status='NIE_ZNAM' AND user_id=?", (user_id,)).fetchone()["c"]
        coca_t= conn.execute("SELECT COUNT(*) as c FROM coca_words").fetchone()["c"]
        coca_c= conn.execute("SELECT COUNT(*) as c FROM coca_words WHERE word IN (SELECT word FROM words WHERE user_id=?)", (user_id,)).fetchone()["c"]
        usr   = conn.execute("SELECT xp, level FROM users WHERE id=?", (user_id,)).fetchone()
        # Dzisiejsza aktywność (liczba sklasyfikowanych słów dzisiaj)
        try:
            today_cls = conn.execute(
                "SELECT COUNT(*) as c FROM user_history WHERE user_id=? AND date(timestamp)=?",
                (user_id, today)).fetchone()["c"]
        except Exception:
            today_cls = 0
        return {"znam":znam,"troche":troche,"nie_znam":nie,"total_classified":znam+troche+nie,
                "coca_total":coca_t,"coca_classified":coca_c,
                "xp": usr["xp"] if usr else 0, "level": usr["level"] if usr else "Beginner",
                "today_classified": today_cls}

def get_next_coca_batch(n=15, user_id=1):
    with get_conn() as conn:
        rows = conn.execute("""
            SELECT c.id,c.word,c.translation,c.frequency_rank FROM coca_words c
            WHERE c.word NOT IN (SELECT word FROM words WHERE user_id=?)
              AND c.word NOT IN (SELECT word FROM skipped_coca_words WHERE user_id=?)
            ORDER BY c.frequency_rank LIMIT ?""", (user_id, user_id, n)).fetchall()
        return [dict(r) for r in rows]

def skip_coca_word(word, user_id=1):
    """Pomiń słowo COCA — nie będzie się pojawiać w 'Nowe słowa'."""
    with get_conn() as conn:
        conn.execute("INSERT OR IGNORE INTO skipped_coca_words (user_id, word) VALUES (?,?)", (user_id, word))

def get_skipped_words(user_id=1):
    """Lista pominiętych słów COCA."""
    with get_conn() as conn:
        rows = conn.execute("SELECT word, skipped_at FROM skipped_coca_words WHERE user_id=? ORDER BY skipped_at DESC",
                            (user_id,)).fetchall()
        return [dict(r) for r in rows]

def unskip_coca_word(word, user_id=1):
    """Przywróć pominięte słowo do listy nowych."""
    with get_conn() as conn:
        conn.execute("DELETE FROM skipped_coca_words WHERE user_id=? AND word=?", (user_id, word))

def get_words_for_review(statuses=("NIE_ZNAM","TROCHE"), limit=20, user_id=1):
    ph = ",".join("?"*len(statuses))
    with get_conn() as conn:
        rows = conn.execute(
            # Recency Boost: słowa dawno niewidziane (lub nigdy) trafiają pierwsze.
            # Wśród słów widzianych w tym samym czasie — losowość zachowana.
            f"""SELECT * FROM words
                WHERE status IN ({ph}) AND translation!='' AND user_id=?
                ORDER BY COALESCE(last_reviewed, '2000-01-01') ASC, RANDOM()
                LIMIT ?""",
            (*statuses, user_id, limit)).fetchall()
        return [dict(r) for r in rows]

def search_words(query, user_id=1, status=None):
    q = f"%{query}%"
    with get_conn() as conn:
        if status:
            rows = conn.execute(
                "SELECT * FROM words WHERE (word LIKE ? OR translation LIKE ?) AND user_id=? AND status=? ORDER BY word LIMIT 50",
                (q, q, user_id, status)).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM words WHERE (word LIKE ? OR translation LIKE ?) AND user_id=? ORDER BY word LIMIT 50",
                (q, q, user_id)).fetchall()
        return [dict(r) for r in rows]

def update_review_result(word_id, correct, user_id=1):
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM words WHERE id=? AND user_id=?", (word_id, user_id)).fetchone()
        if not row: return
        rc = (row["review_count"] or 0) + 1
        cc = (row["correct_count"] or 0) + (1 if correct else 0)
        conn.execute("UPDATE words SET review_count=?,correct_count=?,last_reviewed=CURRENT_TIMESTAMP WHERE id=?", (rc,cc,word_id))

# ─── Sessions & Streak ────────────────────────────────────────────────────────
def add_session(exercise_type, words_practiced, correct, duration_sec, xp_earned, user_id=1):
    with get_conn() as conn:
        conn.execute("INSERT INTO sessions (user_id,exercise_type,words_practiced,correct,duration_sec,xp_earned) VALUES (?,?,?,?,?,?)",
                     (user_id, exercise_type, words_practiced, correct, duration_sec, xp_earned))
    add_xp(user_id, xp_earned)
    _update_streak(user_id)

def _update_streak(user_id):
    today = date.today().isoformat()
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM streak WHERE user_id=?", (user_id,)).fetchone()
        if not row:
            conn.execute("INSERT INTO streak (user_id,last_activity,current_streak,longest_streak) VALUES (?,?,1,1)", (user_id,today))
            return
        last, cur, longest = row["last_activity"], row["current_streak"], row["longest_streak"]
        if last == today: return
        cur = (cur + 1) if last == yesterday else 1
        longest = max(longest, cur)
        conn.execute("UPDATE streak SET last_activity=?,current_streak=?,longest_streak=? WHERE user_id=?", (today,cur,longest,user_id))

def get_streak(user_id=1):
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM streak WHERE user_id=?", (user_id,)).fetchone()
        return dict(row) if row else {"current_streak":0,"longest_streak":0}

def get_word_by_id(word_id, user_id=1):
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM words WHERE id=? AND user_id=?", (word_id, user_id)).fetchone()
        return dict(row) if row else None

# ─── Extended Stats ───────────────────────────────────────────────────────────
def get_words_to_review(user_id=1, limit=20):
    """Słowa wymagające powtórki: review_count>=2 i accuracy<60%"""
    with get_conn() as conn:
        rows = conn.execute("""
            SELECT id, word, translation, status, review_count, correct_count,
                   ROUND(CAST(correct_count AS FLOAT)/review_count*100) as accuracy
            FROM words
            WHERE user_id=? AND review_count>=2 AND CAST(correct_count AS FLOAT)/review_count < 0.6
            ORDER BY CAST(correct_count AS FLOAT)/review_count ASC, review_count DESC
            LIMIT ?""", (user_id, limit)).fetchall()
        return [dict(r) for r in rows]

def get_hardest_words(user_id=1, limit=10):
    """Najtrudniejsze słowa (najniższy % poprawności, min 1 próba)"""
    with get_conn() as conn:
        rows = conn.execute("""
            SELECT id, word, translation, status, review_count, correct_count,
                   ROUND(CAST(correct_count AS FLOAT)/review_count*100) as accuracy
            FROM words
            WHERE user_id=? AND review_count>=1
            ORDER BY CAST(correct_count AS FLOAT)/review_count ASC, review_count DESC
            LIMIT ?""", (user_id, limit)).fetchall()
        return [dict(r) for r in rows]

def get_accuracy_history(user_id=1, days=14):
    """Historia dokładności z ostatnich N dni"""
    with get_conn() as conn:
        rows = conn.execute("""
            SELECT DATE(session_date) as day,
                   SUM(words_practiced) as total,
                   SUM(correct) as correct,
                   SUM(xp_earned) as xp,
                   COUNT(*) as sessions
            FROM sessions
            WHERE user_id=?
              AND DATE(session_date) >= DATE('now', '-' || ? || ' days')
            GROUP BY DATE(session_date)
            ORDER BY day""", (user_id, days)).fetchall()
        return [dict(r) for r in rows]

def get_exercise_accuracy(user_id=1):
    """Dokładność per typ ćwiczenia"""
    with get_conn() as conn:
        rows = conn.execute("""
            SELECT exercise_type,
                   COUNT(*) as sessions,
                   SUM(words_practiced) as total_words,
                   SUM(correct) as total_correct,
                   ROUND(CAST(SUM(correct) AS FLOAT)/NULLIF(SUM(words_practiced),0)*100) as accuracy
            FROM sessions
            WHERE user_id=?
            GROUP BY exercise_type""", (user_id,)).fetchall()
        return [dict(r) for r in rows]

def get_vocabulary_chart(user_id=1):
    """Wykres znajomości słownika wg tierów COCA (TOP 100 / 500 / 1000 / 2000 / 3000)."""
    tiers = [
        ("top100",  1,    100),
        ("top500",  101,  500),
        ("top1000", 501,  1000),
        ("top2000", 1001, 2000),
        ("top3000", 2001, 3000),
    ]
    result = []
    with get_conn() as conn:
        for label, lo, hi in tiers:
            total = conn.execute(
                "SELECT COUNT(*) as c FROM coca_words WHERE frequency_rank BETWEEN ? AND ?",
                (lo, hi)
            ).fetchone()["c"]
            counts = conn.execute("""
                SELECT w.status, COUNT(*) as c
                FROM words w
                JOIN coca_words c ON c.word = w.word
                WHERE w.user_id=? AND c.frequency_rank BETWEEN ? AND ?
                GROUP BY w.status
            """, (user_id, lo, hi)).fetchall()
            by_status = {r["status"]: r["c"] for r in counts}
            result.append({
                "label": label,
                "range": f"#{lo}–#{hi}",
                "total": total,
                "znam":     by_status.get("ZNAM", 0),
                "troche":   by_status.get("TROCHE", 0),
                "nie_znam": by_status.get("NIE_ZNAM", 0),
            })
    return result

_FUN_FACTS = [
    "To jedno z najczesciej uzywanych slow w amerykanskim angielskim!",
    "Uslyszysz je w prawie kazdej angielskiej rozmowie.",
    "Znajomosc tego slowa znacznie ulatwia rozumienie filmow i seriali.",
    "To slowo pojawia sie srednio kilkaset razy na kazde 100 000 slow tekstu.",
    "Opanuj to slowo - uzywa go kazdy rodzimy mowca angielskiego!",
    "W top 1000 slow COCA - fundament anglojezycznej komunikacji.",
    "Bez tego slowa trudno wyrazic wiele codziennych mysli po angielsku.",
    "Znajomosc 1000 takich slow = rozumiesz 85% codziennych rozmow.",
]

def get_word_of_day():
    """Zwraca Slowo Dnia - cachowane per data. Bez Gemini API."""
    import hashlib
    from datetime import date
    today = date.today().isoformat()
    with get_conn() as conn:
        cached = conn.execute(
            "SELECT * FROM word_of_day WHERE wod_date=?", (today,)
        ).fetchone()
        if cached:
            return dict(cached)
        # Wylonij slowo na podstawie daty (deterministycznie)
        words = conn.execute(
            "SELECT word, translation, frequency_rank FROM coca_words "
            "WHERE frequency_rank BETWEEN 200 AND 1500 ORDER BY frequency_rank"
        ).fetchall()
        if not words:
            return None
        # Seed z daty - zawsze to samo slowo dla danego dnia
        seed = int(hashlib.md5(today.encode()).hexdigest(), 16)
        w = words[seed % len(words)]
        fact = _FUN_FACTS[seed % len(_FUN_FACTS)]
        conn.execute(
            "INSERT OR IGNORE INTO word_of_day (wod_date, word, translation, rank, fun_fact) VALUES (?,?,?,?,?)",
            (today, w["word"], w["translation"], w["frequency_rank"], fact)
        )
        return {
            "wod_date": today, "word": w["word"],
            "translation": w["translation"], "rank": w["frequency_rank"],
            "fun_fact": fact
        }


# ─── DAILY QUESTS ─────────────────────────────────────────────────────────────
import hashlib as _hashlib
from datetime import date as _date

_QUEST_POOL = [] # Legacy pool, quests generated inline below

def _get_daily_quests_def(today_str):
    """Zwraca 3 definicje misji na dany dzien (deterministycznie z daty)."""
    seed = int(_hashlib.md5(today_str.encode()).hexdigest(), 16)
    chosen = []
    
    # Quest 1: Classify (20, 50, or 100 words)
    classify_targets = [20, 50, 100]
    classify_xps = [50, 100, 180]
    c_idx = seed % len(classify_targets)
    chosen.append({
        "type": "classify",
        "desc": f"Sklasyfikuj {classify_targets[c_idx]} nowych slow",
        "target": classify_targets[c_idx],
        "xp": classify_xps[c_idx],
        "icon": "🔍"
    })
    
    # Quest 2: Session (exactly 2 exercises)
    chosen.append({
        "type": "session",
        "desc": "Ukoncz 2 cwiczenia",
        "target": 2,
        "xp": 70,
        "icon": "🏋️"
    })
    
    # Quests 3, 4, 5: Rotating quests from other activities
    pool = [
        {"type": "speed_round",     "desc": "Ukoncz Speed Round",       "target": 1, "xp": 60, "icon": "⚡"},
        {"type": "srs",             "desc": "Ukoncz powtorke SRS",      "target": 1, "xp": 60, "icon": "🧠"},
        {"type": "match_pairs",     "desc": "Ukoncz Dopasuj pary",      "target": 1, "xp": 50, "icon": "🔗"},
        {"type": "fill_blank",      "desc": "Ukoncz Test pisowni",      "target": 1, "xp": 60, "icon": "✍️"},
        {"type": "super_quiz",      "desc": "Ukoncz Super-Quiz",        "target": 1, "xp": 75, "icon": "🏆"},
        {"type": "quick_challenge", "desc": "Ukoncz Szybkie Wyzwanie",  "target": 1, "xp": 60, "icon": "⏱️"},
        {"type": "daily_fact",      "desc": "Ukoncz Ciekawostke Dnia",  "target": 1, "xp": 70, "icon": "🧪"},
        {"type": "sentence_builder","desc": "Ukoncz Budowanie zdan",    "target": 1, "xp": 60, "icon": "🔤"},
        {"type": "hands_free",      "desc": "Ukoncz Audionauke",        "target": 1, "xp": 50, "icon": "🎧"},
        {"type": "promote_words",   "desc": "Przenies 3 slowa do Poznalem", "target": 3, "xp": 100, "icon": "🎓"},
    ]
    
    chosen_indices = []
    temp_seed = seed
    while len(chosen_indices) < 3:
        idx = temp_seed % len(pool)
        if idx not in chosen_indices:
            chosen_indices.append(idx)
        temp_seed = temp_seed >> 4
        if temp_seed == 0:
            temp_seed = seed + len(chosen_indices)
            
    for idx in chosen_indices:
        q = pool[idx]
        chosen.append({
            "type": q["type"],
            "desc": q["desc"],
            "target": q["target"],
            "xp": q["xp"],
            "icon": q["icon"]
        })
    return chosen

def _ensure_quests_table(conn):
    conn.execute("""CREATE TABLE IF NOT EXISTS daily_quests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER, quest_date TEXT,
        quest_type TEXT, description TEXT, icon TEXT,
        target INTEGER, progress INTEGER DEFAULT 0,
        completed INTEGER DEFAULT 0, xp_reward INTEGER
    )""")
    # Migracja dla starszych wersji bazy
    if not _col_exists(conn, "daily_quests", "icon"):
        conn.execute("ALTER TABLE daily_quests ADD COLUMN icon TEXT DEFAULT '🎯'")
    if not _col_exists(conn, "daily_quests", "xp_reward"):
        conn.execute("ALTER TABLE daily_quests ADD COLUMN xp_reward INTEGER DEFAULT 50")


def get_daily_quests(user_id=1):
    """Zwraca misje na dzis. Tworzy jesli nie istnieja."""
    today = _date.today().isoformat()
    with get_conn() as conn:
        _ensure_quests_table(conn)
        rows = conn.execute(
            "SELECT * FROM daily_quests WHERE user_id=? AND quest_date=? ORDER BY id",
            (user_id, today)
        ).fetchall()
        if rows and len(rows) < 5:
            conn.execute("DELETE FROM daily_quests WHERE user_id=? AND quest_date=?", (user_id, today))
            rows = []
        if not rows:
            defs = _get_daily_quests_def(today)
            for d in defs:
                conn.execute(
                    "INSERT INTO daily_quests (user_id,quest_date,quest_type,description,icon,target,progress,completed,xp_reward) VALUES (?,?,?,?,?,?,0,0,?)",
                    (user_id, today, d["type"], d["desc"], d["icon"], d["target"], d["xp"])
                )
            rows = conn.execute(
                "SELECT * FROM daily_quests WHERE user_id=? AND quest_date=? ORDER BY id",
                (user_id, today)
            ).fetchall()
        return [dict(r) for r in rows]

def update_quest_progress(user_id, quest_type, amount=1):
    """Aktualizuje postep misji. Zwraca liste nowo ukonczonych misji [{desc, xp, icon}]."""
    today = _date.today().isoformat()
    completed_now = []
    with get_conn() as conn:
        _ensure_quests_table(conn)
        rows = conn.execute(
            "SELECT * FROM daily_quests WHERE user_id=? AND quest_date=? AND quest_type=? AND completed=0",
            (user_id, today, quest_type)
        ).fetchall()
        for row in rows:
            new_progress = min(row["progress"] + amount, row["target"])
            newly_done = new_progress >= row["target"]
            conn.execute(
                "UPDATE daily_quests SET progress=?, completed=? WHERE id=?",
                (new_progress, 1 if newly_done else 0, row["id"])
            )
            if newly_done:
                completed_now.append({"desc": row["description"], "xp": row["xp_reward"], "icon": row["icon"]})
    return completed_now


# ─── ACHIEVEMENTS / BADGES ────────────────────────────────────────────────────
_ALL_BADGES = [
    ("first_step",       "🎉", "Pierwszy krok",       "Sklasyfikuj pierwsze slowo"),
    ("classified_50",    "📚", "Piecdziesiatka",       "50 slow sklasyfikowanych"),
    ("classified_200",   "📖", "Bibliofil",            "200 slow sklasyfikowanych"),
    ("classified_500",   "🎓", "Slownikarz",           "500 slow sklasyfikowanych"),
    ("learned_10",       "⭐", "Pierwsze kroki",       "10 slow w kategorii Znam"),
    ("learned_100",      "🏅", "Setka",                "100 slow w kategorii Znam"),
    ("learned_500",      "🏆", "Polfinalista",         "500 slow w kategorii Znam"),
    ("top100_complete",  "👑", "TOP 100",              "Znasz wszystkie slowa z TOP 100 COCA"),
    ("streak_3",         "🔥", "Seria 3 dni",          "3 dni nauki z rzedu"),
    ("streak_7",         "🔥🔥", "Tygodnik",           "7 dni nauki z rzedu"),
    ("streak_30",        "💎", "Miesiac nauki",        "30 dni nauki z rzedu"),
    ("early_bird",       "🌅", "Ranny ptaszek",        "Nauka przed godz. 8:00"),
    ("night_owl",        "🌙", "Nocna sowa",           "Nauka po godz. 23:00"),
    ("perfect_session",  "🎯", "Perfekcja",            "100% poprawnych w sesji (min 5 slow)"),
    ("speed_ace",        "⚡", "Blyskawtca",           "20+ poprawnych w Speed Round"),
]

def _ensure_achievements_table(conn):
    conn.execute("""CREATE TABLE IF NOT EXISTS achievements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER, badge_id TEXT,
        earned_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, badge_id)
    )""")

def check_and_award_badges(user_id=1, session_correct=None, session_words=None, session_type=None):
    """Sprawdza warunki odznak i przyznaje nowe. Zwraca liste nowo zdobytych."""
    from datetime import datetime
    hour = datetime.now().hour
    earned_new = []
    with get_conn() as conn:
        _ensure_achievements_table(conn)
        classified = conn.execute("SELECT COUNT(*) as c FROM words WHERE user_id=?", (user_id,)).fetchone()["c"]
        znam = conn.execute("SELECT COUNT(*) as c FROM words WHERE user_id=? AND status='ZNAM'", (user_id,)).fetchone()["c"]
        streak_row = conn.execute("SELECT current_streak FROM streak WHERE user_id=?", (user_id,)).fetchone()
        streak_val = streak_row["current_streak"] if streak_row else 0
        top100_total = conn.execute("SELECT COUNT(*) as c FROM coca_words WHERE frequency_rank<=100").fetchone()["c"]
        top100_known = conn.execute("""
            SELECT COUNT(*) as c FROM words w
            JOIN coca_words c ON c.word=w.word
            WHERE w.user_id=? AND w.status='ZNAM' AND c.frequency_rank<=100
        """, (user_id,)).fetchone()["c"]
        perfect = (session_correct is not None and session_words is not None
                   and session_words >= 5 and session_correct == session_words)
        speed_ace = (session_type == "speed_round" and session_correct is not None and session_correct >= 20)
        conditions = {
            "first_step":      classified >= 1,
            "classified_50":   classified >= 50,
            "classified_200":  classified >= 200,
            "classified_500":  classified >= 500,
            "learned_10":      znam >= 10,
            "learned_100":     znam >= 100,
            "learned_500":     znam >= 500,
            "top100_complete": top100_total > 0 and top100_known >= top100_total,
            "streak_3":        streak_val >= 3,
            "streak_7":        streak_val >= 7,
            "streak_30":       streak_val >= 30,
            "early_bird":      5 <= hour < 8,
            "night_owl":       hour >= 23 or hour < 2,
            "perfect_session": perfect,
            "speed_ace":       speed_ace,
        }
        already = {r["badge_id"] for r in conn.execute(
            "SELECT badge_id FROM achievements WHERE user_id=?", (user_id,)
        ).fetchall()}
        badge_map = {b[0]: b for b in _ALL_BADGES}
        for badge_id, met in conditions.items():
            if met and badge_id not in already:
                conn.execute("INSERT OR IGNORE INTO achievements (user_id, badge_id) VALUES (?,?)", (user_id, badge_id))
                b = badge_map[badge_id]
                earned_new.append({"badge_id": b[0], "icon": b[1], "name": b[2], "desc": b[3]})
    return earned_new

def get_achievements(user_id=1):
    """Zwraca pelna liste odznak z informacja czy zdobyta."""
    with get_conn() as conn:
        _ensure_achievements_table(conn)
        earned_map = {r["badge_id"]: r["earned_at"] for r in conn.execute(
            "SELECT badge_id, earned_at FROM achievements WHERE user_id=?", (user_id,)
        ).fetchall()}
    result = []
    for badge_id, icon, name, desc in _ALL_BADGES:
        result.append({
            "badge_id": badge_id, "icon": icon, "name": name, "desc": desc,
            "earned": badge_id in earned_map,
            "earned_at": earned_map.get(badge_id)
        })
    return result


# ─── SRS (SPACED REPETITION – SM-2) ──────────────────────────────────────────
def _ensure_srs_table(conn):
    conn.execute("""CREATE TABLE IF NOT EXISTS srs_cards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER, word_id INTEGER, word TEXT, translation TEXT,
        ef REAL DEFAULT 2.5,
        interval INTEGER DEFAULT 1,
        repetitions INTEGER DEFAULT 0,
        next_review TEXT DEFAULT (date('now')),
        last_review TEXT,
        UNIQUE(user_id, word_id)
    )""")

def _sm2(ef, interval, repetitions, quality):
    """SM-2 algorithm. quality: 0=brak,1=nie wiem,3=trudne,4=dobrze,5=latwo"""
    if quality >= 3:
        if repetitions == 0:
            new_interval = 1
        elif repetitions == 1:
            new_interval = 6
        else:
            new_interval = max(1, round(interval * ef))
        new_ef = max(1.3, ef + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
        new_reps = repetitions + 1
    else:
        # Zle / nie wiem – resetuj powtorzenia, ale skroc interwal (nie cale 0)
        new_reps = 0
        new_interval = 1
        new_ef = max(1.3, ef - 0.2)
    return new_ef, new_interval, new_reps

def seed_srs_for_user(user_id=1):
    """Dodaje do SRS slowa NIE_ZNAM i TROCHE (te ktorych sie uczymy). Usuwa ZNAM (juz znane)."""
    with get_conn() as conn:
        _ensure_srs_table(conn)
        # Dodaj TYLKO nowe slowa (nie nadpisuj juz istniejacych/ocenianych kart!)
        # Nowe karty dostaja next_review = today (nie resetujemy starych)
        conn.execute("""
            INSERT OR IGNORE INTO srs_cards (user_id, word_id, word, translation, next_review)
            SELECT w.user_id, w.id, w.word,
                   COALESCE(NULLIF(w.translation,''), c.translation, w.translation),
                   date('now')
            FROM words w
            LEFT JOIN coca_words c ON c.word = w.word
            WHERE w.user_id=? AND w.status IN ('NIE_ZNAM','TROCHE')
        """, (user_id,))
        # Usun ze SRS slowa ktore awansowaly na ZNAM
        conn.execute("""
            DELETE FROM srs_cards
            WHERE user_id=? AND word_id IN (
                SELECT id FROM words WHERE user_id=? AND status='ZNAM'
            )
        """, (user_id, user_id))

def get_srs_due(user_id=1, limit=20):
    """Zwraca slowa do powtorki (next_review <= dzis), seeduje jesli brak."""
    from datetime import date
    seed_srs_for_user(user_id)
    today = date.today().isoformat()
    with get_conn() as conn:
        _ensure_srs_table(conn)
        # Priorytet: najpierw zaleglosci (najstarsze), potem dzisiejsze – ale w losowej kolejnosci
        # Dzieki temu sesja nie wyglada tak samo za kazdym razem
        rows = conn.execute("""
            SELECT s.id as srs_id, s.word_id, s.word, s.translation,
                   s.ef, s.interval, s.repetitions, s.next_review
            FROM srs_cards s
            WHERE s.user_id=? AND s.next_review <= ?
            ORDER BY s.next_review ASC, RANDOM()
            LIMIT ?
        """, (user_id, today, limit)).fetchall()
        return [dict(r) for r in rows]

def get_srs_due_count(user_id=1):
    """Ile slow czeka na powtorke dzisiaj."""
    from datetime import date
    seed_srs_for_user(user_id)
    today = date.today().isoformat()
    with get_conn() as conn:
        _ensure_srs_table(conn)
        return conn.execute(
            "SELECT COUNT(*) as c FROM srs_cards WHERE user_id=? AND next_review<=?",
            (user_id, today)
        ).fetchone()["c"]

def update_srs(user_id, srs_id, quality):
    """Aktualizuje karte SRS po ocenie (0-5). Zwraca nowy next_review."""
    from datetime import date, timedelta
    with get_conn() as conn:
        _ensure_srs_table(conn)
        row = conn.execute("SELECT * FROM srs_cards WHERE id=? AND user_id=?", (srs_id, user_id)).fetchone()
        if not row:
            return None
        new_ef, new_interval, new_reps = _sm2(row["ef"], row["interval"], row["repetitions"], quality)
        # Przy jakosci >= 3 i powtorzeniu >= 1: interwal rosnie powyzej 1
        # Jesli quality < 3 (reset), zaplanuj na jutro
        next_rev = (date.today() + timedelta(days=new_interval)).isoformat()
        conn.execute("""
            UPDATE srs_cards SET ef=?, interval=?, repetitions=?, next_review=?, last_review=date('now')
            WHERE id=?
        """, (new_ef, new_interval, new_reps, next_rev, srs_id))
        conn.commit()
        return {"next_review": next_rev, "interval": new_interval, "ef": round(new_ef,2)}
