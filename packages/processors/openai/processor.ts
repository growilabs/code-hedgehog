import OpenAI from '@openai/openai';
import { zodResponseFormat } from '@openai/openai/helpers/zod';
import type { IFileChange, IPullRequestInfo, IPullRequestProcessedResult, IReviewComment, ReviewConfig } from '../../core/mod.ts';
import { BaseProcessor } from '../base/mod.ts';
import { type Comment, ReviewResponseSchema } from './schema.ts';

export class OpenaiProcessor extends BaseProcessor {
  private openai: OpenAI;

  constructor(apiKey?: string) {
    super();
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * @inheritdoc
   */
  override async process(prInfo: IPullRequestInfo, files: IFileChange[], config?: ReviewConfig): Promise<IPullRequestProcessedResult> {
    const comments: IReviewComment[] = [];

    const responseFormat = zodResponseFormat(ReviewResponseSchema, 'review_response');

    for (const file of files) {
      const instructions = this.getInstructionsForFile(file.path, config);
      const prompt = this.createPrompt(file, instructions, prInfo);

      try {
        const response = await this.openai.responses.create({
          model: 'gpt-4o',
          input: [
            {
              role: 'user',
              content: prompt,
              type: 'message',
            },
          ],
          text: {
            format: {
              name: responseFormat.json_schema.name,
              type: responseFormat.type,
              schema: responseFormat.json_schema.schema ?? {},
            },
          },
          temperature: 0.7,
        });

        // output_text contains the generated JSON response
        const content = response.output_text;
        if (!content) {
          console.warn(`No review generated for ${file.path}`);
          continue;
        }

        const review = await this.parseReview(content, file.path);
        if (!review) continue;

        // Create inline comments
        for (const comment of review.comments) {
          comments.push({
            path: file.path,
            position: comment.line_number ?? 1,
            body: this.formatComment(comment),
            type: 'inline',
          });
        }

        // Add summary comment
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
   * Parse the review result from JSON content
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

  /**
   * Format a review comment with optional suggestion
   */
  private formatComment(comment: Comment): string {
    let body = comment.message;

    if (comment.suggestion) {
      body += `\n\n**Suggestion:**\n${comment.suggestion}`;
    }

    return body;
  }

  private createPrompt(file: IFileChange, instructions: string, prInfo: IPullRequestInfo): string {
    return `You are a code reviewer. Please review the following code and respond in JSON format.

File: ${file.path}
PR Title: ${prInfo.title}
${instructions ? `\nAdditional Instructions:\n${instructions}` : ''}
Changes:
\`\`\`diff
${file.patch || 'No changes'}
\`\`\`

Please provide specific and constructive review comments.
Include improvement suggestions when appropriate.

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
}
