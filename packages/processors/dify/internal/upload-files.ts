import { UploadResponseSchema } from './schema.ts';
/**
 * Upload a file to Dify API and get file ID
 * @param baseUrl - Base URL for Dify API
 * @param apiKey - API key for the upload
 * @param user - User identifier
 * @param fileContent - Content to upload
 * @param mimeType - MIME type of the file
 * @param fileName - Name of the file to upload
 * @returns Uploaded file ID
 */
export async function uploadFile(
  baseUrl: string,
  apiKey: string,
  user: string,
  fileContent: string | Blob,
  mimeType = 'application/json', // defaults to JSON for compatibility
  fileName = 'data.json',
): Promise<string> {
  const maxRetries = 3;
  const retryDelay = 1000; // 1 second

  // Create FormData with JSON file
  const formData = new FormData();
  const blob = typeof fileContent === 'string'
    ? new Blob([fileContent], { type: mimeType })
    : fileContent;
  formData.append('file', blob, fileName);
  formData.append('user', user);

  let lastAttempt = 0;
  while (lastAttempt < maxRetries) {
    lastAttempt++;
    try {
      const response = await fetch(`${baseUrl}/files/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      // Parse and validate response using zod schema
      const rawResult = await response.json();
      const result = UploadResponseSchema.parse(rawResult);

      return result.id;
    } catch (error) {
      const isLastAttempt = lastAttempt === maxRetries;
      const errorObj = error instanceof Error ? error : new Error(String(error));

      if (isLastAttempt) {
        throw errorObj;
      }

      console.warn(`Attempt ${lastAttempt} failed, retrying in ${retryDelay}ms...`, error);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }

  throw new Error('All retry attempts failed');
}
