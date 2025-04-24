import process from 'node:process';
import type { z } from '../deps.ts';
import { OverallSummarySchema, ReviewResponseSchema, SummaryResponseSchema } from '../deps.ts';
import type { DifyRequestBody } from './schema.ts';
import { DifyOutputsSchema } from './schema.ts';

type SummaryResponse = z.infer<typeof SummaryResponseSchema>;
type OverallSummary = z.infer<typeof OverallSummarySchema>;
type ReviewResponse = z.infer<typeof ReviewResponseSchema>;

type WorkflowType = 'summarize' | 'grouping' | 'review';

/**
 * Determine workflow type from API key
 */
function getWorkflowType(apiKey: string): WorkflowType {
  const summarizeKey = process.env.DIFY_API_KEY_SUMMARIZE;
  const groupingKey = process.env.DIFY_API_KEY_GROUPING;
  const reviewKey = process.env.DIFY_API_KEY_REVIEW;

  if (apiKey === groupingKey) {
    return 'grouping';
  }
  if (apiKey === reviewKey) {
    return 'review';
  }
  if (apiKey === summarizeKey) {
    return 'summarize';
  }

  throw new Error('Unknown API key');
}

/**
 * Extract outputs from Dify response
 */
function extractOutputs(rawResult: unknown): unknown {
  const validated = DifyOutputsSchema.parse(rawResult);
  return validated.data.outputs;
}

/**
 * Process response for summarize workflow
 */
export function processSummarizeResponse(rawResult: unknown): SummaryResponse {
  const outputs = extractOutputs(rawResult);

  if (typeof outputs === 'object' && outputs && 'needsReview' in outputs) {
    const outputsObj = outputs as { needsReview?: unknown };
    if (outputsObj.needsReview !== undefined) {
      outputsObj.needsReview = String(outputsObj.needsReview) === 'true';
    }
  }

  return SummaryResponseSchema.parse(outputs);
}

/**
 * Process response for grouping workflow
 */
export function processGroupingResponse(rawResult: unknown): OverallSummary {
  const outputs = extractOutputs(rawResult);
  return OverallSummarySchema.parse(outputs);
}

/**
 * Process response for review workflow
 */
export function processReviewResponse(rawResult: unknown): ReviewResponse {
  const outputs = extractOutputs(rawResult);
  return ReviewResponseSchema.parse(outputs);
}

/**
 * Execute a Dify workflow with retry logic
 * @param baseUrl - Base URL for Dify API
 * @param apiKey - API key for the workflow
 * @param input - Input for the workflow
 * @returns Result from the workflow execution
 */
export async function runWorkflow(baseUrl: string, apiKey: string, body: DifyRequestBody): Promise<SummaryResponse | OverallSummary | ReviewResponse> {
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
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      // Parse response
      const rawResult = await response.json();

      // Convert response to string for processing
      const responseStr = JSON.stringify(rawResult);

      // Process response based on workflow type
      const workflowType = getWorkflowType(apiKey);
      let processedResult: SummaryResponse | OverallSummary | ReviewResponse;

      switch (workflowType) {
        case 'summarize':
          return processSummarizeResponse(rawResult);
        case 'grouping':
          return processGroupingResponse(rawResult);
        case 'review':
          return processReviewResponse(rawResult);
        default:
          throw new Error('Unknown workflow type');
      }
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
