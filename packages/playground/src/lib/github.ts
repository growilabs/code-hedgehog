import { Octokit } from '@octokit/rest';

const MAX_PER_PAGE = 100;

const createOctokit = (): Octokit => {
  return new Octokit({
    auth: import.meta.env.VITE_GITHUB_TOKEN,
  });
};

export type Repository = {
  id: number;
  name: string;
  full_name: string;
};

/**
 * Fetches the list of repositories for the organization
 */
export const getRepositories = async (org: string): Promise<Repository[]> => {
  const octokit = createOctokit();
  const repositories: Repository[] = [];

  for await (const { data } of octokit.paginate.iterator(octokit.rest.repos.listForOrg, { org, per_page: MAX_PER_PAGE })) {
    repositories.push(
      ...data.map((repo) => ({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
      })),
    );
  }
  return repositories;
};

export type PullRequest = {
  id: number;
  number: number;
  title: string;
  state: string;
  created_at: string;
  updated_at: string;
  user: {
    login: string | undefined;
    avatar_url: string | undefined;
  };
};

export const getPullRequestsWithMaxPage = async (org: string, repo: string, page: number): Promise<{ pullRequests: PullRequest[]; maxPage: number }> => {
  const octokit = createOctokit();
  const response = await octokit.rest.pulls.list({
    owner: org,
    repo,
    per_page: 10,
    page,
  });

  let maxPage = 1;
  const link = response.headers.link;
  const match = link?.match(/<[^>]+[?&]page=(\d+)[^>]*>;\s*rel="last"/);
  if (match != null) {
    maxPage = Number(match[1]);
  }

  const pullRequests = response.data.map((pr) => ({
    id: pr.id,
    number: pr.number,
    title: pr.title,
    state: pr.state,
    created_at: pr.created_at,
    updated_at: pr.updated_at,
    user: {
      login: pr.user?.login,
      avatar_url: pr.user?.avatar_url,
    },
  }));

  return { pullRequests, maxPage };
};
