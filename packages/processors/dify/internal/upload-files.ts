import type { IFileChange } from '../../../core/src/types/file.ts';
import type { ImpactLevel, OverallSummary, ReviewAspect, SummaryResponse } from '../../base/schema.ts';
import { UploadResponseSchema } from './schema.ts';

/**
 * Type for file change data that can be uploaded
 */
export type UploadFileChange = Pick<IFileChange, 'path' | 'patch'> & { type?: 'change' };

/**
 * Valid content types for upload
 */
export type UploadContent =
  | UploadFileChange // File change data
  | SummaryResponse // File summary data
  | { key: string; description: string; impact: ImpactLevel } // Review aspect data
  | { description: string; crossCuttingConcerns: string[] | undefined }; // Partial overall summary

/**
 * Upload a JSON file to Dify API and get file ID.
 * Accepts either file change information or summary data.
 *
 * @param baseUrl - Base URL for Dify API
 * @param apiKey - API key for the upload
 * @param user - User identifier
 * @param content - Content to upload (either file change or summary data)
 * @param fileName - Name of the file to upload (defaults to data.json)
 * @returns Uploaded file ID
 */
export async function uploadFile(
  baseUrl: string,
  apiKey: string,
  user: string,
  content: UploadContent | UploadContent[] | string, // Allow JSON string
  fileName = 'data.json',
): Promise<string> {
  const maxRetries = 3;
  const retryDelay = 1000; // 1 second

  // Create FormData with JSON file
  const formData = new FormData();
  const jsonString = typeof content === 'string' ? content : JSON.stringify(content);
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
