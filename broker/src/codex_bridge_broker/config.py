BRIDGE_SERVICE_NAME = "codex-bridge"
BRIDGE_API_PREFIX = "/v1"
DEFAULT_BIND_HOST = "127.0.0.1"
DEFAULT_BIND_PORT = 47831
DEFAULT_CODEX_MODEL = "gpt-5.4"
DEFAULT_REASONING_EFFORT = "medium"

DEFAULT_CODEX_MODELS = [
    {
        "id": "gpt-5.4",
        "label": "gpt-5.4",
        "description": "Balanced default for Codex-backed chat workflows.",
        "recommended": True,
    },
    {
        "id": "gpt-5",
        "label": "gpt-5",
        "description": "General-purpose GPT-5 model for broader compatibility.",
    },
    {
        "id": "gpt-5-mini",
        "label": "gpt-5-mini",
        "description": "Lower-latency GPT-5 option for lighter tasks.",
    },
]

DEFAULT_CODEX_REASONING_EFFORTS = [
    {
        "id": "none",
        "label": "None",
        "description": "Fastest profile with reasoning effectively disabled.",
    },
    {
        "id": "low",
        "label": "Low",
        "description": "Light reasoning for straightforward tasks.",
    },
    {
        "id": "medium",
        "label": "Medium",
        "description": "Balanced reasoning depth for most requests.",
        "recommended": True,
    },
    {
        "id": "high",
        "label": "High",
        "description": "More deliberate reasoning for harder prompts.",
    },
    {
        "id": "xhigh",
        "label": "XHigh",
        "description": "Maximum reasoning depth for the hardest prompts.",
    },
]
