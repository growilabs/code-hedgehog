// packages/action/src/runner.ts
import * as core from '@actions/core';
import { FileManager, GitHubClient, type IFileFilter, type IGitHubConfig } from '@code-hobbit/core';
import { AcmeReviewProvider } from '@code-hobbit/provider-acme';
import type { ActionConfig } from './config';

export class ActionRunner {
  constructor(private readonly config: ActionConfig) {}

  async run(): Promise<void> {
    try {
      const githubConfig = this.createGitHubConfig();

      // Initialize components
      const githubClient = new GitHubClient(githubConfig);
      const fileManager = new FileManager(githubClient, this.getFileFilter());
      const provider = this.createProvider();

      // Get PR information
      core.info('Fetching pull request information...');
      const prInfo = await githubClient.getPullRequestInfo();

      // Process files in batches and get reviews
      core.info('Starting code review...');
      for await (const files of fileManager.collectChangedFiles()) {
        const comments = await provider.reviewBatch(prInfo, files);
        if (comments.length > 0) {
          await githubClient.createReviewBatch(comments);
          core.info(`Posted ${comments.length} review comments`);
        }
      }

      core.info('Code review completed successfully');
    } catch (error) {
      core.setFailed(`Action failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  private createGitHubConfig(): IGitHubConfig {
    core.debug('Environment variables:');
    core.debug(`GITHUB_REPOSITORY: ${process.env.GITHUB_REPOSITORY}`);
    core.debug(`GITHUB_EVENT_PATH: ${process.env.GITHUB_EVENT_PATH}`);
    core.debug(`GITHUB_PR_NUMBER: ${process.env.GITHUB_PR_NUMBER}`);

    const repository = process.env.GITHUB_REPOSITORY;
    if (!repository) {
      throw new Error('GITHUB_REPOSITORY environment variable is not set');
    }

    const [owner, repo] = repository.split('/');
    if (!owner || !repo) {
      throw new Error('GITHUB_REPOSITORY environment variable is in invalid format');
    }

    let pullNumber: number;
    const eventPath = process.env.GITHUB_EVENT_PATH;

    if (eventPath) {
      try {
        const event = require(eventPath);
        pullNumber = event?.pull_request?.number;
      } catch (error) {
        core.warning(`Failed to read event file: ${error}`);
        // fallback to environment variable
        pullNumber = Number.parseInt(process.env.GITHUB_PR_NUMBER || '', 10);
      }
    } else {
      // get pull request number from environment variable
      pullNumber = Number.parseInt(process.env.GITHUB_PR_NUMBER || '', 10);
    }

    if (!pullNumber || Number.isNaN(pullNumber)) {
      throw new Error('Could not determine pull request number');
    }

    return {
      token: this.config.githubToken,
      owner,
      repo,
      pullNumber,
    };
  }

  private createProvider() {
    // Currently only supporting ACME provider
    if (this.config.provider !== 'acme') {
      throw new Error(`Unsupported provider: ${this.config.provider}`);
    }
    return new AcmeReviewProvider();
  }

  private getFileFilter(): IFileFilter {
    return {
      include: this.config.filter.include,
      exclude: this.config.filter.exclude,
      maxChanges: this.config.filter.maxChanges,
    };
  }
}
