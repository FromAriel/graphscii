#!/usr/bin/env python3
"""Exercise launch.py as a real HTTP server and verify its contract."""

from __future__ import annotations

import argparse
import os
from pathlib import Path
import queue
import re
import socket
import subprocess
import sys
import threading
import time
from urllib.parse import urljoin, urlparse, parse_qs
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent.parent
LAUNCHER = ROOT / "launch.py"
BUILD_RE = re.compile(r"^GraphSCII Draw build: ([0-9a-f]{12})$")
URL_RE = re.compile(r"^GraphSCII Draw: (http://\S+)$")
ASSET_RE = re.compile(r'<script[^>]+src="([^"]+)"', re.IGNORECASE)
EXPECTED_CACHE_CONTROL = "no-store, no-cache, must-revalidate, max-age=0"


def args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Verify the GraphSCII Python launcher over real HTTP.")
    parser.add_argument(
        "--build",
        action="store_true",
        help="Let launch.py run npm run build before serving instead of reusing dist/.",
    )
    parser.add_argument("--timeout", type=float, default=90.0, help="Startup timeout in seconds.")
    return parser.parse_args()


def free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def reader_thread(stream: object, output: queue.Queue[str]) -> None:
    assert hasattr(stream, "readline")
    while True:
        line = stream.readline()  # type: ignore[attr-defined]
        if not line:
            return
        output.put(str(line).rstrip("\r\n"))


def request(url: str) -> tuple[int, dict[str, str], bytes]:
    req = Request(url, headers={"User-Agent": "GraphSCII-launcher-verifier/1"})
    with urlopen(req, timeout=10) as response:
        return (
            int(response.status),
            {key.lower(): value for key, value in response.headers.items()},
            response.read(),
        )


def assert_headers(headers: dict[str, str], build_id: str, label: str) -> None:
    if headers.get("cache-control") != EXPECTED_CACHE_CONTROL:
        raise AssertionError(f"{label}: wrong Cache-Control: {headers.get('cache-control')!r}")
    if headers.get("pragma") != "no-cache":
        raise AssertionError(f"{label}: wrong Pragma: {headers.get('pragma')!r}")
    if headers.get("expires") != "0":
        raise AssertionError(f"{label}: wrong Expires: {headers.get('expires')!r}")
    if headers.get("x-graphscii-build") != build_id:
        raise AssertionError(
            f"{label}: X-GraphSCII-Build {headers.get('x-graphscii-build')!r} != {build_id!r}"
        )


def stop_process(process: subprocess.Popen[str]) -> None:
    if process.poll() is not None:
        return
    process.terminate()
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=5)


def main() -> int:
    options = args()
    port = free_port()
    command = [
        sys.executable,
        "-u",
        str(LAUNCHER),
        "--host",
        "127.0.0.1",
        "--port",
        str(port),
        "--no-open",
    ]
    if not options.build:
        command.append("--no-build")

    environment = os.environ.copy()
    environment["PYTHONUNBUFFERED"] = "1"
    process = subprocess.Popen(
        command,
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
        env=environment,
    )
    assert process.stdout is not None
    lines: queue.Queue[str] = queue.Queue()
    thread = threading.Thread(target=reader_thread, args=(process.stdout, lines), daemon=True)
    thread.start()

    build_id: str | None = None
    launch_url: str | None = None
    transcript: list[str] = []
    deadline = time.monotonic() + options.timeout

    try:
        while time.monotonic() < deadline and (build_id is None or launch_url is None):
            if process.poll() is not None:
                break
            try:
                line = lines.get(timeout=0.2)
            except queue.Empty:
                continue
            transcript.append(line)
            print(line, flush=True)
            build_match = BUILD_RE.match(line)
            if build_match:
                build_id = build_match.group(1)
            url_match = URL_RE.match(line)
            if url_match:
                launch_url = url_match.group(1)

        if build_id is None or launch_url is None:
            raise AssertionError(
                "launch.py did not report a build fingerprint and URL before timeout.\n"
                + "\n".join(transcript[-40:])
            )

        parsed = urlparse(launch_url)
        if parsed.hostname != "127.0.0.1" or parsed.port != port:
            raise AssertionError(f"Launcher reported unexpected address: {launch_url}")
        query_build = parse_qs(parsed.query).get("build", [])
        if query_build != [build_id]:
            raise AssertionError(f"Launcher URL build query {query_build!r} != [{build_id!r}]")

        status, headers, body = request(launch_url)
        if status != 200:
            raise AssertionError(f"Launcher root returned HTTP {status}")
        assert_headers(headers, build_id, "index")
        html = body.decode("utf-8")
        if "GraphSCII Draw" not in html:
            raise AssertionError("Launcher root did not serve the GraphSCII Draw production index.")

        asset_match = ASSET_RE.search(html)
        if not asset_match:
            raise AssertionError("Production index did not contain a script asset URL.")
        asset_url = urljoin(launch_url, asset_match.group(1))
        asset_status, asset_headers, asset_body = request(asset_url)
        if asset_status != 200 or len(asset_body) < 1000:
            raise AssertionError(
                f"Production script asset was not served correctly: HTTP {asset_status}, {len(asset_body)} bytes."
            )
        assert_headers(asset_headers, build_id, "script asset")

        print(
            "GraphSCII launcher verified over real HTTP: "
            f"build {build_id}; fingerprinted URL; production index + hashed script; "
            "cache disabled; X-GraphSCII-Build consistent.",
            flush=True,
        )
        return 0
    finally:
        stop_process(process)


if __name__ == "__main__":
    raise SystemExit(main())
