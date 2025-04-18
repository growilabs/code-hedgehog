/**
 * GitHub VCS Implementation
 *
 * This module provides a concrete implementation of the VCS interface for GitHub.
 * It uses the official GitHub Actions SDK (@actions/github) to interact with the GitHub API,
 * handling pagination, rate limits, and error cases appropriately.
 */
import * as core from '@actions/core';
import { getOctokit } from '@actions/github';
import type { IFileChange, IPullRequestInfo, IReviewComment, IVCSConfig } from '../types/mod.ts';
import { BaseVCS } from './base.ts';
import type { CreateGitHubAPI, IGitHubAPI } from './github.types.ts';

/**
 * Repository context derived from the repository URL
 * Contains the essential parameters needed for API calls
 */
interface IGitHubContext {
  owner: string;
  repo: string;
  pullNumber: number;
}

/**
 * GitHub-specific VCS implementation
 * Handles API interactions, data transformation, and error handling
 */
export class GitHubVCS extends BaseVCS {
  private readonly api: IGitHubAPI;
  private readonly context: IGitHubContext;
  private fileCount = 0;

  /**
   * Creates a new GitHub VCS instance
   * @param config VCS configuration including token and repository details
   * @param createApi Factory function for creating the GitHub API client (useful for testing)
   */
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

  /**
   * Fetches pull request metadata from GitHub
   * Handles null values and error cases appropriately
   */
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

  /**
   * Streams pull request changes from GitHub, handling pagination automatically
   * Includes safeguards for:
   * - Rate limiting (warns when rate limit is low)
   * - File size limits (skips patches larger than 1MB)
   * - Total file count limits (warns after 3000 files)
   *
   * @param batchSize Number of files to include in each yielded batch
   */
  async *getPullRequestChangesStream(batchSize = 10): AsyncIterableIterator<IFileChange[]> {
    try {
      // Optimize page size based on batch size to reduce API calls
      const pageSize = Math.min(100, Math.max(batchSize * 2, 30));

      const iterator = this.api.paginate.iterator<{ filename: string; patch?: string; changes: number; status: string }>(
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
          }

          const patchSize = file.patch ? new TextEncoder().encode(file.patch).length : 0;

          currentBatch.push({
            path: file.filename,
            patch: patchSize > 1_000_000 ? null : (file.patch ?? null),
            changes: file.changes,
            status: file.status as IFileChange['status'], // Type assertion for GitHub API status values
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

  /**
   * Creates a review on the pull request with the provided comments
   * Skips API call if no comments are provided
   */
  async createReviewBatch(comments: IReviewComment[], dryRun = false): Promise<void> {
    if (comments.length === 0) {
      return;
    }

    if (dryRun) {
      core.debug(`[DRY RUN] Would create review with ${comments.length} comments`);
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
