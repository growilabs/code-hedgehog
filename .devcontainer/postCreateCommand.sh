# Install uv
curl -LsSf https://astral.sh/uv/install.sh | sh

# Install act
curl --proto '=https' --tlsv1.2 -sSf https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

# Install dependencies
deno install
