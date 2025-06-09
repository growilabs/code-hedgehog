import { assertEquals } from '@std/assert';
import { afterEach, describe, test } from '@std/testing/bdd';
import { restore } from '@std/testing/mock';
import type { ActionConfig } from './config.ts';
import { ActionRunner, type ExtendedPullRequestInfo } from './runner.ts';

// テスト用のクラス
class TestActionRunner extends ActionRunner {
  // protectedメソッドをpublicにオーバーライド
  public async testShouldSkipReview(prInfo: ExtendedPullRequestInfo): Promise<boolean> {
    return this.shouldSkipReview(prInfo);
  }

  public testGlobToRegExp(pattern: string): RegExp {
    return this.globToRegExp(pattern);
  }

  // 設定を更新するメソッド
  public setReviewConfig(config: {
    ignore_draft_prs?: boolean;
    ignored_branches?: string[];
    ignored_titles?: string[];
    limit_reviews_by_labels?: string[];
  }): void {
    Object.assign(this.reviewConfig, config);
  }
}

describe('ActionRunner', () => {
  afterEach(() => {
    restore();
  });

  // テスト用のPR情報を生成するヘルパー関数
  function createPrInfo(overrides: Partial<ExtendedPullRequestInfo> = {}): ExtendedPullRequestInfo {
    return {
      title: 'Test PR',
      body: 'Test PR description',
      baseBranch: 'main',
      headBranch: 'test/feature', // ignored_branchesパターンにマッチしないブランチ名に変更
      isDraft: false,
      labels: [],
      ...overrides,
    };
  }

  // テスト用の設定を生成するヘルパー関数
  function createActionRunner(configOverrides: Partial<ActionConfig> = {}): TestActionRunner {
    const config: ActionConfig = {
      processor: 'openai',
      ...configOverrides,
    };
    return new TestActionRunner(config);
  }

  describe('should skip review based on PR conditions', () => {
    test('should skip when PR is draft and ignore_draft_prs is true', async () => {
      const runner = createActionRunner();
      const prInfo = createPrInfo({ isDraft: true });
      runner.setReviewConfig({ ignore_draft_prs: true });

      const shouldSkip = await runner.testShouldSkipReview(prInfo);
      assertEquals(shouldSkip, true);
    });

    test('should skip when branch name matches ignored pattern', async () => {
      const runner = createActionRunner();
      runner.setReviewConfig({ ignored_branches: ['dev/*', 'feature/*'] });

      const prInfo = createPrInfo({ headBranch: 'dev/test' });
      const shouldSkip = await runner.testShouldSkipReview(prInfo);
      assertEquals(shouldSkip, true);
    });

    test('should skip when title matches ignored pattern', async () => {
      const runner = createActionRunner();
      runner.setReviewConfig({ ignored_titles: ['WIP', 'DO NOT MERGE'] });

      const prInfo = createPrInfo({ title: '[WIP] Test PR' });
      const shouldSkip = await runner.testShouldSkipReview(prInfo);
      assertEquals(shouldSkip, true);
    });

    test('should skip when required labels are not present', async () => {
      const runner = createActionRunner();
      runner.setReviewConfig({ limit_reviews_by_labels: ['needs-review'] });

      const prInfo = createPrInfo({ labels: ['bug'] });
      const shouldSkip = await runner.testShouldSkipReview(prInfo);
      assertEquals(shouldSkip, true);
    });

    test('should not skip when required labels are present', async () => {
      const runner = createActionRunner();
      runner.setReviewConfig({ limit_reviews_by_labels: ['needs-review'] });

      const prInfo = createPrInfo({ labels: ['needs-review', 'bug'] });
      const shouldSkip = await runner.testShouldSkipReview(prInfo);
      assertEquals(shouldSkip, false);
    });
  });

  describe('glob pattern matching', () => {
    test('should match simple string pattern exactly', () => {
      const runner = createActionRunner();
      const regex = runner.testGlobToRegExp('main');
      assertEquals(regex.test('main'), true);
      assertEquals(regex.test('maintenance'), false);
    });

    test('should handle * pattern correctly', () => {
      const runner = createActionRunner();
      const regex = runner.testGlobToRegExp('feature/*');
      assertEquals(regex.test('feature/test'), true);
      assertEquals(regex.test('feature/nested/test'), false);
    });

    test('should handle ** pattern correctly', () => {
      const runner = createActionRunner();
      const regex = runner.testGlobToRegExp('feature/**');
      assertEquals(regex.test('feature/test'), true);
      assertEquals(regex.test('feature/nested/test'), true);
    });

    test('should escape special characters', () => {
      const runner = createActionRunner();
      const regex = runner.testGlobToRegExp('test.branch');
      assertEquals(regex.test('test.branch'), true);
      assertEquals(regex.test('testxbranch'), false);
    });
  });

  describe('combined PR conditions', () => {
    test('should not skip when all conditions are satisfied', async () => {
      const runner = createActionRunner();
      runner.setReviewConfig({
        ignore_draft_prs: true,
        ignored_branches: ['dev/*'],
        ignored_titles: ['WIP'],
        limit_reviews_by_labels: ['needs-review'],
      });

      const prInfo = createPrInfo({
        isDraft: false,
        headBranch: 'test/feature',
        title: 'Valid PR',
        labels: ['needs-review'],
      });

      const shouldSkip = await runner.testShouldSkipReview(prInfo);
      assertEquals(shouldSkip, false);
    });

    test('should skip when any condition is not satisfied', async () => {
      const runner = createActionRunner();
      runner.setReviewConfig({
        ignore_draft_prs: true,
        ignored_branches: ['dev/*'],
        ignored_titles: ['WIP'],
        limit_reviews_by_labels: ['needs-review'],
      });

      const prInfo = createPrInfo({
        isDraft: false,
        headBranch: 'test/feature',
        title: 'Valid PR',
        labels: [], // 必要なラベルがない
      });

      const shouldSkip = await runner.testShouldSkipReview(prInfo);
      assertEquals(shouldSkip, true);
    });
  });
});
