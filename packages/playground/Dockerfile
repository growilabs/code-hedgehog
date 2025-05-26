# Build stage
FROM denoland/deno:2.3.2 AS builder

WORKDIR /app/packages/playground

# Copy only necessary files for building
COPY packages/playground/deno.jsonc .
COPY packages/playground/vite.config.ts .
COPY packages/playground/index.html .
COPY packages/playground/server.ts .
COPY packages/playground/src ./src
COPY packages/playground/public ./public

# Copy .env file for build-time environment variables
COPY packages/playground/.env* ./

# Build the application
RUN deno run -A --node-modules-dir npm:vite build

# Runtime stage
FROM denoland/deno:2.3.2

WORKDIR /app

COPY deno.jsonc .
COPY packages/action /app/packages/action
COPY packages/core /app/packages/core
COPY packages/processors /app/packages/processors

WORKDIR /app/packages/playground

# Copy built artifacts from the builder stage
COPY --from=builder /app/packages/playground/dist ./dist
COPY --from=builder /app/packages/playground/deno.jsonc ./
COPY --from=builder /app/packages/playground/server.ts ./

# Expose the port the app runs on
EXPOSE 8000

ENV DENO_ENV=production

# Define the command to run the application
CMD ["deno", "run", "--allow-net", "--allow-read", "--allow-env", "server.ts"]