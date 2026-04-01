# Stage 1: Install dependencies
FROM node:20-slim AS deps
WORKDIR /usr/src/app

# Install build tools
RUN apt-get update && apt-get install -y \
    python3 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY bot/package*.json ./bot/
COPY shared/package*.json ./shared/

# Install dependencies
WORKDIR /usr/src/app/bot
RUN npm ci

COPY . .

# Stage 2: Build the application
FROM node:20-slim AS builder
WORKDIR /usr/src/app

COPY --from=deps /usr/src/app/bot/node_modules ./bot/node_modules
COPY shared ./shared
COPY bot ./bot

WORKDIR /usr/src/app/bot
RUN npm run build
RUN npm prune --production

# Stage 3: Run the application
FROM node:20-slim AS runner
WORKDIR /usr/src/app/bot

ENV NODE_ENV=production

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    postgresql-client \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user
RUN groupadd -r nodejs && useradd -r -g nodejs botuser

# Copy built artifacts and production dependencies
COPY --from=builder --chown=botuser:nodejs /usr/src/app/bot/package.json ./
COPY --from=builder --chown=botuser:nodejs /usr/src/app/bot/dist ./dist
COPY --from=builder --chown=botuser:nodejs /usr/src/app/bot/node_modules ./node_modules
COPY --from=builder --chown=botuser:nodejs /usr/src/app/bot/scripts ./scripts

# Copy shared directory for secrets loading
COPY --from=builder --chown=botuser:nodejs /usr/src/app/shared ../shared

USER botuser

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Your app's start command
CMD [ "npm", "run", "start:render" ]