import * as core from '@actions/core';
import { mock } from 'vitest-mock-extended';
import type { IGitHubClient } from '../github/types';
import type { IFileChange } from '../types';
import { FileManager } from './manager';

vi.mock('@actions/core', () => ({
  debug: vi.fn(),
  error: vi.fn(),
}));

describe('FileManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockFile = (path: string, changes = 10, status: IFileChange['status'] = 'modified'): IFileChange => ({
    path,
    patch: '@@ -1,1 +1,1 @@',
    changes,
    status,
  });

  describe('collectChangedFiles', () => {
    it('should filter files based on maxChanges', async () => {
      const mockGithubClient = mock<IGitHubClient>();

      const manager = new FileManager(mockGithubClient, {
        maxChanges: 50,
      });

      const mockFiles = [createMockFile('small.ts', 10), createMockFile('large.ts', 100)];

      mockGithubClient.getPullRequestChangesStream.mockImplementation(async function* () {
        yield mockFiles;
      });

      const result: IFileChange[] = [];
      for await (const batch of manager.collectChangedFiles()) {
        result.push(...batch);
      }

      expect(result).toHaveLength(1);
      assert(result[0] != null);
      expect(result[0].path).toBe('small.ts');
      expect(core.debug).toHaveBeenCalledWith(expect.stringContaining('exceeds limit'));
    });

    it('should filter files based on status', async () => {
      const mockGithubClient = mock<IGitHubClient>();
      const manager = new FileManager(mockGithubClient, {
        allowedStatuses: ['added', 'modified'],
      });

      const mockFiles = [createMockFile('added.ts', 10, 'added'), createMockFile('removed.ts', 10, 'removed'), createMockFile('modified.ts', 10, 'modified')];

      mockGithubClient.getPullRequestChangesStream.mockImplementation(async function* () {
        yield mockFiles;
      });

      const result: IFileChange[] = [];
      for await (const batch of manager.collectChangedFiles()) {
        result.push(...batch);
      }

      expect(result).toHaveLength(2);
      expect(result.map((f) => f.path)).toEqual(['added.ts', 'modified.ts']);
    });

    it('should apply include and exclude patterns', async () => {
      const mockGithubClient = mock<IGitHubClient>();
      const manager = new FileManager(mockGithubClient, {
        include: ['**/*.ts'],
        exclude: ['**/generated/**'],
      });

      const mockFiles = [createMockFile('src/index.ts'), createMockFile('src/generated/types.ts'), createMockFile('src/util.js')];

      mockGithubClient.getPullRequestChangesStream.mockImplementation(async function* () {
        yield mockFiles;
      });

      const result: IFileChange[] = [];
      for await (const batch of manager.collectChangedFiles()) {
        result.push(...batch);
      }

      expect(result).toHaveLength(1);
      assert(result[0] != null);
      expect(result[0].path).toBe('src/index.ts');
    });

    it('should handle batch size correctly', async () => {
      const mockGithubClient = mock<IGitHubClient>();
      const manager = new FileManager(mockGithubClient);
      const mockFiles = Array(25)
        .fill(null)
        .map((_, i) => createMockFile(`file${i}.ts`));

      mockGithubClient.getPullRequestChangesStream.mockImplementation(async function* () {
        yield mockFiles;
      });

      const batchSize = 10;
      const batches: IFileChange[][] = [];
      for await (const batch of manager.collectChangedFiles(batchSize)) {
        batches.push(batch);
      }

      expect(batches).toHaveLength(3);
      expect(batches[0]).toHaveLength(10);
      expect(batches[1]).toHaveLength(10);
      expect(batches[2]).toHaveLength(5);
    });

    it('should handle errors during file collection', async () => {
      const mockGithubClient = mock<IGitHubClient>();
      const manager = new FileManager(mockGithubClient);
      const error = new Error('Stream error');

      mockGithubClient.getPullRequestChangesStream.mockImplementation(
        // deno-lint-ignore require-yield
        async function* () {
          throw error;
        },
      );

      await expect(async () => {
        for await (const _ of manager.collectChangedFiles()) {
          // consume iterator
        }
      }).rejects.toThrow('Stream error');

      expect(core.error).toHaveBeenCalledWith(expect.stringContaining('Failed to collect changed files'));
    });
  });
});
