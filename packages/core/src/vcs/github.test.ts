import { assertEquals } from '@std/assert';
import { describe, it } from '@std/testing/bdd';
import { spy } from '@std/testing/mock';
import type { IFileChange, IVCSConfig } from '../types/mod.ts';
import { createMockOctokit, mockFiles, mockPullRequest } from './_mock.ts';
import { GitHubVCS } from './github.ts';

describe('GitHubVCS', () => {
  // Common test configuration
  const config: IVCSConfig = {
    type: 'github',
    token: 'test-token',
    repositoryUrl: 'https://github.com/test-owner/test-repo',
    pullRequestId: '123',
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
      title: mockPullRequest.data.title,
      body: mockPullRequest.data.body ?? '',
      baseBranch: mockPullRequest.data.base.ref,
      headBranch: mockPullRequest.data.head.ref,
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

  it('should skip API call in dry run mode', async () => {
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

    await vcs.createReviewBatch(comments, true);
    assertEquals(spies.createReview.calls.length, 0, 'API should not be called in dry run mode');
  });
});
