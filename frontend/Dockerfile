# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

ARG NEXT_PUBLIC_API_URL

COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install only production dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm install sharp

COPY --from=builder /app/next.config.ts ./

# Copy built app from builder
COPY --from=builder /app/.next ./.next
#COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["npm", "start"]
