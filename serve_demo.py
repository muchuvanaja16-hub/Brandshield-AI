"""Serve the Phase 1 frontend demo without Flask or a database."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import os

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "frontend")


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5500"))
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print("BrandShield AI demo: http://127.0.0.1:%s/" % port)
    print("Workspace:            http://127.0.0.1:%s/app.html" % port)
    print("This server only hosts static files. It does not scan the internet.")
    server.serve_forever()
