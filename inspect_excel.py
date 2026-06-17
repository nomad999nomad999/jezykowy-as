import openpyxl

wb = openpyxl.load_workbook("ListaCOCAEXCEL5000.xlsx", read_only=True)
sheet = wb.active
print(f"Sheet name: {sheet.title}")

# Print first 10 rows
for i, row in enumerate(sheet.iter_rows(values_only=True), 1):
    if i > 15:
        break
    print(f"Row {i}: {row}")

wb.close()
