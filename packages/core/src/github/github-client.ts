import * as core from '@actions/core';
import { getOctokit } from '@actions/github';

import { IGitHubConfig, IPullRequestInfo } from '../types/mod.ts';

import type { IGitHubClient } from './types.ts';

export class GitHubClient implements IGitHubClient {
  private readonly octokit;
  private readonly config: IGitHubConfig;
  private fileCount = 0;

  constructor(config: IGitHubConfig) {
    this.config = config;
    this.octokit = getOctokit(config.token);
  }

  async getPullRequestInfo(): Promise<IPullRequestInfo> {
    try {
      const response = await this.octokit.rest.pulls.get({
        owner: this.config.owner,
        repo: this.config.repo,
        pull_number: this.config.pullNumber,
      });

      return {
        title: response.data.title,
        body: response.data.body ?? '',
        baseBranch: response.data.base.ref,
        headBranch: response.data.head.ref,
      };
    } catch (error) {
      core.error(
        `Failed to fetch PR info: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw error;
    }
  }

  async *getPullRequestChangesStream(
    batchSize = 10,
  ): AsyncIterableIterator<IFileChange[]> {
    try {
      const iterator = this.octokit.paginate.iterator(
        this.octokit.rest.pulls.listFiles,
        {
          owner: this.config.owner,
          repo: this.config.repo,
          pull_number: this.config.pullNumber,
          per_page: 100,
        },
      );

      let currentBatch: IFileChange[] = [];

      for await (const response of iterator) {
        for (const file of response.data) {
          this.fileCount++;
          if (this.fileCount > 3000) {
            core.warning(
              'GitHub API limits the response to 3000 files. Some files may be skipped.',
            );
            return;
          }

          currentBatch.push({
            path: file.filename,
            patch: file.patch ?? null,
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

      core.debug(
        `Processed ${this.fileCount} files from PR #${this.config.pullNumber}`,
      );
    } catch (error) {
      core.error(
        `Failed to fetch PR changes: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw error;
    }
  }

  async createReviewBatch(comments: IReviewComment[]): Promise<void> {
    if (comments.length === 0) {
      return;
    }

    try {
      await this.octokit.rest.pulls.createReview({
        owner: this.config.owner,
        repo: this.config.repo,
        pull_number: this.config.pullNumber,
        event: 'COMMENT',
        comments: comments.map((comment) => ({
          path: comment.path,
          position: comment.position,
          body: comment.body,
        })),
      });

      core.debug(`Created review with ${comments.length} comments`);
    } catch (error) {
      core.error(
        `Failed to create review: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw error;
    }
  }
}
