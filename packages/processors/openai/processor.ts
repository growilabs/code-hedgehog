import { mergeOverallSummaries } from '../base/utils/summary.ts';
import { BaseProcessor, OpenAI, OverallSummarySchema, ReviewResponseSchema, SummaryResponseSchema, zodResponseFormat } from './deps.ts';
import type {
  IFileChange,
  IPullRequestInfo,
  IPullRequestProcessedResult,
  IReviewComment,
  OverallSummary,
  ReviewComment,
  ReviewConfig,
  SummarizeResult,
} from './deps.ts';
import { createGroupingPrompt, createReviewPrompt, createTriagePrompt } from './internal/prompts.ts';

export class OpenaiProcessor extends BaseProcessor {
  private openai: OpenAI;
  private readonly tokenConfig = {
    margin: 100,
    maxTokens: 4000,
  };

  constructor(apiKey?: string) {
    super();
    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Implementation of summarize phase
   * Performs lightweight analysis using light weight model
   */
  override async summarize(prInfo: IPullRequestInfo, files: IFileChange[], config?: ReviewConfig): Promise<Map<string, SummarizeResult>> {
    const results = new Map<string, SummarizeResult>();
    const summaryResponseFormat = zodResponseFormat(SummaryResponseSchema, 'summarize_response');

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
    summarizeResults: Map<string, SummarizeResult>,
  ): Promise<OverallSummary | undefined> {
    console.debug('Starting overall summary generation with batch processing');
    const BATCH_SIZE = 2; // Number of files to process at once
    const PASSES = 2; // Number of analysis passes
    const entries = Array.from(summarizeResults.entries());
    const totalBatches = Math.ceil(entries.length / BATCH_SIZE);
    const overallSummaryFormat = zodResponseFormat(OverallSummarySchema, 'overall_summary_response');

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
  override async review(
    prInfo: IPullRequestInfo,
    files: IFileChange[],
    summarizeResults: Map<string, SummarizeResult>,
    config?: ReviewConfig,
    overallSummary?: OverallSummary,
  ): Promise<IPullRequestProcessedResult> {
    const comments: IReviewComment[] = [];
    const reviewResponseFormat = zodResponseFormat(ReviewResponseSchema, 'review_response');

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
          title: prInfo.title,
          description: prInfo.body || '',
          filePath: file.path,
          patch: file.patch || 'No changes',
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

        // Create inline comments
        for (const comment of review.comments) {
          comments.push({
            path: file.path,
            position: comment.line ?? 1,
            body: this.formatComment(comment),
            type: 'inline',
          });
        }

        // Add summary comment
        if (review.summary) {
          comments.push({
            path: file.path,
            body: `## Review Summary\n\n${review.summary}`,
            type: 'file',
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

    // Add overall summary to regular comments
    if (overallSummary != null) {
      comments.push({
        path: 'PR',
        body: `## Overall Summary\n\n${overallSummary.description}`,
        type: 'pr',
      });
    }

    return { comments };
  }

  /**
   * Format review comment
   */
  private formatComment(comment: ReviewComment): string {
    let body = comment.content;
    if (comment.suggestion) {
      body += `\n\n**Suggestion:**\n${comment.suggestion}`;
    }
    return body;
  }
}
