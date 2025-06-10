import * as core from '@actions/core'; // Keep the actual import for other potential uses or direct calls if any
import type { ReviewConfig } from '@code-hedgehog/processor-base';
import { minimatch } from 'minimatch';
import type { ExtendedPullRequestInfo } from '../runner.ts';

/**
 * Interface for the core logging methods used by shouldSkipReview and matchesGlobPattern.
 * This allows for easier mocking in tests.
 */
export interface CoreLogger {
  info: (message: string) => void;
  warning: (message: string) => void;
  // Add other methods if they start being used
}

export function shouldSkipReview(prInfo: ExtendedPullRequestInfo, config: ReviewConfig, coreInstance: CoreLogger): boolean {
  // ドラフトPRのチェック
  if (config.ignore_draft_prs && prInfo.isDraft) {
    coreInstance.info('Skipping review for draft PR');
    return true;
  }

  // 無視するブランチのチェック
  if (
    config.ignored_branches.some((pattern) => {
      try {
        // Pass coreInstance to matchesGlobPattern
        if (matchesGlobPattern(prInfo.headBranch, pattern, coreInstance)) {
          coreInstance.info(`Skipping review for ignored branch pattern: ${pattern}`);
          return true;
        }
      } catch (error) {
        coreInstance.warning(`Invalid branch pattern ${pattern}: ${error}`);
      }
      return false;
    })
  ) {
    return true;
  }

  // 無視するタイトルのチェック
  if (config.ignored_titles.length > 0) {
    const title = prInfo.title.toLowerCase();
    for (const pattern of config.ignored_titles) {
      if (title.includes(pattern.toLowerCase())) {
        coreInstance.info(`Skipping review for ignored title pattern: ${pattern}`);
        return true;
      }
    }
  }

  // 必要なラベルのチェック
  if (config.limit_reviews_by_labels.length > 0) {
    const prLabels = prInfo.labels.map((label) => label.toLowerCase());
    const requiredLabels = config.limit_reviews_by_labels.map((label) => label.toLowerCase());
    const hasRequiredLabel = requiredLabels.some((label) => prLabels.includes(label));

    if (!hasRequiredLabel) {
      coreInstance.info('Skipping review as PR does not have any required labels');
      return true;
    }
  }

  return false;
}

/**
 * Checks if a given file path matches a glob pattern.
 * Handles advanced glob syntax including *, **, ?, {alt1,alt2}, and proper escaping.
 *
 * Supported patterns:
 * - `*` - matches any sequence of characters except path separators
 * - `**` - matches any sequence of characters including path separators
 * - `?` - matches exactly one character except path separators
 * - `{alt1,alt2}` - matches any of the comma-separated alternatives
 * - `\` - escapes the next character to match it literally
 *
 * @param filePath The file path to test.
 * @param pattern The glob pattern.
 * @returns True if the path matches the pattern, false otherwise.
 */
export function matchesGlobPattern(filePath: string, pattern: string, coreInstance: CoreLogger): boolean {
  try {
    // Use minimatch for robust glob pattern matching.
    // The `dot` option allows patterns to match files starting with a dot (e.g., .env).
    // More options can be found at https://github.com/isaacs/minimatch
    return minimatch(filePath, pattern, { dot: true });
  } catch (error) {
    // Log invalid patterns but treat them as non-matching to prevent crashes.
    // minimatch itself might throw for severely malformed patterns,
    // though it's generally robust.
    coreInstance.warning(`Error matching glob pattern "${pattern}" for path "${filePath}": ${error}`);
    return false;
  }
}
