import * as core from '@actions/core';
import { minimatch } from 'minimatch';

import type { IFileChange, IVersionControlSystem } from '../types/mod.ts';

import type { IFileFilter, IFileManager } from './types.ts';

export class FileManager implements IFileManager {
  constructor(
    private readonly vcsClient: IVersionControlSystem,
    private readonly filter: IFileFilter = {},
  ) {}

  async *collectChangedFiles(batchSize = 10): AsyncIterableIterator<IFileChange[]> {
    try {
      let currentBatch: IFileChange[] = [];

      for await (const files of this.vcsClient.getPullRequestChangesStream(batchSize)) {
        const filteredFiles = files.filter((file: IFileChange) => this.shouldProcessFile(file));

        currentBatch.push(...filteredFiles);

        while (currentBatch.length >= batchSize) {
          yield currentBatch.slice(0, batchSize);
          currentBatch = currentBatch.slice(batchSize);
        }
      }

      if (currentBatch.length > 0) {
        yield currentBatch;
      }
    } catch (error) {
      core.error(`Failed to collect changed files: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  private shouldProcessFile(file: IFileChange): boolean {
    // Check number of changes if limit is specified
    if (this.filter.maxChanges && file.changes > this.filter.maxChanges) {
      core.debug(`Skipping ${file.path}: changes (${file.changes}) exceeds limit (${this.filter.maxChanges})`);
      return false;
    }

    // Check file status if allowed statuses are specified
    if (this.filter.allowedStatuses && !this.filter.allowedStatuses.includes(file.status)) {
      core.debug(`Skipping ${file.path}: status ${file.status} not in allowed list`);
      return false;
    }

    // Check exclude patterns if specified
    if (this.filter.exclude?.some((pattern: string) => minimatch(file.path, pattern))) {
      core.debug(`Skipping ${file.path}: matches exclude pattern`);
      return false;
    }

    // Check include patterns if specified
    if (this.filter.include?.length && !this.filter.include.some((pattern: string) => minimatch(file.path, pattern))) {
      core.debug(`Skipping ${file.path}: does not match any include pattern`);
      return false;
    }

    return true;
  }
}
