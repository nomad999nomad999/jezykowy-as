"""
app_http.py – wersja HTTP (bez SSL) do uruchamiania za tunelem ngrok.
Uruchamia serwer na porcie 5000 bez HTTPS – ngrok sam doda HTTPS z ważnym certyfikatem.
"""
import sys
sys.path.insert(0, '.')

# Importuj wszystko z app.py
from app import app

if __name__ == "__main__":
    import socket
    ip = socket.gethostbyname(socket.gethostname())
    print(f"\n[HTTP] Serwer wewnętrzny (dla ngrok): http://localhost:5000")
    print(f"[HTTP] Nie wchodź bezpośrednio przez IP – użyj adresu ngrok z drugiego okna!\n")
    app.run(host="0.0.0.0", port=5000, debug=False, ssl_context=None, threaded=True)
