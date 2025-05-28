import { Octokit } from '@octokit/rest';
import type { Endpoints } from '@octokit/types';

export type Repository = Endpoints['GET /orgs/{org}/repos']['response']['data'][number];
export type PullRequestFromList = Endpoints['GET /repos/{owner}/{repo}/pulls']['response']['data'][number];
export type PullRequestDetail = Endpoints['GET /repos/{owner}/{repo}/pulls/{pull_number}']['response']['data'];
// Define type for items returned by search API for pull requests
// This type is based on the GET /search/issues endpoint, which is used for searching PRs as well.
export type SearchedPullRequestItem = Endpoints['GET /search/issues']['response']['data']['items'][number];

export interface DisplayablePullRequest {
  id: number;
  number: number;
  title: string;
  user: {
    login: string;
    avatar_url?: string; // Optional, but good to have for UI
    html_url?: string; // Optional
  } | null;
  state: 'open' | 'closed' | 'merged';
  created_at: string;
  updated_at: string; // Added as it's common and useful
  html_url: string;
  merged_at: string | null | undefined; // Keep this for accurate merged state
  closed_at: string | null | undefined; // Keep this for accurate closed state
  repository_url?: string; // from search results
}

const MAX_PER_PAGE = 100;

const createOctokit = (accessToken: string): Octokit => {
  return new Octokit({ auth: accessToken });
};

/**
 * Fetches the list of repositories for the organization
 */
export const getRepositories = async (accessToken: string, org: string): Promise<Repository[]> => {
  const octokit = createOctokit(accessToken);
  const repositories: Repository[] = [];

  for await (const { data } of octokit.paginate.iterator(octokit.rest.repos.listForOrg, { org, per_page: MAX_PER_PAGE })) {
    repositories.push(...data);
  }
  return repositories;
};

/**
 * Fetches the list of pull requests by page
 * @returns An object containing the list of pull requests and the maximum number of pages
 */
export const getPullRequestsWithMaxPage = async (
  accessToken: string,
  org: string,
  repo: string,
  page: number,
  keyword?: string,
): Promise<{ pullRequests: DisplayablePullRequest[]; maxPage: number }> => {
  const octokit = createOctokit(accessToken);
  const perPage = 10;

  if (keyword && keyword.trim() !== '') {
    const query = `repo:${org}/${repo} ${keyword.trim()} is:pr`;
    const response = await octokit.request('GET /search/issues', {
      q: query,
      per_page: perPage,
      page,
    });

    let maxPage = 1;
    const link = response.headers.link;
    const match = link?.match(/<[^>]+[?&]page=(\d+)[^>]*>;\s*rel="last"/);
    if (match != null) {
      maxPage = Number(match[1]);
    }

    const pullRequests: DisplayablePullRequest[] = response.data.items.map((item: SearchedPullRequestItem) => ({
      id: item.id,
      number: item.number,
      title: item.title,
      user: item.user ? { login: item.user.login, avatar_url: item.user.avatar_url, html_url: item.user.html_url } : null,
      // For search results, 'merged' state is not directly available.
      // We use item.state ('open' or 'closed'). If closed, it might be merged or just closed.
      // PullRequestCard will need to handle this ambiguity if it wants to show 'merged' distinctly.
      // For now, we map 'closed' from search as 'closed', not 'merged'.
      state: item.state === 'open' ? 'open' : 'closed',
      created_at: item.created_at,
      updated_at: item.updated_at,
      html_url: item.html_url,
      merged_at: null, // Not available directly from search/issues
      closed_at: item.closed_at,
      repository_url: item.repository_url,
    }));
    return { pullRequests, maxPage };
  }
  // If no keyword, list all pull requests
  const response = await octokit.rest.pulls.list({
    owner: org,
    repo,
    state: 'all',
    per_page: perPage,
    page,
  });

  let maxPage = 1;
  const link = response.headers.link;
  const match = link?.match(/<[^>]+[?&]page=(\d+)[^>]*>;\s*rel="last"/);
  if (match != null) {
    maxPage = Number(match[1]);
  }

  const pullRequests: DisplayablePullRequest[] = response.data.map((pr: PullRequestFromList) => ({
    id: pr.id,
    number: pr.number,
    title: pr.title,
    user: pr.user ? { login: pr.user.login, avatar_url: pr.user.avatar_url, html_url: pr.user.html_url } : null,
    state: pr.merged_at ? 'merged' : pr.state === 'open' ? 'open' : 'closed',
    created_at: pr.created_at,
    updated_at: pr.updated_at,
    html_url: pr.html_url,
    merged_at: pr.merged_at,
    closed_at: pr.closed_at,
  }));
  return { pullRequests, maxPage };
};

/**
 * Fetches the details of a specific pull request
 */
export const getPullRequest = async (accessToken: string, owner: string, repo: string, pull_number: number): Promise<PullRequestDetail> => {
  const octokit = createOctokit(accessToken);
  const response = await octokit.rest.pulls.get({ owner, repo, pull_number });

  return response.data;
};

/**
 * Searches for pull requests by a keyword using the GET /search/issues endpoint.
 * This searches across all of GitHub. To limit to specific repos or orgs,
 * include qualifiers in the keyword string (e.g., "repo:owner/repo my keyword").
 * @param accessToken GitHub personal access token
 * @param keyword The keyword to search for in pull requests
 * @returns A promise that resolves to an array of pull requests matching the keyword
 */
export const searchPullRequestsByKeyword = async (accessToken: string, keyword: string): Promise<SearchedPullRequestItem[]> => {
  const octokit = createOctokit(accessToken);
  try {
    // Use octokit.request() to directly call the GET /search/issues endpoint.
    // The 'is:pr' qualifier in the query string ensures we only get pull requests.
    const response = await octokit.request('GET /search/issues', {
      q: `${keyword} is:pr`, // Append 'is:pr' to filter for pull requests
      // Add other parameters like sort, order, per_page, page as needed
      // headers: { 'X-GitHub-Api-Version': '2022-11-28' } // Optional: Specify API version
    });
    // The search API (search/issues) can return both issues and PRs.
    // The `is:pr` qualifier filters for PRs.
    // The items should conform to SearchedPullRequestItem if the query is correct and items are PRs.
    return response.data.items as SearchedPullRequestItem[];
  } catch (error) {
    console.error('Error searching pull requests by keyword:', error);
    throw error;
  }
};
