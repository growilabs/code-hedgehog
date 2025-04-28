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
 * Review configuration including path based instructions
 */
export interface ReviewConfig {
  path_instructions: PathInstruction[];
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
   * Main processing flow
   */
  process(prInfo: IPullRequestInfo, files: IFileChange[], config?: ReviewConfig): Promise<IPullRequestProcessedResult>;
}
