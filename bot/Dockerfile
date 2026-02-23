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
WORKDIR /app

# Copy both folders
COPY bot ./bot
COPY shared ./shared

# Install shared dependencies
RUN npm install --prefix ./shared

# Switch to bot folder
WORKDIR /app/bot

# Install bot dependencies
COPY bot/package*.json ./
RUN npm ci

# Copy the rest of bot's source code
COPY bot/ .

# Run the build script to compile TypeScript to JavaScript
RUN npm run build

# Your app's start command (from package.json)
CMD [ "npm", "run", "start" ]
