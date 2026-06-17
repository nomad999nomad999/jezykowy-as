import openpyxl
import sqlite3
import os

DB = os.path.join('data', 'words.db')
EXCEL_FILE = "ListaCOCAEXCEL5000_tlumaczenia_PL.xlsx"

def clean_translation(trans_str):
    if not trans_str:
        return ""
    
    eng_words = {'sb', 'sth', 'make', 'not', 'in', 'real', 'terms', 'eyes', 'of', 'for', 'to', 'do', 'go', 'up', 'down', 'be', 'sbs'}
    
    parts = [p.strip() for p in trans_str.split(';')]
    clean_parts = []
    
    for p in parts:
        if not p:
            continue
            
        cleaned_p = p.lower().replace("'", "").replace("/", " ").replace("-", " ")
        words_in_part = cleaned_p.split()
        
        # If it's a multi-word phrase containing English words, skip (idioms/context examples)
        if len(words_in_part) > 1 and any(w in eng_words for w in words_in_part):
            continue
            
        # Skip overly long descriptions
        if len(p) > 25:
            continue
            
        clean_parts.append(p)
        
    # Keep at most 2 meanings
    clean_parts = clean_parts[:2]
    
    if not clean_parts:
        first_part = parts[0]
        if len(first_part) > 30:
            first_part = first_part[:30] + "..."
        return first_part
        
    return "; ".join(clean_parts)

def main():
    print(f"Opening Excel workbook: {EXCEL_FILE}")
    wb = openpyxl.load_workbook(EXCEL_FILE, data_only=True)
    sheet = wb.active
    
    unique_words = {}
    
    # Read rows (skipping header in row 1)
    for i, row in enumerate(sheet.iter_rows(values_only=True), 1):
        if i == 1:
            continue
        
        rank, lemma, pos, trans = row[0], row[1], row[2], row[3]
        if not lemma:
            continue
            
        lemma_clean = str(lemma).strip().lower()
        if not lemma_clean:
            continue
            
        # Skip if word already seen (keep the first occurrence - lowest rank)
        if lemma_clean in unique_words:
            continue
            
        cleaned_trans = clean_translation(trans)
        unique_words[lemma_clean] = cleaned_trans
        
        if len(unique_words) == 3000:
            break
            
    wb.close()
    
    total_loaded = len(unique_words)
    print(f"Successfully processed {total_loaded} unique words from Excel.")
    
    if total_loaded < 3000:
        print(f"Warning: Excel file only contained {total_loaded} unique words. We will insert all of them.")
        
    # Connect to SQLite and populate coca_words
    print(f"Connecting to database: {DB}")
    conn = sqlite3.connect(DB)
    cursor = conn.cursor()
    
    print("Clearing existing coca_words table...")
    cursor.execute("DELETE FROM coca_words")
    
    print("Inserting new words with sequential ranks...")
    insert_data = []
    for rank_1_indexed, (word, translation) in enumerate(unique_words.items(), 1):
        insert_data.append((word, translation, rank_1_indexed))
        
    cursor.executemany("INSERT INTO coca_words (word, translation, frequency_rank) VALUES (?, ?, ?)", insert_data)
    
    # Commit changes
    conn.commit()
    
    # Verify count
    cursor.execute("SELECT COUNT(*) FROM coca_words")
    count_in_db = cursor.fetchone()[0]
    
    print(f"Database update completed successfully. Total words in coca_words table: {count_in_db}")
    
    conn.close()

if __name__ == "__main__":
    main()
