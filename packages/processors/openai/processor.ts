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
import { createTriagePrompt, createGroupingPrompt, createReviewPrompt } from "./internal/prompts.ts";
import {
  type Comment,
  ReviewResponseSchema,
  SummarizeResponseSchema,
  GroupingResponseSchema
} from './schema.ts';

export class OpenaiProcessor extends BaseProcessor {
  private openai: OpenAI;
  private readonly tokenConfig = {
    margin: 100,
    maxTokens: 4000,
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
      const baseResult = await this.shouldPerformDetailedReview(file, this.tokenConfig);
      
      try {
        const prompt = createTriagePrompt({
          title: prInfo.title,
          description: prInfo.body || "",
          filePath: file.path,
          patch: file.patch || 'No changes',
        });

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
            reason: "Failed to get triage response",
            aspects: [],
            summary: undefined,
          });
          continue;
        }

        // Parse structured response
        const triageResponse = SummarizeResponseSchema.parse(JSON.parse(content));
        results.set(file.path, {
          needsReview: baseResult.needsReview && triageResponse.needsReview,
          reason: triageResponse.reason,
          summary: triageResponse.summary,
          aspects: [],
        });
      } catch (error) {
        console.error(`Triage error for ${file.path}:`, error);
        results.set(file.path, {
          needsReview: true,
          reason: `Error during triage: ${error instanceof Error ? error.message : String(error)}`,
          aspects: [],
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
    try {
      const fileInfos = files.map(file => ({
        path: file.path,
        patch: file.patch || 'No changes',
      }));

      const triageInfos = Array.from(triageResults.entries()).map(([path, result]) => ({
        path,
        summary: result.summary,
        needsReview: result.needsReview,
      }));

      const prompt = createGroupingPrompt({
        title: prInfo.title,
        description: prInfo.body || "",
        files: fileInfos,
        triageResults: triageInfos,
      });

      const response = await this.openai.responses.create({
        model: 'gpt-4o',
        input: [{
          role: 'user',
          content: prompt,
          type: 'message',
        }],
        temperature: 0.3,
      });

      const content = response.output_text;
      if (!content) {
        console.error("No grouping response generated");
        return undefined;
      }

      const result = GroupingResponseSchema.parse(JSON.parse(content));
      const aspectSummaries: AspectSummary[] = result.aspects.map((aspect) => ({
        aspect: {
          key: aspect.name,
          description: aspect.description,
          priority: 1,
        },
        summary: aspect.description,
        impactLevel: aspect.impact,
      }));

      return {
        description: result.description,
        aspectSummaries,
        crossCuttingConcerns: result.crossCuttingConcerns,
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
        console.info(`Light review for ${file.path}: ${triageResult.reason}`);
      }

      try {
        const prompt = createReviewPrompt({
          title: prInfo.title,
          description: prInfo.body || "",
          filePath: file.path,
          patch: file.patch || 'No changes',
          instructions: this.getInstructionsForFile(file.path, config),
          aspects: triageResult.aspects.map(aspect => ({
            name: aspect.key,
            description: aspect.description,
          })),
        });

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

        const review = ReviewResponseSchema.parse(JSON.parse(content));

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
          body: `Failed to generate review: ${error instanceof Error ? error.message : String(error)}`,
          type: 'inline',
        });
      }
    }

    return { comments };
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
}
