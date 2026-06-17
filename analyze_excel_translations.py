import openpyxl

wb = openpyxl.load_workbook("ListaCOCAEXCEL5000_tlumaczenia_PL.xlsx", data_only=True)
sheet = wb.active

total_rows = 0
has_translation = 0
missing_translation = 0
unique_words = set()
duplicates = 0
min_rank = 999999
max_rank = 0

for i, row in enumerate(sheet.iter_rows(values_only=True), 1):
    if i == 1:
        continue
    rank, lemma, pos, trans = row[0], row[1], row[2], row[3]
    if not lemma:
        continue
    
    total_rows += 1
    lemma_str = str(lemma).strip().lower()
    
    if lemma_str in unique_words:
        duplicates += 1
    else:
        unique_words.add(lemma_str)
        
    if trans and str(trans).strip():
        has_translation += 1
    else:
        missing_translation += 1
        
    if rank is not None:
        try:
            r = int(rank)
            if r < min_rank:
                min_rank = r
            if r > max_rank:
                max_rank = r
        except ValueError:
            pass

print(f"Total rows (lemmas): {total_rows}")
print(f"Unique words: {len(unique_words)}")
print(f"Duplicate lemmas in excel: {duplicates}")
print(f"Has translation: {has_translation}")
print(f"Missing translation: {missing_translation}")
print(f"Rank range: {min_rank} - {max_rank}")

wb.close()
