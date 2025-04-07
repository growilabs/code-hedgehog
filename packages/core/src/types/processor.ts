import type { IFileChange } from './file.ts';
import type { IReviewComment } from './review.ts';
import type { IPullRequestInfo } from './vcs.ts';

/**
 * Path based instruction configuration
 */
export interface PathInstruction {
  /** Glob pattern for matching files */
  path: string;
  /** Instructions for matched files */
  instructions: string;
}

/**
 * トリアージ結果
 * 各ファイルの変更が詳細なレビューを必要とするかを判定
 */
export interface TriageResult {
  /** 詳細なレビューが必要かどうか */
  needsReview: boolean;
  /** トリアージの理由（例: "フォーマット変更のみ" "ロジック変更を含む" など） */
  reason: string;
}

/**
 * モデル選択設定
 * 軽量モデルと重量モデルの設定
 */
export interface ModelConfig {
  light: {
    name: string;
    maxTokens: number;
  };
  heavy: {
    name: string;
    maxTokens: number;
  };
}

/**
 * Review configuration including path based instructions
 */
export interface ReviewConfig {
  path_instructions: PathInstruction[];
  model?: ModelConfig;
  skipSimpleChanges?: boolean;
}

export type IPullRequestProcessedResult = {
  updatedPrInfo?: IPullRequestInfo;
  comments?: IReviewComment[];
};

/**
 * 2段階のレビュープロセスを実装するプロセッサのインターフェース
 */
export interface IPullRequestProcessor {
  /**
   * トリアージフェーズ - ファイルの変更を軽量に分析し、詳細なレビューが必要かを判定
   * 
   * @param prInfo Pull request information
   * @param files List of file changes to review
   * @param config Optional review configuration
   * @returns Map of file paths to triage results
   */
  triage(
    prInfo: IPullRequestInfo, 
    files: IFileChange[], 
    config?: ReviewConfig
  ): Promise<Map<string, TriageResult>>;

  /**
   * レビューフェーズ - トリアージ結果に基づいて詳細なレビューを実行
   * 
   * @param prInfo Pull request information
   * @param files List of file changes to review
   * @param triageResults Previous triage results
   * @param config Optional review configuration
   * @returns Review comments and optionally updated PR info
   */
  review(
    prInfo: IPullRequestInfo,
    files: IFileChange[],
    triageResults: Map<string, TriageResult>,
    config?: ReviewConfig
  ): Promise<IPullRequestProcessedResult>;
}
