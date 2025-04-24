import { uploadFile } from '../../internal/mod.ts';
import { processGroupingResponse } from '../../internal/run-workflow.ts';
import type { DifyRequestBody } from '../../internal/schema.ts';

async function main() {
  const baseUrl = Deno.env.get('DIFY_API_BASE_URL');
  if (!baseUrl) {
    throw new Error('DIFY_API_BASE_URL is not set in .act.env');
  }

  const apiKey = Deno.env.get('DIFY_API_KEY_GROUPING');
  if (!apiKey) {
    throw new Error('DIFY_API_KEY_GROUPING is not set in .act.secrets');
  }

  const testFiles = [
    {
      path: 'test/file1.ts',
      patch: 'Sample patch content 1',
    },
    {
      path: 'test/file2.ts',
      patch: 'Sample patch content 2',
    },
  ];

  const testSummarizeResults = [
    {
      path: 'test/file1.ts',
      summary: 'Test summary for file 1',
      needsReview: true,
      reason: 'Changes require review',
    },
    {
      path: 'test/file2.ts',
      summary: 'Test summary for file 2',
      needsReview: false,
      reason: 'Simple changes',
    },
  ];

  // Upload file data
  console.log('Uploading files data...');
  const filesJson = JSON.stringify(testFiles);
  const filesFileId = await uploadFile(baseUrl, apiKey, 'moogle', filesJson);
  console.log('Files uploaded, ID:', filesFileId);

  // Upload summary data
  console.log('Uploading summary data...');
  const summaryJson = JSON.stringify(testSummarizeResults);
  const summaryFileId = await uploadFile(baseUrl, apiKey, 'moogle', summaryJson);
  console.log('Summary uploaded, ID:', summaryFileId);

  // Execute workflow
  console.log('Executing workflow...');
  const requestBody: DifyRequestBody = {
    inputs: {
      title: 'Test Overall Summary',
      description: 'Testing overall summary generation',
      files: {
        transfer_method: 'local_file',
        upload_file_id: filesFileId,
        type: 'document',
      },
      summarizeResults: {
        transfer_method: 'local_file',
        upload_file_id: summaryFileId,
        type: 'document',
      },
      previousAnalysis: undefined,
    },
    response_mode: 'blocking',
    user: 'moogle',
  };

  const response = await fetch(`${baseUrl}/workflows/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
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
    const validatedData = processGroupingResponse(data);
    console.log('\nValidated Overall Summary:', JSON.stringify(validatedData, null, 2));
  } catch (error) {
    console.error('\nValidation Error:', error);
    console.log('\nOutputs data:', data.data?.outputs);
  }
}

main();
