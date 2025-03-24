import { assertEquals } from '@std/assert';
import { describe, it } from '@std/testing/bdd';
import { spy } from '@std/testing/mock';
import type { IFileChange, IVCSConfig } from '../types/mod.ts';
import { createMockOctokit, mockFiles, mockPullRequest } from './_mock.ts';
import { GitHubVCS } from './github.ts';

describe('GitHubVCS', () => {
  const config: IVCSConfig = {
    type: 'github',
    token: 'test-token',
    repositoryUrl: 'https://github.com/test-owner/test-repo',
    requestId: '123',
  };

  it('should initialize with correct repository info', () => {
    const { mockOctokit } = createMockOctokit();
    const getOctokit = spy(() => mockOctokit);
    const vcs = new GitHubVCS(config, getOctokit);

    assertEquals(vcs.type, 'github');
    assertEquals(getOctokit.calls.length, 1);
  });

  it('should fetch pull request info', async () => {
    const { mockOctokit, spies } = createMockOctokit();
    const vcs = new GitHubVCS(config, () => mockOctokit);
    const info = await vcs.getPullRequestInfo();

    assertEquals(info, {
      title: mockPullRequest.title,
      body: mockPullRequest.body ?? '',
      baseBranch: mockPullRequest.base.ref,
      headBranch: mockPullRequest.head.ref,
    });

    assertEquals(spies.getPullRequest.calls.length, 1);
  });

  it('should stream pull request changes', async () => {
    const { mockOctokit, spies } = createMockOctokit();
    const vcs = new GitHubVCS(config, () => mockOctokit);
    const changes: IFileChange[] = [];

    for await (const batch of vcs.getPullRequestChangesStream(2)) {
      changes.push(...batch);
    }

    assertEquals(changes, [
      {
        path: mockFiles[0].filename,
        patch: mockFiles[0].patch,
        changes: mockFiles[0].changes,
        status: mockFiles[0].status,
      },
      {
        path: mockFiles[1].filename,
        patch: mockFiles[1].patch,
        changes: mockFiles[1].changes,
        status: mockFiles[1].status,
      },
    ]);

    assertEquals(spies.paginateIterator.calls.length, 1);
  });

  it('should create review batch', async () => {
    const { mockOctokit, spies } = createMockOctokit();
    const vcs = new GitHubVCS(config, () => mockOctokit);
    const comments = [
      {
        path: 'test.ts',
        position: 1,
        body: 'Test comment',
        type: 'inline' as const,
      },
    ];

    await vcs.createReviewBatch(comments);
    assertEquals(spies.createReview.calls.length, 1);
  });

  it('should skip review creation when no comments', async () => {
    const { mockOctokit, spies } = createMockOctokit();
    const vcs = new GitHubVCS(config, () => mockOctokit);
    await vcs.createReviewBatch([]);
    assertEquals(spies.createReview.calls.length, 0);
  });
});
