# code-hobbit




## Development Environment

### Setup
1. Install VS Code and Docker
2. Install "Dev Containers" extension
3. Clone the repository
4. Open in Dev Container

### Package Management
This project uses pnpm for package management. Common commands:

```bash
# Add a dependency to a workspace
pnpm add <package> --filter <workspace>

# Add a development dependency
pnpm add -D <package> --filter <workspace>

# Install all dependencies
pnpm install

# Run tests across all packages
pnpm test
```

### Test with act

1. Add secret
    
    ```.act.secret
    GITHUB_TOKEN=XXXXXXXXXX
    ```

1. Run act
    
    ```bash
    pnpm bin/act
    ```

