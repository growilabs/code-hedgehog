import process from 'node:process';
import type { GitHubVCS } from '../../core/src/vcs/github.ts';
import type { ReviewConfig } from '../base/types.ts';
import { formatFileSummaryTable } from '../base/utils/formatting.ts';
import { mergeOverallSummaries } from '../base/utils/summary.ts';
import type { IFileChange, IPullRequestInfo, IPullRequestProcessedResult, IReviewComment, OverallSummary, SummarizeResult } from './deps.ts';
import { BaseProcessor, OverallSummarySchema, type ReviewComment, ReviewResponseSchema, SummaryResponseSchema } from './deps.ts';
import { runWorkflow, uploadFile } from './internal/mod.ts';

// Internal configuration type for DifyProcessor
type InternalDifyConfig = Partial<ReviewConfig> & {
  // Extend ReviewConfig to ensure compatibility
  baseUrl: string;
  user: string;
  apiKeySummarize: string;
  apiKeyGrouping: string;
  apiKeyReview: string;
};

interface RepoContent {
  name: string;
  path: string;
  type: 'file' | 'dir' | 'symlink' | 'submodule';
  size: number;
  sha: string;
  url: string;
  html_url: string | null;
  git_url: string | null;
  download_url: string | null;
  content?: string;
}

export class DifyProcessor extends BaseProcessor {
  private repoContents: Map<string, RepoContent> = new Map();
  private headSha: string | null = null;
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
              language: config.language,
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
    const fileSummaries = new Map<string, string>();
    const reviewsByFile: Record<string, ReviewComment[]> = {};

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
        // Initialize repository contents cache if not done yet
        if (!this.headSha && this.vcs && this.vcs.type === 'github') {
          console.log('\n=== getBranchContent: INIT START ===');
          console.log('🔍 Initializing repository contents cache...');

          try {
            const githubVcs = this.vcs as GitHubVCS;

            // Get PR info and latest commit SHA
            const commits = await githubVcs.getCommits();
            this.headSha = commits.data[commits.data.length - 1].sha;

            console.log(`🔀 Head commit SHA: ${this.headSha}`);

            if (this.headSha) {
              // Get all repository contents at once
              const contents = await githubVcs.getBranchContent(this.headSha);

              // Cache all contents
              for (const content of contents) {
                this.repoContents.set(content.path, content);
              }

              console.log('✅ Successfully cached repository contents');
              console.log(`📊 Cached ${this.repoContents.size} files`);
            } else {
              console.log('❌ Failed to get head SHA');
            }
          } catch (error) {
            console.log('❌ Failed to cache repository contents:', error instanceof Error ? error.message : String(error));
          } finally {
            console.log('=== getBranchContent: INIT END ===\n');
          }
        }

        // Upload repository contents as overview
        let overviewFileId: string | undefined;
        try {
          // Create overview data with root files list
          const overviewData = {
            headSha: this.headSha,
            rootFiles: Array.from(this.repoContents.entries()).map(([path, content]) => ({
              path,
              type: content.type
            }))
          };

          console.log('📤 Uploading root files overview:', JSON.stringify(overviewData, null, 2));
          overviewFileId = await uploadFile(
            this.difyConfig.baseUrl,
            this.difyConfig.apiKeyReview,
            this.difyConfig.user,
            JSON.stringify(overviewData)
          );
          console.log('✅ Overview file uploaded with ID:', overviewFileId);
        } catch (error) {
          console.error('❌ Failed to upload overview:', error);
        }

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

        // Debug: Log workflow inputs
        const workflowInputs = {
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
            overview: overviewFileId
              ? {
                  transfer_method: 'local_file',
                  upload_file_id: overviewFileId,
                  type: 'document',
                }
              : undefined,
            overallSummary: overallSummaryFileId
              ? {
                  transfer_method: 'local_file',
                  upload_file_id: overallSummaryFileId,
                  type: 'document',
                }
              : undefined,
            language: config.language,
          },
          response_mode: 'blocking' as const,
          user: this.difyConfig.user,
        };

        console.log('\n=== Workflow Debug START ===');
        console.log('📥 Preparing workflow inputs');
        console.log('🔍 Overview file ID:', overviewFileId);
        console.log(' Workflow inputs:', JSON.stringify(workflowInputs, null, 2));
        console.log('📦 Raw request body:', JSON.stringify({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer [REDACTED]',
          },
          body: JSON.stringify(workflowInputs),
        }, null, 2));
        console.log('=== Workflow Debug END ===\n');

        const response = await runWorkflow(`${this.difyConfig.baseUrl}/workflows/run`, this.difyConfig.apiKeyReview, workflowInputs);
        const review = ReviewResponseSchema.parse(response);

        // Process all comments, separating them by confidence
        if (review.comments) {
          const { inlineComments, reviewsByFile: fileReviews } = this.processComments(file.path, review.comments, config);
          comments.push(...inlineComments);
          Object.assign(reviewsByFile, fileReviews);
        }

        // Store individual file summary
        if (review.summary) {
          fileSummaries.set(file.path, review.summary);
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

    // Format collected file summaries into a table using common utility
    const fileSummaryTable = formatFileSummaryTable(fileSummaries);

    // Format low severity comments section
    const lowSeveritySection = this.formatLowSeveritySection(reviewsByFile, config);

    // Add overall summary with file summaries table and additional notes to regular comments
    if (overallSummary != null) {
      comments.push(this.formatPRBody(overallSummary, fileSummaryTable, reviewsByFile, config));
    }

    return {
      comments: comments,
    };
  }
}
