import { Octokit } from '@octokit/rest';
import type { Endpoints } from '@octokit/types';

export type Repository = Endpoints['GET /orgs/{org}/repos']['response']['data'][number];
export type PullRequest = Endpoints['GET /repos/{owner}/{repo}/pulls']['response']['data'][number];
export type PullRequestDetail = Endpoints['GET /repos/{owner}/{repo}/pulls/{pull_number}']['response']['data'];
// Define type for items returned by search API for pull requests
// This type is based on the GET /search/issues endpoint, which is used for searching PRs as well.
export type SearchedPullRequest = Endpoints['GET /search/issues']['response']['data']['items'][number];

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
): Promise<{ pullRequests: PullRequest[]; maxPage: number }> => {
  const octokit = createOctokit(accessToken);
  const response = await octokit.rest.pulls.list({
    owner: org,
    repo,
    state: 'all',
    per_page: 10,
    page,
  });

  let maxPage = 1;
  const link = response.headers.link;
  const match = link?.match(/<[^>]+[?&]page=(\d+)[^>]*>;\s*rel="last"/);
  if (match != null) {
    maxPage = Number(match[1]);
  }

  return { pullRequests: response.data, maxPage };
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
export const searchPullRequestsByKeyword = async (accessToken: string, keyword: string): Promise<SearchedPullRequest[]> => {
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
    // The items should conform to SearchedPullRequest if the query is correct and items are PRs.
    return response.data.items as SearchedPullRequest[];
  } catch (error) {
    console.error('Error searching pull requests by keyword:', error);
    throw error;
  }
};
