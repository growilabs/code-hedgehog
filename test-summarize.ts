import dotenvx from "npm:@dotenvx/dotenvx";

// Load environment variables from both files
await dotenvx.config({
  path: ['.act.env', '.act.secrets']
});

async function main() {
  const baseUrl = Deno.env.get('DIFY_API_BASE_URL');
  if (!baseUrl) {
    throw new Error('DIFY_API_BASE_URL is not set in .act.env');
  }

  const apiKey = Deno.env.get('DIFY_API_KEY_SUMMARIZE');
  if (!apiKey) {
    throw new Error('DIFY_API_KEY_SUMMARIZE is not set in .act.secrets');
  }

  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      inputs: {
        title: 'Test PR Title',
        description: 'Test PR Description',
        filePath: 'path/to/file.txt',
        patch: 'No changes',
        needsReviewPre: "true",
      },
      response_mode: 'blocking' as const,
      user: 'moogle',
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  console.log('Raw Response:', { response });
  const data = await response.json();
  console.log('\nResponse Body:', JSON.stringify(data, null, 2));
}

main();
