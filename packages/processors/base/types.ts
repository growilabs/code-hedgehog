import type { ReviewConfig as CoreReviewConfig } from '@code-hedgehog/core'; // Import CoreReviewConfig directly from core
// Import core types and config alias from deps.ts
import type { IFileChange, IPullRequestInfo, IPullRequestProcessedResult, IPullRequestProcessor } from './deps.ts'; // Removed CoreReviewConfig import from deps.ts
import type { ReviewAspect, SummaryResponse } from './schema.ts';

/**
 * Summarize result
 * Determines if each file change requires detailed review
 */
export type SummarizeResult = Omit<SummaryResponse, 'summary'> & {
  summary?: string;
  /** Review aspects relevant to this file */
  aspects: ReviewAspect[];
};

// --- Types moved from deps.ts ---
// Redundant aliases removed. Use core types (IFileChange etc.) directly within the module.
// Export aliases can be defined in mod.ts if needed.

// Configuration types specific to this module
export interface TokenConfig {
  margin: number;
  maxTokens: number;
}

export interface PathInstruction {
  path: string;
  instructions: string;
}

// Base review configuration extending the core config
export interface FileFilterConfig {
  exclude: string[];
  max_changes: number;
}

export interface LocalReviewConfig {
  language: string;
  file_path_instructions: PathInstruction[];
  path_filters?: string; // Optional for backward compatibility
  file_filter: FileFilterConfig; // New filter structure
  skip_simple_changes: boolean;
  review_diff_since_last_review: boolean;
  severityThreshold: number; // Threshold for comment severity (1-5, default: 3)
}

// Combined review configuration using the imported alias
export interface ReviewConfig extends CoreReviewConfig, LocalReviewConfig {
  path_instructions: PathInstruction[]; // Required by core
}

// BaseReviewConfig alias removed for simplicity. Use ReviewConfig directly.
