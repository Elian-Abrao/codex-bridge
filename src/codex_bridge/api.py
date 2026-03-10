from __future__ import annotations

import json
from http import HTTPStatus
from typing import Any
from urllib.parse import urlparse

from .config import BRIDGE_API_PREFIX, BRIDGE_SERVICE_NAME
from .errors import BrokerError
from .runtime import BrokerRuntime


JsonDict = dict[str, Any]


def _json_response(status: HTTPStatus, payload: JsonDict) -> tuple[int, bytes]:
    return int(status), json.dumps(payload).encode("utf-8")


def _normalize_path(path: str) -> str:
    return urlparse(path).path or "/"


def _is_route(path: str, route_path: str) -> bool:
    normalized = _normalize_path(path)
    return normalized == route_path or normalized == f"{BRIDGE_API_PREFIX}{route_path}"


def parse_json_body(body: bytes | None) -> JsonDict:
    if not body:
        return {}
    try:
        parsed = json.loads(body.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise BrokerError(400, "Malformed JSON request body.") from exc
    if not isinstance(parsed, dict):
        raise BrokerError(400, "JSON request body must be an object.")
    return parsed


def handle_json_request(runtime: BrokerRuntime, method: str, path: str, body: bytes | None = None) -> tuple[int, bytes]:
    if method == "GET" and _is_route(path, "/health"):
        return _json_response(
            HTTPStatus.OK,
            {
                "ok": True,
                "service": BRIDGE_SERVICE_NAME,
            },
        )

    if method == "GET" and _is_route(path, "/auth/state"):
        return _json_response(HTTPStatus.OK, runtime.auth_service.get_state())

    if method == "GET" and _is_route(path, "/providers/codex/options"):
        return _json_response(HTTPStatus.OK, runtime.codex_service.get_capabilities())

    if method == "POST" and _is_route(path, "/auth/login"):
        login = runtime.auth_service.start_login()
        payload = {
            **login,
            "instructions": [
                "Open authUrl in your browser.",
                "If the automatic callback fails, send the final redirect URL to POST /v1/auth/complete.",
            ],
        }
        return _json_response(HTTPStatus.OK, payload)

    if method == "POST" and _is_route(path, "/auth/complete"):
        payload = parse_json_body(body)
        redirect_url = payload.get("redirectUrl")
        if not isinstance(redirect_url, str) or not redirect_url.strip():
            raise BrokerError(400, "`redirectUrl` is required.")
        runtime.auth_service.complete_manual_login(redirect_url)
        return _json_response(HTTPStatus.OK, runtime.auth_service.get_state())

    if method == "POST" and _is_route(path, "/auth/logout"):
        runtime.auth_service.logout()
        return _json_response(HTTPStatus.OK, {"ok": True})

    if method == "POST" and _is_route(path, "/chat"):
        payload = parse_json_body(body)
        response = runtime.codex_service.chat(payload)
        return _json_response(HTTPStatus.OK, response)

    if method == "POST" and _is_route(path, "/chat/stream"):
        raise BrokerError(500, "Streaming route must be handled separately.")

    return _json_response(HTTPStatus.NOT_FOUND, {"error": "Not found."})
