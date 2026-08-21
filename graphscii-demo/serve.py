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


def main() -> None:
    parser = argparse.ArgumentParser(description="Serve GraphSCII Draw with stable MIME types.")
    parser.add_argument("port", nargs="?", type=int, default=5174)
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parent.parent
    handler = partial(GraphSCIIRequestHandler, directory=str(repo_root))
    server = ThreadingHTTPServer(("127.0.0.1", args.port), handler)

    print(f"GraphSCII Draw: http://127.0.0.1:{args.port}/graphscii-demo/")
    print(f"Serving repository root: {repo_root}")
    server.serve_forever()


if __name__ == "__main__":
    main()
