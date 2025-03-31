import { assertEquals, assertRejects } from '@std/assert';

import type { IFileChange } from '../types/file.ts';
import type { IPullRequestInfo } from '../types/vcs.ts';

import type { IVersionControlSystem } from '../types/mod.ts';
import { FileManager } from './file-manager.ts';

function createMockFile(path: string, changes = 10, status: IFileChange['status'] = 'modified'): IFileChange {
  return {
    path,
    patch: '@@ -1,1 +1,1 @@',
    changes,
    status,
  };
}

function createVCS(generator: () => AsyncGenerator<IFileChange[]>): IVersionControlSystem {
  return {
    type: 'github',
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
  await t.step('should filter files based on maxChanges', async () => {
    const mockVCS = createVCS(async function* () {
      yield [createMockFile('small.ts', 10), createMockFile('large.ts', 100)];
    });

    const manager = new FileManager(mockVCS, {
      maxChanges: 50,
    });

    const result: IFileChange[] = [];
    for await (const batch of manager.collectChangedFiles()) {
      result.push(...batch);
    }

    assertEquals(result.length, 1);
    assertEquals(result[0].path, 'small.ts');
  });

  await t.step('should filter files based on status', async () => {
    const mockVCS = createVCS(async function* () {
      yield [createMockFile('added.ts', 10, 'added'), createMockFile('removed.ts', 10, 'removed'), createMockFile('modified.ts', 10, 'modified')];
    });

    const manager = new FileManager(mockVCS, {
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
  });

  await t.step('should apply include and exclude patterns', async () => {
    const mockVCS = createVCS(async function* () {
      yield [createMockFile('src/index.ts'), createMockFile('src/generated/types.ts'), createMockFile('src/util.js')];
    });

    const manager = new FileManager(mockVCS, {
      include: ['**/*.ts'],
      exclude: ['**/generated/**'],
    });

    const result: IFileChange[] = [];
    for await (const batch of manager.collectChangedFiles()) {
      result.push(...batch);
    }

    assertEquals(result.length, 1);
    assertEquals(result[0].path, 'src/index.ts');
  });

  await t.step('should handle batch size correctly', async () => {
    const mockVCS = createVCS(async function* () {
      yield Array(25)
        .fill(null)
        .map((_, i) => createMockFile(`file${i}.ts`));
    });

    const manager = new FileManager(mockVCS);
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
    const mockVCS = createVCS(async function* () {
      yield []; // Empty batch to simulate initial successful connection
      throw new Error('Stream error');
    });

    const manager = new FileManager(mockVCS);

    await assertRejects(
      async () => {
        for await (const _ of manager.collectChangedFiles()) {
          // consume iterator
        }
      },
      Error,
      'Stream error',
    );
  });
});
