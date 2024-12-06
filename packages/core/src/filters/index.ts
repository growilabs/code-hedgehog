import * as core from '@actions/core';
import { minimatch } from 'minimatch';
import type { IFileChange, IFilterConfig } from '../types';

/**
 * Determines if a file should be processed based on filtering rules
 * @param file File change information
 * @param config Filter configuration
 * @returns True if the file should be processed
 */
export function shouldProcessFile(file: IFileChange, config: IFilterConfig): boolean {
  // Check file size first for early return
  if (file.size > config.maxFileSize) {
    core.debug(`Skipping ${file.path}: file size (${file.size}) exceeds limit (${config.maxFileSize})`);
    return false;
  }

  // Check exclude patterns first
  if (config.exclude.some((pattern) => minimatch(file.path, pattern))) {
    core.debug(`Skipping ${file.path}: matches exclude pattern`);
    return false;
  }

  // Check include patterns
  const matchesInclude = config.include.some((pattern) => minimatch(file.path, pattern));
  if (!matchesInclude) {
    core.debug(`Skipping ${file.path}: does not match any include patterns`);
    return false;
  }

  return true;
}

/**
 * Filters an array of file changes based on configuration
 * @param files Array of file changes
 * @param config Filter configuration
 * @returns Filtered array of file changes
 */
export function filterFiles(files: IFileChange[], config: IFilterConfig): IFileChange[] {
  return files.filter((file) => shouldProcessFile(file, config));
}
