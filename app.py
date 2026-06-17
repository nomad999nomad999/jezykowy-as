"""
Flask backend – multi-user + XP + leaderboard
"""
import os, random
from flask import Flask, jsonify, request, send_from_directory, session
from flask_cors import CORS
from dotenv import load_dotenv
import database as db
import gemini_tasks as gemini
from importer import load_all_to_db
from coca_words import COCA_WORDS, TOP_BASIC_WORDS

load_dotenv()
app = Flask(__name__, static_folder="static", static_url_path="")
app.secret_key = os.getenv("SECRET_KEY", "angielski-secret-2026")
CORS(app, supports_credentials=True)

# XP za jedno poprawne słowo w sesji ćwiczeń
# Sesja ~15 słów × XP_PER_CORRECT → typowe zarobki per sesja:
# fiszki: 15×3=45 XP, wybór: 15×4=60 XP, luka: 15×6=90 XP, AI: 15×8=120 XP
# Awans TROCHE→ZNAM: 150 XP → wyraźnie więcej niż 1 sesja fiszek
XP_TABLE = {
    "flashcards": 3,        # prosta weryfikacja
    "multiple_choice": 4,   # 4 opcje do wyboru
    "fill_blank": 6,        # wpisanie słowa z pamięci
    "match_pairs": 4,       # dopasowanie
    "speed_round": 5,       # czas gra rolę
    "context": 8,           # najtrudniejsze – AI + kontekst
    "hands_free": 2,        # bezdotykowa audionauka
    "quick_challenge": 5,   # tryb szybkich wyzwań (arcade)
    "srs": 4,               # powiórka SRS – XP przekazywane z frontendu
    "sentence_builder": 5,  # budowanie zdań z rozsypanych słów
    "daily_fact": 8,        # ciekawostka dnia – xp z frontendu
    "rpg_adventure": 10,    # interaktywna przygoda RPG
    "dialogue": 8,          # symulator rozmówek (głosowy) - xp per wypowiedź
}

def _uid():
    """Pobiera user_id z nagłówka lub sesji."""
    uid = request.headers.get("X-User-Id") or request.args.get("uid")
    try: return int(uid)
    except: return None

def _require_user():
    uid = _uid()
    if not uid: return None, jsonify({"error": "Nie zalogowany"}), 401
    user = db.get_user_by_id(uid)
    if not user: return None, jsonify({"error": "Użytkownik nie istnieje"}), 401
    return user, None, None

@app.before_request
def setup():
    if not hasattr(app, "_initialized"):
        db.init_db()
        # Tylko jeśli tabela coca_words jest pusta/niepełna, ładujemy domyślny backup
        with db.get_conn() as conn:
            coca_count = conn.execute("SELECT COUNT(*) FROM coca_words").fetchone()[0]
        if coca_count < 1000:
            db.load_coca_words(COCA_WORDS)
            db.load_basic_words(TOP_BASIC_WORDS)
        load_all_to_db(db)
        db.ensure_adrian()
        db.backfill_word_ranks()
        app._initialized = True

@app.route("/")
def index():
    return send_from_directory("static", "index.html")

@app.route("/favicon.ico")
def favicon():
    from flask import Response
    svg = b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">\xf0\x9f\x93\x96</text></svg>'
    return Response(svg, mimetype="image/svg+xml")

@app.route("/<path:filename>")
def static_files(filename):
    """Serwuje pliki statyczne z nagłówkami no-cache dla JS/CSS."""
    from flask import make_response
    response = make_response(send_from_directory("static", filename))
    # Wyłącz cache dla plików JS/CSS — zawsze świeże
    if filename.endswith(('.js', '.css', '.html')):
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
    return response


# ─── Account Picker ────────────────────────────────────────────────────────────
@app.route("/api/auth/users")
def list_users():
    return jsonify(db.get_all_users())

@app.route("/api/auth/select", methods=["POST"])
def select_user():
    uid = request.json.get("user_id")
    user = db.get_user_by_id(uid)
    if not user:
        return jsonify({"error": "Nie znaleziono konta"}), 404
    return jsonify({"ok": True, "user_id": user["id"], "username": user["username"],
                    "xp": user["xp"], "level": user["level"]})

@app.route("/api/auth/create", methods=["POST"])
def create_account():
    name = (request.json.get("username") or "").strip()
    if not name:
        return jsonify({"error": "Podaj imię"}), 400
    uid = db.create_user(name)
    if uid is None:
        return jsonify({"error": "Ta nazwa jest już zajęta"}), 409
    return jsonify({"ok": True, "user_id": uid, "username": name, "xp": 0, "level": "Beginner"})

# ─── Stats ─────────────────────────────────────────────────────────────────────
@app.route("/api/stats")
def stats():
    user, err, code = _require_user()
    if err: return err, code
    return jsonify({**db.get_stats(user["id"]), "streak": db.get_streak(user["id"])})

@app.route("/api/leaderboard")
def leaderboard():
    return jsonify(db.get_leaderboard())

@app.route("/api/stats/review")
def stats_review():
    user, err, code = _require_user()
    if err: return err, code
    return jsonify(db.get_words_to_review(user["id"]))

@app.route("/api/stats/hardest")
def stats_hardest():
    user, err, code = _require_user()
    if err: return err, code
    return jsonify(db.get_hardest_words(user["id"]))

@app.route("/api/stats/history")
def stats_history():
    user, err, code = _require_user()
    if err: return err, code
    days = int(request.args.get("days", 14))
    return jsonify(db.get_accuracy_history(user["id"], days))

@app.route("/api/stats/exercises")
def stats_exercises():
    user, err, code = _require_user()
    if err: return err, code
    return jsonify(db.get_exercise_accuracy(user["id"]))

@app.route("/api/stats/promotions")
def stats_promotions():
    user, err, code = _require_user()
    if err: return err, code
    return jsonify(db.get_promotion_stats(user["id"]))

# ─── Words ─────────────────────────────────────────────────────────────────────
@app.route("/api/words")
def words():
    user, err, code = _require_user()
    if err: return err, code
    status = request.args.get("status")
    return jsonify(db.get_all_words(user["id"], status=status))

@app.route("/api/admin/backfill-ranks", methods=["POST"])
def backfill_ranks():
    """Uzupełnia rangi COCA dla istniejących słów w listach."""
    user, err, code = _require_user()
    if err: return err, code
    count = db.backfill_word_ranks(user["id"])
    return jsonify({"ok": True, "updated": count})

@app.route("/api/words/search")
def search():
    user, err, code = _require_user()
    if err: return err, code
    status = request.args.get("status")  # opcjonalny filtr statusu
    return jsonify(db.search_words(request.args.get("q",""), user["id"], status=status))

@app.route("/api/words/learned")
def words_learned():
    user, err, code = _require_user()
    if err: return err, code
    return jsonify(db.get_learned_words(user["id"]))

@app.route("/api/words/<int:word_id>/status", methods=["POST"])
def update_status(word_id):
    user, err, code = _require_user()
    if err: return err, code
    result = db.update_status(word_id, request.json["status"], user["id"])
    return jsonify({"ok": True, **result})

@app.route("/api/words/<int:word_id>/delete", methods=["POST"])
def delete_word(word_id):
    user, err, code = _require_user()
    if err: return err, code
    db.delete_word(word_id, user["id"])
    return jsonify({"ok": True})

# ─── COCA classify ─────────────────────────────────────────────────────────────
@app.route("/api/classify/batch")
def classify_batch():
    user, err, code = _require_user()
    if err: return err, code
    n = int(request.args.get("n", 15))
    return jsonify(db.get_next_coca_batch(n, user["id"]))

@app.route("/api/classify/word", methods=["POST"])
def classify_word():
    user, err, code = _require_user()
    if err: return err, code
    data = request.json
    db.add_word(data["word"].strip().lower(), data.get("translation",""), data["status"], "coca", user["id"])
    xp, lvl, actual, mult = db.add_xp(user["id"], 2)
    total = db.get_classified_count(user["id"])
    milestone = None
    if total > 0 and total % 50 == 0:
        milestone = {"count": total}
    quests_done = db.update_quest_progress(user["id"], "classify", 1)
    badges_earned = db.check_and_award_badges(user["id"])
    return jsonify({"ok": True, "xp": actual, "total_xp": xp, "milestone": milestone,
                    "quests_done": quests_done, "badges_earned": badges_earned})

@app.route("/api/classify/skip", methods=["POST"])
def skip_word():
    user, err, code = _require_user()
    if err: return err, code
    word = request.json.get("word","").strip().lower()
    if word:
        db.skip_coca_word(word, user["id"])
    return jsonify({"ok": True})

@app.route("/api/classify/skipped")
def skipped_words():
    user, err, code = _require_user()
    if err: return err, code
    return jsonify(db.get_skipped_words(user["id"]))

@app.route("/api/classify/unskip", methods=["POST"])
def unskip_word():
    user, err, code = _require_user()
    if err: return err, code
    word = request.json.get("word","").strip().lower()
    if word:
        db.unskip_coca_word(word, user["id"])
    return jsonify({"ok": True})

# ─── Exercises ─────────────────────────────────────────────────────────────────
@app.route("/api/exercise/flashcards")
def flashcards():
    user, err, code = _require_user()
    if err: return err, code
    return jsonify(db.get_words_for_review(("NIE_ZNAM","TROCHE"), 15, user["id"]))

@app.route("/api/exercise/multiple_choice")
def multiple_choice():
    user, err, code = _require_user()
    if err: return err, code
    words = db.get_words_for_review(("NIE_ZNAM","TROCHE"), 10, user["id"])
    pool = [w["translation"] for w in db.get_words_for_review(("NIE_ZNAM","TROCHE","ZNAM"), 60, user["id"]) if w["translation"]]
    result = []
    for w in words:
        wrong = [t for t in pool if t != w["translation"]]
        random.shuffle(wrong)
        opts = [w["translation"]] + wrong[:3]; random.shuffle(opts)
        result.append({**w, "options": opts})
    return jsonify(result)

@app.route("/api/exercise/match_pairs")
def match_pairs():
    user, err, code = _require_user()
    if err: return err, code
    return jsonify(db.get_words_for_review(("NIE_ZNAM","TROCHE"), 6, user["id"]))

@app.route("/api/exercise/speed_round")
def speed_round():
    user, err, code = _require_user()
    if err: return err, code
    words = db.get_words_for_review(("NIE_ZNAM","TROCHE"), 30, user["id"])
    pool = [w["translation"] for w in db.get_words_for_review(("NIE_ZNAM","TROCHE","ZNAM"), 60, user["id"]) if w["translation"]]
    result = []
    for w in words:
        wrong = [t for t in pool if t != w["translation"]]
        random.shuffle(wrong)
        opts = [w["translation"]] + wrong[:3]; random.shuffle(opts)
        result.append({**w, "options": opts})
    return jsonify(result)

# ─── Gemini ────────────────────────────────────────────────────────────────────
@app.route("/api/gemini/sentence")
def gemini_sentence():
    return jsonify(gemini.generate_example_sentence(request.args.get("word",""), request.args.get("translation","")))

@app.route("/api/gemini/fill_blank")
def gemini_fill():
    return jsonify(gemini.generate_fill_blank(request.args.get("word",""), request.args.get("translation","")))

@app.route("/api/gemini/context")
def gemini_context():
    user, err, code = _require_user()
    if err: return err, code
    word = request.args.get("word",""); translation = request.args.get("translation","")
    pool = db.get_words_for_review(("NIE_ZNAM","TROCHE"), 10, user["id"])
    distractors = [w["translation"] for w in pool if w["translation"] and w["word"] != word][:3]
    return jsonify(gemini.generate_context_challenge(word, translation, distractors))

@app.route("/api/gemini/sentence_builder")
def gemini_sentence_builder():
    word = request.args.get("word", "")
    translation = request.args.get("translation", "")
    return jsonify(gemini.generate_sentence_builder(word, translation))

@app.route("/api/gemini/rpg_adventure", methods=["POST"])
def gemini_rpg_adventure():
    data = request.json or {}
    theme = data.get("theme", "Space Odyssey")
    stage = int(data.get("stage", 1))
    previous_story = data.get("previous_story", "")
    target_word = data.get("word", "")
    target_translation = data.get("translation", "")
    return jsonify(gemini.generate_rpg_step(theme, stage, previous_story, target_word, target_translation))

@app.route("/api/exercise/daily_fact")
def daily_fact():
    user, err, code = _require_user()
    if err: return err, code
    category = request.args.get("category", "biology")
    cats = {
        "biology": ("Biology", "Biologia"),
        "evolutionary_biology": ("Evolutionary Biology", "Biologia ewolucyjna"),
        "nature": ("Nature", "Przyroda"),
        "physics": ("Physics", "Fizyka"),
        "technology": ("Technology", "Technika"),
    }
    cat_en, cat_pl = cats.get(category, ("Biology", "Biologia"))
    # Pula słów: priorytetyzujemy NIE_ZNAM, TROCHE oraz słowa wyuczone (ZNAM z learned_at IS NOT NULL)
    with db.get_conn() as conn:
        rows = conn.execute(
            """SELECT * FROM words
               WHERE user_id = ? AND translation != ''
                 AND (status IN ('NIE_ZNAM', 'TROCHE') OR (status = 'ZNAM' AND learned_at IS NOT NULL))
               ORDER BY COALESCE(last_reviewed, '2000-01-01') ASC, RANDOM()
               LIMIT 20""",
            (user["id"],)
        ).fetchall()
        pool = [dict(r) for r in rows]

    if len(pool) < 15:
        # Dobierz ze zwykłego ZNAM (gdzie learned_at jest NULL) jako fallback
        needed = 20 - len(pool)
        with db.get_conn() as conn:
            extra = conn.execute(
                """SELECT * FROM words
                   WHERE user_id = ? AND translation != ''
                     AND status = 'ZNAM' AND learned_at IS NULL
                   ORDER BY COALESCE(last_reviewed, '2000-01-01') ASC, RANDOM()
                   LIMIT ?""",
                (user["id"], needed)
            ).fetchall()
            pool.extend([dict(r) for r in extra])
    return jsonify(gemini.generate_daily_fact(cat_en, cat_pl, pool))

@app.route("/api/exercise/dialogue/init")
def dialogue_init():
    user, err, code = _require_user()
    if err: return err, code
    topic = request.args.get("topic", "Restaurant")
    # Pula słów do ćwiczeń
    with db.get_conn() as conn:
        rows = conn.execute(
            """SELECT * FROM words
               WHERE user_id = ? AND translation != ''
                 AND status IN ('NIE_ZNAM', 'TROCHE')
               ORDER BY COALESCE(last_reviewed, '2000-01-01') ASC, RANDOM()
               LIMIT 15""",
            (user["id"],)
        ).fetchall()
        pool = [dict(r) for r in rows]
    return jsonify(gemini.generate_dialogue_init(topic, pool))

@app.route("/api/exercise/dialogue/reply", methods=["POST"])
def dialogue_reply():
    user, err, code = _require_user()
    if err: return err, code
    data = request.json
    chat_history = data.get("chat_history", [])
    user_input = data.get("user_input", "")
    expected_phrases = data.get("expected_phrases", [])
    goal = data.get("goal", "")
    return jsonify(gemini.evaluate_dialogue_turn(chat_history, user_input, expected_phrases, goal))

# ─── Session & XP ──────────────────────────────────────────────────────────────
@app.route("/api/session", methods=["POST"])
def save_session():
    user, err, code = _require_user()
    if err: return err, code
    data = request.json
    ex_type = data.get("type","")
    correct = data.get("correct",0)
    words_cnt = data.get("words",0)
    duration = data.get("duration",0)
    # Jesli frontend przekaze xp_earned (np. SRS z akumulowanym XP per-karta), uzyj go
    frontend_xp = data.get("xp_earned")
    if frontend_xp is not None:
        xp_earned = int(frontend_xp)
    else:
        xp_per = XP_TABLE.get(ex_type, 3)
        xp_earned = correct * xp_per
        if words_cnt > 0 and correct > 0 and (correct / words_cnt) >= 0.8:
            xp_earned = round(xp_earned * 1.2)
    db.add_session(ex_type, words_cnt, correct, duration, xp_earned, user["id"])
    new_xp, new_lvl, actual_xp, mult = db.add_xp(user["id"], xp_earned)
    new_streak = db.get_streak(user["id"])
    quests_done = db.update_quest_progress(user["id"], "session", 1)
    quests_done += db.update_quest_progress(user["id"], ex_type, 1)
    if ex_type == "flashcards" and words_cnt > 0:
        quests_done += db.update_quest_progress(user["id"], "flashcards", words_cnt)
    badges_earned = db.check_and_award_badges(user["id"],
        session_correct=correct, session_words=words_cnt, session_type=ex_type)
    return jsonify({"ok": True, "xp_earned": actual_xp, "total_xp": new_xp,
                    "multiplier": mult, "streak": new_streak,
                    "quests_done": quests_done, "badges_earned": badges_earned})

@app.route("/api/review_result", methods=["POST"])
def review_result():
    user, err, code = _require_user()
    if err: return err, code
    data = request.json
    db.update_review_result(data["word_id"], data["correct"], user["id"])
    return jsonify({"ok": True})

@app.route("/api/stats/vocab-chart")
def vocab_chart():
    user, err, code = _require_user()
    if err: return err, code
    return jsonify(db.get_vocabulary_chart(user["id"]))

@app.route("/api/word-of-day")
def word_of_day():
    user, err, code = _require_user()
    if err: return err, code
    wod = db.get_word_of_day()
    return jsonify(wod) if wod else jsonify({"error": "brak"}), (200 if wod else 404)

@app.route("/api/quests")
def get_quests():
    user, err, code = _require_user()
    if err: return err, code
    return jsonify(db.get_daily_quests(user["id"]))

@app.route("/api/achievements")
def get_achievements():
    user, err, code = _require_user()
    if err: return err, code
    return jsonify(db.get_achievements(user["id"]))

@app.route("/api/exercise/srs")
def srs_exercise():
    user, err, code = _require_user()
    if err: return err, code
    return jsonify(db.get_srs_due(user["id"]))

@app.route("/api/srs/result", methods=["POST"])
def srs_result():
    user, err, code = _require_user()
    if err: return err, code
    data = request.json
    result = db.update_srs(user["id"], data["srs_id"], data["quality"])
    xp_map = {5: 5, 4: 4, 3: 3, 2: 1, 1: 0, 0: 0}
    xp = xp_map.get(data["quality"], 2)
    if xp > 0:
        db.add_xp(user["id"], xp)
    return jsonify({"ok": True, **(result or {})})

@app.route("/api/stats/srs-count")
def srs_count():
    user, err, code = _require_user()
    if err: return err, code
    return jsonify({"count": db.get_srs_due_count(user["id"])})


if __name__ == "__main__":
    import socket, os, subprocess, shutil

    # Pobierz aktualny adres IP
    ip = socket.gethostbyname(socket.gethostname())

    cert_dir = os.path.join(os.path.dirname(__file__), "data")
    os.makedirs(cert_dir, exist_ok=True)
    cert_path = os.path.join(cert_dir, "cert.pem")
    key_path  = os.path.join(cert_dir, "key.pem")

    ssl_context = None
    mkcert_exe  = shutil.which("mkcert")

    # Jeśli certyfikat nie istnieje, wygeneruj przez mkcert (jeśli dostępny)
    if not (os.path.exists(cert_path) and os.path.exists(key_path)):
        if mkcert_exe:
            print("Generowanie certyfikatu SSL przez mkcert...")
            try:
                subprocess.run(
                    [mkcert_exe, "-cert-file", cert_path, "-key-file", key_path,
                     "localhost", "127.0.0.1", ip],
                    check=True
                )
                print("Certyfikat SSL (mkcert) wygenerowany pomyślnie.")
            except Exception as e:
                print(f"Błąd mkcert: {e}")
                mkcert_exe = None  # fallback poniżej

        if not mkcert_exe:
            # Fallback: samopodpisany certyfikat przez cryptography
            print("Generowanie samopodpisanego certyfikatu SSL (fallback)...")
            try:
                import ipaddress
                from datetime import datetime, timedelta, timezone
                from cryptography import x509
                from cryptography.x509.oid import NameOID
                from cryptography.hazmat.primitives import hashes
                from cryptography.hazmat.primitives.asymmetric import rsa
                from cryptography.hazmat.primitives import serialization

                key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
                subject = issuer = x509.Name([
                    x509.NameAttribute(NameOID.COUNTRY_NAME, "PL"),
                    x509.NameAttribute(NameOID.COMMON_NAME, "localhost"),
                ])
                san_list = [
                    x509.DNSName("localhost"),
                    x509.IPAddress(ipaddress.ip_address("127.0.0.1")),
                ]
                try:
                    san_list.append(x509.IPAddress(ipaddress.ip_address(ip)))
                except Exception:
                    pass
                now = datetime.now(timezone.utc)
                cert_obj = x509.CertificateBuilder().subject_name(subject).issuer_name(issuer)\
                    .public_key(key.public_key()).serial_number(x509.random_serial_number())\
                    .not_valid_before(now - timedelta(days=1))\
                    .not_valid_after(now + timedelta(days=365))\
                    .add_extension(x509.SubjectAlternativeName(san_list), critical=False)\
                    .sign(key, hashes.SHA256())
                with open(key_path, "wb") as f:
                    f.write(key.private_bytes(serialization.Encoding.PEM,
                        serialization.PrivateFormat.TraditionalOpenSSL,
                        serialization.NoEncryption()))
                with open(cert_path, "wb") as f:
                    f.write(cert_obj.public_bytes(serialization.Encoding.PEM))
                print("Samopodpisany certyfikat wygenerowany.")
            except Exception as ssl_err:
                print(f"Nie udało się wygenerować certyfikatu: {ssl_err}")
                cert_path = None

    if cert_path and os.path.exists(cert_path) and os.path.exists(key_path):
        ssl_context = (cert_path, key_path)
        is_mkcert = bool(mkcert_exe)

        ca_path = os.path.join(os.path.dirname(__file__), "static", "rootCA.pem")
        ca_available = os.path.exists(ca_path)

        print("\n=== Jezykowy AS - Serwer HTTPS uruchomiony ===")
        print(f"  Ten komputer: https://localhost:5000")
        print(f"  Smartfon:     https://{ip}:5000")
        print("")
        print("MIKROFON NA TELEFONIE - INSTRUKCJA (jednorazowo):")
        print(f"  1. Wejdz na telefonie: https://{ip}:5000")
        print("  2. Kliknij [Zaawansowane] -> [Przejdz do strony]")
        print("  3. Kliknij klopke strony -> Zezwol na mikrofon")
        if ca_available:
            print("")
            print("  Aby na stale usunac ostrzezenie o certyfikacie:")
            print(f"  Pobierz plik CA: https://{ip}:5000/rootCA.pem")
            print("  Zainstaluj na Androidzie: Ustawienia -> Certyfikaty")
        print("="*47 + "\n")
    else:
        print(f"\nAplikacja: http://localhost:5000")
        print(f"Smartfon:  http://{ip}:5000  (uwaga: mikrofon może być zablokowany!)\n")

    app.run(host="0.0.0.0", port=5000, debug=False, ssl_context=ssl_context, threaded=True)

