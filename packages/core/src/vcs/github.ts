import * as core from '@actions/core';
import { getOctokit } from '@actions/github';
import type { IFileChange, IPullRequestInfo, IReviewComment, IVCSConfig } from '../types/mod.ts';
import type { GitHubFile } from './_mock.ts';
import { BaseVCS } from './base.ts';
import type { CreateGitHubAPI, IGitHubAPI } from './github.types.ts';

/**
 * GitHub-specific configuration derived from repository URL
 */
interface IGitHubContext {
  owner: string;
  repo: string;
  pullNumber: number;
}

export class GitHubVCS extends BaseVCS {
  private readonly api: IGitHubAPI;
  private readonly context: IGitHubContext;
  private fileCount = 0;

  constructor(config: IVCSConfig, createApi: CreateGitHubAPI = (token) => getOctokit(token)) {
    super(config, 'github');
    const { owner, repo } = this.getRepositoryInfo();
    this.context = {
      owner,
      repo,
      pullNumber: Number(config.pullRequestId),
    };
    this.api = createApi(config.token);
  }

  async getPullRequestInfo(): Promise<IPullRequestInfo> {
    try {
      const response = await this.api.rest.pulls.get({
        owner: this.context.owner,
        repo: this.context.repo,
        pull_number: this.context.pullNumber,
      });

      return {
        title: response.data.title,
        body: response.data.body ?? '',
        baseBranch: response.data.base.ref,
        headBranch: response.data.head.ref,
      };
    } catch (error) {
      throw this.formatError('fetch PR info', error);
    }
  }

  async *getPullRequestChangesStream(batchSize = 10): AsyncIterableIterator<IFileChange[]> {
    try {
      // Optimize page size based on batch size
      const pageSize = Math.min(100, Math.max(batchSize * 2, 30));

      const iterator = this.api.paginate.iterator<GitHubFile>(
        this.api.rest.pulls.listFiles.endpoint.merge({
          owner: this.context.owner,
          repo: this.context.repo,
          pull_number: this.context.pullNumber,
          per_page: pageSize,
        }),
      );

      let currentBatch: IFileChange[] = [];
      let isFileLimitWarned = false;

      for await (const response of iterator) {
        // Check rate limit
        const rateLimit = response.headers?.['x-ratelimit-remaining'];
        if (rateLimit && Number.parseInt(rateLimit, 10) < 10) {
          core.warning(`GitHub API rate limit is running low: ${rateLimit} requests remaining`);
        }

        for (const file of response.data) {
          this.fileCount++;
          if (this.fileCount > 3000) {
            if (!isFileLimitWarned) {
              core.warning('GitHub API limits the response to 3000 files. Some files may be skipped.');
              isFileLimitWarned = true;
            }
            // Continue processing after warning
          }

          // Check for oversized patch data
          const patchSize = file.patch ? new TextEncoder().encode(file.patch).length : 0;

          currentBatch.push({
            path: file.filename,
            patch: patchSize > 1_000_000 ? null : (file.patch ?? null),
            changes: file.changes,
            status: file.status as IFileChange['status'],
          });

          if (currentBatch.length >= batchSize) {
            yield currentBatch;
            currentBatch = [];
          }
        }
      }

      if (currentBatch.length > 0) {
        yield currentBatch;
      }

      core.debug(`Processed ${this.fileCount} files from PR #${this.context.pullNumber}`);
    } catch (error) {
      throw this.formatError('fetch PR changes', error);
    }
  }

  async createReviewBatch(comments: IReviewComment[]): Promise<void> {
    if (comments.length === 0) {
      return;
    }

    try {
      await this.api.rest.pulls.createReview({
        owner: this.context.owner,
        repo: this.context.repo,
        pull_number: this.context.pullNumber,
        event: 'COMMENT',
        comments: comments.map((comment) => ({
          path: comment.path,
          position: comment.position,
          body: comment.body,
        })),
      });

      core.debug(`Created review with ${comments.length} comments`);
    } catch (error) {
      throw this.formatError('create review', error);
    }
  }
}
