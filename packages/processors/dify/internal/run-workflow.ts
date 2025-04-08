import type { DifyResponse } from '../schema.ts';

/**
 * Execute a Dify workflow with retry logic
 * @param baseUrl - Base URL for Dify API
 * @param apiKey - API key for the workflow
 * @param input - Input for the workflow
 * @returns Result from the workflow execution
 */
export async function runWorkflow(baseUrl: string, apiKey: string, input: string): Promise<string> {
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
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: input,
          }],
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const result = await response.json() as DifyResponse;
      if (!result?.choices?.[0]?.message?.content) {
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
