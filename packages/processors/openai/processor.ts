import process from 'node:process';
import { ImpactLevel } from '../base/schema.ts';
// Import the base config type
import type { ReviewConfig } from '../base/types.ts'; // Use base ReviewConfig
import { createHorizontalBatches, createVerticalBatches } from '../base/utils/batch.ts';
import { formatFileSummaryTable } from '../base/utils/formatting.ts';
import { mergeOverallSummaries } from '../base/utils/summary.ts';
import { CommentType } from './deps.ts';
import type { z } from './deps.ts'; // Import zod for type assertion
import { BaseProcessor, OpenAI, OverallSummarySchema, ReviewResponseSchema, SummaryResponseSchema, zodResponseFormat } from './deps.ts';
import type {
  IFileChange,
  IPullRequestInfo,
  IPullRequestProcessedResult,
  IReviewComment,
  OverallSummary,
  ReviewComment,
  // ReviewConfig, // Use specific type below
  SummarizeResult,
} from './deps.ts';
import { createGroupingPrompt, createReviewPrompt, createTriagePrompt } from './internal/prompts.ts';

export class OpenaiProcessor extends BaseProcessor {
  private openai: OpenAI;
  private readonly tokenConfig = {
    margin: 100,
    maxTokens: 4000,
  };

  constructor() {
    // Constructor takes no arguments now
    super();
    // Load OpenAI API key from environment variable
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    this.openai = new OpenAI({ apiKey });
    // Base config loading is handled by BaseProcessor's process method
  }

  /**
   * Implementation of summarize phase
   * Performs lightweight analysis using light weight model
   */
  // Update config parameter type to base ReviewConfig
  override async summarize(prInfo: IPullRequestInfo, files: IFileChange[], config: ReviewConfig): Promise<Map<string, SummarizeResult>> {
    const results = new Map<string, SummarizeResult>();
    // biome-ignore lint/suspicious/noExplicitAny: zodResponseFormat's type inference is complex
    const summaryResponseFormat = zodResponseFormat(SummaryResponseSchema as unknown as any, 'summarize_response');

    for (const file of files) {
      // Basic token check and simple change detection
      const baseResult = await this.shouldPerformDetailedReview(file, this.tokenConfig);

      try {
        const prompt = createTriagePrompt({
          title: prInfo.title,
          description: prInfo.body || '',
          filePath: file.path,
          patch: file.patch || 'No changes',
          needsReviewPre: baseResult.needsReview,
        });

        const response = await this.openai.responses.create({
          model: 'gpt-4o-mini',
          input: [
            {
              role: 'user',
              content: prompt,
              type: 'message',
            },
          ],
          text: {
            format: {
              name: summaryResponseFormat.json_schema.name,
              type: summaryResponseFormat.type,
              schema: summaryResponseFormat.json_schema.schema ?? {},
            },
          },
          temperature: 0.2,
        });

        const content = response.output_text;
        if (!content) {
          results.set(file.path, {
            needsReview: true,
            reason: 'Failed to get triage response',
            aspects: [],
            summary: undefined,
          });
          continue;
        }

        // Parse structured response
        const summaryResponse = SummaryResponseSchema.parse(JSON.parse(content));
        results.set(file.path, {
          ...summaryResponse,
          needsReview: baseResult.needsReview && summaryResponse.needsReview === true,
          aspects: [], // Will be populated by the grouping phase
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

    console.debug('OpenAI summarized results:', results);

    return results;
  }

  /**
   * Implementation of overall summary generation with batch processing
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
    // biome-ignore lint/suspicious/noExplicitAny: zodResponseFormat's type inference is complex
    const overallSummaryFormat = zodResponseFormat(OverallSummarySchema as unknown as any, 'overall_summary_response');

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
        const batchFiles = files.filter((f) => batchEntries.some(([path]) => path === f.path));

        console.debug(`[Pass ${pass}/${PASSES}] Processing batch ${batchNumber}/${totalBatches}`);
        console.debug(
          `[Pass ${pass}/${PASSES}] Batch ${batchNumber} files:`,
          batchFiles.map((f) => f.path),
        );
        if (previousAnalysis) {
          console.debug(`[Pass ${pass}/${PASSES}] Previous cumulative analysis:`, previousAnalysis);
        }

        try {
          const prompt = createGroupingPrompt({
            config,
            title: prInfo.title,
            description: prInfo.body || '',
            files: batchFiles.map((f) => ({
              path: f.path,
              patch: f.patch || 'No changes',
            })),
            summarizeResults: batchEntries.map(([path, result]) => ({
              path,
              summary: result.summary,
              needsReview: result.needsReview,
              reason: result.reason,
            })),
            previousAnalysis,
          });

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
                name: overallSummaryFormat.json_schema.name,
                type: overallSummaryFormat.type,
                schema: overallSummaryFormat.json_schema.schema ?? {},
              },
            },
            temperature: 0.2,
          });

          const content = response.output_text;
          if (!content) {
            console.error(`[Pass ${pass}/${PASSES}] No response generated for batch ${batchNumber}`);
            continue;
          }

          const batchResult = OverallSummarySchema.parse(JSON.parse(content));

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
   * Performs detailed review using GPT-4
   */
  // Update config parameter type to base ReviewConfig
  override async review(
    prInfo: IPullRequestInfo,
    files: IFileChange[],
    config: ReviewConfig,
    summarizeResults: Map<string, SummarizeResult>,
    overallSummary?: OverallSummary,
  ): Promise<IPullRequestProcessedResult> {
    const comments: IReviewComment[] = [];
    const fileSummaries = new Map<string, string>();
    const reviewsByFile: Record<string, ReviewComment[]> = {};
    // biome-ignore lint/suspicious/noExplicitAny: zodResponseFormat's type inference is complex
    const reviewResponseFormat = zodResponseFormat(ReviewResponseSchema as unknown as any, 'review_response');

    for (const file of files) {
      const summarizeResult = summarizeResults.get(file.path);

      if (!summarizeResult) {
        console.warn(`No triage result for ${file.path}`);
        continue;
      }

      if (!summarizeResult.needsReview) {
        console.info(`Light review for ${file.path}: ${summarizeResult.reason}`);
      }

      try {
        const prompt = createReviewPrompt({
          config,
          title: prInfo.title,
          description: prInfo.body || '',
          filePath: file.path,
          patch: this.addLineNumbersToDiff(file.patch),
          instructions: this.getInstructionsForFile(file.path, config),
          aspects: summarizeResult.aspects.map((aspect) => ({
            name: aspect.key,
            description: aspect.description,
          })),
        });

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
              name: reviewResponseFormat.json_schema.name,
              type: reviewResponseFormat.type,
              schema: reviewResponseFormat.json_schema.schema ?? {},
            },
          },
          temperature: 0.2,
        });

        const content = response.output_text;
        if (!content) {
          console.warn(`No review generated for ${file.path}`);
          continue;
        }

        const review = ReviewResponseSchema.parse(JSON.parse(content));

        // Process comments and separate by severity
        if (review.comments) {
          const { inlineComments, reviewsByFile: fileReviews } = this.processComments(file.path, review.comments, config);
          comments.push(...inlineComments);
          Object.assign(reviewsByFile, fileReviews);
        }

        // Store file summary
        if (review.summary) {
          fileSummaries.set(file.path, review.summary);
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

    // Add overall summary to regular comments
    if (overallSummary != null) {
      const fileSummaryTable = formatFileSummaryTable(fileSummaries);
      comments.push(this.formatPRBody(overallSummary, fileSummaryTable, reviewsByFile, config));
    }

    return { comments };
  }

  /**
   * Format review comment
   */
}
