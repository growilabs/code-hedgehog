export interface IFilterConfig {
  /** File patterns to include */
  include: string[];
  /** File patterns to exclude */
  exclude: string[];
  /** Maximum file size in bytes */
  maxFileSize: number;
}

export interface IGitHubConfig {
  /** GitHub API token */
  token: string;
  /** Repository owner */
  owner: string;
  /** Repository name */
  repo: string;
  /** Pull request number */
  pullNumber: number;
}
