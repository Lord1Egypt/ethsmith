FROM node:22-slim AS base

# System deps for LevelDB native bindings
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps first — postinstall downloads Foundry to ~/.ethsmith/bin/
COPY package.json package-lock.json ./
COPY scripts/ ./scripts/
RUN npm ci --omit=dev

# Foundry binaries land in ~/.ethsmith/bin/ — add to PATH
ENV PATH="/root/.ethsmith/bin:${PATH}"

COPY bin/ ./bin/
COPY src/ ./src/

RUN chmod +x bin/ethsmith.js

# Only persist the DB directory, not the entire ~/.ethsmith
# (binaries stay in the image layer, DB is user data)
VOLUME ["/root/.ethsmith/db"]

EXPOSE 8545

ENV ETHSMITH_LOG_LEVEL=info
ENV NODE_ENV=production

ENTRYPOINT ["node", "/app/bin/ethsmith.js"]
CMD ["node", "--deterministic"]
