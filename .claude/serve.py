"""Static preview server for koyo-site, with HTTP Range support (needed for <video>)."""
import os
import sys

SITE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "koyo-site")
os.chdir(SITE)

import http.server
import socketserver

PORT = int(os.environ.get("PORT", "4173"))
CHUNK = 64 * 1024


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        self.send_header("Accept-Ranges", "bytes")
        super().end_headers()

    def log_message(self, *args):
        pass

    def do_GET(self):
        rng = self.headers.get("Range")
        path = self.translate_path(self.path)
        if rng and rng.startswith("bytes=") and os.path.isfile(path):
            try:
                size = os.path.getsize(path)
                spec = rng[len("bytes="):].split(",")[0].strip()
                start_s, _, end_s = spec.partition("-")
                if start_s:
                    start = int(start_s)
                    end = min(int(end_s), size - 1) if end_s else size - 1
                else:  # suffix range: last N bytes
                    start = max(0, size - int(end_s))
                    end = size - 1
            except ValueError:
                self.send_error(416)
                return
            if start > end or start >= size:
                self.send_error(416)
                return
            self.send_response(206)
            self.send_header("Content-Type", self.guess_type(path))
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
            self.send_header("Content-Length", str(end - start + 1))
            self.end_headers()
            try:
                with open(path, "rb") as f:
                    f.seek(start)
                    remaining = end - start + 1
                    while remaining > 0:
                        chunk = f.read(min(CHUNK, remaining))
                        if not chunk:
                            break
                        self.wfile.write(chunk)
                        remaining -= len(chunk)
            except (BrokenPipeError, ConnectionResetError):
                pass
            return
        super().do_GET()


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


with Server(("127.0.0.1", PORT), Handler) as httpd:
    print(f"serving {SITE} on http://127.0.0.1:{PORT}")
    httpd.serve_forever()
