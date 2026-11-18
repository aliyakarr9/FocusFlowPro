"""
FocusFlow Pro masaüstü başlatıcısı.

Sunucuyu arka planda çalıştırır ve arayüzü pywebview penceresinde açar.
"""

import sys
import os
import threading
import time

# Paketli sürümde arayüz dosyaları _MEIPASS altındadır
if getattr(sys, 'frozen', False):
    os.chdir(sys._MEIPASS)


from server import app, auto_backup


def find_free_port():
    import socket
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('', 0))
        return s.getsockname()[1]


DYNAMIC_PORT = find_free_port()


def start_server():
    auto_backup()
    app.run(port=DYNAMIC_PORT, use_reloader=False)


def wait_for_server(url=f"http://localhost:{DYNAMIC_PORT}", timeout=10):
    """Sunucu yanıt verene kadar bekler."""
    import urllib.request
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            urllib.request.urlopen(url, timeout=1)
            return True
        except Exception:
            time.sleep(0.15)
    return False


if __name__ == '__main__':
    # Sunucu arka planda çalışır; pencere kapanınca o da kapanır
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()

    # Pencereyi sunucu hazır olunca aç
    wait_for_server()

    import webview
    webview.create_window(
        'FocusFlow Pro',
        f'http://localhost:{DYNAMIC_PORT}',
        width=1200,
        height=800,
        min_size=(900, 600),
    )
    webview.start()
