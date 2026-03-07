FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV CODEX_BRIDGE_HOST=0.0.0.0
ENV CODEX_BRIDGE_PORT=47831
ENV CODEX_BRIDGE_AUTH_STORE_PATH=/data/auth/codex-session.json

EXPOSE 47831

CMD ["npm", "run", "serve"]
