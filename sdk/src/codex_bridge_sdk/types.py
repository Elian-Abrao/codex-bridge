from __future__ import annotations

from typing import Any, Literal, TypedDict

BridgeReasoningEffort = Literal["none", "low", "medium", "high", "xhigh"]
ChatRole = Literal["system", "user", "assistant"]


class ChatMessage(TypedDict):
    role: ChatRole
    content: str


class StartLoginResult(TypedDict):
    provider: Literal["codex"]
    authUrl: str
    redirectUri: str
    expiresAt: int
    manualFallback: bool


class PublicAuthSession(TypedDict, total=False):
    provider: Literal["codex"]
    accountId: str
    email: str
    planType: str
    expiresAt: int
    updatedAt: int


class ActiveLoginSnapshot(StartLoginResult, total=False):
    startedAt: int


class AuthStateSnapshot(TypedDict, total=False):
    activeLogin: ActiveLoginSnapshot
    session: PublicAuthSession
    isRefreshing: bool


class BridgeOption(TypedDict, total=False):
    id: str
    label: str
    description: str
    recommended: bool


class BridgeHealthResponse(TypedDict):
    ok: bool
    service: str


class BridgeLoginResponse(StartLoginResult):
    instructions: list[str]


class BridgeCodexCapabilitiesResponse(TypedDict, total=False):
    provider: Literal["codex"]
    billingMode: Literal["monthly"]
    requiresAuth: bool
    authenticated: bool
    accountEmail: str
    defaultModel: str
    defaultReasoningEffort: BridgeReasoningEffort
    models: list[BridgeOption]
    reasoningEfforts: list[BridgeOption]


class BridgeChatRequest(TypedDict, total=False):
    model: str
    messages: list[ChatMessage]
    reasoningEffort: BridgeReasoningEffort
    temperature: float
    metadata: dict[str, str]


class BridgeChatResponse(TypedDict):
    requestId: str
    provider: Literal["codex"]
    model: str
    outputText: str


class StreamStatusEvent(TypedDict):
    requestId: str
    provider: Literal["codex"]
    kind: Literal["status"]
    message: str


class StreamDeltaEvent(TypedDict):
    requestId: str
    provider: Literal["codex"]
    kind: Literal["delta"]
    delta: str


class StreamDoneEvent(TypedDict):
    requestId: str
    provider: Literal["codex"]
    kind: Literal["done"]


class StreamErrorEvent(TypedDict):
    requestId: str
    provider: Literal["codex"]
    kind: Literal["error"]
    message: str


StreamEvent = StreamStatusEvent | StreamDeltaEvent | StreamDoneEvent | StreamErrorEvent


JsonObject = dict[str, Any]
