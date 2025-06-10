// actualCore のインポートは完全に不要になる
// import * as actualCore from '@actions/core';
import { DEFAULT_CONFIG } from '@code-hedgehog/processor-base';
import type { ReviewConfig } from '@code-hedgehog/processor-base';
import { assertEquals } from '@std/assert';
import { beforeEach, describe, test } from '@std/testing/bdd'; // afterEach は不要
// Spy と spy のインポートも不要
// import { type Spy, spy } from '@std/testing/mock';
import type { ExtendedPullRequestInfo } from '../runner.ts';
import { matchesGlobPattern, shouldSkipReview } from './pr-filter.ts';

// テスト用のストレージとロガー (これは主に matchesGlobPattern のエラーハンドリング用として残す)
const localMessages: string[] = []; // 名前を変更
const localCoreMock = {
  // 名前を変更
  info(message: string) {
    localMessages.push(message);
  },
  warning(message: string) {
    localMessages.push(`WARNING: ${message}`);
  },
};

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

describe('Advanced Glob Pattern Matching', () => {
  beforeEach(() => {
    localMessages.length = 0;
  });

  describe('Basic patterns', () => {
    test('exact match', () => {
      assertEquals(matchesGlobPattern('test.txt', 'test.txt', localCoreMock), true);
      assertEquals(matchesGlobPattern('test.txt', 'test.js', localCoreMock), false);
    });

    test('single asterisk (*)', () => {
      assertEquals(matchesGlobPattern('test.txt', '*.txt', localCoreMock), true);
      assertEquals(matchesGlobPattern('test.js', '*.txt', localCoreMock), false);
      assertEquals(matchesGlobPattern('prefix-test.txt', 'prefix-*.txt', localCoreMock), true);
      assertEquals(matchesGlobPattern('dir/test.txt', '*.txt', localCoreMock), false); // * doesn't match path separators
    });

    test('double asterisk (**)', () => {
      assertEquals(matchesGlobPattern('dir/subdir/test.txt', '**/test.txt', localCoreMock), true);
      assertEquals(matchesGlobPattern('test.txt', '**/test.txt', localCoreMock), true);
      assertEquals(matchesGlobPattern('dir/test.txt', '**/test.txt', localCoreMock), true);
      assertEquals(matchesGlobPattern('a/b/c/test.txt', '**/test.txt', localCoreMock), true);
    });

    test('question mark (?)', () => {
      assertEquals(matchesGlobPattern('test1.txt', 'test?.txt', localCoreMock), true);
      assertEquals(matchesGlobPattern('testa.txt', 'test?.txt', localCoreMock), true);
      assertEquals(matchesGlobPattern('test12.txt', 'test?.txt', localCoreMock), false);
      assertEquals(matchesGlobPattern('test.txt', 'test?.txt', localCoreMock), false);
      assertEquals(matchesGlobPattern('test/.txt', 'test?.txt', localCoreMock), false); // ? doesn't match path separators
    });
  });

  describe('Brace expansion {alt1,alt2}', () => {
    test('simple alternatives', () => {
      assertEquals(matchesGlobPattern('test.js', 'test.{js,ts}', localCoreMock), true);
      assertEquals(matchesGlobPattern('test.ts', 'test.{js,ts}', localCoreMock), true);
      assertEquals(matchesGlobPattern('test.py', 'test.{js,ts}', localCoreMock), false);
    });

    test('multiple alternatives', () => {
      assertEquals(matchesGlobPattern('src/index.js', '{src,test,lib}/index.{js,ts,jsx}', localCoreMock), true);
      assertEquals(matchesGlobPattern('test/index.ts', '{src,test,lib}/index.{js,ts,jsx}', localCoreMock), true);
      assertEquals(matchesGlobPattern('docs/index.md', '{src,test,lib}/index.{js,ts,jsx}', localCoreMock), false);
    });

    test('nested braces', () => {
      assertEquals(matchesGlobPattern('a.js', '{a,b}.{js,{ts,jsx}}', localCoreMock), true);
      assertEquals(matchesGlobPattern('b.ts', '{a,b}.{js,{ts,jsx}}', localCoreMock), true);
      assertEquals(matchesGlobPattern('a.py', '{a,b}.{js,{ts,jsx}}', localCoreMock), false);
    });

    test('escaped commas in braces', () => {
      assertEquals(matchesGlobPattern('file,name.txt', 'file\\,name.{txt,md}', localCoreMock), true);
      assertEquals(matchesGlobPattern('file,name.md', 'file\\,name.{txt,md}', localCoreMock), true);
      assertEquals(matchesGlobPattern('filename.txt', 'file\\,name.{txt,md}', localCoreMock), false);
    });

    test('malformed braces', () => {
      assertEquals(matchesGlobPattern('{unclosed', '{unclosed', localCoreMock), true);
      assertEquals(matchesGlobPattern('test{', 'test{', localCoreMock), true);
      assertEquals(matchesGlobPattern('test}', 'test}', localCoreMock), true);
    });
  });

  describe('Character classes [abc]', () => {
    test('simple character class', () => {
      assertEquals(matchesGlobPattern('test1.txt', 'test[123].txt', localCoreMock), true);
      assertEquals(matchesGlobPattern('test2.txt', 'test[123].txt', localCoreMock), true);
      assertEquals(matchesGlobPattern('test4.txt', 'test[123].txt', localCoreMock), false);
    });

    test('character ranges', () => {
      assertEquals(matchesGlobPattern('test1.txt', 'test[1-3].txt', localCoreMock), true);
      assertEquals(matchesGlobPattern('test2.txt', 'test[1-3].txt', localCoreMock), true);
      assertEquals(matchesGlobPattern('test4.txt', 'test[1-3].txt', localCoreMock), false);
    });

    test('negated character class', () => {
      assertEquals(matchesGlobPattern('test1.txt', 'test[!abc].txt', localCoreMock), true);
      assertEquals(matchesGlobPattern('testa.txt', 'test[!abc].txt', localCoreMock), false);
      assertEquals(matchesGlobPattern('test1.txt', 'test[^abc].txt', localCoreMock), true);
      assertEquals(matchesGlobPattern('testb.txt', 'test[^abc].txt', localCoreMock), false);
    });

    test('escaped characters in character class', () => {
      assertEquals(matchesGlobPattern('test].txt', 'test[\\]].txt', localCoreMock), true);
      assertEquals(matchesGlobPattern('test-.txt', 'test[\\-].txt', localCoreMock), true);
    });

    test('malformed character class', () => {
      assertEquals(matchesGlobPattern('test[unclosed', 'test[unclosed', localCoreMock), true);
      assertEquals(matchesGlobPattern('test[', 'test[', localCoreMock), true);
    });
  });

  describe('Escape sequences', () => {
    test('escaped special characters', () => {
      assertEquals(matchesGlobPattern('test*.txt', 'test\\*.txt', localCoreMock), true);
      assertEquals(matchesGlobPattern('testX.txt', 'test\\*.txt', localCoreMock), false);
      assertEquals(matchesGlobPattern('test?.txt', 'test\\?.txt', localCoreMock), true);
      assertEquals(matchesGlobPattern('testX.txt', 'test\\?.txt', localCoreMock), false);
    });

    test('escaped backslash', () => {
      assertEquals(matchesGlobPattern('test\\.txt', 'test\\\\.txt', localCoreMock), true);
      assertEquals(matchesGlobPattern('testX.txt', 'test\\\\.txt', localCoreMock), false);
    });

    test('trailing backslash', () => {
      assertEquals(matchesGlobPattern('test\\', 'test\\', localCoreMock), true);
    });
  });

  describe('Complex real-world patterns', () => {
    test('source file patterns', () => {
      const patterns = ['src/**/*.{js,ts,jsx,tsx}', 'lib/**/*.js', 'test/**/*.test.{js,ts}', '**/*.d.ts', 'packages/*/src/**/*.ts'];

      const testCases = [
        { path: 'src/components/Button.tsx', shouldMatch: [0] },
        { path: 'src/utils/helper.ts', shouldMatch: [0] },
        { path: 'lib/index.js', shouldMatch: [1] },
        { path: 'test/unit/helper.test.js', shouldMatch: [2] },
        { path: 'src/types.d.ts', shouldMatch: [0, 3] },
        { path: 'packages/core/src/index.ts', shouldMatch: [4] },
        { path: 'docs/README.md', shouldMatch: [] },
      ];

      for (const testCase of testCases) {
        for (let i = 0; i < patterns.length; i++) {
          const shouldMatch = testCase.shouldMatch.includes(i);
          assertEquals(
            matchesGlobPattern(testCase.path, patterns[i], localCoreMock),
            shouldMatch,
            `Pattern "${patterns[i]}" should ${shouldMatch ? 'match' : 'not match'} path "${testCase.path}"`,
          );
        }
      }
    });

    test('branch patterns', () => {
      const testCases = [
        { branch: 'feature/user-auth', pattern: 'feature/*', shouldMatch: true },
        { branch: 'feature/ui/button-component', pattern: 'feature/**', shouldMatch: true },
        { branch: 'hotfix/critical-bug', pattern: '{feature,hotfix}/*', shouldMatch: true },
        { branch: 'release/v1.2.3', pattern: 'release/v?.?.?', shouldMatch: true },
        { branch: 'dependabot/npm_and_yarn/types-1.0.0', pattern: 'dependabot/**', shouldMatch: true },
        { branch: 'renovate/typescript-4.x', pattern: 'renovate/*', shouldMatch: true },
        { branch: 'main', pattern: '{main,master,develop}', shouldMatch: true },
        { branch: 'develop', pattern: '{main,master,develop}', shouldMatch: true },
        { branch: 'feat/test', pattern: 'feature/*', shouldMatch: false },
      ];

      for (const testCase of testCases) {
        assertEquals(
          matchesGlobPattern(testCase.branch, testCase.pattern, localCoreMock),
          testCase.shouldMatch,
          `Pattern "${testCase.pattern}" should ${testCase.shouldMatch ? 'match' : 'not match'} branch "${testCase.branch}"`,
        );
      }
    });
  });

  describe('Error handling', () => {
    test('invalid regex patterns should not crash', () => {
      // These patterns might cause regex errors but should be handled gracefully
      const invalidPatterns = [
        '[z-a]', // Invalid range
        '***', // Multiple consecutive wildcards (should be handled)
        '{{{', // Malformed braces
      ];

      for (const pattern of invalidPatterns) {
        // Should not throw an error
        // matchesGlobPattern内でエラーが発生した場合、localCoreMock.warningが呼ばれることを期待
        localMessages.length = 0; // warningメッセージをキャプチャする前にクリア
        const result = matchesGlobPattern('test', pattern, localCoreMock);
        assertEquals(typeof result, 'boolean', `Pattern "${pattern}" should return a boolean`);
        // 必要であれば、localMessagesにwarningが記録されたかもチェックできる
        // 例: if pattern is expected to be invalid and log, check localMessages
      }
    });
  });
});

describe('PR Skip Logic with Advanced Patterns', () => {
  // infoSpy と spy の使用を localCoreMock と localMessages に置き換える

  beforeEach(() => {
    localMessages.length = 0; // 各テストケースまたはループの開始時にクリア
  });

  // afterEach ブロックは不要

  test('branch pattern matching with complex patterns', () => {
    const testCases = [
      { branch: 'dependabot/npm_and_yarn/typescript-4.9.5', pattern: 'dependabot/**' },
      { branch: 'renovate/pin-dependencies', pattern: '{renovate,dependabot}/**' },
      { branch: 'feature/user-auth-v2', pattern: 'feature/*-v?' },
      { branch: 'hotfix/security-patch', pattern: '{hotfix,bugfix}/*' },
    ];

    for (const { branch, pattern } of testCases) {
      localMessages.length = 0; // 各イテレーションの前にクリア

      const prInfo = createPrInfo({ headBranch: branch });
      const config: ReviewConfig = {
        ...DEFAULT_CONFIG,
        ignored_branches: [pattern],
      };

      // actualCore の代わりに localCoreMock を渡す
      assertEquals(shouldSkipReview(prInfo, config, localCoreMock), true, `Branch "${branch}" should be skipped by pattern "${pattern}"`);
      // localMessages をチェック
      assertEquals(localMessages.length, 1, `localMessages should have one entry for branch "${branch}" with pattern "${pattern}"`);
      assertEquals(localMessages[0], `Skipping review for ignored branch pattern: ${pattern}`);
    }
  });

  test('multiple pattern matching', () => {
    localMessages.length = 0;
    const prInfo = createPrInfo({ headBranch: 'dependabot/npm_and_yarn/lodash-4.17.21' });
    const config: ReviewConfig = {
      ...DEFAULT_CONFIG,
      ignored_branches: ['renovate/**', 'dependabot/**', 'release/*'],
    };

    // actualCore の代わりに localCoreMock を渡す
    assertEquals(shouldSkipReview(prInfo, config, localCoreMock), true, 'Should match dependabot pattern');
    // localMessages をチェック
    assertEquals(localMessages.length, 1, 'localMessages should have one entry');
    // 最初にマッチしたパターンがログに出力されることを期待
    assertEquals(localMessages[0], 'Skipping review for ignored branch pattern: dependabot/**');
  });

  test('no pattern matching', () => {
    localMessages.length = 0;
    const prInfo = createPrInfo({ headBranch: 'feature/new-component' });
    const config: ReviewConfig = {
      ...DEFAULT_CONFIG,
      ignored_branches: ['renovate/**', 'dependabot/**', 'release/*'],
    };

    // actualCore の代わりに localCoreMock を渡す
    assertEquals(shouldSkipReview(prInfo, config, localCoreMock), false, 'Should not skip feature branch');
    // localMessages をチェック
    assertEquals(localMessages.length, 0, 'localMessages should be empty');
  });
});
