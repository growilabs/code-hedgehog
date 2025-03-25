import { spy } from '@std/testing/mock';
import type { IFileChange } from '../types/file.ts';
import type { IGitHubAPI } from './github.types.ts';

// Mock response data
export const mockPullRequest = {
  data: {
    title: 'Test PR',
    body: 'Test description',
    base: { ref: 'main' },
    head: { ref: 'feature' },
  },
};

// Mock files using octokit response format
export const mockFiles = [
  {
    filename: 'test.ts',
    patch: 'test patch',
    changes: 10,
    status: 'modified' as const,
  },
  {
    filename: 'new.ts',
    patch: 'new file',
    changes: 5,
    status: 'added' as const,
  },
];

// Create spies
function createSpies() {
  return {
    getPullRequest: spy(() => Promise.resolve(mockPullRequest)),
    listFiles: spy(() => Promise.resolve({ data: mockFiles })),
    createReview: spy(() => Promise.resolve({ data: {} })),
    paginateIterator: spy(async function* () {
      yield {
        headers: { 'x-ratelimit-remaining': '1000' },
        data: mockFiles,
      };
    }),
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
            merge: spy(() => 'GET /repos/{owner}/{repo}/pulls/{pull_number}/files'),
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
