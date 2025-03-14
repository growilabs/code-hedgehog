import type { IFileChange } from './file.ts';
import type { IPullRequestInfo } from './github.ts';
import type { IReviewComment } from './review.ts';

export type IPullRequestProcessedResult = {
  updatedPrInfo?: IPullRequestInfo;
  comments?: IReviewComment[];
};

export interface IPullRequestProcessor {
  /**
   * Performs code review on file changes
   * @param prInfo Pull request information
   * @param files List of file changes to review
   * @returns Review comments
   */
  process(prInfo: IPullRequestInfo, files: IFileChange[]): Promise<IPullRequestProcessedResult>;

  // TODO: will be implemented in the future
  // getPullRequestInfo(): Promise<IPullRequestInfo>;
  // updatePullRequestTitle(title: string): Promise<void>;
  // updatePullRequestBody(body: string): Promise<void>;
  // addLabels(labels: string[]): Promise<void>;
}
