// Core dependencies
export * from '@code-hedgehog/core';

// Base processor dependencies
export {
  BaseProcessor,
  type SummarizeResult,
  type OverallSummary,
  type ReviewResponse,
  type SummaryResponse,
  type ReviewComment,
  ImpactLevel,
  SummaryResponseSchema,
  OverallSummarySchema,
  ReviewResponseSchema,
  ReviewCommentSchema,
} from '@code-hedgehog/base-processor';

// External dependencies
export { z } from 'zod';
