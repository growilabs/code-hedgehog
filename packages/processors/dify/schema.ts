/**
 * Dify API レスポンスの基本形式
 */
interface DifyResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

/**
 * トリアージワークフロー用のレスポンス形式
 */
export interface TriageResponse {
  needsReview: boolean;
  reason: string;
}

/**
 * レビューコメントの構造
 */
export interface ReviewComment {
  content: string;
  line?: number;
  suggestion?: string;
}

/**
 * レビューワークフロー用のレスポンス形式
 */
export interface ReviewResponse {
  comments: ReviewComment[];  // レビューコメントを必須に変更
  summary?: string;  // 全体のサマリー（オプション）
}

export type { DifyResponse };