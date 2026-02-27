# Use a Node.js version that matches your dependencies (e.g., Node 20)
FROM node:20-slim

# Install ffmpeg AND the tools required to build native addons
RUN apt-get update && apt-get install -y \
    ffmpeg \
    build-essential \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory in the container
WORKDIR /usr/src/app

# 1. Copy the shared directory first
COPY shared ./shared

# 2. Change working directory to bot
WORKDIR /usr/src/app/bot

# 3. Copy bot package files and install dependencies
COPY bot/package*.json ./
RUN npm ci

# 4. Copy the rest of the bot source code
COPY bot/ ./

# Run the build script to compile TypeScript to JavaScript
RUN npm run build

# Your app's start command
CMD [ "npm", "run", "start:render" ]