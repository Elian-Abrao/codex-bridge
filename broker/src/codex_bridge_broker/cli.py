from __future__ import annotations

import argparse

from .config import DEFAULT_BIND_HOST, DEFAULT_BIND_PORT
from .server import run_server


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="codex-bridge-broker")
    subparsers = parser.add_subparsers(dest="command", required=True)

    serve_parser = subparsers.add_parser("serve", help="Start the Python broker skeleton.")
    serve_parser.add_argument("--host", default=DEFAULT_BIND_HOST)
    serve_parser.add_argument("--port", type=int, default=DEFAULT_BIND_PORT)

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    if args.command == "serve":
        run_server(host=args.host, port=args.port)
        return

    parser.error(f"Unsupported command: {args.command}")


if __name__ == "__main__":
    main()
