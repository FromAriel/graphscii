#!/usr/bin/env python3
"""Build and self-host the GraphSCII Draw demo.

Examples:
    python launch.py
    python launch.py --watch
    python launch.py --host 0.0.0.0 --port 8080 --no-open
"""

from __future__ import annotations

import argparse
import functools
import http.server
import os
from pathlib import Path
import shutil
import subprocess
import sys
import threading
import time
import webbrowser


ROOT = Path(__file__).resolve().parent
DIST = ROOT / "dist"
NODE_MODULES = ROOT / "node_modules"
WATCH_SUFFIXES = {".ts", ".part", ".css", ".html", ".mjs", ".json"}
WATCH_FILES = (ROOT / "index.html", ROOT / "package.json", ROOT / "tsconfig.json")
WATCH_ROOTS = (ROOT / "src", ROOT / "scripts")
GENERATED_MAIN = (ROOT / "src" / "main.ts").resolve()


def args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build and self-host GraphSCII Draw.")
    parser.add_argument("--host", default="127.0.0.1", help="Bind address (default: 127.0.0.1).")
    parser.add_argument("--port", type=int, default=5174, help="HTTP port (default: 5174).")
    parser.add_argument("--watch", action="store_true", help="Rebuild when source files change.")
    parser.add_argument("--no-open", action="store_true", help="Do not open a browser automatically.")
    parser.add_argument("--no-build", action="store_true", help="Serve the existing dist/ without rebuilding.")
    parser.add_argument("--install", action="store_true", help="Force npm install before building.")
    return parser.parse_args()


def find_npm() -> str:
    names = ("npm.cmd", "npm") if os.name == "nt" else ("npm", "npm.cmd")
    for name in names:
        found = shutil.which(name)
        if found:
            return found
    raise SystemExit("npm was not found on PATH. Install Node.js/npm first.")


def run(command: list[str]) -> None:
    print(f"\n> {' '.join(command)}", flush=True)
    subprocess.run(command, cwd=ROOT, check=True)


def build(npm: str) -> bool:
    try:
        run([npm, "run", "build"])
        return True
    except subprocess.CalledProcessError as exc:
        print(f"Build failed with exit code {exc.returncode}.", file=sys.stderr, flush=True)
        return False


def snapshot() -> dict[Path, tuple[int, int]]:
    result: dict[Path, tuple[int, int]] = {}

    def add(path: Path) -> None:
        resolved = path.resolve()
        if resolved == GENERATED_MAIN or not path.is_file() or path.suffix.lower() not in WATCH_SUFFIXES:
            return
        stat = path.stat()
        result[resolved] = (stat.st_mtime_ns, stat.st_size)

    for root in WATCH_ROOTS:
        if root.is_dir():
            for path in root.rglob("*"):
                add(path)
    for path in WATCH_FILES:
        add(path)
    return result


def watch(npm: str, stop: threading.Event) -> None:
    previous = snapshot()
    print("Watching source files for changes...", flush=True)
    while not stop.wait(0.75):
        current = snapshot()
        if current == previous:
            continue
        previous = current
        time.sleep(0.2)
        print("\nChange detected. Rebuilding...", flush=True)
        if build(npm):
            previous = snapshot()
            print("Rebuild complete. Refresh the browser.", flush=True)


class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *values: object) -> None:
        print(f"[http] {self.address_string()} - {format % values}", flush=True)


def browser_url(host: str, port: int) -> str:
    display = "127.0.0.1" if host in {"0.0.0.0", "::", ""} else host
    if ":" in display and not display.startswith("["):
        display = f"[{display}]"
    return f"http://{display}:{port}/"


def main() -> int:
    options = args()
    if not 1 <= options.port <= 65535:
        raise SystemExit("--port must be between 1 and 65535.")

    npm = find_npm()
    if not options.no_build:
        if options.install or not NODE_MODULES.is_dir():
            run([npm, "install", "--no-audit", "--no-fund"])
        if not build(npm):
            return 1
    elif not DIST.is_dir():
        raise SystemExit("dist/ does not exist. Run once without --no-build first.")

    handler = functools.partial(Handler, directory=str(DIST))
    server = http.server.ThreadingHTTPServer((options.host, options.port), handler)
    server.daemon_threads = True
    url = browser_url(options.host, options.port)
    stop = threading.Event()
    watcher: threading.Thread | None = None

    if options.watch:
        watcher = threading.Thread(target=watch, args=(npm, stop), daemon=True)
        watcher.start()

    print(f"\nGraphSCII Draw: {url}")
    print("Press Ctrl+C to stop.\n")

    if not options.no_open:
        threading.Timer(0.35, webbrowser.open, args=(url,)).start()

    try:
        server.serve_forever(poll_interval=0.25)
    except KeyboardInterrupt:
        print("\nStopping GraphSCII Draw...", flush=True)
    finally:
        stop.set()
        server.server_close()
        if watcher is not None:
            watcher.join(timeout=1.0)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
