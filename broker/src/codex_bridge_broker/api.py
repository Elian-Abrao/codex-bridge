from __future__ import annotations

import json
from http import HTTPStatus
from typing import Any

from .config import (
    BRIDGE_API_PREFIX,
    BRIDGE_SERVICE_NAME,
    DEFAULT_CODEX_MODEL,
    DEFAULT_CODEX_MODELS,
    DEFAULT_CODEX_REASONING_EFFORTS,
    DEFAULT_REASONING_EFFORT,
)


JsonDict = dict[str, Any]


def _json_response(status: HTTPStatus, payload: JsonDict) -> tuple[int, bytes]:
    return int(status), json.dumps(payload).encode("utf-8")


def build_health_response() -> JsonDict:
    return {
        "ok": True,
        "service": BRIDGE_SERVICE_NAME,
    }


def build_auth_state_response() -> JsonDict:
    return {
        "isRefreshing": False,
    }


def build_capabilities_response() -> JsonDict:
    return {
        "provider": "codex",
        "billingMode": "monthly",
        "requiresAuth": True,
        "authenticated": False,
        "defaultModel": DEFAULT_CODEX_MODEL,
        "defaultReasoningEffort": DEFAULT_REASONING_EFFORT,
        "models": DEFAULT_CODEX_MODELS,
        "reasoningEfforts": DEFAULT_CODEX_REASONING_EFFORTS,
    }


def build_not_implemented_response(path: str) -> JsonDict:
    return {
        "error": (
            "Python broker skeleton has not implemented this route yet: "
            f"{path}. Use the current Node broker for full auth and chat behavior."
        )
    }


def handle_request(method: str, path: str, body: bytes | None = None) -> tuple[int, bytes]:
    if method == "GET" and path == f"{BRIDGE_API_PREFIX}/health":
        return _json_response(HTTPStatus.OK, build_health_response())

    if method == "GET" and path == f"{BRIDGE_API_PREFIX}/auth/state":
        return _json_response(HTTPStatus.OK, build_auth_state_response())

    if method == "GET" and path == f"{BRIDGE_API_PREFIX}/providers/codex/options":
        return _json_response(HTTPStatus.OK, build_capabilities_response())

    if method == "POST" and path == f"{BRIDGE_API_PREFIX}/auth/logout":
        return _json_response(HTTPStatus.OK, {"ok": True})

    if path.startswith(BRIDGE_API_PREFIX):
        return _json_response(HTTPStatus.NOT_IMPLEMENTED, build_not_implemented_response(path))

    return _json_response(HTTPStatus.NOT_FOUND, {"error": "Not found."})
