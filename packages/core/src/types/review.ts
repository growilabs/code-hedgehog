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

/**
 * Represents an existing comment retrieved from the VCS (e.g., GitHub).
 * This is distinct from IReviewComment, which represents a comment to be created by the bot.
 */
export interface CommentInfo {
  /**
   * Unique identifier for the comment.
   */
  id: string;

  /**
   * The main content of the comment.
   */
  body: string;

  /**
   * The login name of the user who posted the comment.
   */
  user: string; // Or a more specific User type if available/needed

  /**
   * The timestamp when the comment was created (ISO 8601 format).
   */
  createdAt: string;

  /**
   * The URL to view the comment on the VCS platform.
   */
  url: string;

  /**
   * The path to the file this comment is associated with.
   * Can be undefined for PR-level comments.
   */
  path?: string;

  /**
   * The line number in the file diff this comment is associated with.
   * Can be undefined for PR-level or file-level (non-diff) comments.
   */
  position?: number; // For diff-specific comments

  /**
   * The ID of the comment this comment is a reply to.
   * Undefined if this is a top-level comment in a thread.
   */
  in_reply_to_id?: string;
}
