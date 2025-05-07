// Core dependencies
export type { IFileChange, IPullRequestInfo, IPullRequestProcessedResult, IReviewComment, ReviewConfig, CommentType, CommentInfo } from '@code-hedgehog/core'; // Added CommentInfo

// Base processor
export {
  type SummarizeResult,
  type OverallSummary,
  type ReviewComment,
  BaseProcessor,
  SummaryResponseSchema,
  OverallSummarySchema,
  ReviewResponseSchema,
} from '@code-hedgehog/base-processor';

// OpenAI dependencies
export { default as OpenAI } from '@openai/openai';
export { zodResponseFormat } from '@openai/openai/helpers/zod';
export { z } from 'zod';
