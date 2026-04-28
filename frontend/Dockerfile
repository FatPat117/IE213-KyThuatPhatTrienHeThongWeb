# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_ADMIN_WALLETS
ARG NEXT_PUBLIC_CROWDFUNDING_CONTRACT_ADDRESS
ARG NEXT_PUBLIC_SEPOLIA_RPC_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_ADMIN_WALLETS=$NEXT_PUBLIC_ADMIN_WALLETS
ENV NEXT_PUBLIC_CROWDFUNDING_CONTRACT_ADDRESS=$NEXT_PUBLIC_CROWDFUNDING_CONTRACT_ADDRESS
ENV NEXT_PUBLIC_SEPOLIA_RPC_URL=$NEXT_PUBLIC_SEPOLIA_RPC_URL

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
