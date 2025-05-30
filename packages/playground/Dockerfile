# Build stage
FROM denoland/deno:2.3.2 AS builder

WORKDIR /app

# Copy root deno.jsonc and other packages first if they are needed globally or by multiple stages
COPY deno.jsonc .
# Assuming these packages are at the root of the build context (repository root)
COPY packages/action ./packages/action
COPY packages/core ./packages/core
COPY packages/processors ./packages/processors

# Now, set WORKDIR for the playground app specifics
WORKDIR /app/packages/playground

# Copy only necessary files for building the playground app
# Paths are relative to the build context (repository root)
COPY packages/playground/deno.jsonc .
COPY packages/playground/vite.config.ts .
COPY packages/playground/index.html .
COPY packages/playground/server.ts .
COPY packages/playground/src ./src
COPY packages/playground/public ./public

# Copy .env file for build-time environment variables
COPY packages/playground/.env* ./

# Build the application
# This command will be executed in /app/packages/playground
RUN deno run -A --node-modules-dir npm:vite build

# Runtime stage
FROM denoland/deno:2.3.2

WORKDIR /app

# Copy root deno.jsonc and other packages again for the runtime environment
COPY deno.jsonc .
COPY packages/action ./packages/action
COPY packages/core ./packages/core
COPY packages/processors ./packages/processors

WORKDIR /app/packages/playground

# Copy built artifacts from the builder stage
# The source paths in --from=builder are absolute paths within the builder container
COPY --from=builder /app/packages/playground/dist ./dist
COPY --from=builder /app/packages/playground/deno.jsonc ./
COPY --from=builder /app/packages/playground/server.ts ./

# Expose the port the app runs on
EXPOSE 8000

ENV DENO_ENV=production

# Define the command to run the application
CMD ["deno", "run", "--allow-net", "--allow-read", "--allow-env", "server.ts"]