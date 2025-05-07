/**
 * GitHub VCS Implementation
 *
 * This module provides a concrete implementation of the VCS interface for GitHub.
 * It uses the official GitHub Actions SDK (@actions/github) to interact with the GitHub API,
 * handling pagination, rate limits, and error cases appropriately.
 */
import * as core from '@actions/core';
import { getOctokit } from '@actions/github';
import type {
  CommentInfo,
  CreateCheckRunParams,
  ICommitComparisonShas,
  IFileChange,
  IPullRequestInfo,
  IReviewComment,
  IVCSConfig,
  UpdateCheckRunParams,
} from '../types/mod.ts';
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

interface IApiFileChangeData {
  filename: string;
  patch?: string;
  changes: number;
  status: string;
}

/**
 * GitHub-specific VCS implementation
 * Handles API interactions, data transformation, and error handling
 */
export class GitHubVCS extends BaseVCS {
  static readonly MAX_PER_PAGE = 100;

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
   * Fetches all issue comments for the current pull request.
   */
  async getIssueComments() {
    try {
      return this.api.rest.issues.listComments({
        owner: this.context.owner,
        repo: this.context.repo,
        issue_number: this.context.pullNumber,
        per_page: GitHubVCS.MAX_PER_PAGE,
      });
    } catch (error) {
      throw this.formatError('fetch issue comments', error);
    }
  }

  /**
   * Fetches all commits for the current pull request.
   * By default, returns commits in asc order (oldest first).
   */
  async getCommits() {
    try {
      return this.api.rest.pulls.listCommits({
        owner: this.context.owner,
        repo: this.context.repo,
        pull_number: this.context.pullNumber,
        per_page: GitHubVCS.MAX_PER_PAGE,
      });
    } catch (error) {
      throw this.formatError('fetch commits', error);
    }
  }

  /**
   * Fetches the commit SHA range representing changes since the last *issue* comment was posted on the pull request.
   *
   * **Limitations:**
   * - **Comment Type:** Only considers issue comments. Review comments or commit-specific comments are ignored.
   * - **Commit Limit:** Relies on `pulls.listCommits` which fetches a maximum of 100 commits by default. If the PR has more commits, or the latest comment refers to a commit older than the last 100, the calculated `baseSha` might be inaccurate or the method might incorrectly return `undefined`.
   * - **No Comments/Commits:** Returns `undefined` if no issue comments or no commits are found in the PR.
   */
  // TODO: Separate into BaseVCS when implementing GitLab.
  async getShaRangeSinceLastIssueComment(): Promise<ICommitComparisonShas | undefined> {
    try {
      const { data: issueComments } = await this.getIssueComments();

      if (issueComments.length === 0) {
        core.debug(`No issue comments found in PR #${this.context.pullNumber}`);
        return;
      }

      const latestComment = issueComments[issueComments.length - 1];
      const latestCommentTime = new Date(latestComment.created_at).getTime();

      const { data: commits } = await this.getCommits();

      if (commits.length === 0) {
        core.warning(`No commits found in PR #${this.context.pullNumber}`);
        return;
      }

      const headSha = commits[commits.length - 1].sha;

      const commitsBeforeLastComment = commits.filter((commit) => {
        const commitTime = commit.commit.committer?.date ? new Date(commit.commit.committer.date).getTime() : 0;
        return commitTime < latestCommentTime;
      });

      if (commitsBeforeLastComment.length === 0) {
        core.debug('No commits found before the latest comment.');
        return;
      }

      const baseSha = commitsBeforeLastComment[commitsBeforeLastComment.length - 1].sha;

      return { baseSha, headSha };
    } catch (error) {
      throw this.formatError('get SHA range', error);
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

      const shaRange = await this.getShaRangeSinceLastIssueComment();

      const iterator = this.api.paginate.iterator(
        shaRange != null
          ? this.api.rest.repos.compareCommits.endpoint.merge({
              owner: this.context.owner,
              repo: this.context.repo,
              base: shaRange.baseSha,
              head: shaRange.headSha,
              per_page: pageSize,
            })
          : this.api.rest.pulls.listFiles.endpoint.merge({
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

        let files: IApiFileChangeData[] = [];
        if (shaRange != null) {
          // TODO: Fix the type to the correct one
          const data = response.data as { files?: IApiFileChangeData[] | undefined };
          files = data?.files ?? [];
        } else {
          // TODO: Fix the type to the correct one
          files = (response.data as IApiFileChangeData[] | undefined) ?? [];
        }

        for (const file of files) {
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

    const prComments = comments.filter((c) => c.type === 'pr');
    const fileComments = comments.filter((c) => c.type === 'file');
    const inlineComments = comments.filter((c) => c.type === 'inline');

    if (dryRun) {
      core.debug(`[DRY RUN] Would create review with ${comments.length} comments`);
      return;
    }

    try {
      const prData = await this.api.rest.pulls.get({
        owner: this.context.owner,
        repo: this.context.repo,
        pull_number: this.context.pullNumber,
      });
      const headCommitSha = prData.data.head.sha;

      if (prComments.length > 0) {
        const prResults = await Promise.allSettled(
          prComments.map((comment) =>
            this.api.rest.issues.createComment({
              owner: this.context.owner,
              repo: this.context.repo,
              issue_number: this.context.pullNumber,
              body: comment.body,
            }),
          ),
        );
        prResults.forEach((result, idx) => {
          if (result.status === 'rejected') {
            core.warning(`Failed to create PR comment #${idx + 1}: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`);
          }
        });

        core.debug(`Created review with ${prComments.length} pr comments`);
      }

      if (fileComments.length > 0) {
        // Cannot run in parallel, because only one pending review is allowed
        for (const comment of fileComments) {
          try {
            await this.api.rest.pulls.createReviewComment({
              owner: this.context.owner,
              repo: this.context.repo,
              pull_number: this.context.pullNumber,
              body: comment.body,
              commit_id: headCommitSha,
              path: comment.path,
              subject_type: 'file',
            });
          } catch (error) {
            core.warning(`Failed to createReviewComment for file "${comment.path}": ${error instanceof Error ? error.message : String(error)}`);
          }
        }

        core.debug(`Created review with ${fileComments.length} file comments`);
      }

      if (inlineComments.length > 0) {
        await this.api.rest.pulls.createReview({
          owner: this.context.owner,
          repo: this.context.repo,
          pull_number: this.context.pullNumber,
          event: 'COMMENT',
          comments: inlineComments.map((comment) => ({
            path: comment.path,
            position: comment.position,
            body: comment.body,
          })),
        });

        core.debug(`Created review with ${inlineComments.length} inline comments`);
      }
    } catch (error) {
      throw this.formatError('create review', error);
    }
  }

  /**
   * Fetches existing comments on a pull request.
   * This includes both review comments and general PR (issue) comments.
   */
  async getComments(pullRequestId: string | number): Promise<CommentInfo[]> {
    const prNumber = Number(pullRequestId);
    if (Number.isNaN(prNumber)) {
      throw new Error('Invalid pullRequestId for getComments');
    }

    const allComments: CommentInfo[] = [];

    try {
      // Fetch review comments
      const reviewCommentsPaginator = this.api.paginate.iterator(this.api.rest.pulls.listReviewComments, {
        owner: this.context.owner,
        repo: this.context.repo,
        pull_number: prNumber,
        per_page: GitHubVCS.MAX_PER_PAGE,
      });

      for await (const response of reviewCommentsPaginator) {
        for (const comment of response.data) {
          allComments.push({
            id: String(comment.id),
            body: comment.body,
            user: comment.user?.login ?? 'unknown',
            createdAt: comment.created_at,
            url: comment.html_url,
            path: comment.path,
            position: comment.line ?? comment.original_line, // Prefer 'line' if available (for multi-line comments)
            in_reply_to_id: comment.in_reply_to_id ? String(comment.in_reply_to_id) : undefined,
          });
        }
      }
      core.debug(`Fetched ${allComments.length} review comments for PR #${prNumber}`);

      // Fetch issue comments (general PR comments)
      let issueCommentsCount = 0;
      const issueCommentsPaginator = this.api.paginate.iterator(this.api.rest.issues.listComments, {
        owner: this.context.owner,
        repo: this.context.repo,
        issue_number: prNumber, // For PRs, issue_number is the same as pull_number
        per_page: GitHubVCS.MAX_PER_PAGE,
      });

      for await (const response of issueCommentsPaginator) {
        for (const comment of response.data) {
          // Avoid adding the main PR description as a comment if it appears here
          if (comment.user?.type === 'Bot' && comment.body && comment.body.includes('<!-- PULL_REQUEST_DESCRIPTION -->')) {
            continue;
          }
          allComments.push({
            id: String(comment.id),
            body: comment.body_text ?? comment.body ?? '', // Prefer body_text, then body, then empty string
            user: comment.user?.login ?? 'unknown',
            createdAt: comment.created_at,
            url: comment.html_url,
            // Issue comments are not typically associated with a specific file path or line
            path: undefined,
            position: undefined,
            // Issue comments don't have in_reply_to_id in the same way review comment threads do
            in_reply_to_id: undefined,
          });
          issueCommentsCount++;
        }
      }
      core.debug(`Fetched ${issueCommentsCount} issue comments for PR #${prNumber}`);

      // Sort comments by creation date
      allComments.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      core.info(`Fetched a total of ${allComments.length} comments for PR #${prNumber}`);
      return allComments;
    } catch (error) {
      throw this.formatError(`fetch comments for PR #${prNumber}`, error);
    }
  }

  /**
   * Creates a new check run.
   * @param params Parameters for creating the check run.
   * @returns A promise that resolves to the ID of the created check run.
   */
  async createCheckRun(params: CreateCheckRunParams): Promise<number> {
    try {
      const apiParams = {
        name: params.name,
        head_sha: params.head_sha,
        status: params.status,
        conclusion: params.conclusion,
        started_at: params.started_at,
        completed_at: params.completed_at,
        output: params.output,
        details_url: params.details_url,
        external_id: params.external_id,
        // TODO: Add actions if/when CheckRunAction is defined and used
      };
      const response = await this.api.rest.checks.create({
        owner: this.context.owner,
        repo: this.context.repo,
        ...apiParams,
      });
      core.debug(`Created check run #${response.data.id} with name "${apiParams.name}" and status "${apiParams.status ?? 'queued'}"`);
      return response.data.id;
    } catch (error) {
      throw this.formatError(`create check run with name "${params.name}"`, error); // Keep original params.name for error logging consistency
    }
  }

  /**
   * Updates an existing check run.
   * @param checkRunId The ID of the check run to update.
   * @param params Parameters for updating the check run.
   * @returns A promise that resolves when the check run is updated.
   */
  async updateCheckRun(checkRunId: number, params: UpdateCheckRunParams): Promise<void> {
    try {
      await this.api.rest.checks.update({
        owner: this.context.owner,
        repo: this.context.repo,
        check_run_id: checkRunId,
        // Explicitly map params for update as well, to be safe
        name: params.name,
        status: params.status,
        conclusion: params.conclusion,
        completed_at: params.completed_at,
        output: params.output,
        details_url: params.details_url,
        // TODO: Add actions if/when CheckRunAction is defined and used
      });
      core.debug(
        `Updated check run #${checkRunId}${params.name ? ` with name "${params.name}"` : ''}${params.status ? ` to status "${params.status}"` : ''}${params.conclusion ? ` with conclusion "${params.conclusion}"` : ''}`,
      );
    } catch (error) {
      throw this.formatError(`update check run #${checkRunId}`, error);
    }
  }
}
