import type { IFileChange, IPullRequestInfo, IPullRequestProcessedResult, IReviewComment, ReviewConfig, TriageResult } from './deps.ts';
import { BaseProcessor } from '../base/mod.ts';
import type { ReviewResponse, SummaryResponse } from './schema.ts';
import { runWorkflow } from './internal/run-workflow.ts';

/**
 * Processor implementation for Dify AI Service
 */
export class DifyProcessor extends BaseProcessor {
  private readonly baseUrl: string;
  private readonly triageApiKey: string;
  private readonly reviewApiKey: string;

  /**
   * Constructor for DifyProcessor
   * @param baseUrl - Base URL for Dify API
   * @param triageApiKey - API key for triage workflow 
   * @param reviewApiKey - API key for review workflow
   */
  constructor(baseUrl: string, triageApiKey: string, reviewApiKey: string) {
    super();
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    this.triageApiKey = triageApiKey;
    this.reviewApiKey = reviewApiKey;
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

        const response = await runWorkflow(this.baseUrl, this.triageApiKey, input);
        const summaryResponse = JSON.parse(response) as SummaryResponse;

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

        const response = await runWorkflow(this.baseUrl, this.reviewApiKey, input);
        const review = JSON.parse(response) as ReviewResponse;

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
