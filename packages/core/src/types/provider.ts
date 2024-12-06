import type { IFileChange } from './file';
import type { IReviewComment } from './review';

export interface IReviewProvider {
  /**
   * Performs code review on file changes
   * @param files List of file changes to review
   * @returns Review comments
   */
  review(files: IFileChange[]): Promise<IReviewComment[]>;
}
