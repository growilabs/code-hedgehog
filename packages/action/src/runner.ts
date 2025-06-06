// packages/action/src/runner.ts

import process from 'node:process';
import * as core from '@actions/core';
import { FileManager, type IFileFilter, type IPullRequestProcessor, type IReviewComment, type IVCSConfig, createVCS } from '@code-hedgehog/core';
import { DEFAULT_CONFIG, type ReviewConfig, loadBaseConfig as loadExternalBaseConfig } from '@code-hedgehog/processor-base';
import type { ActionConfig } from './config.ts';

export class ActionRunner {
  // Initialize config with DEFAULT_CONFIG, it will be updated by loadConfig
  private reviewConfig: ReviewConfig = DEFAULT_CONFIG;

  constructor(private readonly config: ActionConfig) {}

  async run(): Promise<IReviewComment[]> {
    await this.loadBaseConfig();

    const dryRunEnvVar = process.env.CODE_HEDGEHOG_DRY_RUN_VCS_PROCESSING;
    const dryRun = dryRunEnvVar === 'true' || dryRunEnvVar === '1';

    try {
      const githubConfig = this.createGitHubConfig();

      // Initialize components
      const vcsClient = createVCS(githubConfig);
      const fileManager = new FileManager(vcsClient, this.getFileFilter());
      const processor = await this.createProcessor();

      // Get PR information
      core.info('Fetching pull request information...');
      const prInfo = await vcsClient.getPullRequestInfo();

      core.info('Starting code review...');
      if (dryRun) {
        core.info('::: DRY RUN :::');
      }

      const allComments: IReviewComment[] = [];

      // Process files in batches and get reviews
      for await (const files of fileManager.collectChangedFiles(this.reviewConfig)) {
        const { comments } = await processor.process(prInfo, files, vcsClient);
        allComments.push(...(comments ?? []));

        if (comments != null && comments.length > 0) {
          if (dryRun) {
            core.info(comments.map((comment) => `- ${JSON.stringify(comment, null, 2)}`).join('\n'));
          } else {
            await vcsClient.createReviewBatch(comments, dryRun);
          }
          core.info(`Posted ${comments.length} review comments`);
        }
      }

      core.info('Code review completed successfully');

      return allComments;
    } catch (error) {
      core.setFailed(`Action failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  private createGitHubConfig(): IVCSConfig {
    core.info('Environment variables:');
    core.info(`GITHUB_REPOSITORY: ${process.env.GITHUB_REPOSITORY}`);
    core.info(`GITHUB_EVENT_PATH: ${process.env.GITHUB_EVENT_PATH}`);
    core.info(`GITHUB_PR_NUMBER: ${process.env.GITHUB_PR_NUMBER}`);

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
    core.info(`Pull Request number is determined: ${pullNumber}`);

    return {
      type: 'github',
      token: process.env.GITHUB_TOKEN ?? '',
      repositoryUrl: `https://github.com/${owner}/${repo}`,
      pullRequestId: pullNumber,
    };
  }

  private async createProcessor(): Promise<IPullRequestProcessor> {
    core.info(`Creating processor: ${this.config.processor}`);
    // Base configuration loading is now handled within the BaseProcessor or its inheritors

    // Processor instantiation logic remains, but without passing baseConfig
    switch (this.config.processor) {
      case 'acme': {
        const { AcmeProcessor } = await import('@code-hedgehog/processor-acme');
        return new AcmeProcessor();
      }
      case 'openai': {
        const { OpenaiProcessor } = await import('@code-hedgehog/processor-openai'); // Use import map without mod.ts
        // Pass only the baseConfig to the constructor
        // The processor itself will load specific environment variables
        // Constructor now takes no arguments
        return new OpenaiProcessor();
      }
      case 'dify': {
        const { DifyProcessor } = await import('@code-hedgehog/processor-dify'); // Use import map without mod.ts
        // Pass only the baseConfig to the constructor
        // The processor itself will load specific environment variables
        // Constructor now takes no arguments
        return new DifyProcessor();
      }
      default:
        throw new Error(`Unsupported processor: ${this.config.processor}`);
    }
  }

  private getFileFilter(): IFileFilter {
    return {
      include: this.config.filter.include,
      exclude: this.config.filter.exclude,
      maxChanges: this.config.filter.maxChanges,
    };
  }

  /**
   * Load configuration using the external module.
   * This method now acts as a wrapper to update the instance's config.
   */
  protected async loadBaseConfig(configPath = '.coderabbitai.yaml'): Promise<void> {
    // Call the external function and update the instance's config
    this.reviewConfig = await loadExternalBaseConfig(configPath); // Rename function call
  }
}
