import { spy } from '@std/testing/mock';
import type { IFileChange } from '../types/file.ts';
import type { IGitHubAPI } from './github.types.ts';

// Mock response types
export interface PullRequestResponse {
  data: {
    title: string;
    body: string | null;
    base: { ref: string };
    head: { ref: string };
  };
}

// Mock data with exported const
export const mockPullRequest: PullRequestResponse = {
  data: {
    title: 'Test PR',
    body: 'Test description',
    base: { ref: 'main' },
    head: { ref: 'feature' },
  },
};

export const mockFiles: IFileChange[] = [
  {
    path: 'test.ts',
    patch: 'test patch',
    changes: 10,
    status: 'modified',
  },
  {
    path: 'new.ts',
    patch: 'new file',
    changes: 5,
    status: 'added',
  },
];

// Create spies
function createSpies() {
  return {
    getPullRequest: spy(() => Promise.resolve(mockPullRequest)),
    listFiles: spy(() =>
      Promise.resolve({
        data: mockFiles.map((file) => ({
          filename: file.path,
          patch: file.patch,
          changes: file.changes,
          status: file.status,
        })),
      }),
    ),
    createReview: spy(() => Promise.resolve({ data: {} })),
    paginateIterator: spy(async function* () {
      yield {
        headers: { 'x-ratelimit-remaining': '1000' },
        data: mockFiles.map((file) => ({
          filename: file.path,
          patch: file.patch,
          changes: file.changes,
          status: file.status,
        })),
      };
    }),
    endpoint: {
      merge: spy(() => 'GET /repos/{owner}/{repo}/pulls/{pull_number}/files'),
    },
  };
}

// Create mock Octokit instance
export function createMockOctokit() {
  const spies = createSpies();

  const mockApi = {
    rest: {
      pulls: {
        get: spies.getPullRequest,
        listFiles: Object.assign(spies.listFiles, {
          endpoint: {
            merge: spies.endpoint.merge,
          },
        }),
        createReview: spies.createReview,
      },
    },
    paginate: {
      iterator: spies.paginateIterator,
    },
  };

  return {
    mockOctokit: mockApi as unknown as IGitHubAPI,
    spies,
  };
}
