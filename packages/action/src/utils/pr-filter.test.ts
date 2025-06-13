import { DEFAULT_CONFIG, type ReviewConfig } from '@code-hedgehog/processor-base';
import { assertEquals } from '@std/assert';
import { beforeEach, describe, test } from '@std/testing/bdd';
import type { ExtendedPullRequestInfo } from '../runner.ts';
import { matchesGlobPattern, shouldSkipReview } from './pr-filter.ts';

// テスト用のシンプルなロガー
const testMessages: string[] = [];
const testLogger = {
  info: (message: string) => testMessages.push(message),
  warning: (message: string) => testMessages.push(`WARNING: ${message}`),
};

// テストヘルパー関数
function createTestPR(options: Partial<ExtendedPullRequestInfo> = {}): ExtendedPullRequestInfo {
  return {
    title: 'Test PR',
    body: '',
    baseBranch: 'main',
    headBranch: 'feature/test',
    isDraft: false,
    labels: [],
    ...options,
  };
}

function clearMessages() {
  testMessages.length = 0;
}

function expectSkipped(shouldSkip: boolean, expectedMessage?: string) {
  assertEquals(shouldSkip, true);
  if (expectedMessage) {
    assertEquals(testMessages.length, 1);
    assertEquals(testMessages[0], expectedMessage);
  }
}

function expectNotSkipped(shouldSkip: boolean) {
  assertEquals(shouldSkip, false);
  assertEquals(testMessages.length, 0);
}

describe('Glob Pattern Matching Tests', () => {
  beforeEach(clearMessages);

  describe('基本的なパターンマッチング', () => {
    const testCases: [string, string, boolean][] = [
      // 型注釈をここに追加
      // [ファイルパス, パターン, 期待結果]
      ['test.txt', 'test.txt', true],
      ['test.txt', 'test.js', false],
      ['test.txt', '*.txt', true],
      ['test.js', '*.txt', false],
      ['dir/test.txt', '*.txt', false], // * はパス区切り文字にマッチしない
      ['dir/test.txt', '**/test.txt', true],
      ['a/b/c/test.txt', '**/test.txt', true],
    ];

    for (const [filePath, pattern, expected] of testCases) {
      test(`"${filePath}" should ${expected ? 'match' : 'not match'} "${pattern}"`, () => {
        const result = matchesGlobPattern(filePath, pattern, testLogger);
        assertEquals(result, expected);
      });
    }
  });

  describe('複雑なパターン', () => {
    test('ブレース展開パターン', () => {
      const jsFile = 'test.js';
      const tsFile = 'test.ts';
      const pyFile = 'test.py';
      const pattern = 'test.{js,ts}';

      assertEquals(matchesGlobPattern(jsFile, pattern, testLogger), true);
      assertEquals(matchesGlobPattern(tsFile, pattern, testLogger), true);
      assertEquals(matchesGlobPattern(pyFile, pattern, testLogger), false);
    });

    test('文字クラスパターン', () => {
      const testCases: [string, string, boolean][] = [
        // 型注釈をここに追加
        ['test1.txt', 'test[123].txt', true],
        ['test2.txt', 'test[123].txt', true],
        ['test4.txt', 'test[123].txt', false],
        ['test1.txt', 'test[1-3].txt', true],
        ['test4.txt', 'test[1-3].txt', false],
      ];

      for (const [filePath, pattern, expected] of testCases) {
        assertEquals(matchesGlobPattern(filePath, pattern, testLogger), expected);
      }
    });
  });

  describe('実際のユースケース', () => {
    test('ソースファイルパターン', () => {
      const sourcePattern = 'src/**/*.{js,ts,jsx,tsx}';

      assertEquals(matchesGlobPattern('src/components/Button.tsx', sourcePattern, testLogger), true);
      assertEquals(matchesGlobPattern('src/utils/helper.ts', sourcePattern, testLogger), true);
      assertEquals(matchesGlobPattern('docs/README.md', sourcePattern, testLogger), false);
    });

    test('ブランチパターン', () => {
      const branchPattern = 'feature/*';

      assertEquals(matchesGlobPattern('feature/user-auth', branchPattern, testLogger), true);
      assertEquals(matchesGlobPattern('hotfix/bug-fix', branchPattern, testLogger), false);
    });
  });

  describe('エラーハンドリング', () => {
    test('不正なパターンでもクラッシュしない', () => {
      const invalidPatterns = ['[z-a]', '***', '{{{'];

      for (const pattern of invalidPatterns) {
        clearMessages();
        const result = matchesGlobPattern('test', pattern, testLogger);
        assertEquals(typeof result, 'boolean');
      }
    });
  });
});

describe('PR Skip Logic Tests', () => {
  beforeEach(clearMessages);

  describe('ドラフトPRのスキップ', () => {
    test('ドラフトPRをスキップする設定の場合', () => {
      const prInfo = createTestPR({ isDraft: true });
      const config: ReviewConfig = {
        ...DEFAULT_CONFIG,
        ignore_draft_prs: true,
      };

      const result = shouldSkipReview(prInfo, config, testLogger);
      expectSkipped(result, 'Skipping review for draft PR');
    });

    test('ドラフトPRをスキップしない設定の場合', () => {
      const prInfo = createTestPR({ isDraft: true });
      const config: ReviewConfig = {
        ...DEFAULT_CONFIG,
        ignore_draft_prs: false,
      };

      const result = shouldSkipReview(prInfo, config, testLogger);
      expectNotSkipped(result);
    });
  });

  describe('ブランチパターンでのスキップ', () => {
    test('単一パターンでのマッチ', () => {
      const prInfo = createTestPR({ headBranch: 'dependabot/npm_update' });
      const config: ReviewConfig = {
        ...DEFAULT_CONFIG,
        ignored_branches: ['dependabot/**'],
      };

      const result = shouldSkipReview(prInfo, config, testLogger);
      expectSkipped(result, 'Skipping review for ignored branch pattern: dependabot/**');
    });

    test('複数パターンでのマッチ', () => {
      const prInfo = createTestPR({ headBranch: 'renovate/typescript-4.9' });
      const config: ReviewConfig = {
        ...DEFAULT_CONFIG,
        ignored_branches: ['dependabot/**', 'renovate/**', 'release/*'],
      };

      const result = shouldSkipReview(prInfo, config, testLogger);
      expectSkipped(result, 'Skipping review for ignored branch pattern: renovate/**');
    });

    test('パターンにマッチしない場合', () => {
      const prInfo = createTestPR({ headBranch: 'feature/new-feature' });
      const config: ReviewConfig = {
        ...DEFAULT_CONFIG,
        ignored_branches: ['dependabot/**', 'renovate/**'],
      };

      const result = shouldSkipReview(prInfo, config, testLogger);
      expectNotSkipped(result);
    });
  });

  describe('タイトルパターンでのスキップ', () => {
    test('無視するタイトルでスキップ', () => {
      const prInfo = createTestPR({ title: 'WIP: Working on feature' });
      const config: ReviewConfig = {
        ...DEFAULT_CONFIG,
        ignored_titles: ['wip:', 'draft:'],
      };

      const result = shouldSkipReview(prInfo, config, testLogger);
      expectSkipped(result, 'Skipping review for ignored title pattern: wip:');
    });

    test('大文字小文字を区別しない', () => {
      const prInfo = createTestPR({ title: 'DRAFT: New feature' });
      const config: ReviewConfig = {
        ...DEFAULT_CONFIG,
        ignored_titles: ['draft:'],
      };

      const result = shouldSkipReview(prInfo, config, testLogger);
      expectSkipped(result, 'Skipping review for ignored title pattern: draft:');
    });
  });

  describe('ラベル制限でのスキップ', () => {
    test('必要なラベルがない場合スキップ', () => {
      const prInfo = createTestPR({ labels: ['bug', 'enhancement'] });
      const config: ReviewConfig = {
        ...DEFAULT_CONFIG,
        limit_reviews_by_labels: ['needs-review', 'ready-for-review'],
      };

      const result = shouldSkipReview(prInfo, config, testLogger);
      expectSkipped(result, 'Skipping review as PR does not have any required labels');
    });

    test('必要なラベルがある場合は処理続行', () => {
      const prInfo = createTestPR({ labels: ['bug', 'needs-review'] });
      const config: ReviewConfig = {
        ...DEFAULT_CONFIG,
        limit_reviews_by_labels: ['needs-review', 'ready-for-review'],
      };

      const result = shouldSkipReview(prInfo, config, testLogger);
      expectNotSkipped(result);
    });

    test('ラベルの大文字小文字を区別しない', () => {
      const prInfo = createTestPR({ labels: ['NEEDS-REVIEW'] });
      const config: ReviewConfig = {
        ...DEFAULT_CONFIG,
        limit_reviews_by_labels: ['needs-review'],
      };

      const result = shouldSkipReview(prInfo, config, testLogger);
      expectNotSkipped(result);
    });
  });

  describe('複合条件のテスト', () => {
    test('複数の条件が重なる場合、最初の条件でスキップ', () => {
      const prInfo = createTestPR({
        isDraft: true,
        headBranch: 'dependabot/update',
        title: 'WIP: Draft PR',
      });
      const config: ReviewConfig = {
        ...DEFAULT_CONFIG,
        ignore_draft_prs: true,
        ignored_branches: ['dependabot/**'],
        ignored_titles: ['wip:'],
      };

      const result = shouldSkipReview(prInfo, config, testLogger);
      // ドラフトPRのチェックが最初に実行されるため
      expectSkipped(result, 'Skipping review for draft PR');
    });

    test('どの条件にもマッチしない場合は処理続行', () => {
      const prInfo = createTestPR({
        isDraft: false,
        headBranch: 'feature/new-feature',
        title: 'Add new feature',
        labels: ['enhancement'],
      });
      const config: ReviewConfig = {
        ...DEFAULT_CONFIG,
        ignore_draft_prs: true,
        ignored_branches: ['dependabot/**'],
        ignored_titles: ['wip:', 'draft:'],
      };

      const result = shouldSkipReview(prInfo, config, testLogger);
      expectNotSkipped(result);
    });
  });
});
