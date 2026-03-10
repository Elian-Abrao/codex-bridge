FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV CODEX_BRIDGE_HOST=0.0.0.0
ENV CODEX_BRIDGE_PORT=47831
ENV CODEX_BRIDGE_AUTH_STORE_PATH=/data/auth/codex-session.json
ENV CODEX_BRIDGE_DISABLE_KEYRING=1

WORKDIR /app

COPY pyproject.toml README.md LICENSE ./
COPY src ./src

RUN python -m pip install --no-cache-dir .

VOLUME ["/data"]

EXPOSE 47831

CMD ["codex-bridge", "serve", "--host", "0.0.0.0", "--port", "47831"]
