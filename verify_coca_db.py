import sqlite3
import os

DB = os.path.join('data', 'words.db')

def main():
    print(f"Connecting to database: {DB}")
    conn = sqlite3.connect(DB)
    cursor = conn.cursor()
    
    # 1. Check total rows
    cursor.execute("SELECT COUNT(*) FROM coca_words")
    total_words = cursor.fetchone()[0]
    print(f"Total words in coca_words: {total_words}")
    
    # 2. Check min and max rank
    cursor.execute("SELECT MIN(frequency_rank), MAX(frequency_rank) FROM coca_words")
    min_rank, max_rank = cursor.fetchone()
    print(f"Rank range: {min_rank} to {max_rank}")
    
    # 3. Check for any missing ranks in 1..3000 sequence
    cursor.execute("SELECT frequency_rank FROM coca_words ORDER BY frequency_rank")
    ranks = [r[0] for r in cursor.fetchall()]
    expected_ranks = list(range(1, 3001))
    
    missing_ranks = set(expected_ranks) - set(ranks)
    extra_ranks = set(ranks) - set(expected_ranks)
    
    if not missing_ranks and not extra_ranks:
        print("Success: Ranks are exactly sequential from 1 to 3000 without any gaps or extra values!")
    else:
        if missing_ranks:
            print(f"Warning: Missing ranks: {list(missing_ranks)[:20]}...")
        if extra_ranks:
            print(f"Warning: Extra ranks: {list(extra_ranks)[:20]}...")
            
    # 4. Check for duplicates in 'word'
    cursor.execute("SELECT word, COUNT(*) as c FROM coca_words GROUP BY word HAVING c > 1")
    duplicates = cursor.fetchall()
    if not duplicates:
        print("Success: No duplicate words found in coca_words table.")
    else:
        print(f"Warning: Found duplicate words: {duplicates}")
        
    # 5. Check some sample words to verify translation format
    print("\nSample entries:")
    cursor.execute("SELECT frequency_rank, word, translation FROM coca_words WHERE frequency_rank IN (1, 10, 100, 500, 1000, 2000, 3000)")
    for rank, word, trans in cursor.fetchall():
        print(f"Rank {rank:4d} | Word: {word:<12s} | Translation: {trans}")
        
    conn.close()

if __name__ == "__main__":
    main()
