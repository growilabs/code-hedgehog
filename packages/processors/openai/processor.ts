import OpenAI from 'npm:openai';
import { z } from 'npm:zod';
import type { IFileChange, IPullRequestInfo, IPullRequestProcessedResult, IReviewComment, ReviewConfig } from '../../core/mod.ts';
import { BaseProcessor } from '../base/mod.ts';

/**
 * Schema for a review comment structure
 */
const reviewCommentSchema = z.object({
  message: z.string(),
  suggestion: z.string().optional(),
  line_number: z.number().optional(),
});

/**
 * Schema for the file review result
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
      return fileReviewSchema.parse(json);
    } catch (error) {
      console.error(`Failed to parse review for ${path}:`, error);
      return null;
    }
  }

  /**
   * Format a review comment with optional suggestion
   */
  private formatComment(comment: z.infer<typeof reviewCommentSchema>): string {
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
