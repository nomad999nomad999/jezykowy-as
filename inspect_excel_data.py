import openpyxl

wb = openpyxl.load_workbook("ListaCOCAEXCEL5000.xlsx", data_only=True)
sheet = wb.active

total_rows = 0
has_translation = 0
unique_words = set()

for i, row in enumerate(sheet.iter_rows(values_only=True), 1):
    if i == 1:
        continue
    rank, lemma, pos, trans = row[0], row[1], row[2], row[3]
    if not lemma:
        continue
    total_rows += 1
    lemma_str = str(lemma).strip().lower()
    unique_words.add(lemma_str)
    if trans:
        has_translation += 1

print(f"Total rows in sheet (excluding header): {total_rows}")
print(f"Unique words: {len(unique_words)}")
print(f"Rows with translation: {has_translation}")
print(f"Rows without translation: {total_rows - has_translation}")

wb.close()
