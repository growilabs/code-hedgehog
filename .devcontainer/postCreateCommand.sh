# Setup pnpm
SHELL=bash pnpm setup
eval "$(cat /home/vscode/.bashrc)"

# Install global packages
pnpm install turbo @devcontainers/cli act --global

# Install dependencies
turbo run bootstrap