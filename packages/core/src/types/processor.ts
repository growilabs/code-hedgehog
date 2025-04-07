import type { IFileChange } from './file.ts';
import type { IReviewComment } from './review.ts';
import type { IPullRequestInfo } from './vcs.ts';

/**
 * Path based instruction configuration
 */
export interface PathInstruction {
  /** Glob pattern for matching files */
  path: string;
  /** Instructions for matched files */
  instructions: string;
}

/**
 * Triage result
 * Determines if each file change requires detailed review
 */
export interface TriageResult {
  /** Whether detailed review is needed */
  needsReview: boolean;
  /** Triage reason (e.g. "Format changes only", "Contains logic changes") */
  reason: string;
}

/**
 * Model selection configuration
 * Settings for light and heavy models
 */
export interface ModelConfig {
  light: {
    name: string;
    maxTokens: number;
  };
  heavy: {
    name: string;
    maxTokens: number;
  };
}

/**
 * Review configuration including path based instructions
 */
export interface ReviewConfig {
  path_instructions: PathInstruction[];
  model?: ModelConfig;
  skipSimpleChanges?: boolean;
}

export type IPullRequestProcessedResult = {
  updatedPrInfo?: IPullRequestInfo;
  comments?: IReviewComment[];
};

/**
 * Interface for processor implementing two-phase review process
 */
export interface IPullRequestProcessor {
  /**
   * Triage phase - Lightly analyze file changes to determine if detailed review is needed
   *
   * @param prInfo Pull request information
   * @param files List of file changes to review
   * @param config Optional review configuration
   * @returns Map of file paths to triage results
   */
  triage(
    prInfo: IPullRequestInfo, 
    files: IFileChange[], 
    config?: ReviewConfig
  ): Promise<Map<string, TriageResult>>;

  /**
   * Review phase - Execute detailed review based on triage results
   *
   * @param prInfo Pull request information
   * @param files List of file changes to review
   * @param triageResults Previous triage results
   * @param config Optional review configuration
   * @returns Review comments and optionally updated PR info
   */
  review(
    prInfo: IPullRequestInfo,
    files: IFileChange[],
    triageResults: Map<string, TriageResult>,
    config?: ReviewConfig
  ): Promise<IPullRequestProcessedResult>;
}
