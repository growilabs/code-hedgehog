import { processSummarizeResponse } from '../../internal/run-workflow.ts';

async function main() {
  const baseUrl = Deno.env.get('DIFY_API_BASE_URL');
  if (!baseUrl) {
    throw new Error('DIFY_API_BASE_URL is not set in .act.env');
  }

  const apiKey = Deno.env.get('DIFY_API_KEY_SUMMARIZE');
  if (!apiKey) {
    throw new Error('DIFY_API_KEY_SUMMARIZE is not set in .act.secrets');
  }

  const response = await fetch(`${baseUrl}/workflows/run`, {
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
        needsReviewPre: 'true',
      },
      response_mode: 'blocking' as const,
      user: 'moogle',
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  // Get raw response data
  const data = await response.json();
  console.log('\nRaw Response Body:', JSON.stringify(data, null, 2));

  try {
    // Process and validate response
    console.log('\nAttempting to process and validate response...');
    const validatedData = processSummarizeResponse(data);
    console.log('\nValidated Summary Response:', JSON.stringify(validatedData, null, 2));
  } catch (error) {
    console.error('\nValidation Error:', error);
    console.log('\nOutputs data:', data.data?.outputs);
  }
}

main();
