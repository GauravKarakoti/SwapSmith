# ---------- Builder ----------
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG GROQ_API_KEY
ENV GROQ_API_KEY=$GROQ_API_KEY


RUN npm run build


# ---------- Runner ----------
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# copy standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["node", "server.js"]
