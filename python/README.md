# Python SDK

Python client for consuming a local `codex-bridge` server.

## Install

From this repository:

```bash
pip install ./python
```

Editable install during development:

```bash
pip install -e ./python
```

Install with the FastAPI example dependencies:

```bash
pip install -e './python[examples]'
```

## Example

```python
from codex_bridge import create_chat_client

client = create_chat_client("http://127.0.0.1:47831")

capabilities = client.get_codex_capabilities()
print(capabilities["models"])

reply = client.chat(
    {
        "model": "gpt-5.4",
        "reasoningEffort": "medium",
        "messages": [{"role": "user", "content": "Explain this file."}],
    }
)

print(reply["outputText"])
```

## Streaming

```python
from codex_bridge import CodexBridgeClient

client = CodexBridgeClient()

def on_event(event):
    if event["kind"] == "delta":
        print(event["delta"], end="", flush=True)

response = client.stream_chat(
    {
        "messages": [{"role": "user", "content": "Reply with a short sentence."}],
    },
    on_event=on_event,
)
```

## FastAPI Example

A minimal FastAPI proxy app lives in [`examples/fastapi_app.py`](./examples/fastapi_app.py).

Run it with:

```bash
pip install -e './python[examples]'
uvicorn fastapi_app:app --app-dir python/examples --reload
```

The example exposes:

- `GET /health`
- `GET /bridge/health`
- `GET /bridge/auth/state`
- `POST /bridge/auth/login`
- `POST /bridge/auth/complete`
- `GET /bridge/providers/codex/options`
- `POST /bridge/chat`
- `POST /bridge/chat/stream`

## Surface

- `health()`
- `get_auth_state()`
- `start_login()`
- `complete_login(redirect_url)`
- `logout()`
- `get_codex_capabilities()`
- `chat(request)`
- `iter_stream_chat(request)`
- `stream_chat(request, on_event=...)`

## Tests

Run the SDK tests from the repository root:

```bash
npm run test:python
```
