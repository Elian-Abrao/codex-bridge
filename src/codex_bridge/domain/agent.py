from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


VALID_PERMISSION_PROFILES = ("read-only", "workspace-write", "full-access")
VALID_SESSION_MODES = ("chat", "agent")


def normalize_permission_profile(value: str | None) -> str:
    normalized = (value or "").strip().lower()
    if normalized in VALID_PERMISSION_PROFILES:
        return normalized
    return "read-only"


def normalize_session_mode(value: str | None) -> str:
    normalized = (value or "").strip().lower()
    if normalized in VALID_SESSION_MODES:
        return normalized
    return "agent"


@dataclass(slots=True)
class AgentEvent:
    session_id: str
    kind: str
    message: str | None = None
    data: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "sessionId": self.session_id,
            "kind": self.kind,
        }
        if self.message:
            payload["message"] = self.message
        if self.data:
            payload.update(self.data)
        return payload


@dataclass(frozen=True, slots=True)
class ToolDescriptor:
    name: str
    description: str
    requires_write: bool = False
    requires_full_access: bool = False

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "description": self.description,
            "requiresWrite": self.requires_write,
            "requiresFullAccess": self.requires_full_access,
        }


@dataclass(frozen=True, slots=True)
class ToolResult:
    tool_name: str
    output_text: str
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_context_message(self) -> str:
        lines = [f"Tool `{self.tool_name}` executed locally."]
        path = self.metadata.get("path")
        if isinstance(path, str) and path:
            lines.append(f"Path: {path}")
        exit_code = self.metadata.get("exitCode")
        if isinstance(exit_code, int):
            lines.append(f"Exit code: {exit_code}")
        if self.output_text:
            lines.append("Output:")
            lines.append(self.output_text)
        return "\n".join(lines)


@dataclass(slots=True)
class AgentSession:
    id: str
    mode: str
    model: str
    reasoning_effort: str
    permission_profile: str
    workspace_root: str
    cwd: str
    created_at: int
    updated_at: int
    messages: list[dict[str, str]] = field(default_factory=list)

    def touch(self, updated_at: int) -> None:
        self.updated_at = updated_at

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "mode": self.mode,
            "model": self.model,
            "reasoningEffort": self.reasoning_effort,
            "permissionProfile": self.permission_profile,
            "workspaceRoot": self.workspace_root,
            "cwd": self.cwd,
            "createdAt": self.created_at,
            "updatedAt": self.updated_at,
            "messageCount": len(self.messages),
        }
