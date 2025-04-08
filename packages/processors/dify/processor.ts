import type { IFileChange, IPullRequestInfo, IPullRequestProcessedResult, IReviewComment, ReviewConfig, TriageResult } from './deps.ts';
import { BaseProcessor } from '../base/processor.ts';
import { ReviewResponseSchema, SummaryResponseSchema } from './schema.ts';
import { runWorkflow } from './internal/run-workflow.ts';


type DifyProcessorConfig = {
  baseUrl: string;
  apiKeyTriage: string;
  apiKeyReview: string;
};

/**
 * Processor implementation for Dify AI Service
 */
export class DifyProcessor extends BaseProcessor {
  private readonly config: DifyProcessorConfig;

  /**
   * Constructor for DifyProcessor
   * @param baseUrl - Base URL for Dify API
   * @param apiKeyTriage - API key for triage workflow 
   * @param apiKeyReview - API key for review workflow
   */
  constructor(config: Partial<DifyProcessorConfig>) {
    super();

    if (config.baseUrl == null) {
      throw new Error('Base URL for Dify API is required');
    }
    if (config.apiKeyTriage == null) {
      throw new Error('API key for triage workflow is required');
    }
    if (config.apiKeyReview == null) {
      throw new Error('API key for review workflow is required');
    }

    this.config = {
      baseUrl: config.baseUrl.endsWith('/') ? config.baseUrl.slice(0, -1) : config.baseUrl,
      apiKeyTriage: config.apiKeyTriage,
      apiKeyReview: config.apiKeyReview,
    }
  }
  /**
   * Implementation of triage phase
   * Analyze each file change lightly to determine if detailed review is needed
   */
  override async triage(
    prInfo: IPullRequestInfo,
    files: IFileChange[],
    config?: ReviewConfig
  ): Promise<Map<string, TriageResult>> {
    const results = new Map<string, TriageResult>();
    
    for (const file of files) {
      // Basic token check and simple change detection
      const baseResult = await this.shouldPerformDetailedReview(file, { margin: 100, maxTokens: 4000 });
      
      try {
        const input = JSON.stringify({
          title: prInfo.title,
          description: prInfo.body || "",
          filePath: file.path,
          patch: file.patch || "No changes",
          baseResult: baseResult
        });

        const response = await runWorkflow(this.config.baseUrl, this.config.apiKeyTriage, input);
        const summaryResponse = SummaryResponseSchema.parse(JSON.parse(response));

        results.set(file.path, {
          needsReview: baseResult.needsReview && summaryResponse.needsReview === true,
          reason: summaryResponse.reason,
          summary: summaryResponse.summary,
        });
      } catch (error) {
        console.error(`Triage error for ${file.path}:`, error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.set(file.path, {
          needsReview: true,
          reason: `Error during triage: ${errorMessage}`
        });
      }
    }

    return results;
  }

  /**
   * Implementation of review phase
   * Execute detailed review based on triage results
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

      // Always execute review for summary generation
      if (!triageResult.needsReview) {
        console.info(`Light review for ${file.path}: ${triageResult.reason}`);
      }

      try {
        const input = JSON.stringify({
          title: prInfo.title,
          description: prInfo.body || "",
          filePath: file.path,
          patch: file.patch || "No changes",
          instructions: this.getInstructionsForFile(file.path, config),
        });

        const response = await runWorkflow(this.config.baseUrl, this.config.apiKeyReview, input);
        const review = ReviewResponseSchema.parse(JSON.parse(response));

        if (review.comments) {
          for (const comment of review.comments) {
            comments.push({
              path: file.path,
              body: comment.suggestion
                ? `${comment.content}\n\n**Suggestion:**\n${comment.suggestion}`
                : comment.content,
              type: 'inline',
              position: comment.line || 1,
            });
          }
        }

        if (review.summary) {
          comments.push({
            path: file.path,
            body: `## Review Summary\n\n${review.summary}`,
            type: 'pr',
          });
        }
      } catch (error) {
        console.error(`Review error for ${file.path}:`, error);
        comments.push({
          path: file.path,
          position: 1,
          body: `Failed to generate review due to an error: ${error instanceof Error ? error.message : String(error)}`,
          type: 'inline',
        });
      }
    }

    // Always return comments array to ensure type safety
    return {
      comments: comments
    };
  }
}
