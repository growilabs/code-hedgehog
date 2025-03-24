/**
 * GitHub API Types
 */

export interface GitHubPullRequest {
  title: string;
  body: string | null;
  base: { ref: string };
  head: { ref: string };
}

export interface GitHubFile {
  filename: string;
  patch: string | null;
  changes: number;
  status: string;
}

export interface GitHubAPIResponse<T> {
  data: T;
}

export interface GitHubPullsAPI {
  get(params: {
    owner: string;
    repo: string;
    pull_number: number;
  }): Promise<GitHubAPIResponse<GitHubPullRequest>>;

  listFiles(params: {
    owner: string;
    repo: string;
    pull_number: number;
    per_page: number;
  }): Promise<GitHubAPIResponse<GitHubFile[]>>;

  createReview(params: {
    owner: string;
    repo: string;
    pull_number: number;
    event: string;
    comments: Array<{
      path: string;
      position?: number;
      body: string;
    }>;
  }): Promise<void>;
}

export interface GitHubRestAPI {
  pulls: GitHubPullsAPI;
}

export interface IGitHubAPI {
  rest: GitHubRestAPI;
  paginate: {
    iterator<T>(method: GitHubPullsAPI[keyof GitHubPullsAPI], params: unknown): AsyncIterableIterator<GitHubAPIResponse<T>>;
  };
}

export type CreateGitHubAPI = (token: string) => IGitHubAPI;
