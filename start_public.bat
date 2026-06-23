@echo off
chcp 65001 >nul
echo ============================================
echo   Jezykowy AS - Tryb Publiczny (ngrok)
echo ============================================
echo.

:: Odswiez PATH o sciezke winget ngrok
set "PATH=%LOCALAPPDATA%\Microsoft\WinGet\Packages\Ngrok.Ngrok_Microsoft.Winget.Source_8wekyb3d8bbwe;%PATH%"

cd /d "%~dp0"

:: Sprawdz ngrok
where ngrok >nul 2>&1
if errorlevel 1 (
    echo [BLAD] ngrok nie jest zainstalowany!
    echo.
    echo Zainstaluj przez:  winget install Ngrok.Ngrok
    echo Nastepnie zarejestruj bezplatne konto na https://ngrok.com
    echo i uruchom: ngrok config add-authtoken TWOJ_TOKEN
    pause
    exit /b 1
)

:: Sprawdz authtoken
ngrok config check >nul 2>&1
if errorlevel 1 (
    echo [BLAD] Brak auth tokenu ngrok!
    echo.
    echo 1. Zaloguj sie / zarejestruj bezplatnie na https://dashboard.ngrok.com
    echo 2. Skopiuj swoj authtoken
    echo 3. Uruchom: ngrok config add-authtoken TWOJ_TOKEN
    echo.
    pause
    exit /b 1
)

echo [1/3] Instalacja/aktualizacja pakietow...
.venv\Scripts\pip install -q -r requirements.txt

echo [2/3] Uruchamianie serwera Flask (HTTP, port 5000)...
start "Jezykowy AS - Serwer" "%~dp0.venv\Scripts\python.exe" app_http.py

echo [3/3] Uruchamianie tunelu ngrok HTTPS...
echo.
echo !! Poczekaj az pojawi sie adres https://xxxxx.ngrok-free.app !!
echo    Ten adres otwierz na smartfonie - mikrofon bedzie dzialac bez instalacji certyfikatow.
echo.
echo Ctrl+C aby zatrzymac.
echo.

ngrok http 5000
