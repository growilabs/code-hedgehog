// Core dependencies
export type { IFileChange, IPullRequestInfo, IPullRequestProcessedResult, IReviewComment, ReviewConfig } from '@code-hedgehog/core';

// Base processor
export {
  type SummarizeResult,
  type OverallSummary,
  type ReviewComment,
  BaseProcessor,
  SummaryResponseSchema,
  ReviewAspectMappingsSchema,
  OverallSummarySchema,
  ReviewResponseSchema
} from '@code-hedgehog/base-processor';

// External dependencies
export { z } from 'zod';

// OpenAI dependencies
export { default as OpenAI } from '@openai/openai';
export { zodResponseFormat } from '@openai/openai/helpers/zod';
