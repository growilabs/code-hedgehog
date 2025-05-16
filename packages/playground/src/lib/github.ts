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
  const response = await octokit.rest.repos.listForOrg({
    org,
    per_page: MAX_PER_PAGE,
  });

  return response.data.map((repo) => ({
    id: repo.id,
    name: repo.name,
    full_name: repo.full_name,
  }));
};
