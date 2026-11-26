#!/usr/bin/env python3
"""Serve the built recharge oscillator.

One command from the repo root:

    python3 serve.py

Then open http://127.0.0.1:8080
"""

import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dist")


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".webmanifest": "application/manifest+json",
        ".svg": "image/svg+xml",
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)


def main():
    if not os.path.isdir(ROOT) or not os.path.isfile(os.path.join(ROOT, "index.html")):
        raise SystemExit("Build the site first: npm install && npm run build")
    port = int(os.environ.get("PORT", "8080"))
    server = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    print(f"Recharge oscillator at http://127.0.0.1:{port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
