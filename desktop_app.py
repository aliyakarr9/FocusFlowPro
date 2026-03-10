"""
FocusFlow Pro — Desktop Application Launcher
Starts the Flask server in a background thread and opens
a native macOS window via pywebview.
"""

import sys
import os
import threading
import time

# When frozen by PyInstaller, static files live inside _MEIPASS
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
    """Run the Flask server silently in a daemon thread."""
    auto_backup()
    app.run(port=DYNAMIC_PORT, use_reloader=False)


def wait_for_server(url=f"http://localhost:{DYNAMIC_PORT}", timeout=10):
    """Block until the Flask server is reachable."""
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
    # Start Flask in a daemon thread so it dies when the window closes
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()

    # Wait until the server is ready before opening the window
    wait_for_server()

    import webview
    webview.create_window(
        'FocusFlow Pro ⚡',
        f'http://localhost:{DYNAMIC_PORT}',
        width=1200,
        height=800,
        min_size=(900, 600),
    )
    webview.start()
