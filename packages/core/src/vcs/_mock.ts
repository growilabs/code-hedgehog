import { spy } from '@std/testing/mock';
import type { GitHubAPIResponse, GitHubFile, GitHubPullRequest, IGitHubAPI } from './github.types.ts';

// Mock GitHub API responses
export const mockPullRequest: GitHubPullRequest = {
  title: 'Test PR',
  body: 'Test description',
  base: { ref: 'main' },
  head: { ref: 'feature' },
};

export const mockFiles: GitHubFile[] = [
  {
    filename: 'test.ts',
    patch: 'test patch',
    changes: 10,
    status: 'modified',
  },
  {
    filename: 'new.ts',
    patch: 'new file',
    changes: 5,
    status: 'added',
  },
];

// Create fresh spy instances
export function createSpies() {
  return {
    getPullRequest: spy(() => Promise.resolve({ data: mockPullRequest })),
    listFiles: spy(() => Promise.resolve({ data: mockFiles })),
    createReview: spy(() => Promise.resolve()),
    paginateIterator: spy(async function* () {
      yield { data: mockFiles };
    }),
  };
}

// Create fresh mock Octokit instance
export function createMockOctokit() {
  const spies = createSpies();

  const mockOctokit: IGitHubAPI = {
    rest: {
      pulls: {
        get: () => spies.getPullRequest(),
        listFiles: () => spies.listFiles(),
        createReview: (params: { comments: unknown[] }) => {
          if (params.comments.length === 0) {
            return Promise.resolve();
          }
          return spies.createReview();
        },
      },
    },
    paginate: {
      iterator: <T>() => spies.paginateIterator() as AsyncIterableIterator<GitHubAPIResponse<T>>,
    },
  };

  return { mockOctokit, spies };
}
