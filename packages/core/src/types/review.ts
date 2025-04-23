/**
 * Type of review comment
 */
export type CommentType = 'inline' | 'file' | 'pr';

/**
 * Represents a review comment on a pull request
 */
export interface IReviewComment {
  /**
   * Target file path for the comment
   */
  path: string;

  /**
   * Position in the diff (for inline comments)
   */
  position?: number;

  /**
   * Comment content
   */
  body: string;

  /**
   * Type of comment
   */
  type: CommentType;
}
