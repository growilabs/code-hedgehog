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
