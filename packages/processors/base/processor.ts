import type {
  IFileChange,
  IPullRequestInfo,
  IPullRequestProcessor,
  IPullRequestProcessedResult,
  ReviewConfig,
  TriageResult,
  TokenConfig,
} from './deps.ts';
import { estimateTokenCount, isWithinLimit, matchesGlobPattern } from './deps.ts';

/**
 * Base class for pull request processors
 * Provides common functionality for reviewing pull requests
 */
export abstract class BaseProcessor implements IPullRequestProcessor {
  /**
   * Get instructions for a specific file based on the path patterns
   */
  protected getInstructionsForFile(filePath: string, config?: ReviewConfig): string {
    if (!config?.path_instructions) return '';

    const matchingInstructions = config.path_instructions
      .filter((instruction) => matchesGlobPattern(filePath, instruction.path))
      .map((instruction) => instruction.instructions);

    return matchingInstructions.join('\n\n');
  }

  /**
   * 共通のトリアージロジック
   * トークン数とファイルの性質に基づいて詳細レビューの要否を判定
   */
  protected async shouldPerformDetailedReview(
    file: IFileChange,
    tokenConfig: TokenConfig
  ): Promise<TriageResult> {
    // トークン数チェック
    if (!file.patch) {
      return {
        needsReview: false,
        reason: "No changes detected in file"
      };
    }

    // パッチのトークン数を計算
    const tokenCount = estimateTokenCount(file.patch);
    if (!isWithinLimit(file.patch, tokenConfig)) {
      return {
        needsReview: false,
        reason: `Token count (${tokenCount}) exceeds limit`
      };
    }

    // 単純な変更かどうかを判定
    const isSimpleChange = this.isSimpleChange(file.patch);
    if (isSimpleChange) {
      return {
        needsReview: false,
        reason: "Changes appear to be simple (formatting, comments, etc.)"
      };
    }

    return {
      needsReview: true,
      reason: "Changes require detailed review"
    };
  }

  /**
   * 単純な変更（フォーマット、コメントのみなど）かどうかを判定
   */
  protected isSimpleChange(patch: string): boolean {
    const lines = patch.split('\n');
    let hasSubstantiveChanges = false;

    for (const line of lines) {
      if (!line.startsWith('+') && !line.startsWith('-')) continue;

      const code = line.slice(1).trim();
      // 空行、コメント、インデント変更のみの行をスキップ
      if (code === '' || code.startsWith('//') || code.startsWith('/*') || code.startsWith('*')) {
        continue;
      }

      hasSubstantiveChanges = true;
      break;
    }

    return !hasSubstantiveChanges;
  }

  /**
   * トリアージフェーズの実装
   */
  abstract triage(
    prInfo: IPullRequestInfo,
    files: IFileChange[],
    config?: ReviewConfig
  ): Promise<Map<string, TriageResult>>;

  /**
   * レビューフェーズの実装
   */
  abstract review(
    prInfo: IPullRequestInfo,
    files: IFileChange[],
    triageResults: Map<string, TriageResult>,
    config?: ReviewConfig
  ): Promise<IPullRequestProcessedResult>;

  /**
   * メインの処理フロー
   */
  async process(
    prInfo: IPullRequestInfo,
    files: IFileChange[],
    config?: ReviewConfig
  ): Promise<IPullRequestProcessedResult> {
    // 1. トリアージ実行
    const triageResults = await this.triage(prInfo, files, config);
    
    // 2. トリアージ結果に基づいてレビュー実行
    return this.review(prInfo, files, triageResults, config);
  }
}
