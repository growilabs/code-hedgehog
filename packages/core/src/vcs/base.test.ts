import { assertEquals, assertThrows } from '@std/assert';
import { describe, it } from '@std/testing/bdd';
import type { IFileChange, IPullRequestInfo, IReviewComment, IVCSConfig, VCSType } from '../types/mod.ts';
import { BaseVCS } from './base.ts';

class TestVCS extends BaseVCS {
  constructor(config: IVCSConfig) {
    super(config, 'github' as VCSType);
  }

  getPullRequestInfo(): Promise<IPullRequestInfo> {
    throw new Error('Method not implemented.');
  }

  getPullRequestChangesStream(): AsyncIterableIterator<IFileChange[]> {
    throw new Error('Method not implemented.');
  }

  createReviewBatch(_comments: IReviewComment[]): Promise<void> {
    throw new Error('Method not implemented.');
  }

  // Expose protected methods for testing
  public testGetRepositoryInfo() {
    return this.getRepositoryInfo();
  }

  public testFormatError(operation: string, error: unknown) {
    return this.formatError(operation, error);
  }
}

describe('BaseVCS', () => {
  it('should validate repository URL format', () => {
    // Valid GitHub URL
    const validConfig: IVCSConfig = {
      type: 'github',
      token: 'test-token',
      repositoryUrl: 'https://github.com/owner/repo',
      requestId: '123',
    };
    const vcs = new TestVCS(validConfig);
    assertEquals(vcs.type, 'github');

    // Invalid URLs
    const invalidUrls = ['not-a-url', 'https://github.com', 'https://github.com/owner', 'https://github.com/'];

    for (const url of invalidUrls) {
      assertThrows(
        () =>
          new TestVCS({
            ...validConfig,
            repositoryUrl: url,
          }),
        Error,
        'Invalid repository URL',
      );
    }
  });

  it('should extract repository info correctly', () => {
    const vcs = new TestVCS({
      type: 'github',
      token: 'test-token',
      repositoryUrl: 'https://github.com/test-owner/test-repo',
      requestId: '123',
    });

    const info = vcs.testGetRepositoryInfo();
    assertEquals(info, {
      owner: 'test-owner',
      repo: 'test-repo',
    });
  });

  it('should format errors with context', () => {
    const vcs = new TestVCS({
      type: 'github',
      token: 'test-token',
      repositoryUrl: 'https://github.com/owner/repo',
      requestId: '123',
    });

    const error = vcs.testFormatError('test operation', new Error('test error'));
    assertEquals(error.message, '[github] Failed to test operation: test error');
  });
});
