import type { IFileChange, IPullRequestInfo, IReviewComment, IVCSConfig, IVersionControlSystem, VCSType } from '../types/mod.ts';

/**
 * Base class for VCS implementations
 */
export abstract class BaseVCS implements IVersionControlSystem {
  protected constructor(
    protected readonly config: IVCSConfig,
    public readonly type: VCSType,
  ) {
    // Validate repository URL format
    if (!this.validateRepositoryUrl(config.repositoryUrl)) {
      throw new Error(`Invalid repository URL: ${config.repositoryUrl}`);
    }
  }

  abstract getPullRequestInfo(): Promise<IPullRequestInfo>;
  abstract getPullRequestChangesStream(batchSize?: number): AsyncIterableIterator<IFileChange[]>;
  abstract createReviewBatch(comments: IReviewComment[]): Promise<void>;

  /**
   * Get repository owner and name from URL
   */
  protected getRepositoryInfo(): { owner: string; repo: string } {
    const url = new URL(this.config.repositoryUrl);
    const [, owner, repo] = url.pathname.split('/');
    if (!owner || !repo) {
      throw new Error(`Invalid repository URL format: ${this.config.repositoryUrl}`);
    }
    return { owner, repo };
  }

  /**
   * Validate repository URL format
   */
  protected validateRepositoryUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      const [, owner, repo] = parsed.pathname.split('/');
      return Boolean(owner && repo);
    } catch {
      return false;
    }
  }

  /**
   * Format error message with context
   */
  protected formatError(operation: string, error: unknown): Error {
    const message = error instanceof Error ? error.message : String(error);
    return new Error(`[${this.type}] Failed to ${operation}: ${message}`);
  }
}
