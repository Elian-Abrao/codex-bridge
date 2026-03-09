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
