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

# Copy package.json and package-lock.json
COPY package*.json ./

# Install app dependencies
RUN npm ci

# Copy the rest of your app's source code
COPY . .

# Run the build script to compile TypeScript to JavaScript
RUN npm run build

# Your app's start command (from package.json)
CMD [ "npm", "run", "start" ]