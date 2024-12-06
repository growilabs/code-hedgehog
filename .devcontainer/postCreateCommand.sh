# Setup pnpm
SHELL=bash pnpm setup
eval "$(cat /home/vscode/.bashrc)"

# Install act
curl -s https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

# Install global packages
pnpm install turbo @devcontainers/cli act --global

# Install dependencies
turbo run bootstrap