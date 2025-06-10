import process from 'node:process';
import * as core from '@actions/core';
import {
  FileManager,
  type IPullRequestInfo,
  type IPullRequestProcessor,
  type IReviewComment,
  type IVCSConfig,
  type IVersionControlSystem,
  createVCS,
} from '@code-hedgehog/core';
import { DEFAULT_CONFIG, type ReviewConfig, loadBaseConfig as loadExternalBaseConfig } from '@code-hedgehog/processor-base';
import type { ActionConfig } from './config.ts';
import { shouldSkipReview } from './utils/pr-filter.ts';

export interface ExtendedPullRequestInfo extends IPullRequestInfo {
  isDraft: boolean;
  labels: string[];
}

export class ActionRunner {
  // Initialize config with DEFAULT_CONFIG, it will be updated by loadConfig
  protected reviewConfig: ReviewConfig = DEFAULT_CONFIG;
  protected vcsClient?: IVersionControlSystem;

  constructor(protected readonly config: ActionConfig) {}

  async run(): Promise<IReviewComment[]> {
    await this.loadBaseConfig();

    const dryRunEnvVar = process.env.CODE_HEDGEHOG_DRY_RUN_VCS_PROCESSING;
    const dryRun = dryRunEnvVar === 'true' || dryRunEnvVar === '1';

    try {
      const githubConfig = this.createGitHubConfig();

      // Initialize components
      this.vcsClient = this.vcsClient ?? createVCS(githubConfig);
      const fileManager = new FileManager(this.vcsClient, {
        exclude: this.reviewConfig.file_filter?.exclude ?? DEFAULT_CONFIG.file_filter.exclude,
        maxChanges: this.reviewConfig.file_filter?.max_changes ?? DEFAULT_CONFIG.file_filter.max_changes,
      });
      const processor = await this.createProcessor();

      // Get PR information
      core.info('Fetching pull request information...');
      const prInfo = (await this.vcsClient.getPullRequestInfo()) as ExtendedPullRequestInfo;

      // Check if PR should be reviewed based on configuration
      if (shouldSkipReview(prInfo, this.reviewConfig)) {
        core.info('Skipping review based on PR configuration');
        return [];
      }

      core.info('Starting code review...');
      if (dryRun) {
        core.info('::: DRY RUN :::');
      }

      const allComments: IReviewComment[] = [];

      // Process files in batches and get reviews
      for await (const files of fileManager.collectChangedFiles(this.reviewConfig)) {
        const { comments } = await processor.process(prInfo, files);
        allComments.push(...(comments ?? []));

        if (comments != null && comments.length > 0) {
          if (dryRun) {
            core.info(comments.map((comment) => `- ${JSON.stringify(comment, null, 2)}`).join('\n'));
          } else {
            await this.vcsClient.createReviewBatch(comments, dryRun);
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

  protected createGitHubConfig(): IVCSConfig {
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

  protected async createProcessor(): Promise<IPullRequestProcessor> {
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

  /**
   * Load configuration using the external module.
   * This method now acts as a wrapper to update the instance's config.
   */
  protected async loadBaseConfig(configPath = '.coderabbitai.yaml'): Promise<void> {
    // Call the external function and update the instance's config
    this.reviewConfig = await loadExternalBaseConfig(configPath); // Rename function call
  }

  /**
   * For testing purposes only
   */
  protected setVCSClient(client: IVersionControlSystem): void {
    this.vcsClient = client;
  }
}
