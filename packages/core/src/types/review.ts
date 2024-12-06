export type CommentType = 'inline' | 'pr';

export interface IReviewComment {
  /** Target file path for the comment */
  path: string;
  /** Position in the diff (for inline comments) */
  position?: number;
  /** Comment content */
  body: string;
  /** Type of comment */
  type: CommentType;
}
