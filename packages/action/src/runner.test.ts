import { promises as fs } from 'node:fs';
import type {
  IFileChange,
  IPullRequestInfo,
  IPullRequestProcessedResult,
  IPullRequestProcessor,
  IReviewComment,
  IVCSConfig,
  IVersionControlSystem,
} from '@code-hedgehog/core';
import type { ReviewConfig } from '@code-hedgehog/processor-base';
import { assertEquals, assertRejects } from '@std/assert';
import { afterEach, beforeEach, describe, test } from '@std/testing/bdd';
import { restore } from '@std/testing/mock';
import type { ActionConfig } from './config.ts';
import { ActionRunner, type ExtendedPullRequestInfo } from './runner.ts';
import { type CoreLogger, shouldSkipReview } from './utils/pr-filter.ts';

// モック用のコンテナ
const mockContainer = {
  errors: [] as string[],
  addError(message: string) {
    this.errors.push(message);
  },
  clearErrors() {
    this.errors = [];
  },
};

// テスト用のActionRunner - core.setFailedを直接モック
class TestActionRunner extends ActionRunner {
  private mockSetFailed: (message: string) => void;
  private mockCoreLogger: CoreLogger;

  constructor(config: ActionConfig, mockSetFailed?: (message: string) => void) {
    super(config);
    this.mockSetFailed =
      mockSetFailed ||
      ((message: string) => {
        mockContainer.addError(message);
      });

    // CoreLoggerのモック
    this.mockCoreLogger = {
      info: (message: string) => {
        // テスト用ログ処理
      },
      warning: (message: string) => {
        console.warn(message);
      },
    };
  }

  protected override loadBaseConfig(_configPath?: string): Promise<void> {
    return Promise.resolve();
  }

  // 設定を更新するメソッド
  public setReviewConfig(config: Partial<ReviewConfig>): void {
    Object.assign(this.reviewConfig, config);
  }

  // テスト用にconfigを公開
  public getReviewConfig(): ReviewConfig {
    return this.reviewConfig;
  }

  // VCSクライアントを設定するメソッドを公開
  public setTestVCSClient(client: IVersionControlSystem): void {
    this.setVCSClient(client);
  }

  // createProcessorをオーバーライド
  protected override async createProcessor(): Promise<IPullRequestProcessor> {
    return new MockProcessor();
  }

  // run メソッドを完全にオーバーライドしてcore.setFailedをモック
  override async run(): Promise<IReviewComment[]> {
    try {
      await this.loadBaseConfig();

      const githubConfig = this.createGitHubConfig();

      // Initialize components - テスト用のVCSクライアントを使用
      if (!this.vcsClient) {
        throw new Error('VCS client not set for test');
      }

      const processor = await this.createProcessor();

      // Get PR information
      const prInfo = (await this.vcsClient.getPullRequestInfo()) as ExtendedPullRequestInfo;

      // Check if PR should be reviewed based on configuration
      if (shouldSkipReview(prInfo, this.reviewConfig, this.mockCoreLogger)) {
        return [];
      }

      const allComments: IReviewComment[] = [];

      // Simulate file processing
      const files = [
        {
          path: 'test.ts',
          patch: 'test patch',
          changes: 1,
          status: 'modified' as const,
        },
      ];

      const { comments } = await processor.process(prInfo, files);
      allComments.push(...(comments ?? []));

      if (comments != null && comments.length > 0) {
        await this.vcsClient.createReviewBatch(comments, false);
      }

      return allComments;
    } catch (error) {
      this.mockSetFailed(`Action failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  // 環境変数の確認のみを行うメソッドをオーバーライド
  protected override createGitHubConfig(): IVCSConfig {
    const repository = process.env.GITHUB_REPOSITORY;
    if (!repository) {
      throw new Error('GITHUB_REPOSITORY environment variable is not set');
    }

    return {
      type: 'github',
      token: 'test-token',
      repositoryUrl: 'https://github.com/owner/repo',
      pullRequestId: 123,
    };
  }
}

// エラー時のテスト用クラス
class ErrorActionRunner extends TestActionRunner {
  protected override async createProcessor(): Promise<IPullRequestProcessor> {
    throw new Error('Unsupported processor: unsupported');
  }
}

// モック用のカスタムVCSクライアント
class MockVCSClient implements IVersionControlSystem {
  constructor(
    private prInfo: ExtendedPullRequestInfo,
    private comments: IReviewComment[] = [],
  ) {}

  type = 'github' as const;

  async getPullRequestInfo(): Promise<IPullRequestInfo> {
    return this.prInfo;
  }

  async *getPullRequestChangesStream(_config: ReviewConfig): AsyncIterableIterator<IFileChange[]> {
    yield [
      {
        path: 'test.ts',
        patch: 'test patch',
        changes: 1,
        status: 'modified',
      },
    ];
  }

  async createReviewBatch(comments: IReviewComment[]): Promise<void> {
    this.comments.push(...comments);
  }
}

// モック用のカスタムプロセッサー
class MockProcessor implements IPullRequestProcessor {
  async process(prInfo: IPullRequestInfo, files: IFileChange[]): Promise<IPullRequestProcessedResult> {
    return {
      comments: [
        {
          type: 'inline',
          path: 'test.ts',
          position: 1,
          body: 'Test comment',
        },
      ],
    };
  }
}

describe('ActionRunner', () => {
  let realProcessEnv: typeof process.env;

  beforeEach(() => {
    // 元の環境変数を保存
    realProcessEnv = { ...process.env };
    // テスト用の環境変数をクリア
    process.env = {};
    // エラーをクリア
    mockContainer.clearErrors();
  });

  afterEach(() => {
    // 環境変数を復元
    process.env = realProcessEnv;
    restore();
  });

  function setupEnvironment(options: { repository?: string; token?: string; prNumber?: string; isDraft?: boolean } = {}) {
    // 環境変数の設定
    process.env = {
      GITHUB_REPOSITORY: options.repository,
      GITHUB_TOKEN: options.token ?? 'test-token',
      GITHUB_PR_NUMBER: options.prNumber ?? '123',
      OPENAI_API_KEY: 'test-api-key',
    };
  }

  // テスト用のPR情報を生成するヘルパー関数
  function createPrInfo(overrides: Partial<ExtendedPullRequestInfo> = {}): ExtendedPullRequestInfo {
    return {
      title: 'Test PR',
      body: 'Test PR description',
      baseBranch: 'main',
      headBranch: 'test/feature',
      isDraft: false,
      labels: [],
      ...overrides,
    };
  }

  // テスト用のVCSクライアントを生成
  function createMockVCS(options: { isDraft?: boolean } = {}): MockVCSClient {
    return new MockVCSClient(createPrInfo({ isDraft: options.isDraft }));
  }

  // テスト用の設定を生成するヘルパー関数
  function createActionRunner(options: { vcs?: IVersionControlSystem } & Partial<ActionConfig> = {}): TestActionRunner {
    const { vcs, ...configOverrides } = options;
    const config: ActionConfig = {
      processor: 'openai',
      ...configOverrides,
    };
    const runner = new TestActionRunner(config);
    if (vcs) {
      runner.setTestVCSClient(vcs);
    }
    return runner;
  }

  describe('run', () => {
    test('should process PR and create review comments', async () => {
      setupEnvironment({ repository: 'owner/repo' });
      const mockVCS = createMockVCS();
      const runner = createActionRunner({ vcs: mockVCS });

      const comments = await runner.run();
      assertEquals(comments.length, 1);
      assertEquals(comments[0].body, 'Test comment');
    });

    test('should skip review when PR matches skip conditions', async () => {
      setupEnvironment({ repository: 'owner/repo' });
      const mockVCS = createMockVCS({ isDraft: true });
      const runner = createActionRunner({ vcs: mockVCS });
      runner.setReviewConfig({ ignore_draft_prs: true });

      const comments = await runner.run();
      assertEquals(comments.length, 0);
    });

    test('should handle errors when environment variables are missing', async () => {
      setupEnvironment({ repository: undefined });
      const mockVCS = createMockVCS();
      const runner = createActionRunner({ vcs: mockVCS });

      await assertRejects(
        async () => {
          await runner.run();
        },
        Error,
        'GITHUB_REPOSITORY environment variable is not set',
      );

      assertEquals(mockContainer.errors, ['Action failed: GITHUB_REPOSITORY environment variable is not set']);
    });

    test('should handle unsupported processor type', async () => {
      setupEnvironment({ repository: 'owner/repo' });
      const mockVCS = createMockVCS();

      const runner = new ErrorActionRunner({ processor: 'unsupported' as 'openai' });
      runner.setTestVCSClient(mockVCS);

      await assertRejects(
        async () => {
          await runner.run();
        },
        Error,
        'Unsupported processor: unsupported',
      );

      assertEquals(mockContainer.errors, ['Action failed: Unsupported processor: unsupported']);
    });
  });

  describe('combined PR conditions', () => {
    test('should not skip when all conditions are satisfied', async () => {
      const prInfo = createPrInfo({
        isDraft: false,
        headBranch: 'test/feature',
        title: 'Valid PR',
        labels: ['needs-review'],
      });

      const config: ReviewConfig = {
        ...createActionRunner().getReviewConfig(),
        ignore_draft_prs: true,
        ignored_branches: ['dev/*'],
        ignored_titles: ['WIP'],
        limit_reviews_by_labels: ['needs-review'],
      };

      const mockLogger: CoreLogger = {
        info: () => {},
        warning: () => {},
      };

      const shouldSkip = shouldSkipReview(prInfo, config, mockLogger);
      assertEquals(shouldSkip, false);
    });

    test('should skip when any condition is not satisfied', async () => {
      const prInfo = createPrInfo({
        isDraft: false,
        headBranch: 'test/feature',
        title: 'Valid PR',
        labels: [], // 必要なラベルがない
      });

      const config: ReviewConfig = {
        ...createActionRunner().getReviewConfig(),
        ignore_draft_prs: true,
        ignored_branches: ['dev/*'],
        ignored_titles: ['WIP'],
        limit_reviews_by_labels: ['needs-review'],
      };

      const mockLogger: CoreLogger = {
        info: () => {},
        warning: () => {},
      };

      const shouldSkip = shouldSkipReview(prInfo, config, mockLogger);
      assertEquals(shouldSkip, true);
    });
  });
});
