import type { IFileChange, IPullRequestInfo, IPullRequestProcessedResult, IReviewComment, ReviewConfig, SummarizeResult, OverallSummary } from './deps.ts';
import {
  BaseProcessor,
  SummaryResponseSchema,
  OverallSummarySchema,
  ReviewResponseSchema
} from './deps.ts';
import { runWorkflow } from './internal/mod.ts';

type DifyProcessorConfig = {
  baseUrl: string;
  user: string;
  apiKeySummarize: string;
  apiKeyGrouping: string;
  apiKeyReview: string;
};

/**
 * Processor implementation for Dify AI Service
 */
export class DifyProcessor extends BaseProcessor {
  private readonly config: DifyProcessorConfig;

  /**
   * Constructor for DifyProcessor
   * @param config - Configuration for Dify processor
   */
  constructor(config: Partial<DifyProcessorConfig>) {
    super();

    if (config.baseUrl == null || config.baseUrl.length === 0) {
      throw new Error('Base URL for Dify API is required');
    }
    if (config.user == null || config.user.length === 0) {
      throw new Error('API execution user is required');
    }
    if (config.apiKeySummarize == null || config.apiKeySummarize.length === 0) {
      throw new Error('API key for summarize workflow is required');
    }
    if (config.apiKeyGrouping == null || config.apiKeyGrouping.length === 0) {
      throw new Error('API key for grouping workflow is required');
    }
    if (config.apiKeyReview == null || config.apiKeyReview.length === 0) {
      throw new Error('API key for review workflow is required');
    }

    this.config = {
      baseUrl: config.baseUrl.endsWith('/') ? config.baseUrl.slice(0, -1) : config.baseUrl,
      user: config.user,
      apiKeySummarize: config.apiKeySummarize,
      apiKeyReview: config.apiKeyReview,
      apiKeyGrouping: config.apiKeyGrouping,
    }
  }

  /**
   * Implementation of summarize phase
   * Analyze each file change lightly to determine if detailed review is needed
   */
  override async summarize(
    prInfo: IPullRequestInfo,
    files: IFileChange[],
    config?: ReviewConfig
  ): Promise<Map<string, SummarizeResult>> {
    const results = new Map<string, SummarizeResult>();
    
    for (const file of files) {
      // Basic token check and simple change detection
      const baseResult = await this.shouldPerformDetailedReview(file, { margin: 100, maxTokens: 4000 });
      
      try {
        const response = await runWorkflow(this.config.baseUrl, this.config.apiKeySummarize, {
          inputs: {
            title: prInfo.title,
            description: prInfo.body || "",
            filePath: file.path,
            patch: file.patch || "No changes",
            needsReviewPre: baseResult.needsReview,
          },
          response_mode: 'blocking' as const,
          user: this.config.user,
        });

        const summaryResponse = SummaryResponseSchema.parse(JSON.parse(response));

        results.set(file.path, {
          ...summaryResponse,
          needsReview: baseResult.needsReview && summaryResponse.needsReview === true,
          aspects: [], // Will be populated by the grouping phase
        });
      } catch (error) {
        console.error(`Triage error for ${file.path}:`, error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.set(file.path, {
          needsReview: true,
          reason: `Error during triage: ${errorMessage}`,
          aspects: [],
        });
      }
    }

    return results;
  }

  /**
   * Implementation of overall summary generation
   * Groups file changes by aspects and generates impact summaries
   */
  protected async generateOverallSummary(
    prInfo: IPullRequestInfo,
    files: IFileChange[],
    summarizeResults: Map<string, SummarizeResult>
  ): Promise<OverallSummary | undefined> {
    try {
      const response = await runWorkflow(this.config.baseUrl, this.config.apiKeyGrouping, {
        inputs: {
          title: prInfo.title,
          description: prInfo.body || "",
          files,
          summarizeResults: Array.from(summarizeResults.entries()).map(([path, result]) => ({
            path,
            summary: result.summary,
            needsReview: result.needsReview,
            reason: result.reason,
          })),
        },
        response_mode: 'blocking' as const,
        user: this.config.user,
      });
      return OverallSummarySchema.parse(JSON.parse(response));

    } catch (error) {
      console.error("Error generating overall summary:", error);
      return undefined;
    }
  }

  /**
   * Implementation of review phase
   * Execute detailed review based on summarized results and overall summary
   */
  override async review(
    prInfo: IPullRequestInfo,
    files: IFileChange[],
    summarizeResults: Map<string, SummarizeResult>,
    config?: ReviewConfig,
    overallSummary?: OverallSummary
  ): Promise<IPullRequestProcessedResult> {
    const comments: IReviewComment[] = [];

    for (const file of files) {
      const summarizeResult = summarizeResults.get(file.path);
      
      if (!summarizeResult) {
        console.warn(`No triage result for ${file.path}`);
        continue;
      }

      // Always execute review for summary generation
      if (!summarizeResult.needsReview) {
        console.info(`Light review for ${file.path}: ${summarizeResult.reason}`);
      }

      try {
        const response = await runWorkflow(this.config.baseUrl, this.config.apiKeyReview, {
          inputs: {
            title: prInfo.title,
            description: prInfo.body || "",
            filePath: file.path,
            patch: file.patch || "No changes",
            instructions: this.getInstructionsForFile(file.path, config),
            aspects: summarizeResult.aspects,
            overallSummary: {
              description: overallSummary?.description,
              crossCuttingConcerns: overallSummary?.crossCuttingConcerns,
            },
          },
          response_mode: 'blocking' as const,
          user: this.config.user,
        });
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

    return {
      comments: comments
    };
  }
}
