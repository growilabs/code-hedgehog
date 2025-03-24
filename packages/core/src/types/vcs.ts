/**
 * Version Control System types
 */

import type { IFileChange } from './file.ts';
import type { IPullRequestInfo } from './github.ts';
import type { IReviewComment } from './review.ts';

/**
 * Supported VCS types
 */
export type VCSType = 'github' | 'gitlab';

/**
 * Common configuration for VCS providers
 */
export interface IVCSConfig {
  /**
   * VCS type
   */
  type: VCSType;

  /**
   * Authentication token
   */
  token: string;

  /**
   * Repository URL
   * @example "https://github.com/owner/repo"
   * @example "https://gitlab.com/owner/repo"
   */
  repositoryUrl: string;

  /**
   * Pull/Merge request ID
   */
  requestId: string | number;
}

/**
 * Interface for VCS operations
 */
export interface IVersionControlSystem {
  /**
   * VCS provider type
   */
  readonly type: VCSType;

  /**
   * Fetches pull/merge request metadata
   */
  getPullRequestInfo(): Promise<IPullRequestInfo>;

  /**
   * Creates an async iterator that yields batches of file changes
   * @param batchSize Number of files to process in each batch
   */
  getPullRequestChangesStream(batchSize?: number): AsyncIterableIterator<IFileChange[]>;

  /**
   * Creates a review with a batch of comments
   * @param comments Array of review comments to post
   */
  createReviewBatch(comments: IReviewComment[]): Promise<void>;
}
