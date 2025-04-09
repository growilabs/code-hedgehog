import type { DifyRequestBody } from './schema.ts';
import { DifyResponseSchema } from './schema.ts';


/**
 * Execute a Dify workflow with retry logic
 * @param baseUrl - Base URL for Dify API
 * @param apiKey - API key for the workflow
 * @param input - Input for the workflow
 * @returns Result from the workflow execution
 */
export async function runWorkflow(baseUrl: string, apiKey: string, body: DifyRequestBody): Promise<string> {
  const maxRetries = 3;
  const retryDelay = 1000; // 1 second

  let lastAttempt = 0;
  while (lastAttempt < maxRetries) {
    lastAttempt++;
    try {
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      // Parse and validate response using zod schema
      const rawResult = await response.json();
      const result = DifyResponseSchema.parse(rawResult);
      
      // Ensure required data exists
      if (!result.choices[0]?.message?.content) {
        throw new Error('Invalid response format from Dify API');
      }

      return result.choices[0].message.content;
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
