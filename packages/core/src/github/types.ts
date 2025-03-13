import type {
  IFileChange,
  IPullRequestInfo,
  IReviewComment,
} from '../types/mod.ts';

/**
 * Interface for GitHub API client operations
 */
export interface IGitHubClient {
  /**
   * Fetches pull request metadata
   */
  getPullRequestInfo(): Promise<IPullRequestInfo>;

  /**
   * Creates an async iterator that yields batches of file changes from a pull request
   * @param batchSize Number of files to process in each batch
   */
  getPullRequestChangesStream(
    batchSize?: number,
  ): AsyncIterableIterator<IFileChange[]>;

  /**
   * Creates a review with a batch of comments on a pull request
   * @param comments Array of review comments to post
   */
  createReviewBatch(comments: IReviewComment[]): Promise<void>;
}
