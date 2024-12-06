import type { IFileChange } from './file';
import type { IPullRequestInfo } from './github';
import type { IReviewComment } from './review';

export interface IReviewProvider {
  /**
   * Performs code review on file changes
   * @param prInfo Pull request information
   * @param files List of file changes to review
   * @returns Review comments
   */
  reviewBatch(prInfo: IPullRequestInfo, files: IFileChange[]): Promise<IReviewComment[]>;
}
