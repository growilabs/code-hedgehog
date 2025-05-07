import type { IFileChange } from './file.ts';
import type { CommentInfo, IReviewComment } from './review.ts';
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
 * Input for the main processing flow of a pull request.
 */
export interface ProcessInput {
  prInfo: IPullRequestInfo;
  files: IFileChange[];
  config?: ReviewConfig;
  commentHistory?: CommentInfo[];
}

/**
 * Interface for processor implementing two-phase review process
 */
export interface IPullRequestProcessor {
  /**
   * Main processing flow
   */
  process(input: ProcessInput): Promise<IPullRequestProcessedResult>;
}
