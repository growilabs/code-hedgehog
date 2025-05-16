# Use the Deno image matching the DevContainer environment
FROM denoland/deno:2.3.2

# Set the working directory in the container
WORKDIR /app

# Copy the Deno configuration file
COPY deno.jsonc .

# Copy the rest of the application code
COPY . .

# Build the application
RUN deno run -A --node-modules-dir npm:vite build

# Expose the port the app runs on
EXPOSE 8000

# Define the command to run the application
CMD ["deno", "run", "--allow-net", "--allow-read", "jsr:@std/http@1/file-server", "dist/"]
