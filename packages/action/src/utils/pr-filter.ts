import * as core from '@actions/core';
import type { ReviewConfig } from '@code-hedgehog/processor-base';
import type { ExtendedPullRequestInfo } from '../runner.ts';

export function shouldSkipReview(prInfo: ExtendedPullRequestInfo, config: ReviewConfig): boolean {
  // ドラフトPRのチェック
  if (config.ignore_draft_prs && prInfo.isDraft) {
    core.info('Skipping review for draft PR');
    return true;
  }

  // 無視するブランチのチェック
  if (
    config.ignored_branches.some((pattern) => {
      try {
        const regex = globToRegExp(pattern);
        if (regex.test(prInfo.headBranch)) {
          core.info(`Skipping review for ignored branch pattern: ${pattern}`);
          return true;
        }
      } catch (error) {
        core.warning(`Invalid branch pattern ${pattern}: ${error}`);
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
        core.info(`Skipping review for ignored title pattern: ${pattern}`);
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
      core.info('Skipping review as PR does not have any required labels');
      return true;
    }
  }

  return false;
}

/**
 * Convert glob pattern to RegExp
 * Simple implementation that handles * and ** patterns
 */
export function globToRegExp(pattern: string): RegExp {
  // Escape special regex characters except * and **
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '{{GLOBSTAR}}') // 一時的なプレースホルダー
    .replace(/\*/g, '[^/]*')
    .replace(/{{GLOBSTAR}}/g, '.*');

  return new RegExp(`^${escaped}$`);
}
