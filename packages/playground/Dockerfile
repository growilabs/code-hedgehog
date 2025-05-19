# Build stage
FROM denoland/deno:2.3.2 AS builder

WORKDIR /app

# Copy only necessary files for building
COPY deno.jsonc .
COPY vite.config.ts .
COPY index.html .
COPY tsconfig.json .
COPY src ./src
COPY public ./public
# If you have other specific files or directories needed for the build, copy them here.
# For example, if you have a components.json or other configuration files.
# COPY components.json .

# Build the application
# Ensure that deno.jsonc has the necessary tasks or scripts for vite.
# If "deno run -A --node-modules-dir npm:vite build" is the correct command,
# it implies vite is listed as a dependency or installed globally in the image.
# For a cleaner build, consider caching dependencies if possible.
RUN deno run -A --node-modules-dir npm:vite build

# Runtime stage
FROM denoland/deno:2.3.2

WORKDIR /app

# Copy only the built artifacts from the builder stage
COPY --from=builder /app/dist ./dist

# Expose the port the app runs on
EXPOSE 8000

# Define the command to run the application
# Using jsr:@std/http/file-server to serve static files from dist/
CMD ["deno", "run", "--allow-net", "--allow-read", "jsr:@std/http@1/file-server", "dist/"]
