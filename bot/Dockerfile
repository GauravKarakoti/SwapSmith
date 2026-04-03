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

# Install shared dependencies (ADDED)
WORKDIR /usr/src/app/shared
RUN npm install

# Install bot dependencies
WORKDIR /usr/src/app/bot
RUN npm install

# Stage 2: Build the application
FROM node:20-slim AS builder
WORKDIR /usr/src/app

COPY --from=deps /usr/src/app/bot/node_modules ./bot/node_modules
# Copy shared node_modules (ADDED)
COPY --from=deps /usr/src/app/shared/node_modules ./shared/node_modules 
COPY shared ./shared
COPY bot ./bot

# Build the shared directory first to generate the dist folder (ADDED)
WORKDIR /usr/src/app/shared
RUN npm run build

# Then build the bot directory
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

# FIX: Create the logs directory and give botuser ownership of the working directory
RUN mkdir -p /usr/src/app/bot/logs && chown -R botuser:nodejs /usr/src/app/bot

# Copy built artifacts and production dependencies
COPY --from=builder --chown=botuser:nodejs /usr/src/app/bot/package.json ./
COPY --from=builder --chown=botuser:nodejs /usr/src/app/bot/dist ./dist
COPY --from=builder --chown=botuser:nodejs /usr/src/app/bot/node_modules ./node_modules
COPY --from=builder --chown=botuser:nodejs /usr/src/app/bot/scripts ./scripts
COPY --from=builder --chown=botuser:nodejs /usr/src/app/shared ./dist/shared

USER botuser

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f https://swapsmith-5e8y.onrender.com/health || exit 1

# Your app's start command
CMD [ "npm", "run", "start:render" ]