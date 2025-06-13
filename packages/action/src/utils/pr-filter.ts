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
}

/**
 * Default core logger that uses @actions/core
 */
export const defaultCoreLogger: CoreLogger = {
  info: (message: string) => core.info(message),
  warning: (message: string) => core.warning(message),
};

export function shouldSkipReview(prInfo: ExtendedPullRequestInfo, config: ReviewConfig, coreInstance: CoreLogger = defaultCoreLogger): boolean {
  // ドラフトPRのチェック - 安全なアクセス
  if ((config.ignore_draft_prs ?? false) && prInfo.isDraft) {
    coreInstance.info('Skipping review for draft PR');
    return true;
  }

  // 無視するブランチのチェック - 安全なアクセス
  const ignoredBranches = config.ignored_branches ?? [];
  for (const pattern of ignoredBranches) {
    try {
      if (matchesGlobPattern(prInfo.headBranch, pattern, coreInstance)) {
        coreInstance.info(`Skipping review for ignored branch pattern: ${pattern}`);
        return true;
      }
    } catch (error) {
      coreInstance.warning(`Invalid branch pattern ${pattern}: ${error}`);
    }
  }

  // 無視するタイトルのチェック - 安全なアクセス
  const ignoredTitles = config.ignored_titles ?? [];
  if (ignoredTitles.length > 0) {
    const title = prInfo.title.toLowerCase();
    for (const pattern of ignoredTitles) {
      if (title.includes(pattern.toLowerCase())) {
        coreInstance.info(`Skipping review for ignored title pattern: ${pattern}`);
        return true;
      }
    }
  }

  // 必要なラベルのチェック - 安全なアクセス
  const requiredLabels = config.limit_reviews_by_labels ?? [];
  if (requiredLabels.length > 0) {
    const prLabels = (prInfo.labels ?? []).map((label) => label.toLowerCase());
    const normalizedRequiredLabels = requiredLabels.map((label) => label.toLowerCase());
    const hasRequiredLabel = normalizedRequiredLabels.some((label) => prLabels.includes(label));

    if (!hasRequiredLabel) {
      coreInstance.info('Skipping review as PR does not have any required labels');
      return true;
    }
  }

  return false;
}

/**
 * Checks if a given file path matches a glob pattern.
 * Uses minimatch for robust and well-tested glob pattern matching.
 *
 * Supported patterns (via minimatch):
 * - `*` - matches any sequence of characters except path separators
 * - `**` - matches any sequence of characters including path separators
 * - `?` - matches exactly one character except path separators
 * - `{alt1,alt2}` - matches any of the comma-separated alternatives
 * - `[abc]` - matches any character in the set
 * - `[!abc]` or `[^abc]` - matches any character not in the set
 * - `\` - escapes the next character to match it literally
 * - And many more advanced patterns supported by minimatch
 *
 * @param filePath The file path to test.
 * @param pattern The glob pattern.
 * @param coreInstance Logger instance for warnings
 * @returns True if the path matches the pattern, false otherwise.
 */
export function matchesGlobPattern(filePath: string, pattern: string, coreInstance: CoreLogger = defaultCoreLogger): boolean {
  try {
    // Use minimatch for robust glob pattern matching.
    // The `dot` option allows patterns to match files starting with a dot (e.g., .env).
    // More options can be found at https://github.com/isaacs/minimatch
    return minimatch(filePath, pattern, {
      dot: true,
      matchBase: false, // Keep strict path matching for security
      nocomment: true, // Disable comment parsing for security
      nonegate: true, // Disable negation patterns for security
    });
  } catch (error) {
    // Log invalid patterns but treat them as non-matching to prevent crashes.
    // minimatch itself might throw for severely malformed patterns,
    // though it's generally robust.
    coreInstance.warning(`Error matching glob pattern "${pattern}" for path "${filePath}": ${error}`);
    return false;
  }
}
