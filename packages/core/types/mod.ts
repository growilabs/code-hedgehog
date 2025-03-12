/**
 * Represents a file change in a pull request
 */
export interface IFileChange {
  /**
   * File path relative to repository root
   */
  path: string;

  /**
   * Patch/diff information
   */
  patch: string | null;

  /**
   * Number of lines changed
   */
  changes: number;

  /**
   * Type of change
   */
  status: 'added' | 'modified' | 'removed' | 'renamed' | 'changed';
}

/**
 * GitHub specific configuration
 */
export interface IGitHubConfig {
  /**
   * GitHub API token
   */
  token: string;

  /**
   * Repository owner
   */
  owner: string;

  /**
   * Repository name
   */
  repo: string;

  /**
   * Pull request number
   */
  pullNumber: number;
}

/**
 * Pull request metadata
 */
export interface IPullRequestInfo {
  /**
   * Pull request title
   */
  title: string;

  /**
   * Pull request description/body
   */
  body: string;

  /**
   * Base branch name
   */
  baseBranch: string;

  /**
   * Head branch name
   */
  headBranch: string;
}

/**
 * Type of review comment
 */
export type CommentType = 'inline' | 'pr';

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
 * Result of processing a pull request
 */
export type IPullRequestProcessedResult = {
  updatedPrInfo?: IPullRequestInfo;
  comments?: IReviewComment[];
};

/**
 * Interface for pull request processors
 */
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
