# code-hedgehog

## Development Environment

### Setup
1. Install VS Code and Docker
2. Install "Dev Containers" extension
3. Clone the repository
4. Open in Dev Container

### Test with act

1. Add secret
    
    ```.act.secrets
    GITHUB_TOKEN=XXXXXXXXXX
    ```

    ```.act.env
    CODE_HEDGEHOG_DRY_RUN_VCS_PROCESSING=1
    ```

1. Run act
    
    ```bash
    ./bin/act -e .github/act/test-events/pull_request_1.json
    ```

