# Use a Node.js version that matches your dependencies (e.g., Node 20)
FROM node:20-slim

# Install ffmpeg AND the tools required to build native addons
# (build-essential includes 'make', 'g++', etc. python3 is also needed by node-gyp)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    build-essential \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy root package files
COPY package.json package-lock.json ./

# Copy workspace package files (to allow npm ci to work)
COPY shared/package.json ./shared/
COPY bot/package.json ./bot/
COPY frontend/package.json ./frontend/

# Install app dependencies
RUN npm ci

# Copy source code
COPY shared ./shared
COPY bot ./bot

# Build shared workspace
WORKDIR /usr/src/app/shared
RUN npm run build

# Build bot workspace
WORKDIR /usr/src/app/bot
RUN npm run build

# Your app's start command (from bot package.json)
CMD [ "npm", "run", "start" ]
