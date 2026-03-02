# ---------- Builder ----------
FROM node:20-alpine AS builder

# Set up root working directory
WORKDIR /app

# Copy the shared directory 
COPY shared ./shared

RUN apk add --no-cache ffmpeg

# ARG key removed for security; keys will be provided at runtime via env variables

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# ---------- Runner ----------
FROM node:20-alpine AS runner

WORKDIR /app/frontend

ENV NODE_ENV=production

# copy standalone output (adjust paths to accommodate the new WORKDIR)
COPY --from=builder /app/frontend/.next/standalone ./
COPY --from=builder /app/frontend/.next/static ./.next/static
COPY --from=builder /app/frontend/public ./public

EXPOSE 3000

CMD ["node", "server.js"]