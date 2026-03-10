# Python SDK

Python client for consuming a local `codex-bridge` broker.

Package name:

```bash
pip install codex-bridge-sdk
```

Import path:

```python
from codex_bridge_sdk import create_chat_client
```

## Local Install

From this repository:

```bash
pip install -e ./sdk
```

Install with FastAPI example dependencies:

```bash
pip install -e './sdk[examples]'
```

## Example

```python
from codex_bridge_sdk import create_chat_client

client = create_chat_client("http://127.0.0.1:47831")
reply = client.chat(
    {
        "model": "gpt-5.4",
        "reasoningEffort": "medium",
        "messages": [{"role": "user", "content": "Explain this file."}],
    }
)

print(reply["outputText"])
```

## FastAPI Example

A minimal proxy example lives in [`examples/fastapi_app.py`](./examples/fastapi_app.py).

Run it with:

```bash
pip install -e './sdk[examples]'
uvicorn fastapi_app:app --app-dir sdk/examples --reload
```

## Tests

```bash
PYTHONPATH=sdk/src python -m unittest discover -s sdk/tests -p 'test_*.py'
```
