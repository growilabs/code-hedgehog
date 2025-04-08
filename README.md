# code-hedgehog

## Development Environment

### Setup
1. Install VS Code and Docker
2. Install "Dev Containers" extension
3. Clone the repository
4. Open in Dev Container

### Install act

Install act according to https://nektosact.com/installation/


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
    ./bin/act -e .github/act/test-events/pull_request_2.json
    ```

### Test with OpenaiProcessor

1. Add OpenAI API Key

    ```.act.secrets
    OPENAI_API_KEY=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
    ```

### Test with DifyProcessor

1. Add Dify base URL and API Keys

    ```.act.secrets
    DIFY_API_BASE_URL=https://dify.example.com/v1
    DIFY_API_KEY_TRIAGE=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
    DIFY_API_KEY_REVIEW=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
    ```

