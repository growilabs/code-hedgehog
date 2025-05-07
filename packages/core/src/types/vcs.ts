/**
 * Version Control System types
 */

import type { IFileChange } from './file.ts';
import type { CommentInfo, IReviewComment } from './review.ts';

/**
 * Supported VCS types
 */
export type VCSType = 'github' | 'gitlab';

/**
 * Common configuration for VCS providers
 */
export interface IVCSConfig {
  /**
   * VCS type
   */
  type: VCSType;

  /**
   * Authentication token
   */
  token: string;

  /**
   * Repository URL
   * @example "https://github.com/owner/repo"
   * @example "https://gitlab.com/owner/repo"
   */
  repositoryUrl: string;

  /**
   * Pull/Merge request ID
   */
  pullRequestId: string | number;
}

/**
 * Common pull/merge request information
 * This interface represents the common structure between GitHub Pull Requests
 * and GitLab Merge Requests.
 */
export interface IPullRequestInfo {
  /**
   * Pull/Merge request title
   */
  title: string;

  /**
   * Pull/Merge request description/body
   */
  body: string;

  /**
   * Base/target branch name
   */
  baseBranch: string;

  /**
   * Head/source branch name
   */
  headBranch: string;
}

/**
 * Represents the pair of commit SHAs used for comparison (e.g., between pushes).
 */
export interface ICommitComparisonShas {
  /**
   * The base commit SHA for comparison (e.g., previous push)
   */
  baseSha: string;

  /**
   * The head/after commit SHA for comparison (e.g., current push)
   */
  headSha: string;
}

/**
 * Interface for VCS operations
 */
export interface IVersionControlSystem {
  /**
   * VCS provider type
   */
  readonly type: VCSType;

  /**
   * Fetches pull/merge request metadata
   */
  getPullRequestInfo(): Promise<IPullRequestInfo>;

  /**
   * Creates an async iterator that yields batches of file changes
   * @param batchSize Number of files to process in each batch
   */
  getPullRequestChangesStream(batchSize?: number): AsyncIterableIterator<IFileChange[]>;

  /**
   * Creates a review with a batch of comments
   * @param comments Array of review comments to post
   * @param dryRun If true, only simulate the review creation
   */
  createReviewBatch(comments: IReviewComment[], dryRun?: boolean): Promise<void>;

  /**
   * Fetches existing comments on a pull/merge request.
   * @param pullRequestId The ID of the pull/merge request.
   * @returns A promise that resolves to an array of CommentInfo objects.
   */
  getComments(pullRequestId: string | number): Promise<CommentInfo[]>;

  /**
   * Creates a new check run.
   * @param params Parameters for creating the check run.
   * @returns A promise that resolves to the ID of the created check run.
   */
  createCheckRun(params: CreateCheckRunParams): Promise<number>; // Returns Check Run ID

  /**
   * Updates an existing check run.
   * @param checkRunId The ID of the check run to update.
   * @param params Parameters for updating the check run.
   * @returns A promise that resolves when the check run is updated.
   */
  updateCheckRun(checkRunId: number, params: UpdateCheckRunParams): Promise<void>;
}

// Types for GitHub Checks API

/**
 * The status of the check run.
 */
export type CheckRunStatus = 'queued' | 'in_progress' | 'completed';

/**
 * The final conclusion of the check run.
 * Required if status is 'completed'.
 */
export type CheckRunConclusion = 'action_required' | 'cancelled' | 'failure' | 'neutral' | 'success' | 'skipped' | 'stale' | 'timed_out';

/**
 * The output of the check run.
 */
export interface CheckRunOutput {
  /**
   * The title of the check run.
   */
  title: string;
  /**
   * The summary of the check run.
   * Supports Markdown.
   */
  summary: string;
  /**
   * The details of the check run.
   * Supports Markdown.
   */
  text?: string;
  // annotations?: CheckRunAnnotation[]; // Future: Add annotations if needed
  // images?: CheckRunImage[]; // Future: Add images if needed
}

/**
 * Parameters for creating a new check run.
 */
export interface CreateCheckRunParams {
  /**
   * The name of the check.
   * @example "My Code Linter"
   */
  name: string;
  /**
   * The SHA of the commit.
   */
  head_sha: string;
  /**
   * The current status of the check run.
   * Default: 'queued'
   */
  status?: CheckRunStatus;
  /**
   * The final conclusion of the check run.
   * Required if status is 'completed'.
   */
  conclusion?: CheckRunConclusion;
  /**
   * The time that the check run began, in ISO 8601 format.
   */
  started_at?: string; // ISO 8601 string: YYYY-MM-DDTHH:MM:SSZ
  /**
   * The time that the check run completed, in ISO 8601 format.
   * Required if status is 'completed'.
   */
  completed_at?: string; // ISO 8601 string: YYYY-MM-DDTHH:MM:SSZ
  /**
   * Check run output.
   */
  output?: CheckRunOutput;
  /**
   * A URL with more details about the check run.
   * @example "https://example.com/build/status"
   */
  details_url?: string; // GitHub API uses snake_case
  /**
   * An identifier for the check run from an external system.
   */
  external_id?: string; // GitHub API uses snake_case
  // actions?: CheckRunAction[]; // Future: Add actions if needed
}

/**
 * Parameters for updating an existing check run.
 * All parameters are optional.
 */
export interface UpdateCheckRunParams {
  /**
   * The name of the check.
   */
  name?: string;
  /**
   * The current status of the check run.
   */
  status?: CheckRunStatus;
  /**
   * The final conclusion of the check run.
   * Required if status is 'completed'.
   */
  conclusion?: CheckRunConclusion;
  /**
   * The time that the check run completed, in ISO 8601 format.
   */
  completed_at?: string; // ISO 8601 string: YYYY-MM-DDTHH:MM:SSZ
  /**
   * Check run output.
   */
  output?: CheckRunOutput;
  /**
   * A URL with more details about the check run.
   */
  details_url?: string; // GitHub API uses snake_case
  // actions?: CheckRunAction[]; // Future: Add actions if needed
}
