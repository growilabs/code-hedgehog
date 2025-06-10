import { DEFAULT_CONFIG } from '@code-hedgehog/processor-base';
import type { ReviewConfig } from '@code-hedgehog/processor-base';
import { assertEquals } from '@std/assert';
import { beforeEach, describe, test } from '@std/testing/bdd';
import type { ExtendedPullRequestInfo } from '../runner.ts';

// テスト用のストレージとロガー
const messages: string[] = [];
const core = {
  info(message: string) {
    messages.push(message);
  },
  warning(message: string) {
    messages.push(`WARNING: ${message}`);
  },
};

// テスト用の実装
function shouldSkipReview(prInfo: ExtendedPullRequestInfo, config: ReviewConfig): boolean {
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

function globToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '{{GLOBSTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/{{GLOBSTAR}}/g, '.*');

  return new RegExp(`^${escaped}$`);
}

// ヘルパー関数
function createPrInfo(overrides: Partial<ExtendedPullRequestInfo> = {}): ExtendedPullRequestInfo {
  return {
    title: 'Test PR',
    body: '',
    baseBranch: 'main',
    headBranch: 'feature/test',
    isDraft: false,
    labels: [],
    ...overrides,
  };
}

describe('PR skip conditions', () => {
  beforeEach(() => {
    messages.length = 0;
  });

  test('draft PR skipping', () => {
    const prInfo = createPrInfo({ isDraft: true });
    const config: ReviewConfig = {
      ...DEFAULT_CONFIG,
      ignore_draft_prs: true,
    };

    assertEquals(shouldSkipReview(prInfo, config), true, 'ドラフトPRはスキップされるべき');
    assertEquals(messages.length, 1, 'メッセージが1つ記録されるべき');
    assertEquals(messages[0], 'Skipping review for draft PR', 'メッセージの内容が正しいべき');
  });

  test('branch pattern matching', () => {
    const testCases = [
      { branch: 'deps/update-typescript', pattern: 'deps/*' },
      { branch: 'renovate/update-jest', pattern: 'renovate/**' },
      { branch: 'dev/feature/test', pattern: 'dev/**' },
    ];

    for (const { branch, pattern } of testCases) {
      messages.length = 0;
      const prInfo = createPrInfo({ headBranch: branch });
      const config: ReviewConfig = {
        ...DEFAULT_CONFIG,
        ignored_branches: [pattern],
      };

      assertEquals(shouldSkipReview(prInfo, config), true, `${pattern}パターンにマッチするブランチはスキップされるべき`);
      assertEquals(messages.length, 1, 'メッセージが1つ記録されるべき');
      assertEquals(messages[0], `Skipping review for ignored branch pattern: ${pattern}`, 'メッセージの内容が正しいべき');
    }
  });

  test('title pattern matching', () => {
    const testCases = [
      { title: '[WIP] New feature', pattern: '[WIP]' },
      { title: 'chore: update deps', pattern: 'chore:' },
      { title: 'DO NOT MERGE: testing', pattern: 'DO NOT MERGE' },
    ];

    for (const { title, pattern } of testCases) {
      messages.length = 0;
      const prInfo = createPrInfo({ title });
      const config: ReviewConfig = {
        ...DEFAULT_CONFIG,
        ignored_titles: [pattern],
      };

      assertEquals(shouldSkipReview(prInfo, config), true, `${pattern}パターンにマッチするタイトルはスキップされるべき`);
      assertEquals(messages.length, 1, 'メッセージが1つ記録されるべき');
      assertEquals(messages[0], `Skipping review for ignored title pattern: ${pattern}`, 'メッセージの内容が正しいべき');
    }
  });

  test('label requirement checking', () => {
    // ラベルがない場合
    {
      messages.length = 0;
      const prInfo = createPrInfo({ labels: ['bug'] });
      const config: ReviewConfig = {
        ...DEFAULT_CONFIG,
        limit_reviews_by_labels: ['needs-review'],
      };

      assertEquals(shouldSkipReview(prInfo, config), true, '必要なラベルがない場合はスキップされるべき');
      assertEquals(messages.length, 1, 'メッセージが1つ記録されるべき');
      assertEquals(messages[0], 'Skipping review as PR does not have any required labels', 'メッセージの内容が正しいべき');
    }

    // ラベルがある場合
    {
      messages.length = 0;
      const prInfo = createPrInfo({ labels: ['needs-review', 'bug'] });
      const config: ReviewConfig = {
        ...DEFAULT_CONFIG,
        limit_reviews_by_labels: ['needs-review'],
      };

      assertEquals(shouldSkipReview(prInfo, config), false, '必要なラベルがある場合はスキップされないべき');
      assertEquals(messages.length, 0, 'メッセージは記録されないべき');
    }
  });
});

describe('glob pattern matching', () => {
  test('basic patterns', () => {
    const testCases = [
      {
        pattern: 'test',
        matches: ['test'],
        nonMatches: ['test1', 'atest', 'testa'],
      },
      {
        pattern: 'test*',
        matches: ['test', 'test1', 'testA'],
        nonMatches: ['atest', 'test/a'],
      },
      {
        pattern: 'test/**',
        matches: ['test/a', 'test/a/b'],
        nonMatches: ['test', 'atest/b'],
      },
    ];

    for (const { pattern, matches, nonMatches } of testCases) {
      const regex = globToRegExp(pattern);

      for (const match of matches) {
        assertEquals(regex.test(match), true, `パターン "${pattern}" は "${match}" にマッチするべき`);
      }

      for (const nonMatch of nonMatches) {
        assertEquals(regex.test(nonMatch), false, `パターン "${pattern}" は "${nonMatch}" にマッチしないべき`);
      }
    }
  });

  test('special characters', () => {
    const testCases = [
      {
        pattern: 'test.ts',
        matches: ['test.ts'],
        nonMatches: ['testxts', 'test_ts'],
      },
      {
        pattern: 'test[abc].ts',
        matches: ['test[abc].ts'],
        nonMatches: ['testa.ts', 'testb.ts'],
      },
      {
        pattern: 'test(1).ts',
        matches: ['test(1).ts'],
        nonMatches: ['test1.ts', 'test.ts'],
      },
    ];

    for (const { pattern, matches, nonMatches } of testCases) {
      const regex = globToRegExp(pattern);

      for (const match of matches) {
        assertEquals(regex.test(match), true, `パターン "${pattern}" は "${match}" にマッチするべき`);
      }

      for (const nonMatch of nonMatches) {
        assertEquals(regex.test(nonMatch), false, `パターン "${pattern}" は "${nonMatch}" にマッチしないべき`);
      }
    }
  });
});
