"""Local development server for ILI (never used in production).

    python3 dev/serve.py            # serves the repo at http://localhost:8000

Serves the repository root on 127.0.0.1 only, with caching turned off so Safari and Chrome
always load the current files. It never contacts Supabase, SeamScape or any other service.
"""
import http.server
import os
import socketserver

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(os.environ.get("PORT", "8000"))


class DevHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        if self.path in ("/", "/index.html"):
            self.send_header("Clear-Site-Data", '"cache"')
        super().end_headers()


socketserver.TCPServer.allow_reuse_address = True
with socketserver.ThreadingTCPServer(("127.0.0.1", PORT), DevHandler) as httpd:
    print(f"ILI dev server: http://localhost:{PORT}/  (serving {ROOT})")
    httpd.serve_forever()
