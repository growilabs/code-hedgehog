// External dependencies
import { encode } from 'npm:gpt-tokenizer';
import { parse as parseYaml } from 'npm:yaml';
import { z } from 'npm:zod';

// Core types
import type {
  IFileChange as CoreFileChange,
  IPullRequestProcessedResult as CoreProcessedResult,
  IPullRequestProcessor as CoreProcessor,
  IPullRequestInfo as CorePullRequestInfo,
  ReviewConfig as CoreReviewConfig,
} from '@code-hedgehog/core';

// Export dependencies
export { encode, parseYaml, z };

// Configuration types
export interface TokenConfig {
  margin: number;
  maxTokens: number;
}

export interface PathInstruction {
  path: string;
  instructions: string;
}

// Base review configuration
export interface LocalReviewConfig {
  file_path_instructions?: PathInstruction[];
  path_filters?: string;
  skip_simple_changes?: boolean;
}

// Combined review configuration
export interface ReviewConfig extends CoreReviewConfig, LocalReviewConfig {
  path_instructions: PathInstruction[]; // Required by core
}

// Re-export core types with their original names
export type IFileChange = CoreFileChange;
export type IPullRequestInfo = CorePullRequestInfo;
export type IPullRequestProcessedResult = CoreProcessedResult;
export type IPullRequestProcessor = CoreProcessor;

// Type aliases for convenience
export type FileChange = IFileChange;
export type PullRequestInfo = IPullRequestInfo;
export type PullRequestProcessedResult = IPullRequestProcessedResult;
export type PullRequestProcessor = IPullRequestProcessor;
export type BaseReviewConfig = ReviewConfig;

// Utility functions
export function matchesGlobPattern(filePath: string, pattern: string): boolean {
  const regexPattern = pattern.replace(/\./g, '\\.').replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*').replace(/\?/g, '.');
  return new RegExp(`^${regexPattern}$`).test(filePath);
}

// Default configuration
export const DEFAULT_CONFIG: ReviewConfig = {
  path_instructions: [], // Required by core
  file_path_instructions: [], // Local extension
  path_filters: ['!dist/**', '!**/*.min.js', '!**/*.map', '!**/node_modules/**'].join('\n'),
  skip_simple_changes: false,
};
