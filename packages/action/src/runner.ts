// packages/action/src/runner.ts

import process from 'node:process';
import * as core from '@actions/core';
import { FileManager, type IFileFilter, type IPullRequestProcessor, type IVCSConfig, createVCS } from '@code-hedgehog/core';
import { DEFAULT_CONFIG, loadConfig } from '@code-hedgehog/processor-base';
import type { ActionConfig } from './config.ts';

export class ActionRunner {
  constructor(private readonly config: ActionConfig) {}

  async run(): Promise<void> {
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

      // Process files in batches and get reviews
      for await (const files of fileManager.collectChangedFiles()) {
        const { comments } = await processor.process(prInfo, files);
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
    // Load the base configuration (ReviewConfig) from YAML and defaults
    const baseConfig = await loadConfig(); // Returns ReviewConfig with only base fields from YAML + defaults
    core.info(`Loaded base configuration for processor: ${this.config.processor}`);
    core.debug(`Base config loaded: ${JSON.stringify(baseConfig)}`);

    // Processor-specific configurations are loaded from environment variables only
    switch (this.config.processor) {
      case 'acme': {
        const { AcmeProcessor } = await import('@code-hedgehog/processor-acme');
        return new AcmeProcessor();
      }
      case 'openai': {
        const { OpenaiProcessor } = await import('@code-hedgehog/processor-openai/mod.ts');
        // Import the specific config type dynamically
        const { OpenaiReviewConfig } = await import('@code-hedgehog/processor-openai/types.ts');
        // Create the specific config by merging base config and env vars
        const openaiConfig: OpenaiReviewConfig = {
          ...baseConfig, // Spread the base config loaded from loadConfig
          openai_api_key: process.env.OPENAI_API_KEY ?? '', // Load specific env var here
        };
        core.debug(`Final OpenAI config: ${JSON.stringify(openaiConfig)}`);
        return new OpenaiProcessor(openaiConfig);
      }
      case 'dify': {
        const { DifyProcessor } = await import('@code-hedgehog/processor-dify/mod.ts');
        // Import the specific config type dynamically
        const { DifyReviewConfig } = await import('@code-hedgehog/processor-dify/types.ts');
        // Create the specific config by merging base config and env vars
        const difyConfig: DifyReviewConfig = {
          ...baseConfig, // Spread the base config loaded from loadConfig
          dify_base_url: process.env.DIFY_API_BASE_URL ?? '', // Load specific env vars here
          dify_user: process.env.DIFY_API_EXEC_USER ?? '',
          dify_api_key_summarize: process.env.DIFY_API_KEY_SUMMARIZE ?? '',
          dify_api_key_grouping: process.env.DIFY_API_KEY_GROUPING ?? '',
          dify_api_key_review: process.env.DIFY_API_KEY_REVIEW ?? '',
        };
        core.debug(`Final Dify config: ${JSON.stringify(difyConfig)}`);
        return new DifyProcessor(difyConfig);
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
}
