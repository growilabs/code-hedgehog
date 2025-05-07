// Core dependencies
export * from '@code-hedgehog/core';

// Base processor dependencies
export {
  BaseProcessor,
  type SummarizeResult,
  type OverallSummary,
  type ReviewResponse, // Add type export
  type SummaryResponse, // Add type export
  ImpactLevel,
  SummaryResponseSchema, // Keep schema export
  OverallSummarySchema, // Keep schema export
  ReviewResponseSchema, // Keep schema export
} from '@code-hedgehog/base-processor';

// External dependencies
export { z } from 'zod';
