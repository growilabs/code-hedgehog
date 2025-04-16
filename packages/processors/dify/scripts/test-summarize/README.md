# Test Summarize

A test script that uses the Dify API to generate summaries of PRs. This script is used to verify the functionality of the API that summarizes pull request changes and determines if a review is necessary.

## Test Data

The script uses the following test data to call the API:

- Title: "Test PR Title"
- Description: "Test PR Description"
- File path: "path/to/file.txt"
- Changes: "No changes"

## Environment Setup

This script requires Dify API environment variables. For setup instructions, refer to the [project's main README](../../../../../README.md) in the "Test with DifyProcessor" section.

## Running the Script

```bash
deno run --allow-net --allow-env --env-file=.act.env --env-file=.act.secrets packages/processors/dify/scripts/test-summarize/mod.ts
```

### Required Permissions

- `--allow-net`: For HTTP requests to the Dify API
- `--allow-env`: For accessing environment variables
- `--env-file`: For loading environment variable files

## Results

The script outputs the following information:

1. Raw Response: Raw HTTP response data (status code, header information, etc.)
2. Response Body: Dify API response (in JSON format) containing:
   - `summary`: Summary of PR changes
   - `needsReview`: Whether a review is needed
   - `reason`: The reason why a review is or isn't needed

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
      "summary": "No changes.",
      "needsReview": "false",
      "reason": "No review required as there are no changes included."
    },
    "error": null,
    "elapsed_time": 1.5,
    "total_tokens": 650,
    "total_steps": 4
  }
}
```