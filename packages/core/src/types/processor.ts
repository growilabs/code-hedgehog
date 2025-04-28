import type { IFileChange } from './file.ts';
import type { IReviewComment } from './review.ts';
import type { IPullRequestInfo } from './vcs.ts';

/**
 * Path based instruction configuration
 */
interface PathInstruction {
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

export interface IPullRequestProcessor {
  process(prInfo: IPullRequestInfo, files: IFileChange[], config?: ReviewConfig): Promise<IPullRequestProcessedResult>;
}
