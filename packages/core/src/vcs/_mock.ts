/**
 * GitHub API Mock Implementation
 *
 * This module provides mock data and implementations for testing the GitHub VCS integration.
 * The mock data follows the actual GitHub API response structure while keeping the implementation
 * minimal and focused on the features we actually use.
 */
import { spy } from '@std/testing/mock';
import type { IGitHubAPI } from './github.types.ts';

/**
 * Mock response data structured to match GitHub API responses
 * We use literal objects instead of class instances to keep the mock simple
 */
export const mockPullRequest = {
  data: {
    title: 'Test PR',
    body: 'Test description',
    base: { ref: 'main' },
    head: { ref: 'feature' },
  },
};

/**
 * Mock file changes that match the GitHub API response format
 * Note: We use 'as const' to ensure type safety for the status field
 */
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

/**
 * Creates spy functions for all required API methods
 * Each spy returns a Promise that resolves to a mock response
 * matching the GitHub API structure
 */
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

/**
 * Creates a mock Octokit instance that implements the minimum required
 * subset of the GitHub API interface. The mock focuses only on the
 * methods actually used by our implementation.
 */
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
