import type { ReviewConfig } from '@code-hedgehog/processor-base';
import type { IFileChange } from '../types/mod.ts';

export interface IFileFilter {
  /**
   * If specified, only files matching these patterns will be processed
   * @example ['**.{ts,js}', 'src/**']
   */
  include?: string[];

  /**
   * If specified, files matching these patterns will be excluded
   * @example ['**\/node_modules/**', 'pnpm-lock.yaml']
   */
  exclude?: string[];

  /**
   * Maximum number of changes (lines) to process
   */
  maxChanges?: number;

  /**
   * List of file statuses to process
   */
  allowedStatuses?: ('added' | 'modified' | 'removed' | 'renamed' | 'changed')[];
}

export interface IFileManager {
  /**
   * Collects and filters changed files from PR
   * @param reviewConfig .coderabbitai.yaml file configurations
   * @param batchSize Number of files to process in each batch
   * @returns AsyncIterator of filtered file changes
   */
  collectChangedFiles(reviewConfig: ReviewConfig, batchSize?: number): AsyncIterableIterator<IFileChange[]>;
}
