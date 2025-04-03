import OpenAI from 'npm:openai';
import { z } from 'npm:zod';
import type { IFileChange, IPullRequestInfo, IPullRequestProcessedResult, IReviewComment, ReviewConfig } from '../../core/mod.ts';
import { BaseProcessor } from '../base/mod.ts';

/**
 * レビューコメントの重要度
 */
export const severitySchema = z.enum(['info', 'warning', 'critical']);

/**
 * レビューコメントの種類
 */
export const categorySchema = z.enum(['security', 'performance', 'maintainability', 'testing', 'error_handling']);

/**
 * レビューコメントの構造
 */
const reviewCommentSchema = z.object({
  message: z.string(),
  severity: severitySchema,
  category: categorySchema,
  suggestion: z.string().optional(),
  line_number: z.number().optional(),
});

/**
 * ファイルレビューの結果
 */
const fileReviewSchema = z.object({
  comments: z.array(reviewCommentSchema),
  summary: z.string(),
});

export class OpenaiProcessor extends BaseProcessor {
  private openai: OpenAI;

  constructor(apiKey: string) {
    super();
    this.openai = new OpenAI({
      apiKey,
    });
  }

  /**
   * @inheritdoc
   */
  override async process(prInfo: IPullRequestInfo, files: IFileChange[], config?: ReviewConfig): Promise<IPullRequestProcessedResult> {
    const comments: IReviewComment[] = [];

    for (const file of files) {
      const instructions = this.getInstructionsForFile(file.path, config);
      const prompt = this.createPrompt(file, instructions, prInfo);

      try {
        const completion = await this.openai.chat.completions.create({
          messages: [{ role: 'user', content: prompt }],
          model: 'gpt-4-turbo-preview',
          response_format: { type: 'json_object' },
          temperature: 0.7,
        });

        const content = completion.choices[0]?.message?.content;
        if (!content) {
          console.warn(`No review generated for ${file.path}`);
          continue;
        }

        const review = await this.parseReview(content, file.path);
        if (!review) continue;

        // インラインコメントを作成
        for (const comment of review.comments) {
          comments.push({
            path: file.path,
            position: comment.line_number ?? 1,
            body: this.formatComment(comment),
            type: 'inline',
          });
        }

        // サマリーコメントを追加
        if (review.summary) {
          comments.push({
            path: file.path,
            body: `## Review Summary\n\n${review.summary}`,
            type: 'pr',
          });
        }
      } catch (error) {
        console.error(`Error reviewing ${file.path}:`, error);
        comments.push({
          path: file.path,
          position: 1,
          body: 'Failed to generate review due to an error.',
          type: 'inline',
        });
      }
    }

    return {
      comments,
    };
  }

  /**
   * レビュー結果をパースする
   */
  private async parseReview(content: string, path: string) {
    try {
      const json = JSON.parse(content);
      return fileReviewSchema.parse(json);
    } catch (error) {
      console.error(`Failed to parse review for ${path}:`, error);
      return null;
    }
  }

  /**
   * コメントをフォーマットする
   */
  private formatComment(comment: z.infer<typeof reviewCommentSchema>): string {
    const severity = this.getSeverityEmoji(comment.severity);
    const category = comment.category.replace('_', ' ').toUpperCase();

    let body = `${severity} **[${category}]**\n\n${comment.message}`;

    if (comment.suggestion) {
      body += `\n\n**Suggestion:**\n${comment.suggestion}`;
    }

    return body;
  }

  /**
   * 重要度に応じた絵文字を返す
   */
  private getSeverityEmoji(severity: z.infer<typeof severitySchema>): string {
    switch (severity) {
      case 'info':
        return 'ℹ️';
      case 'warning':
        return '⚠️';
      case 'critical':
        return '🚨';
    }
  }

  private createPrompt(file: IFileChange, instructions: string, prInfo: IPullRequestInfo): string {
    return `あなたはコードレビュアーです。以下のコードをレビューし、JSON形式でレスポンスを返してください。

ファイル: ${file.path}
PR タイトル: ${prInfo.title}
${instructions ? `\n追加の指示:\n${instructions}` : ''}
変更内容:
\`\`\`diff
${file.patch || '変更内容なし'}
\`\`\`

以下の点に注意してレビューを行い、JSON形式で回答してください：
1. コードの品質と保守性 (maintainability)
2. エラーハンドリング (error_handling)
3. パフォーマンス (performance)
4. セキュリティ (security)
5. テストの網羅性（テストファイルの場合）(testing)

期待するJSONフォーマット:
{
  "comments": [
    {
      "message": "レビューコメント",
      "severity": "info" | "warning" | "critical",
      "category": "security" | "performance" | "maintainability" | "testing" | "error_handling",
      "suggestion": "改善提案（任意）",
      "line_number": 行番号（任意）
    }
  ],
  "summary": "全体的な評価と改善点のまとめ"
}`;
  }
}
