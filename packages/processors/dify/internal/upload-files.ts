import { UploadResponseSchema } from './schema.ts';

/**
 * JSON serializable value type
 */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
/**
 * Upload a JSON file to Dify API and get file ID.
 * This function is specifically designed for uploading JSON data,
 * which is the only current use case in the application.
 *
 * @param baseUrl - Base URL for Dify API
 * @param apiKey - API key for the upload
 * @param user - User identifier
 * @param fileContent - JSON serializable content to upload
 * @param fileName - Name of the file to upload (defaults to data.json)
 * @returns Uploaded file ID
 */
export async function uploadFile(
  baseUrl: string,
  apiKey: string,
  user: string,
  fileContent: JsonValue | Record<string, unknown>,
  fileName = 'data.json',
): Promise<string> {
  const maxRetries = 3;
  const retryDelay = 1000; // 1 second

  // Create FormData with JSON file
  const formData = new FormData();
  const jsonString = JSON.stringify(fileContent);
  const blob = new Blob([jsonString], { type: 'application/json' });
  formData.append('file', blob, fileName);
  formData.append('user', user);

  let lastAttempt = 0;
  while (lastAttempt < maxRetries) {
    lastAttempt++;
    try {
      const response = await fetch(`${baseUrl}/files/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
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
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }

  throw new Error('All retry attempts failed');
}
