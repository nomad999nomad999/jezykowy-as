@echo off
chcp 65001 >nul
echo ========================================
echo   Językowy AS - Nauka Angielskiego
echo ========================================

cd /d "%~dp0"

if not exist ".venv" (
    echo Tworzenie srodowiska wirtualnego...
    python -m venv .venv
)

echo Instalacja/aktualizacja pakietow...
.venv\Scripts\pip install -q -r requirements.txt

echo.
echo Uruchamianie serwera...
echo.

for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
    set IP=%%a
    goto :found
)
:found
set IP=%IP: =%
echo ✅ Aplikacja dostepna na (HTTPS WYMAGANE DLA MIKROFONU NA TELEFONIE):
echo    https://localhost:5000       (ten komputer)
echo    https://%IP%:5000   (smartfon w sieci LAN)
echo.
echo ⚠️ Uwaga: Przy pierwszym wejściu przeglądarka wyświetli ostrzeżenie o certyfikacie.
echo    Kliknij "Zaawansowane" i przejdź do strony (Proceed/Zezwól).
echo.
echo Nacisnij Ctrl+C aby zatrzymac.
echo.

.venv\Scripts\python app.py
pause
