# Test Review

A test script that uses the Dify API to perform detailed code reviews. This script is used to verify the functionality of the API that analyzes code changes and provides specific feedback and suggestions.

## Test Data

The script uses the following test data to call the API:

- Title: "Add user authentication feature"
- Description: "This PR implements user authentication using JWT tokens"
- File path: "src/auth/auth.service.ts"
- Changes: Implementation of an authentication service using JWT
- Instructions: "Focus on security best practices and error handling"
- Aspects: Security and Authentication domain aspects
- Overall Summary: JWT-based authentication system with cross-cutting concerns

## Environment Setup

This script requires Dify API environment variables. For setup instructions, refer to the [project's main README](../../../../../README.md) in the "Test with DifyProcessor" section.

## Running the Script

```bash
deno run --allow-net --allow-env --env-file=.act.env --env-file=.act.secrets packages/processors/dify/scripts/test-review/mod.ts
```

### Required Permissions

- `--allow-net`: For HTTP requests to the Dify API
- `--allow-env`: For accessing environment variables
- `--env-file`: For loading environment variable files

## Results

The script outputs the following information:

1. Raw Response: Raw HTTP response data (status code, header information, etc.)
2. Response Body: Dify API response (in JSON format) containing:
   - `comments`: Array of review comments with suggestions
   - `summary`: Overall review summary for the file

### Example Output

```json
Response Body: {
  "task_id": "...",
  "workflow_run_id": "...",
  "data": {
    "id": "...",
    "workflow_id": "...",
    "status": "succeeded",
    "outputs": {
      "comments": [
        {
          "content": "Password comparison should use a secure hash comparison",
          "suggestion": "Use bcrypt.compare() instead of direct password comparison",
          "line": 15
        }
      ],
      "summary": "The authentication implementation needs improvements in security practices..."
    },
    "error": null,
    "elapsed_time": 2.5,
    "total_tokens": 850,
    "total_steps": 4
  }
}