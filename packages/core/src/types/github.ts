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
