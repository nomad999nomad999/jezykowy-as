import sqlite3
import os
import json

# Ścieżka do bazy danych
db_path = os.path.join(os.path.dirname(__file__), "data", "words.db")
static_dir = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(static_dir, exist_ok=True)

print(f"Łączenie z bazą danych: {db_path}")
if not os.path.exists(db_path):
    print("BŁĄD: Baza danych nie istnieje!")
    exit(1)

conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row

# 1. Eksport coca_words
print("Eksportowanie słów COCA...")
coca_rows = conn.execute("SELECT word, translation, frequency_rank FROM coca_words").fetchall()
coca_words = [dict(r) for r in coca_rows]
coca_out_path = os.path.join(static_dir, "coca_words.json")
with open(coca_out_path, "w", encoding="utf-8") as f:
    json.dump(coca_words, f, ensure_ascii=False, indent=2)
print(f"Wyeksportowano {len(coca_words)} słów COCA do {coca_out_path}")

# 2. Eksport postępu wybranych użytkowników (Adrian i Madzia)
print("Eksportowanie postępu wybranych użytkowników...")
users_rows = conn.execute("SELECT id, username, xp, level FROM users WHERE LOWER(username) IN ('adrian', 'madzia')").fetchall()

profiles = {}

for u_row in users_rows:
    uid = u_row["id"]
    username = u_row["username"]
    user_dict = dict(u_row)
    print(f"Eksportowanie użytkownika: {username} (ID: {uid})...")
    
    words_rows = conn.execute(
        "SELECT word, translation, status, source, added_date, last_reviewed, review_count, correct_count, learned_at, frequency_rank "
        "FROM words WHERE user_id=?", (uid,)
    ).fetchall()
    words = [dict(r) for r in words_rows]
    
    sessions_rows = conn.execute(
        "SELECT session_date, exercise_type, words_practiced, correct, duration_sec, xp_earned "
        "FROM sessions WHERE user_id=?", (uid,)
    ).fetchall()
    sessions = [dict(r) for r in sessions_rows]
    
    streak_row = conn.execute(
        "SELECT last_activity, current_streak, longest_streak "
        "FROM streak WHERE user_id=?", (uid,)
    ).fetchone()
    streak = dict(streak_row) if streak_row else {"current_streak": 0, "longest_streak": 0, "last_activity": None}
    
    achievements_rows = conn.execute(
        "SELECT badge_id, earned_at "
        "FROM achievements WHERE user_id=?", (uid,)
    ).fetchall()
    achievements = [dict(r) for r in achievements_rows]
    
    skipped_rows = conn.execute(
        "SELECT word, skipped_at "
        "FROM skipped_coca_words WHERE user_id=?", (uid,)
    ).fetchall()
    skipped_coca_words = [dict(r) for r in skipped_rows]
    
    srs_rows = conn.execute(
        "SELECT word_id, word, translation, ef, interval, repetitions, next_review, last_review "
        "FROM srs_cards WHERE user_id=?", (uid,)
    ).fetchall()
    srs_cards = [dict(r) for r in srs_rows]
    
    profiles[str(uid)] = {
        "user": user_dict,
        "words": words,
        "sessions": sessions,
        "streak": streak,
        "achievements": achievements,
        "skipped_coca_words": skipped_coca_words,
        "srs_cards": srs_cards
    }

progress_out_path = os.path.join(static_dir, "initial_progress.json")
with open(progress_out_path, "w", encoding="utf-8") as f:
    json.dump(profiles, f, ensure_ascii=False, indent=2)

print(f"Pomyślnie wyeksportowano {len(profiles)} profili do {progress_out_path}")
conn.close()
print("Eksport zakończony pomyślnie!")
