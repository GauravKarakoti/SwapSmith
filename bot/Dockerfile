# Use an official Node.js runtime as a parent image
# You can change '18' to match your preferred Node.js version
FROM node:18-slim

# Install ffmpeg
# This runs 'apt-get update' and then 'apt-get install'
RUN apt-get update && apt-get install -y ffmpeg

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install app dependencies
RUN npm install

# Copy the rest of your app's source code
COPY . .

# Run the build script to compile TypeScript to JavaScript
RUN npm run build

# Your app's dev command (from package.json)
CMD [ "npm", "run", "dev" ]