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
}

export type IPullRequestProcessedResult = {
  updatedPrInfo?: IPullRequestInfo;
  comments?: IReviewComment[];
};

export interface IPullRequestProcessor {
  /**
   * Performs code review on file changes
   * @param prInfo Pull request information
   * @param files List of file changes to review
   * @param config Optional review configuration including path based instructions
   * @returns Review comments and optionally updated PR info
   */
  process(prInfo: IPullRequestInfo, files: IFileChange[], config?: ReviewConfig): Promise<IPullRequestProcessedResult>;

  // TODO: will be implemented in the future
  // getPullRequestInfo(): Promise<IPullRequestInfo>;
  // updatePullRequestTitle(title: string): Promise<void>;
  // updatePullRequestBody(body: string): Promise<void>;
  // addLabels(labels: string[]): Promise<void>;
}
