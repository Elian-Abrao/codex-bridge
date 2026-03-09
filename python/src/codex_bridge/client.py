from __future__ import annotations

import json
from typing import Any, Callable, Iterator
from urllib import error, request

from .types import (
    AuthStateSnapshot,
    BridgeChatRequest,
    BridgeChatResponse,
    BridgeCodexCapabilitiesResponse,
    BridgeHealthResponse,
    BridgeLoginResponse,
    JsonObject,
    StreamEvent,
)

BRIDGE_SERVICE_NAME = "codex-bridge"
BRIDGE_API_PREFIX = "/v1"
DEFAULT_BRIDGE_HOST = "127.0.0.1"
DEFAULT_BRIDGE_PORT = 47831
DEFAULT_BRIDGE_MODEL = "gpt-5.4"
DEFAULT_TIMEOUT_SECONDS = 120.0


class BridgeClientError(RuntimeError):
    """Base exception for Python SDK failures."""


class BridgeHttpError(BridgeClientError):
    """Raised when the bridge responds with a non-2xx status."""

    def __init__(self, status_code: int, message: str, body: str = "") -> None:
        super().__init__(message)
        self.status_code = status_code
        self.body = body


def _trim_trailing_slash(value: str) -> str:
    return value.rstrip("/")


def _build_api_path(path: str) -> str:
    normalized = path if path.startswith("/") else f"/{path}"
    return f"{BRIDGE_API_PREFIX}{normalized}"


def _read_error_message(body: str, status_code: int) -> str:
    text = (body or "").strip()
    if not text:
        return f"Bridge request failed with status {status_code}."

    try:
        payload = json.loads(text)
    except json.JSONDecodeError:
        return text

    if isinstance(payload, dict):
        raw_error = payload.get("error")
        if isinstance(raw_error, str) and raw_error.strip():
            return raw_error.strip()

    return text


def _iter_sse_events(response: Any) -> Iterator[dict[str, str]]:
    event_name: str | None = None
    data_parts: list[str] = []

    for raw_line in response:
        line = raw_line.decode("utf-8").rstrip("\r\n")

        if not line:
            if data_parts:
                yield {
                    "event": event_name or "",
                    "data": "\n".join(data_parts),
                }
            event_name = None
            data_parts = []
            continue

        if line.startswith(":"):
            continue

        if line.startswith("event:"):
            event_name = line[len("event:") :].strip()
            continue

        if line.startswith("data:"):
            data_parts.append(line[len("data:") :].lstrip())

    if data_parts:
        yield {
            "event": event_name or "",
            "data": "\n".join(data_parts),
        }


class CodexBridgeClient:
    def __init__(self, base_url: str | None = None, timeout: float = DEFAULT_TIMEOUT_SECONDS) -> None:
        target = base_url or f"http://{DEFAULT_BRIDGE_HOST}:{DEFAULT_BRIDGE_PORT}"
        self._base_url = _trim_trailing_slash(target.strip())
        self._timeout = timeout

    @property
    def base_url(self) -> str:
        return self._base_url

    def health(self) -> BridgeHealthResponse:
        payload = self._request_json("GET", _build_api_path("/health"))
        service = payload.get("service")
        if service != BRIDGE_SERVICE_NAME:
            raise BridgeClientError(f"Unexpected bridge service: {service}")
        return payload  # type: ignore[return-value]

    def get_auth_state(self) -> AuthStateSnapshot:
        return self._request_json("GET", _build_api_path("/auth/state"))  # type: ignore[return-value]

    def start_login(self) -> BridgeLoginResponse:
        return self._request_json("POST", _build_api_path("/auth/login"))  # type: ignore[return-value]

    def complete_login(self, redirect_url: str) -> AuthStateSnapshot:
        return self._request_json(
            "POST",
            _build_api_path("/auth/complete"),
            {"redirectUrl": redirect_url},
        )  # type: ignore[return-value]

    def logout(self) -> None:
        self._request_json("POST", _build_api_path("/auth/logout"))

    def get_codex_capabilities(self) -> BridgeCodexCapabilitiesResponse:
        return self._request_json("GET", _build_api_path("/providers/codex/options"))  # type: ignore[return-value]

    def chat(self, request_payload: BridgeChatRequest) -> BridgeChatResponse:
        return self._request_json("POST", _build_api_path("/chat"), request_payload)  # type: ignore[return-value]

    def iter_stream_chat(
        self,
        request_payload: BridgeChatRequest,
        *,
        timeout: float | None = None,
    ) -> Iterator[StreamEvent]:
        response = self._open("POST", _build_api_path("/chat/stream"), request_payload, timeout=timeout)
        try:
            for envelope in _iter_sse_events(response):
                raw_data = envelope.get("data", "")
                try:
                    parsed = json.loads(raw_data)
                except json.JSONDecodeError as exc:
                    raise BridgeClientError("Bridge stream returned a malformed event.") from exc

                if not isinstance(parsed, dict):
                    raise BridgeClientError("Bridge stream returned a malformed event.")

                yield parsed  # type: ignore[misc]
        finally:
            response.close()

    def stream_chat(
        self,
        request_payload: BridgeChatRequest,
        *,
        on_event: Callable[[StreamEvent], None] | None = None,
        timeout: float | None = None,
    ) -> BridgeChatResponse:
        request_id: str | None = None
        provider = str(request_payload.get("provider") or "codex")
        output_text = ""
        stream_error: str | None = None

        for event in self.iter_stream_chat(request_payload, timeout=timeout):
            if request_id is None:
                request_id = str(event["requestId"])

            provider = str(event["provider"])
            kind = str(event["kind"])

            if kind == "delta":
                delta = event.get("delta", "")
                if isinstance(delta, str):
                    output_text += delta

            if kind == "error":
                message = event.get("message", "")
                if isinstance(message, str):
                    stream_error = message

            if on_event is not None:
                on_event(event)

        if stream_error:
            raise BridgeClientError(stream_error)

        if request_id is None:
            raise BridgeClientError("Bridge stream finished without a request id.")

        raw_model = str(request_payload.get("model") or "").strip()
        return {
            "requestId": request_id,
            "provider": provider,  # type: ignore[typeddict-item]
            "model": raw_model or DEFAULT_BRIDGE_MODEL,
            "outputText": output_text,
        }

    def _request_json(
        self,
        method: str,
        path: str,
        body: JsonObject | None = None,
        *,
        timeout: float | None = None,
    ) -> JsonObject:
        response = self._open(method, path, body, timeout=timeout)
        try:
            raw = response.read().decode("utf-8")
        finally:
            response.close()

        try:
            payload = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise BridgeClientError("Bridge returned a malformed JSON payload.") from exc

        if not isinstance(payload, dict):
            raise BridgeClientError("Bridge returned a non-object JSON payload.")

        return payload

    def _open(
        self,
        method: str,
        path: str,
        body: JsonObject | None = None,
        *,
        timeout: float | None = None,
    ) -> Any:
        data = None
        headers: dict[str, str] = {}

        if body is not None:
            data = json.dumps(body).encode("utf-8")
            headers["Content-Type"] = "application/json"

        req = request.Request(
            f"{self._base_url}{path}",
            data=data,
            headers=headers,
            method=method,
        )

        try:
            return request.urlopen(req, timeout=timeout or self._timeout)
        except error.HTTPError as exc:
            raw_body = exc.read().decode("utf-8", errors="replace")
            raise BridgeHttpError(exc.code, _read_error_message(raw_body, exc.code), raw_body) from exc
        except error.URLError as exc:
            raise BridgeClientError(str(exc.reason)) from exc


def create_bridge_client(
    base_url: str | None = None,
    *,
    timeout: float = DEFAULT_TIMEOUT_SECONDS,
) -> CodexBridgeClient:
    return CodexBridgeClient(base_url=base_url, timeout=timeout)


def create_chat_client(
    base_url: str | None = None,
    *,
    timeout: float = DEFAULT_TIMEOUT_SECONDS,
) -> CodexBridgeClient:
    return CodexBridgeClient(base_url=base_url, timeout=timeout)
