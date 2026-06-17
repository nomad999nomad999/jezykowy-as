import openpyxl
import sqlite3
import os

DB = os.path.join("data", "words.db")
conn = sqlite3.connect(DB)
conn.row_factory = sqlite3.Row

# Load translations we currently have in database (from coca_words and words tables)
db_translations = {}
for r in conn.execute("SELECT word, translation FROM coca_words WHERE translation IS NOT NULL AND translation != '' AND translation != word"):
    db_translations[r["word"].lower()] = r["translation"]

# Load translations from coca_words.py
coca_words_py = {}
try:
    import sys; sys.path.insert(0, os.path.dirname(__file__))
    from coca_words import COCA_WORDS, TOP_BASIC_WORDS
    for w, t, r in COCA_WORDS + TOP_BASIC_WORDS:
        coca_words_py[w.lower()] = t
except Exception as e:
    print(f"Error loading coca_words.py: {e}")

# Combine translations
all_translations = {**coca_words_py, **db_translations}
print(f"Total known translations from DB and py file: {len(all_translations)}")

# Read Excel and check coverage for ranks 1 to 3000
wb = openpyxl.load_workbook("ListaCOCAEXCEL5000.xlsx", data_only=True)
sheet = wb.active

missing_translations_count = 0
found_translations_count = 0
unique_excel_words = []
seen_words = set()

# We want to process exactly the top 3000 unique words from Excel
for i, row in enumerate(sheet.iter_rows(values_only=True), 1):
    if i == 1:
        continue
    rank, lemma, pos, _ = row[0], row[1], row[2], row[3]
    if not lemma:
        continue
    
    word = str(lemma).strip().lower()
    if word in seen_words:
        continue
    seen_words.add(word)
    unique_excel_words.append((word, rank))
    
    if len(unique_excel_words) >= 3000:
        break

for word, rank in unique_excel_words:
    if word in all_translations:
        found_translations_count += 1
    else:
        missing_translations_count += 1

print(f"Top 3000 unique words from Excel:")
print(f"  Translations found: {found_translations_count} ({found_translations_count*100//3000}%)")
print(f"  Translations missing: {missing_translations_count} ({missing_translations_count*100//3000}%)")

if missing_translations_count > 0:
    # Print some examples of missing translations
    missing_samples = [w for w, r in unique_excel_words if w not in all_translations][:15]
    print(f"Samples of missing words: {missing_samples}")

conn.close()
wb.close()
