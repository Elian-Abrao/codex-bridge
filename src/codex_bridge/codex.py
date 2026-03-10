from __future__ import annotations

import json
import uuid
from typing import Any, Iterator
from urllib import error, request

from .auth import AuthService
from .config import (
    CODEX_ORIGINATOR,
    DEFAULT_CODEX_MODEL,
    DEFAULT_CODEX_MODELS,
    DEFAULT_CODEX_REASONING_EFFORTS,
    DEFAULT_REASONING_EFFORT,
    normalize_codex_base_url,
    normalize_codex_model,
    normalize_reasoning_effort,
)
from .default_instructions import CODEX_DEFAULT_INSTRUCTIONS
from .errors import BrokerError


def _to_json_record(value: Any) -> dict[str, Any] | None:
    return value if isinstance(value, dict) else None


def _collect_system_messages(messages: list[dict[str, Any]]) -> str | None:
    collected = [
        str(message.get("content", "")).strip()
        for message in messages
        if message.get("role") == "system" and str(message.get("content", "")).strip()
    ]
    return "\n\n".join(collected) if collected else None


def _build_instructions(messages: list[dict[str, Any]]) -> str:
    system_instructions = _collect_system_messages(messages)
    if not system_instructions:
        return CODEX_DEFAULT_INSTRUCTIONS
    return f"{CODEX_DEFAULT_INSTRUCTIONS}\n\n## User-defined instructions\n\n{system_instructions}"


def _build_input(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    payload: list[dict[str, Any]] = []
    for message in messages:
        role = str(message.get("role", "")).strip()
        if role == "system":
            continue
        content = str(message.get("content", ""))
        payload.append(
            {
                "role": role,
                "content": [
                    {
                        "type": "output_text" if role == "assistant" else "input_text",
                        "text": content,
                    }
                ],
            }
        )
    return payload


def _iter_sse_events(response) -> Iterator[dict[str, str]]:
    event_name: str | None = None
    data_parts: list[str] = []
    for raw_line in response:
        line = raw_line.decode("utf-8").rstrip("\r\n")
        if not line:
            if data_parts:
                yield {"event": event_name or "", "data": "\n".join(data_parts)}
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
        yield {"event": event_name or "", "data": "\n".join(data_parts)}


class CodexService:
    def __init__(self, *, auth_service: AuthService, base_url: str, user_agent: str) -> None:
        self._auth_service = auth_service
        self._base_url = normalize_codex_base_url(base_url)
        self._user_agent = user_agent

    def get_capabilities(self) -> dict[str, object]:
        state = self._auth_service.get_state()
        session = state.get("session") if isinstance(state, dict) else None
        account_email = session.get("email") if isinstance(session, dict) else None
        return {
            "provider": "codex",
            "billingMode": "monthly",
            "requiresAuth": True,
            "authenticated": bool(session),
            "accountEmail": account_email,
            "defaultModel": DEFAULT_CODEX_MODEL,
            "defaultReasoningEffort": DEFAULT_REASONING_EFFORT,
            "models": DEFAULT_CODEX_MODELS,
            "reasoningEfforts": DEFAULT_CODEX_REASONING_EFFORTS,
        }

    def stream_chat(self, request_payload: dict[str, Any]) -> Iterator[dict[str, Any]]:
        provider = str(request_payload.get("provider") or "codex").strip()
        if provider and provider != "codex":
            raise BrokerError(400, "This broker is Codex-only. Omit `provider` or set it to `codex`.")

        messages = request_payload.get("messages")
        if not isinstance(messages, list) or not messages:
            raise BrokerError(400, "`messages` must contain at least one chat message.")

        request_id = str(request_payload.get("requestId") or uuid.uuid4())
        model = normalize_codex_model(request_payload.get("model") if isinstance(request_payload.get("model"), str) else None)
        reasoning_effort = normalize_reasoning_effort(
            request_payload.get("reasoningEffort") if isinstance(request_payload.get("reasoningEffort"), str) else None
        )

        yield {
            "requestId": request_id,
            "provider": "codex",
            "kind": "status",
            "message": "Connecting to codex...",
        }

        session = self._auth_service.get_valid_session()
        headers = {
            "Authorization": f"Bearer {session.accessToken}",
            "Content-Type": "application/json",
            "Accept": "text/event-stream",
            "originator": CODEX_ORIGINATOR,
            "User-Agent": self._user_agent,
        }
        if session.accountId:
            headers["ChatGPT-Account-Id"] = session.accountId

        body: dict[str, Any] = {
            "model": model,
            "stream": True,
            "store": False,
            "instructions": _build_instructions(messages),
            "input": _build_input(messages),
        }
        if reasoning_effort:
            body["reasoning"] = {"effort": reasoning_effort}

        req = request.Request(
            f"{self._base_url}/responses",
            data=json.dumps(body).encode("utf-8"),
            headers=headers,
            method="POST",
        )

        try:
            response = request.urlopen(req, timeout=120)
        except error.HTTPError as exc:
            raw_body = exc.read().decode("utf-8", errors="replace")
            raise BrokerError(502, f"Request failed ({exc.code}): {raw_body}", raw_body) from exc
        except error.URLError as exc:
            raise BrokerError(502, str(exc.reason)) from exc

        with response:
            for envelope in _iter_sse_events(response):
                data = envelope.get("data", "")
                if data == "[DONE]":
                    yield {"requestId": request_id, "provider": "codex", "kind": "done"}
                    return

                payload = _to_json_record(json.loads(data))
                if not payload:
                    continue

                event_type = payload.get("type")
                if event_type == "response.output_text.delta" and isinstance(payload.get("delta"), str):
                    yield {
                        "requestId": request_id,
                        "provider": "codex",
                        "kind": "delta",
                        "delta": payload["delta"],
                    }
                    continue

                if event_type == "response.failed":
                    error_payload = _to_json_record(payload.get("error")) or {}
                    message = error_payload.get("message")
                    yield {
                        "requestId": request_id,
                        "provider": "codex",
                        "kind": "error",
                        "message": message if isinstance(message, str) and message else "Codex returned a failed response event.",
                    }
                    return

                if event_type == "response.completed":
                    yield {"requestId": request_id, "provider": "codex", "kind": "done"}
                    return

    def chat(self, request_payload: dict[str, Any]) -> dict[str, Any]:
        request_id: str | None = None
        output_text = ""
        model = normalize_codex_model(request_payload.get("model") if isinstance(request_payload.get("model"), str) else None)
        for event in self.stream_chat(request_payload):
            request_id = request_id or str(event.get("requestId"))
            if event.get("kind") == "delta" and isinstance(event.get("delta"), str):
                output_text += event["delta"]
            if event.get("kind") == "error":
                raise BrokerError(502, str(event.get("message") or "Codex returned an error."))

        if not request_id:
            raise BrokerError(502, "Bridge stream finished without a request id.")

        return {
            "requestId": request_id,
            "provider": "codex",
            "model": model,
            "outputText": output_text,
        }
