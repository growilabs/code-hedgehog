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

// Mock data for listComments
const mockCommentsData = [
  {
    id: 1,
    body: 'Old comment',
    created_at: '2024-01-01T00:00:00Z',
    user: { login: 'user1' },
  },
  {
    id: 2,
    body: 'Latest comment',
    created_at: '2024-01-02T00:00:00Z',
    user: { login: 'user2' },
  },
];

// Mock data for listCommits
const mockCommitsData = [
  { sha: 'commit1', commit: { committer: { date: '2024-01-01T12:00:00Z' } } },
  { sha: 'commit2', commit: { committer: { date: '2024-01-02T12:00:00Z' } } },
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
    paginateIterator: spy(async function* (endpointOptions: { url: string }) {
      // Determine the correct data structure based on the endpoint URL
      const isCompareCommits = endpointOptions.url.includes('/compare/');
      const responseData = isCompareCommits ? { files: mockFiles } : mockFiles;

      yield {
        headers: { 'x-ratelimit-remaining': '1000' },
        data: responseData,
      };
    }),
    listComments: spy(() => Promise.resolve({ data: mockCommentsData })),
    listCommits: spy(() => Promise.resolve({ data: mockCommitsData })),
    compareCommits: spy(() => Promise.resolve({ data: { files: mockFiles } })),
  };
}

/**
 * Creates a mock Octokit instance that implements the minimum required
 * subset of the GitHub API interface. The mock focuses only on the
 * methods actually used by our implementation.
 */
export function createMockOctokit(overrides: Partial<ReturnType<typeof createSpies>> = {}) {
  const defaultSpies = createSpies();
  const spies = { ...defaultSpies, ...overrides }; // Merge defaults with overrides

  const mockApi = {
    rest: {
      pulls: {
        get: spies.getPullRequest,
        listFiles: Object.assign(spies.listFiles, {
          endpoint: {
            merge: spy(() => ({ url: 'GET /repos/{owner}/{repo}/pulls/{pull_number}/files' })),
          },
        }),
        createReview: spies.createReview,
        listCommits: spies.listCommits,
      },
      issues: {
        listComments: spies.listComments,
      },
      repos: {
        compareCommits: Object.assign(spies.compareCommits, {
          endpoint: {
            merge: spy(() => ({ url: 'GET /repos/{owner}/{repo}/compare/{base}...{head}' })),
          },
        }),
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
