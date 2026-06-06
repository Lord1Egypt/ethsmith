FROM node:22-slim AS base

# Install system deps for LevelDB native bindings + curl for foundryup
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    python3 \
    make \
    g++ \
    git \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# ── Install Foundry (forge, cast, anvil, chisel) ─────────────────────────────
RUN curl -L https://foundry.paradigm.xyz | bash
ENV PATH="/root/.foundry/bin:${PATH}"
RUN foundryup

# ── Install ethsmith ─────────────────────────────────────────────────────────
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY bin/ ./bin/
COPY src/ ./src/

RUN chmod +x bin/ethsmith.js

# ── Runtime ──────────────────────────────────────────────────────────────────
VOLUME ["/root/.ethsmith"]

EXPOSE 8545

ENV ETHSMITH_LOG_LEVEL=info
ENV NODE_ENV=production

ENTRYPOINT ["node", "/app/bin/ethsmith.js"]
CMD ["node", "--host", "0.0.0.0", "--deterministic"]
