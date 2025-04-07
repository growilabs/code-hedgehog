import type { IFileChange, IPullRequestInfo, IPullRequestProcessedResult, IReviewComment, ReviewConfig, TriageResult } from '../../core/mod.ts';
import type { TokenConfig } from '../../core/src/types/token.ts';
import { BaseProcessor } from '../base/mod.ts';

export class DifyProcessor extends BaseProcessor {
  private readonly tokenConfig: TokenConfig = {
    margin: 100,
    maxTokens: 4000, // デフォルト値、設定から上書き可能
  };

  /**
   * トリアージフェーズの実装
   * 各ファイルの変更を軽量に分析し、詳細なレビューが必要かを判定
   */
  override async triage(
    prInfo: IPullRequestInfo,
    files: IFileChange[],
    config?: ReviewConfig
  ): Promise<Map<string, TriageResult>> {
    const results = new Map<string, TriageResult>();

    for (const file of files) {
      const tokenConfig = config?.model?.light?.maxTokens
        ? { ...this.tokenConfig, maxTokens: config.model.light.maxTokens }
        : this.tokenConfig;

      // BaseProcessorの共通ロジックを使用
      const result = await this.shouldPerformDetailedReview(file, tokenConfig);
      results.set(file.path, result);
    }

    return results;
  }

  /**
   * レビューフェーズの実装
   * トリアージ結果に基づいて詳細なレビューを実行
   */
  override async review(
    prInfo: IPullRequestInfo,
    files: IFileChange[],
    triageResults: Map<string, TriageResult>,
    config?: ReviewConfig
  ): Promise<IPullRequestProcessedResult> {
    const comments: IReviewComment[] = [];

    for (const file of files) {
      const triageResult = triageResults.get(file.path);
      
      if (!triageResult) {
        console.warn(`No triage result for ${file.path}`);
        continue;
      }

      if (!triageResult.needsReview) {
        // 簡易コメントのみ追加
        comments.push({
          path: file.path,
          body: `Skipped detailed review: ${triageResult.reason}`,
          type: 'inline',
          position: 1,
        });
        continue;
      }

      const instructions = this.getInstructionsForFile(file.path, config);
      // TODO: Difyワークフローを使用して詳細なレビューを実行
      comments.push({
        path: file.path,
        position: 1,
        body: `[DIFY] Processed ${file.path}\n\nPR: ${prInfo.title}${instructions ? `\n\nInstructions:\n${instructions}` : ''}`,
        type: 'inline',
      });
    }

    return {
      comments,
    };
  }
}
