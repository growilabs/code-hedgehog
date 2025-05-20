import { Octokit } from '@octokit/rest';
import type { Endpoints } from '@octokit/types';

export type Repository = Endpoints['GET /orgs/{org}/repos']['response']['data'][number];
export type PullRequest = Endpoints['GET /repos/{owner}/{repo}/pulls']['response']['data'][number];
export type PullRequestDetail = Endpoints['GET /repos/{owner}/{repo}/pulls/{pull_number}']['response']['data'];

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

export const getPullRequest = async (owner: string, repo: string, pull_number: number): Promise<PullRequestDetail> => {
  const octokit = createOctokit();
  const response = await octokit.rest.pulls.get({ owner, repo, pull_number });

  return response.data;
};
