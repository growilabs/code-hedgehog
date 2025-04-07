import { OpenAI, zodResponseFormat, BaseProcessor } from './deps.ts';
import type {
  IFileChange,
  IPullRequestInfo,
  IPullRequestProcessedResult,
  IReviewComment,
  ReviewConfig,
  TriageResult
} from './deps.ts';
import { type Comment, type TriageResponse, ReviewResponseSchema, TriageResponseSchema } from './schema.ts';

export class OpenaiProcessor extends BaseProcessor {
  private openai: OpenAI;
  private readonly tokenConfig = {
    margin: 100,
    maxTokens: 4000, // デフォルト値、設定から上書き可能
  };

  constructor(apiKey?: string) {
    super();
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * トリアージフェーズの実装
   * GPT-3.5を使用して軽量な分析を行う
   */
  override async triage(
    prInfo: IPullRequestInfo,
    files: IFileChange[],
    config?: ReviewConfig
  ): Promise<Map<string, TriageResult>> {
    const results = new Map<string, TriageResult>();
    const triageResponseFormat = zodResponseFormat(TriageResponseSchema, 'triage_response');
    
    for (const file of files) {
      const tokenConfig = config?.model?.light?.maxTokens
        ? { ...this.tokenConfig, maxTokens: config.model.light.maxTokens }
        : this.tokenConfig;

      // 基本的なトークンチェックとシンプル変更の判定
      const baseResult = await this.shouldPerformDetailedReview(file, tokenConfig);
      
      if (!baseResult.needsReview) {
        results.set(file.path, baseResult);
        continue;
      }

      // GPT-3.5でトリアージ
      try {
        const prompt = this.createTriagePrompt(file, prInfo);
        const response = await this.openai.responses.create({
          model: config?.model?.light?.name ?? 'gpt-3.5-turbo',
          input: [{
            role: 'user',
            content: prompt,
            type: 'message',
          }],
          text: {
            format: {
              name: triageResponseFormat.json_schema.name,
              type: triageResponseFormat.type,
              schema: triageResponseFormat.json_schema.schema ?? {},
            },
          },
          temperature: 0.3,
        });

        const content = response.output_text;
        if (!content) {
          results.set(file.path, {
            needsReview: true,
            reason: "Failed to get triage response"
          });
          continue;
        }

        // Parse structured response
        const triageResponse = TriageResponseSchema.parse(JSON.parse(content));
        results.set(file.path, {
          needsReview: triageResponse.status === 'NEEDS_REVIEW',
          reason: triageResponse.reason
        });
      } catch (error) {
        console.error(`Triage error for ${file.path}:`, error);
        results.set(file.path, {
          needsReview: true,
          reason: "Error during triage"
        });
      }
    }

    return results;
  }

  /**
   * レビューフェーズの実装
   * GPT-4を使用して詳細なレビューを行う
   */
  override async review(
    prInfo: IPullRequestInfo,
    files: IFileChange[],
    triageResults: Map<string, TriageResult>,
    config?: ReviewConfig
  ): Promise<IPullRequestProcessedResult> {
    const comments: IReviewComment[] = [];
    const reviewResponseFormat = zodResponseFormat(ReviewResponseSchema, 'review_response');

    for (const file of files) {
      const triageResult = triageResults.get(file.path);
      
      if (!triageResult) {
        console.warn(`No triage result for ${file.path}`);
        continue;
      }

      if (!triageResult.needsReview) {
        console.info(`Skipped detailed review: ${file.path} (${triageResult.reason})`);
        continue;
      }

      const instructions = this.getInstructionsForFile(file.path, config);
      const prompt = this.createReviewPrompt(file, prInfo, instructions);

      try {
        const response = await this.openai.responses.create({
          model: config?.model?.heavy?.name ?? 'gpt-4',
          input: [{
            role: 'user',
            content: prompt,
            type: 'message',
          }],
          text: {
            format: {
              name: reviewResponseFormat.json_schema.name,
              type: reviewResponseFormat.type,
              schema: reviewResponseFormat.json_schema.schema ?? {},
            },
          },
          temperature: 0.7,
        });

        const content = response.output_text;
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

    return { comments };
  }

  /**
   * トリアージ用のプロンプトを作成
   */
  private createTriagePrompt(file: IFileChange, prInfo: IPullRequestInfo): string {
    return `You are a code reviewer. Please analyze these changes and determine if they need detailed review.
Respond in JSON format with 'status' (NEEDS_REVIEW or APPROVED) and 'reason' explaining your decision.

File: ${file.path}
PR Title: ${prInfo.title}
Changes:
\`\`\`diff
${file.patch || 'No changes'}
\`\`\`

- Approve if changes are simple (formatting, comments, etc)
- Request review if changes affect logic or behavior

Expected JSON Format:
{
  "status": "NEEDS_REVIEW" or "APPROVED",
  "reason": "Explanation of the decision"
}`;
  }

  /**
   * レビュー用のプロンプトを作成
   */
  private createReviewPrompt(file: IFileChange, prInfo: IPullRequestInfo, instructions: string): string {
    return `You are a code reviewer. Please review the following code and provide specific and constructive feedback.
Respond in JSON format with comments array and overall summary.

File: ${file.path}
PR Title: ${prInfo.title}
${instructions ? `\nAdditional Instructions:\n${instructions}` : ''}
Changes:
\`\`\`diff
${file.patch || 'No changes'}
\`\`\`

Expected JSON Format:
{
  "comments": [
    {
      "message": "Review comment",
      "suggestion": "Improvement suggestion (optional)",
      "line_number": Line number (optional)
    }
  ],
  "summary": "Overall evaluation and improvement points"
}`;
  }

  /**
   * レビューコメントをフォーマット
   */
  private formatComment(comment: Comment): string {
    let body = comment.message;

    if (comment.suggestion) {
      body += `\n\n**Suggestion:**\n${comment.suggestion}`;
    }

    return body;
  }

  /**
   * レビュー結果をパース
   */
  private async parseReview(content: string, path: string) {
    try {
      const json = JSON.parse(content);
      return ReviewResponseSchema.parse(json);
    } catch (error) {
      console.error(`Failed to parse review for ${path}:`, error);
      return null;
    }
  }
}
