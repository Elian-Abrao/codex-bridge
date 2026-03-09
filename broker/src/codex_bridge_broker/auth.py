from __future__ import annotations

import json
import threading
import time
import uuid
from dataclasses import dataclass
from typing import Any
from urllib import error, request

from .callback import CallbackPayload, LocalCallbackServer, parse_manual_callback_input
from .config import (
    ACCESS_TOKEN_EXPIRY_BUFFER_MS,
    FALLBACK_EXPIRY_MS,
    LOGIN_TIMEOUT_MS,
    MIN_REFRESH_DELAY_MS,
)
from .errors import BrokerError
from .jwt import (
    extract_jwt_expiry_ms,
    extract_openai_account_id,
    extract_openai_email,
    extract_openai_plan_type,
)
from .oauth import CODEX_OAUTH_PROVIDER, build_authorize_url, build_redirect_uri, build_token_url
from .pkce import generate_oauth_state, generate_pkce_pair, to_form_urlencoded
from .session_store import AuthSessionStore, StoredAuthSession


def _resolve_expiry_timestamp(
    *,
    now_ms: int,
    expires_in_seconds: int | None,
    access_token: str | None,
    id_token: str | None,
) -> int:
    explicit_expiry = (
        now_ms + expires_in_seconds * 1000 - ACCESS_TOKEN_EXPIRY_BUFFER_MS
        if isinstance(expires_in_seconds, int)
        else None
    )
    jwt_expiry = extract_jwt_expiry_ms(access_token) or extract_jwt_expiry_ms(id_token)
    return max(
        explicit_expiry or (jwt_expiry - ACCESS_TOKEN_EXPIRY_BUFFER_MS if jwt_expiry else now_ms + FALLBACK_EXPIRY_MS),
        now_ms + 30_000,
    )


@dataclass
class PendingLogin:
    id: str
    state: str
    verifier: str
    challenge: str
    redirect_uri: str
    auth_url: str
    started_at: int
    expires_at: int
    callback_server: LocalCallbackServer | None = None
    timeout_handle: threading.Timer | None = None
    completing: bool = False


class AuthService:
    def __init__(
        self,
        *,
        session_store: AuthSessionStore,
        now=None,
    ) -> None:
        self._session_store = session_store
        self._now = now or (lambda: int(time.time() * 1000))
        self._lock = threading.RLock()
        self._refresh_lock = threading.Lock()
        self._active_login: PendingLogin | None = None
        self._refresh_timer: threading.Timer | None = None
        self._is_refreshing = False
        self._session: StoredAuthSession | None = None

    def initialize(self) -> None:
        session = self._session_store.load()
        with self._lock:
            self._session = session
        if session:
            self._schedule_refresh(session)

    def get_state(self) -> dict[str, object]:
        with self._lock:
            active_login = self._active_login
            session = self._session
            is_refreshing = self._is_refreshing

        state: dict[str, object] = {"isRefreshing": is_refreshing}
        if active_login:
            state["activeLogin"] = {
                "provider": "codex",
                "authUrl": active_login.auth_url,
                "redirectUri": active_login.redirect_uri,
                "expiresAt": active_login.expires_at,
                "startedAt": active_login.started_at,
                "manualFallback": True,
            }
        if session:
            state["session"] = session.to_public()
        return state

    def start_login(self) -> dict[str, object]:
        with self._lock:
            if self._active_login:
                active = self._active_login
                return {
                    "provider": "codex",
                    "authUrl": active.auth_url,
                    "redirectUri": active.redirect_uri,
                    "expiresAt": active.expires_at,
                    "manualFallback": True,
                }

        verifier, challenge = generate_pkce_pair()
        state = generate_oauth_state()
        redirect_uri = build_redirect_uri(CODEX_OAUTH_PROVIDER)
        auth_url = build_authorize_url(CODEX_OAUTH_PROVIDER, challenge, state)
        started_at = self._now()
        expires_at = started_at + LOGIN_TIMEOUT_MS

        pending = PendingLogin(
            id=str(uuid.uuid4()),
            state=state,
            verifier=verifier,
            challenge=challenge,
            redirect_uri=redirect_uri,
            auth_url=auth_url,
            started_at=started_at,
            expires_at=expires_at,
        )

        timeout = threading.Timer(LOGIN_TIMEOUT_MS / 1000, self._clear_pending_login, args=(pending.id,))
        timeout.daemon = True
        pending.timeout_handle = timeout
        timeout.start()

        try:
            callback_server = LocalCallbackServer(
                host=CODEX_OAUTH_PROVIDER.bind_host,
                port=CODEX_OAUTH_PROVIDER.redirect_port,
                callback_path=CODEX_OAUTH_PROVIDER.redirect_path,
                cancel_path="/auth/cancel",
                expected_state=state,
                timeout_seconds=LOGIN_TIMEOUT_MS / 1000,
                success_title="Access granted",
                success_message="codex-bridge is now authorized. You can return to your terminal or app and continue.",
                on_callback=lambda payload: self.finish_login_from_callback(pending.id, payload),
            )
            callback_server.start()
            pending.callback_server = callback_server
        except Exception:
            pending.callback_server = None

        with self._lock:
            self._active_login = pending

        return {
            "provider": "codex",
            "authUrl": auth_url,
            "redirectUri": redirect_uri,
            "expiresAt": expires_at,
            "manualFallback": True,
        }

    def complete_manual_login(self, redirect_url: str) -> None:
        with self._lock:
            pending = self._active_login
        if not pending:
            raise BrokerError(409, "There is no active OAuth login to complete.")
        payload = parse_manual_callback_input(redirect_url, pending.state)
        self.finish_login_from_callback(pending.id, payload)

    def finish_login_from_callback(self, login_id: str, payload: CallbackPayload) -> None:
        with self._lock:
            pending = self._active_login
            if not pending or pending.id != login_id:
                return
            if pending.completing:
                return
            pending.completing = True

        try:
            session = self._exchange_authorization_code(pending, payload.code)
            with self._lock:
                self._session = session
            self._session_store.save(session)
            self._schedule_refresh(session)
        finally:
            self._clear_pending_login(login_id)

    def logout(self) -> None:
        with self._lock:
            pending = self._active_login
            self._active_login = None
            self._session = None
            refresh_timer = self._refresh_timer
            self._refresh_timer = None

        if pending and pending.timeout_handle:
            pending.timeout_handle.cancel()
        if pending and pending.callback_server:
            pending.callback_server.close()
        if refresh_timer:
            refresh_timer.cancel()
        self._session_store.clear()

    def get_valid_session(self) -> StoredAuthSession:
        with self._lock:
            session = self._session
        if not session:
            raise BrokerError(401, "No authenticated Codex session is available.")
        if session.expiresAt <= self._now():
            self.refresh_session()
            with self._lock:
                session = self._session
        if not session:
            raise BrokerError(401, "No authenticated Codex session is available.")
        return session

    def refresh_session(self) -> None:
        with self._lock:
            session = self._session
        if not session:
            raise BrokerError(401, "No authenticated Codex session is available.")

        with self._refresh_lock:
            with self._lock:
                self._is_refreshing = True
            try:
                refreshed = self._refresh_codex_session(session)
                with self._lock:
                    self._session = refreshed
                self._session_store.save(refreshed)
                self._schedule_refresh(refreshed)
            finally:
                with self._lock:
                    self._is_refreshing = False

    def _exchange_authorization_code(self, pending: PendingLogin, code: str) -> StoredAuthSession:
        token_url = build_token_url(CODEX_OAUTH_PROVIDER)
        encoded = to_form_urlencoded(
            {
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": pending.redirect_uri,
                "client_id": CODEX_OAUTH_PROVIDER.client_id,
                "code_verifier": pending.verifier,
            }
        ).encode("utf-8")
        req = request.Request(
            token_url,
            data=encoded,
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept": "application/json",
            },
            method="POST",
        )

        try:
            with request.urlopen(req, timeout=120) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            raise BrokerError(502, f"OAuth token exchange failed ({exc.code}): {body}", body) from exc

        access_token = payload.get("access_token")
        refresh_token = payload.get("refresh_token")
        if not isinstance(access_token, str) or not access_token.strip():
            raise BrokerError(502, "OAuth response is missing access_token.")
        if not isinstance(refresh_token, str) or not refresh_token.strip():
            raise BrokerError(502, "OAuth response is missing refresh_token.")

        id_token = payload.get("id_token")
        now_ms = self._now()
        return StoredAuthSession(
            provider="codex",
            accessToken=access_token,
            refreshToken=refresh_token,
            idToken=id_token if isinstance(id_token, str) and id_token.strip() else None,
            accountId=extract_openai_account_id(access_token) or extract_openai_account_id(id_token),
            email=extract_openai_email(id_token),
            planType=extract_openai_plan_type(id_token),
            expiresAt=_resolve_expiry_timestamp(
                now_ms=now_ms,
                expires_in_seconds=payload.get("expires_in") if isinstance(payload.get("expires_in"), int) else None,
                access_token=access_token,
                id_token=id_token if isinstance(id_token, str) else None,
            ),
            updatedAt=now_ms,
        )

    def _refresh_codex_session(self, session: StoredAuthSession) -> StoredAuthSession:
        token_url = build_token_url(CODEX_OAUTH_PROVIDER)
        body = json.dumps(
            {
                "client_id": CODEX_OAUTH_PROVIDER.client_id,
                "grant_type": "refresh_token",
                "refresh_token": session.refreshToken,
            }
        ).encode("utf-8")
        req = request.Request(
            token_url,
            data=body,
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            method="POST",
        )

        try:
            with request.urlopen(req, timeout=120) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except error.HTTPError as exc:
            body_text = exc.read().decode("utf-8", errors="replace")
            raise BrokerError(502, f"OAuth refresh failed ({exc.code}): {body_text}", body_text) from exc

        access_token = payload.get("access_token")
        if not isinstance(access_token, str) or not access_token.strip():
            raise BrokerError(502, "OAuth refresh response is missing access_token.")

        id_token = payload.get("id_token")
        now_ms = self._now()
        return StoredAuthSession(
            provider="codex",
            accessToken=access_token,
            refreshToken=payload.get("refresh_token") if isinstance(payload.get("refresh_token"), str) else session.refreshToken,
            idToken=id_token if isinstance(id_token, str) and id_token.strip() else session.idToken,
            accountId=(
                extract_openai_account_id(access_token)
                or extract_openai_account_id(id_token if isinstance(id_token, str) else None)
                or session.accountId
            ),
            email=extract_openai_email(id_token if isinstance(id_token, str) else None) or session.email,
            planType=extract_openai_plan_type(id_token if isinstance(id_token, str) else None) or session.planType,
            expiresAt=_resolve_expiry_timestamp(
                now_ms=now_ms,
                expires_in_seconds=payload.get("expires_in") if isinstance(payload.get("expires_in"), int) else None,
                access_token=access_token,
                id_token=id_token if isinstance(id_token, str) else session.idToken,
            ),
            updatedAt=now_ms,
        )

    def _schedule_refresh(self, session: StoredAuthSession) -> None:
        with self._lock:
            if self._refresh_timer:
                self._refresh_timer.cancel()
            delay_ms = max(MIN_REFRESH_DELAY_MS, session.expiresAt - self._now())
            timer = threading.Timer(delay_ms / 1000, self._refresh_from_timer)
            timer.daemon = True
            self._refresh_timer = timer
            timer.start()

    def _refresh_from_timer(self) -> None:
        try:
            self.refresh_session()
        except Exception:
            return

    def _clear_pending_login(self, login_id: str) -> None:
        with self._lock:
            pending = self._active_login
            if not pending or pending.id != login_id:
                return
            self._active_login = None

        if pending.timeout_handle:
            pending.timeout_handle.cancel()
        if pending.callback_server:
            pending.callback_server.close()
