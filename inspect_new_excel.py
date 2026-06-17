import openpyxl

wb = openpyxl.load_workbook("ListaCOCAEXCEL5000_tlumaczenia_PL.xlsx", data_only=True)
sheet = wb.active

print(f"Sheet: {sheet.title}")

# Print first 20 rows
for i, row in enumerate(sheet.iter_rows(values_only=True), 1):
    if i > 25:
        break
    print(f"Row {i}: {row}")

wb.close()
