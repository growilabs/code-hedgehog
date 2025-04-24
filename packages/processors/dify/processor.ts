import type { IFileChange, IPullRequestInfo, IPullRequestProcessedResult, IReviewComment, OverallSummary, ReviewConfig, SummarizeResult } from './deps.ts';
import { BaseProcessor, OverallSummarySchema, ReviewResponseSchema, SummaryResponseSchema } from './deps.ts';
import { runWorkflow, uploadFile } from './internal/mod.ts';
import { mergeOverallSummaries } from '../base/utils/summary.ts';

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
  constructor(config: DifyProcessorConfig) {
    super();

    if (config.baseUrl.length === 0) {
      throw new Error('Base URL for Dify API is required');
    }
    if (config.user.length === 0) {
      throw new Error('API execution user is required');
    }
    if (config.apiKeySummarize.length === 0) {
      throw new Error('API key for summarize workflow is required');
    }
    if (config.apiKeyGrouping.length === 0) {
      throw new Error('API key for grouping workflow is required');
    }
    if (config.apiKeyReview.length === 0) {
      throw new Error('API key for review workflow is required');
    }

    this.config = {
      ...config,
      baseUrl: config.baseUrl.endsWith('/') ? config.baseUrl.slice(0, -1) : config.baseUrl,
    }
  }

  /**
   * Convert IFileChange array to JSON string
   * @param files Array of file changes
   * @returns JSON string representation of files
   */
  private formatFilesToJson(files: IFileChange[]): string {
    return JSON.stringify(
      files.map(file => ({
        path: file.path,
        patch: file.patch || "No changes"
      }))
    );
  }

  /**
   * Convert summarize results to JSON string
   * @param entries Array of [path, result] tuples
   * @returns JSON string representation of summarize results
   */
  private formatSummarizeResultsToJson(entries: [string, SummarizeResult][]): string {
    return JSON.stringify(
      entries.map(([path, result]) => ({
        path,
        summary: result.summary,
        needsReview: result.needsReview,
        reason: result.reason
      }))
    );
  }

  /**
   * Implementation of summarize phase
   * Analyze each file change lightly to determine if detailed review is needed
   */
  override async summarize(prInfo: IPullRequestInfo, files: IFileChange[], config?: ReviewConfig): Promise<Map<string, SummarizeResult>> {
    const results = new Map<string, SummarizeResult>();
    
    for (const file of files) {
      // Basic token check and simple change detection
      const baseResult = await this.shouldPerformDetailedReview(file, { margin: 100, maxTokens: 4000 });
      
      try {
        const response = await runWorkflow(`${this.config.baseUrl}/workflows/run`, this.config.apiKeySummarize, {
          inputs: {
            title: prInfo.title,
            description: prInfo.body || "",
            filePath: file.path,
            patch: file.patch || "No changes",
            needsReviewPre: String(baseResult.needsReview),
          },
          response_mode: 'blocking' as const,
          user: this.config.user,
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
    summarizeResults: Map<string, SummarizeResult>,
  ): Promise<OverallSummary | undefined> {
    console.debug('Starting overall summary generation with batch processing');
    const BATCH_SIZE = 2; // Number of files to process at once
    const PASSES = 2; // Number of analysis passes
    const entries = Array.from(summarizeResults.entries());
    const totalBatches = Math.ceil(entries.length / BATCH_SIZE);

    console.debug(`Processing ${entries.length} files in ${totalBatches} batches with ${PASSES} passes`);

    let accumulatedResult: OverallSummary | undefined;
    let previousAnalysis: string | undefined;

    // Begin multi-pass processing
    for (let pass = 1; pass <= PASSES; pass++) {
      console.debug(`Starting pass ${pass}/${PASSES}`);

      // Generate batches
      const batches = this.createBatchEntries(entries, BATCH_SIZE, pass);
      const totalBatches = batches.length;

      // Process each batch
      for (let batchNumber = 1; batchNumber <= totalBatches; batchNumber++) {
        const batchEntries = batches[batchNumber - 1];
        const batchFiles = files.filter(f =>
          batchEntries.some(([path]) => path === f.path)
        );

        console.debug(`[Pass ${pass}/${PASSES}] Processing batch ${batchNumber}/${totalBatches}`);
        console.debug(`[Pass ${pass}/${PASSES}] Batch ${batchNumber} files:`, batchFiles.map(f => f.path));
        if (previousAnalysis) {
          console.debug(`[Pass ${pass}/${PASSES}] Previous cumulative analysis:`, previousAnalysis);
        }

        try {
          // Upload previous analysis if available
          let previousAnalysisFileId: string | undefined;
          if (previousAnalysis) {
            previousAnalysisFileId = await uploadFile(
              this.config.baseUrl,
              this.config.apiKeyGrouping,
              this.config.user,
              previousAnalysis
            );
            console.debug(`[Pass ${pass}/${PASSES}] Uploaded previous analysis (${previousAnalysisFileId})`);
          }

          // Upload files data
          const filesJson = this.formatFilesToJson(batchFiles);
          const filesFileId = await uploadFile(
            this.config.baseUrl,
            this.config.apiKeyGrouping,
            this.config.user,
            filesJson
          );

          // Upload summarize results
          const summaryJson = this.formatSummarizeResultsToJson(batchEntries);
          const summaryFileId = await uploadFile(
            this.config.baseUrl,
            this.config.apiKeyGrouping,
            this.config.user,
            summaryJson
          );

          console.debug(`[Pass ${pass}/${PASSES}] Uploaded files (${filesFileId}) and summary (${summaryFileId})`);

          // Execute workflow with uploaded file IDs
          const response = await runWorkflow(`${this.config.baseUrl}/workflows/run`, this.config.apiKeyGrouping, {
            inputs: {
              title: prInfo.title,
              description: prInfo.body || "",
              files: {
                transfer_method: "local_file",
                upload_file_id: filesFileId,
                type: "document"
              },
              summarizeResults: {
                transfer_method: "local_file",
                upload_file_id: summaryFileId,
                type: "document"
              },
              previousAnalysis: previousAnalysisFileId ? {
                transfer_method: "local_file",
                upload_file_id: previousAnalysisFileId,
                type: "document"
              } : undefined,
            },
            response_mode: 'blocking' as const,
            user: this.config.user,
          });

          if (!response) {
            console.error(`[Pass ${pass}/${PASSES}] No response generated for batch ${batchNumber}`);
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
          previousAnalysis = JSON.stringify(accumulatedResult, null, 2);
          console.debug(`[Pass ${pass}/${PASSES}] Batch ${batchNumber} complete. Cumulative analysis:`, previousAnalysis);
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
        // Upload aspects data
        const aspectsJson = JSON.stringify(summarizeResult.aspects);
        const aspectsFileId = await uploadFile(
          this.config.baseUrl,
          this.config.apiKeyReview,
          this.config.user,
          aspectsJson
        );

        // Upload overall summary data if available
        let overallSummaryFileId: string | undefined;
        if (overallSummary) {
          const overallSummaryJson = JSON.stringify({
            description: overallSummary.description,
            crossCuttingConcerns: overallSummary.crossCuttingConcerns,
          });
          overallSummaryFileId = await uploadFile(
            this.config.baseUrl,
            this.config.apiKeyReview,
            this.config.user,
            overallSummaryJson
          );
        }

        const response = await runWorkflow(`${this.config.baseUrl}/workflows/run`, this.config.apiKeyReview, {
          inputs: {
            title: prInfo.title,
            description: prInfo.body || "",
            filePath: file.path,
            patch: file.patch || "No changes",
            instructions: this.getInstructionsForFile(file.path, config),
            aspects: {
              transfer_method: "local_file",
              upload_file_id: aspectsFileId,
              type: "document"
            },
            overallSummary: overallSummaryFileId ? {
              transfer_method: "local_file",
              upload_file_id: overallSummaryFileId,
              type: "document"
            } : undefined,
          },
          response_mode: 'blocking' as const,
          user: this.config.user,
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

        // Add file summary comment
        if (review.summary) {
          comments.push({
            path: file.path,
            body: `## Review Summary\n\n${review.summary}`,
            type: 'file',
          });
        }

        // Add PR summary comment if overall summary is available
        if (overallSummary != null) {
          comments.push({
            path: 'PR',
            body: `## Overall Summary\n\n${overallSummary.description}`,
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
