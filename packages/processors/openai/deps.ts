// Core dependencies
export type { IFileChange, IPullRequestInfo, IPullRequestProcessedResult, IReviewComment, ReviewConfig } from '@code-hedgehog/core';

// Base processor
export { BaseProcessor, ImpactLevel } from '@code-hedgehog/base-processor';
export type { TriageResult, OverallSummary, AspectSummary, ReviewAspect } from '@code-hedgehog/base-processor';

// External dependencies
export { z } from 'zod';

// OpenAI dependencies
export { default as OpenAI } from '@openai/openai';
export { zodResponseFormat } from '@openai/openai/helpers/zod';