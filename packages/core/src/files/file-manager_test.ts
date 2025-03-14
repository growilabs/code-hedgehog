import { assertEquals, assertRejects } from 'https://deno.land/std@0.218.0/assert/mod.ts';
import { assertSpyCalls } from 'https://deno.land/std@0.218.0/testing/mock.ts';
import { debug, error, resetSpies } from '../mocks/actions-core.ts';

import type { IGitHubClient } from '../github/mod.ts';
import type { IFileChange } from '../types/file.ts';
import type { IPullRequestInfo } from '../types/github.ts';
import { FileManager } from './mod.ts';

function createMockFile(path: string, changes = 10, status: IFileChange['status'] = 'modified'): IFileChange {
  return {
    path,
    patch: '@@ -1,1 +1,1 @@',
    changes,
    status,
  };
}

function createMockGithubClient(generator: () => AsyncGenerator<IFileChange[]>): IGitHubClient {
  return {
    getPullRequestChangesStream: generator,
    getPullRequestInfo: async (): Promise<IPullRequestInfo> => ({
      title: 'test PR',
      body: 'test body',
      baseBranch: 'main',
      headBranch: 'feature',
    }),
    createReviewBatch: async () => {
      // Denoでは戻り値の型がvoidなので何も返さない
    },
  };
}

Deno.test('FileManager.collectChangedFiles', async (t) => {
  // 各テストの前にスパイをリセット
  resetSpies();

  await t.step('should filter files based on maxChanges', async () => {
    const mockGithubClient = createMockGithubClient(async function* () {
      yield [createMockFile('small.ts', 10), createMockFile('large.ts', 100)];
    });

    const manager = new FileManager(mockGithubClient, {
      maxChanges: 50,
    });

    const result: IFileChange[] = [];
    for await (const batch of manager.collectChangedFiles()) {
      result.push(...batch);
    }

    assertEquals(result.length, 1);
    assertEquals(result[0].path, 'small.ts');
    assertSpyCalls(debug, 1);
    assertEquals(debug.calls[0].args[0], 'Skipping large.ts: changes (100) exceeds limit (50)');
  });

  await t.step('should filter files based on status', async () => {
    resetSpies();

    const mockGithubClient = createMockGithubClient(async function* () {
      yield [createMockFile('added.ts', 10, 'added'), createMockFile('removed.ts', 10, 'removed'), createMockFile('modified.ts', 10, 'modified')];
    });

    const manager = new FileManager(mockGithubClient, {
      allowedStatuses: ['added', 'modified'],
    });

    const result: IFileChange[] = [];
    for await (const batch of manager.collectChangedFiles()) {
      result.push(...batch);
    }

    assertEquals(result.length, 2);
    assertEquals(
      result.map((f) => f.path),
      ['added.ts', 'modified.ts'],
    );
    assertSpyCalls(debug, 1);
    assertEquals(debug.calls[0].args[0], 'Skipping removed.ts: status removed not in allowed list');
  });

  await t.step('should apply include and exclude patterns', async () => {
    resetSpies();

    const mockGithubClient = createMockGithubClient(async function* () {
      yield [createMockFile('src/index.ts'), createMockFile('src/generated/types.ts'), createMockFile('src/util.js')];
    });

    const manager = new FileManager(mockGithubClient, {
      include: ['**/*.ts'],
      exclude: ['**/generated/**'],
    });

    const result: IFileChange[] = [];
    for await (const batch of manager.collectChangedFiles()) {
      result.push(...batch);
    }

    assertEquals(result.length, 1);
    assertEquals(result[0].path, 'src/index.ts');
    assertSpyCalls(debug, 2);
    assertEquals(debug.calls[0].args[0], 'Skipping src/generated/types.ts: matches exclude pattern');
    assertEquals(debug.calls[1].args[0], 'Skipping src/util.js: does not match any include pattern');
  });

  await t.step('should handle batch size correctly', async () => {
    const mockGithubClient = createMockGithubClient(async function* () {
      yield Array(25)
        .fill(null)
        .map((_, i) => createMockFile(`file${i}.ts`));
    });

    const manager = new FileManager(mockGithubClient);
    const batchSize = 10;
    const batches: IFileChange[][] = [];

    for await (const batch of manager.collectChangedFiles(batchSize)) {
      batches.push(batch);
    }

    assertEquals(batches.length, 3);
    assertEquals(batches[0].length, 10);
    assertEquals(batches[1].length, 10);
    assertEquals(batches[2].length, 5);
  });

  await t.step('should handle errors during file collection', async () => {
    resetSpies();

    const mockGithubClient = createMockGithubClient(async function* () {
      throw new Error('Stream error');
    });

    const manager = new FileManager(mockGithubClient);

    await assertRejects(
      async () => {
        for await (const _ of manager.collectChangedFiles()) {
          // consume iterator
        }
      },
      Error,
      'Stream error',
    );

    assertSpyCalls(error, 1);
    assertEquals(error.calls[0].args[0], 'Failed to collect changed files: Stream error');
  });
});
