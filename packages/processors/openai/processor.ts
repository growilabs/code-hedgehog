import { OpenAI, zodResponseFormat, BaseProcessor } from './deps.ts';
import type {
  IFileChange,
  IPullRequestInfo,
  IPullRequestProcessedResult,
  IReviewComment,
  ReviewConfig,
  TriageResult,
  OverallSummary,
  ReviewAspect,
  AspectSummary,
  ImpactLevel
} from './deps.ts';
import { summarizePrompt, triagePrompt } from "./internal/prompts.ts";
import { type Comment, ReviewResponseSchema, SummarizeResponseSchema } from './schema.ts';

export class OpenaiProcessor extends BaseProcessor {
  private openai: OpenAI;
  private readonly tokenConfig = {
    margin: 100,
    maxTokens: 4000, // Default value, can be overridden by configuration
  };

  constructor(apiKey?: string) {
    super();
    if (!apiKey) {
      throw new Error("OpenAI API key is required");
    }
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Implementation of triage phase
   * Performs lightweight analysis using GPT-3.5
   */
  override async triage(
    prInfo: IPullRequestInfo,
    files: IFileChange[],
    config?: ReviewConfig
  ): Promise<Map<string, TriageResult>> {
    const results = new Map<string, TriageResult>();
    const summarizeResponseFormat = zodResponseFormat(SummarizeResponseSchema, 'summarize_response');
    
    for (const file of files) {
      // Basic token check and simple change detection
      const baseResult = await this.shouldPerformDetailedReview(file, { margin: 100, maxTokens: 4000 });
      
      // Summarize using GPT-3.5
      try {
        const prompt = this.createSummarizePrompt(file, prInfo, baseResult);
        const response = await this.openai.responses.create({
          model: 'gpt-4o-mini',
          input: [{
            role: 'user',
            content: prompt,
            type: 'message',
          }],
          text: {
            format: {
              name: summarizeResponseFormat.json_schema.name,
              type: summarizeResponseFormat.type,
              schema: summarizeResponseFormat.json_schema.schema ?? {},
            },
          },
          temperature: 0.3,
        });

        const content = response.output_text;
        if (!content) {
          results.set(file.path, {
            needsReview: true,
            reason: "Failed to get summary response",
            aspects: []
          });
          continue;
        }

        // Parse structured response
        const summaryResponse = SummarizeResponseSchema.parse(JSON.parse(content));
        results.set(file.path, {
          needsReview: baseResult.needsReview && summaryResponse.status === 'NEEDS_REVIEW',
          reason: summaryResponse.reason,
          summary: summaryResponse.summary,
          aspects: []
        });
      } catch (error) {
        console.error(`Summarize error for ${file.path}:`, error);
        results.set(file.path, {
          needsReview: true,
          reason: "Error during summarize",
          aspects: []
        });
      }
    }

    return results;
  }

  /**
   * Implementation of overall summary generation
   */
  protected async generateOverallSummary(
    prInfo: IPullRequestInfo,
    files: IFileChange[],
    triageResults: Map<string, TriageResult>
  ): Promise<OverallSummary | undefined> {
    const allSummaries = Array.from(triageResults.values())
      .filter(result => result.summary)
      .map(result => result.summary);
    
    if (allSummaries.length === 0) {
      return undefined;
    }

    try {
      // Generate overall description
      const description = `Pull Request "${prInfo.title}" updates ${files.length} files. ` +
        `Changes include: ${allSummaries.join(". ")}`;

      return {
        description,
        aspectSummaries: [], // Empty array for now
        crossCuttingConcerns: []
      };
    } catch (error) {
      console.error("Error generating overall summary:", error);
      return undefined;
    }
  }

  /**
   * Implementation of review phase
   * Performs detailed review using GPT-4
   */
  override async review(
    prInfo: IPullRequestInfo,
    files: IFileChange[],
    triageResults: Map<string, TriageResult>,
    config?: ReviewConfig,
    overallSummary?: OverallSummary
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
          model: 'gpt-4o',
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

    return { comments };
  }

  /**
   * Create prompt for triage
   */
  private createSummarizePrompt(file: IFileChange, prInfo: IPullRequestInfo, triageResult: TriageResult): string {
    let prompt = summarizePrompt({
      title: prInfo.title,
      description: prInfo.body || "",
      fileDiff: file.patch || 'No changes',
    });

    if (triageResult.needsReview) {
      prompt += triagePrompt;
    }

    return prompt;
  }

  /**
   * Create prompt for review
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
   * Format review comment
   */
  private formatComment(comment: Comment): string {
    let body = comment.message;

    if (comment.suggestion) {
      body += `\n\n**Suggestion:**\n${comment.suggestion}`;
    }

    return body;
  }

  /**
   * Parse review result
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
