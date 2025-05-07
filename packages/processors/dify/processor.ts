import process from 'node:process';
import type { ReviewConfig } from '../base/types.ts';
import { mergeOverallSummaries } from '../base/utils/summary.ts';
import type { IFileChange, IPullRequestInfo, IPullRequestProcessedResult, IReviewComment, OverallSummary, SummarizeResult } from './deps.ts';
import { BaseProcessor, OverallSummarySchema, ReviewResponseSchema, SummaryResponseSchema } from './deps.ts';
import { runWorkflow, uploadFile } from './internal/mod.ts';

// Internal configuration type for DifyProcessor
type InternalDifyConfig = ReviewConfig & {
  // Extend ReviewConfig to ensure compatibility
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
  // Use a different name for Dify specific config to avoid conflict with private base config
  protected readonly difyConfig: InternalDifyConfig;
  private readonly tokenConfig = {
    margin: 100,
    maxTokens: 4000, // Note: This seems low for modern models, consider increasing
  };

  /**
   * Constructor for DifyProcessor
   */
  constructor() {
    super();

    // Load Dify specific config from environment variables
    const baseUrl = process.env.DIFY_API_BASE_URL;
    const user = process.env.DIFY_API_EXEC_USER;
    const apiKeySummarize = process.env.DIFY_API_KEY_SUMMARIZE;
    const apiKeyGrouping = process.env.DIFY_API_KEY_GROUPING;
    const apiKeyReview = process.env.DIFY_API_KEY_REVIEW;

    // Validate required environment variables
    if (!baseUrl) {
      throw new Error('DIFY_API_BASE_URL environment variable is not set');
    }
    if (!user) {
      throw new Error('DIFY_API_EXEC_USER environment variable is not set');
    }
    if (!apiKeySummarize) {
      throw new Error('DIFY_API_KEY_SUMMARIZE environment variable is not set');
    }
    if (!apiKeyGrouping) {
      throw new Error('DIFY_API_KEY_GROUPING environment variable is not set');
    }
    if (!apiKeyReview) {
      throw new Error('DIFY_API_KEY_REVIEW environment variable is not set');
    }

    // Initialize Dify specific config
    this.difyConfig = {
      baseUrl: baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl,
      user: user,
      apiKeySummarize: apiKeySummarize,
      apiKeyGrouping: apiKeyGrouping,
      apiKeyReview: apiKeyReview,
      // Initialize path_instructions as empty, BaseProcessor might populate it later
      path_instructions: [],
    };
    // Base config loading is handled by BaseProcessor's process method
  }

  /**
   * Implementation of summarize phase
   * Analyze each file change lightly to determine if detailed review is needed
   */
  // Update config parameter type to base ReviewConfig
  override async summarize(prInfo: IPullRequestInfo, files: IFileChange[], config: ReviewConfig): Promise<Map<string, SummarizeResult>> {
    const results = new Map<string, SummarizeResult>();

    for (const file of files) {
      // Basic token check and simple change detection
      const baseResult = await this.shouldPerformDetailedReview(file, this.tokenConfig);

      try {
        const response = await runWorkflow(`${this.difyConfig.baseUrl}/workflows/run`, this.difyConfig.apiKeySummarize, {
          inputs: {
            title: prInfo.title,
            description: prInfo.body || '',
            filePath: file.path,
            patch: file.patch || 'No changes',
            needsReviewPre: String(baseResult.needsReview),
          },
          response_mode: 'blocking' as const,
          user: this.difyConfig.user,
        });

        const summaryResponse = SummaryResponseSchema.parse(response);

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
    config: ReviewConfig,
    summarizeResults: Map<string, SummarizeResult>,
  ): Promise<OverallSummary | undefined> {
    console.debug('Starting overall summary generation with batch processing');
    const BATCH_SIZE = 2; // Number of files to process at once
    const PASSES = 2; // Number of analysis passes
    const entries = Array.from(summarizeResults.entries());
    const totalBatches = Math.ceil(entries.length / BATCH_SIZE);

    console.debug(`Processing ${entries.length} files in ${totalBatches} batches with ${PASSES} passes`);

    let accumulatedResult: OverallSummary | undefined;
    let previousAnalysis: OverallSummary | undefined;

    // Begin multi-pass processing
    for (let pass = 1; pass <= PASSES; pass++) {
      console.debug(`Starting pass ${pass}/${PASSES}`);

      // Generate batches
      const batches = this.createBatchEntries(entries, BATCH_SIZE, pass);
      const totalBatches = batches.length;

      // Process each batch
      for (let batchNumber = 1; batchNumber <= totalBatches; batchNumber++) {
        const batchEntries = batches[batchNumber - 1];
        const batchFiles = files.filter((f) => batchEntries.some(([path]) => path === f.path));

        console.debug(`[Pass ${pass}/${PASSES}] Processing batch ${batchNumber}/${totalBatches}`);
        console.debug(
          `[Pass ${pass}/${PASSES}] Batch ${batchNumber} files:`,
          batchFiles.map((f) => f.path),
        );
        if (previousAnalysis) {
          console.debug(`[Pass ${pass}/${PASSES}] Previous cumulative analysis:`, JSON.stringify(previousAnalysis, null, 2));
        }

        try {
          // Upload previous analysis if available
          let previousAnalysisFileId: string | undefined;
          if (previousAnalysis) {
            const uploadData = {
              description: previousAnalysis.description,
              crossCuttingConcerns: previousAnalysis.crossCuttingConcerns,
            };
            previousAnalysisFileId = await uploadFile(this.difyConfig.baseUrl, this.difyConfig.apiKeyGrouping, this.difyConfig.user, uploadData);
            console.debug(`[Pass ${pass}/${PASSES}] Uploaded previous analysis (${previousAnalysisFileId})`);
          }

          // Upload files data
          const filesWithDefaults = batchFiles.map((file) => ({
            ...file,
            patch: file.patch || 'No changes', // Ensure patch is never null
          }));
          const filesFileId = await uploadFile(this.difyConfig.baseUrl, this.difyConfig.apiKeyGrouping, this.difyConfig.user, filesWithDefaults);

          // Upload summarize results (convert Map entries to SummaryResponse[])
          const summaryFileId = await uploadFile(
            this.difyConfig.baseUrl,
            this.difyConfig.apiKeyGrouping,
            this.difyConfig.user,
            batchEntries.map(([path, result]) => ({
              path,
              summary: result.summary || '',
              needsReview: result.needsReview,
              reason: result.reason || '',
            })),
          );

          console.debug(`[Pass ${pass}/${PASSES}] Uploaded files (${filesFileId}) and summary (${summaryFileId})`);

          // Execute workflow with uploaded file IDs
          const response = await runWorkflow(`${this.difyConfig.baseUrl}/workflows/run`, this.difyConfig.apiKeyGrouping, {
            inputs: {
              title: prInfo.title,
              description: prInfo.body || '',
              files: {
                transfer_method: 'local_file',
                upload_file_id: filesFileId,
                type: 'document',
              },
              summarizeResults: {
                transfer_method: 'local_file',
                upload_file_id: summaryFileId,
                type: 'document',
              },
              previousAnalysis: previousAnalysisFileId
                ? {
                    transfer_method: 'local_file',
                    upload_file_id: previousAnalysisFileId,
                    type: 'document',
                  }
                : undefined,
            },
            response_mode: 'blocking' as const,
            user: this.difyConfig.user,
          });

          if (!response) {
            console.error(`[Pass ${pass}/${PASSES}] No review outputs generated for batch ${batchNumber}`);
            continue;
          }

          const batchResult = OverallSummarySchema.parse(response);

          // Update accumulated results
          if (accumulatedResult) {
            accumulatedResult = mergeOverallSummaries(accumulatedResult, batchResult);
          } else {
            accumulatedResult = batchResult;
          }

          // Update cumulative analysis for next batch
          previousAnalysis = accumulatedResult;
          console.debug(`[Pass ${pass}/${PASSES}] Batch ${batchNumber} complete. Current analysis state:`, JSON.stringify(previousAnalysis, null, 2));
        } catch (error) {
          console.error(`[Pass ${pass}/${PASSES}] Error in batch ${batchNumber}/${totalBatches}:`, error);
        }
      }

      // Log completion of each pass
      console.debug(`[Pass ${pass}/${PASSES}] Complete`);
    }

    if (!accumulatedResult) {
      console.error('No results generated from any batch');
      return undefined;
    }

    return accumulatedResult;
  }

  /**
   * Implementation of review phase
   * Execute detailed review based on summarized results and overall summary
   */
  override async review(
    prInfo: IPullRequestInfo,
    files: IFileChange[],
    config: ReviewConfig, // Update config parameter type to base ReviewConfig
    summarizeResults: Map<string, SummarizeResult>,
    overallSummary?: OverallSummary,
  ): Promise<IPullRequestProcessedResult> {
    // If we don't have overall summary, we can't do a proper review
    if (!overallSummary) {
      console.warn('No overall summary available, skipping review');
      return { comments: [] };
    }

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
        // Upload aspects data
        const aspectsFileId = await uploadFile(this.difyConfig.baseUrl, this.difyConfig.apiKeyReview, this.difyConfig.user, summarizeResult.aspects);

        // Upload overall summary data if available
        let overallSummaryFileId: string | undefined;
        if (overallSummary) {
          const overallSummaryData = {
            description: overallSummary.description,
            crossCuttingConcerns: overallSummary.crossCuttingConcerns,
          };
          overallSummaryFileId = await uploadFile(this.difyConfig.baseUrl, this.difyConfig.apiKeyReview, this.difyConfig.user, overallSummaryData);
        }

        const response = await runWorkflow(`${this.difyConfig.baseUrl}/workflows/run`, this.difyConfig.apiKeyReview, {
          inputs: {
            title: prInfo.title,
            description: prInfo.body || '',
            filePath: file.path,
            patch: file.patch || 'No changes',
            instructions: this.getInstructionsForFile(file.path, config),
            aspects: {
              transfer_method: 'local_file',
              upload_file_id: aspectsFileId,
              type: 'document',
            },
            overallSummary: overallSummaryFileId
              ? {
                  transfer_method: 'local_file',
                  upload_file_id: overallSummaryFileId,
                  type: 'document',
                }
              : undefined,
          },
          response_mode: 'blocking' as const,
          user: this.difyConfig.user,
        });
        const review = ReviewResponseSchema.parse(response);

        if (review.comments) {
          for (const comment of review.comments) {
            comments.push({
              path: file.path,
              body: this.formatComment(comment),
              type: 'inline',
              position: comment.line_number || 1,
            });
          }
        }

        if (review.summary) {
          comments.push({
            path: file.path,
            body: `## Review Summary\n\n${review.summary}`,
            type: 'file',
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

    // Add overall summary to regular comments
    if (overallSummary != null) {
      comments.push({
        path: 'PR',
        body: `## Overall Summary\n\n${overallSummary.description}`,
        type: 'pr',
      });
    }

    return {
      comments: comments,
    };
  }
}
