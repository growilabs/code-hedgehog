// packages/action/src/runner.ts

import process from 'node:process';
import * as core from '@actions/core';
import { FileManager, type IFileFilter, type IPullRequestProcessor, type IVCSConfig, type ProcessInput, createVCS } from '@code-hedgehog/core';
import type { ActionConfig } from './config.ts';

export class ActionRunner {
  constructor(private readonly config: ActionConfig) {}

  async run(): Promise<void> {
    const dryRunEnvVar = process.env.CODE_HEDGEHOG_DRY_RUN_VCS_PROCESSING;
    const dryRun = dryRunEnvVar === 'true' || dryRunEnvVar === '1';
    let checkRunId: number | undefined;

    try {
      const githubConfig = this.createGitHubConfig();
      const headSha = process.env.GITHUB_SHA;
      if (!headSha) {
        throw new Error('GITHUB_SHA environment variable is not set. Cannot create Check Run.');
      }

      // Initialize components
      const vcsClient = createVCS(githubConfig);
      const fileManager = new FileManager(vcsClient, this.getFileFilter());
      const processor = await this.createProcessor();

      // Create Check Run
      if (!dryRun) {
        core.info('Creating Check Run...');
        checkRunId = await vcsClient.createCheckRun({
          name: 'Code Hedgehog Review',
          head_sha: headSha,
          status: 'in_progress',
          started_at: new Date().toISOString(),
          output: {
            title: 'Review in Progress',
            summary: 'Code Hedgehog is currently reviewing the changes.',
          },
        });
        core.info(`Created Check Run ID: ${checkRunId}`);
      } else {
        core.info('[DRY RUN] Would create Check Run: Code Hedgehog Review (in_progress)');
      }

      // Get PR information
      core.info('Fetching pull request information...');
      const prInfo = await vcsClient.getPullRequestInfo();

      core.info('Fetching comment history...');
      const commentHistory = await vcsClient.getComments(githubConfig.pullRequestId);
      core.info(`Fetched ${commentHistory.length} comments.`);

      core.info('Starting code review...');
      if (dryRun) {
        core.info('::: DRY RUN :::');
      }

      let totalCommentsPosted = 0;
      // Process files in batches and get reviews
      for await (const files of fileManager.collectChangedFiles()) {
        const processInput: ProcessInput = {
          prInfo,
          files,
          // TODO: Pass merged config here once config loading is implemented in ActionRunner
          // config: mergedConfig,
          commentHistory,
        };
        const { comments } = await processor.process(processInput);
        if (comments != null && comments.length > 0) {
          totalCommentsPosted += comments.length;
          if (dryRun) {
            core.info(comments.map((comment) => `- ${JSON.stringify(comment, null, 2)}`).join('\n'));
          } else {
            await vcsClient.createReviewBatch(comments, false); // dryRun for createReviewBatch is handled by the main dryRun flag for Check Runs
          }
          core.info(`Posted ${comments.length} review comments`);
        }
      }

      core.info('Code review completed successfully');

      // Update Check Run to success
      if (!dryRun && checkRunId !== undefined) {
        core.info('Updating Check Run to success...');
        await vcsClient.updateCheckRun(checkRunId, {
          status: 'completed',
          conclusion: 'success',
          completed_at: new Date().toISOString(),
          output: {
            title: 'Review Complete',
            summary: `Code Hedgehog review finished. ${totalCommentsPosted} comments posted.`,
          },
        });
        core.info('Check Run updated to success.');
      } else if (dryRun) {
        core.info('[DRY RUN] Would update Check Run to success.');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      core.setFailed(`Action failed: ${errorMessage}`);

      // Update Check Run to failure
      if (!dryRun && checkRunId !== undefined) {
        core.error(`Attempting to update Check Run ${checkRunId} to failure...`);
        try {
          await createVCS(this.createGitHubConfig()).updateCheckRun(checkRunId, {
            // Re-create VCS client for safety, config should be available
            status: 'completed',
            conclusion: 'failure',
            completed_at: new Date().toISOString(),
            output: {
              title: 'Review Failed',
              summary: `Code Hedgehog review failed: ${errorMessage}`,
            },
          });
          core.info(`Check Run ${checkRunId} updated to failure.`);
        } catch (updateError) {
          core.error(`Failed to update Check Run to failure: ${updateError instanceof Error ? updateError.message : String(updateError)}`);
        }
      } else if (dryRun) {
        core.info('[DRY RUN] Would update Check Run to failure.');
      }
      // Do not re-throw error here if we want the action to potentially pass if check run update fails
      // However, setFailed above will mark the action as failed.
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
}
