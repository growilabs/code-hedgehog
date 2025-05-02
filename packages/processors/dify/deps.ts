// Core dependencies
export * from '@code-hedgehog/core';

// Base processor dependencies
export {
  BaseProcessor,
  type SummarizeResult,
  type OverallSummary,
  type SummaryResponse,
  ImpactLevel,
  SummaryResponseSchema,
  OverallSummarySchema,
  ReviewResponseSchema,
} from '@code-hedgehog/base-processor';

// External dependencies
export { z } from 'zod';
