from __future__ import annotations

import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class GraphSCIIRequestHandler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".mjs": "text/javascript; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".ttf": "font/ttf",
    }

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        self.send_header(
            "Content-Security-Policy",
            "default-src 'self'; script-src 'self'; style-src 'self'; "
            "font-src 'self'; img-src 'self' data:; connect-src 'self'; "
            "object-src 'none'; base-uri 'none'",
        )
        super().end_headers()


def main() -> None:
    parser = argparse.ArgumentParser(description="Serve GraphSCII Draw with stable MIME types and strict CSP.")
    parser.add_argument("port", nargs="?", type=int, default=5174)
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parent.parent
    handler = partial(GraphSCIIRequestHandler, directory=str(repo_root))
    server = ThreadingHTTPServer(("127.0.0.1", args.port), handler)

    print(f"GraphSCII Draw: http://127.0.0.1:{args.port}/graphscii-demo/")
    print(f"Serving repository root: {repo_root}")
    print("CSP: strict; unsafe-eval is NOT allowed")
    server.serve_forever()


if __name__ == "__main__":
    main()
