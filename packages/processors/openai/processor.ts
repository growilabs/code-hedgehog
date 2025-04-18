import { OpenAI, zodResponseFormat, BaseProcessor, SummaryResponseSchema, OverallSummarySchema, ReviewResponseSchema } from './deps.ts';
import type {
  IFileChange,
  IPullRequestInfo,
  IPullRequestProcessedResult,
  IReviewComment,
  ReviewComment,
  ReviewConfig,
  SummarizeResult,
  OverallSummary,
} from './deps.ts';
import { ImpactLevel } from '../base/schema.ts';
import { createTriagePrompt, createGroupingPrompt, createReviewPrompt } from './internal/prompts.ts';
import { createHorizontalBatches, createVerticalBatches } from '../base/utils/batch.ts';

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
        const batchFiles = files.filter(f =>
          batchEntries.some(([path]) => path === f.path)
        );

        console.debug(`[Pass ${pass}/${PASSES}] Processing batch ${batchNumber}/${totalBatches}`);
        console.debug(`[Pass ${pass}/${PASSES}] Batch ${batchNumber} files:`, batchFiles.map(f => f.path));
        if (previousAnalysis) {
          console.debug(`[Pass ${pass}/${PASSES}] Previous cumulative analysis:`, previousAnalysis);
        }

        try {
          const prompt = createGroupingPrompt({
            title: prInfo.title,
            description: prInfo.body || '',
            files: batchFiles.map(f => ({
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
            accumulatedResult = this.mergeOverallSummaries([accumulatedResult, batchResult]);
          } else {
            accumulatedResult = batchResult;
          }

          // Update cumulative analysis for next batch
          previousAnalysis = this.formatPreviousAnalysis(accumulatedResult);
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
   * Create batches for given pass
   */
  private createBatchEntries(
    entries: [string, SummarizeResult][],
    batchSize: number,
    pass: number
  ): [string, SummarizeResult][][] {
    if (pass === 1) {
      return createHorizontalBatches(entries, batchSize);
    }
    return createVerticalBatches(entries, batchSize);
  }

  /**
   * Merge multiple OverallSummary results into one
   * LLM integration:
   * - description: Comprehensive explanation of all changes
   * - aspect.description: Detailed explanation of each aspect
   * - crossCuttingConcerns: Overall concerns and considerations
   *
   * Mechanical integration:
   * - aspect.key: Maintain consistency across batches
   * - aspect.files: Combine with deduplication
   * - aspect.impact: Use highest impact level
   */
  private mergeOverallSummaries(summaries: OverallSummary[]): OverallSummary {
    const latest = summaries[summaries.length - 1];
    const previous = summaries.slice(0, -1);
    const previousMappings = previous.flatMap(s => s.aspectMappings);

    // Process current mappings (new or update)
    const newAspectMappings = latest.aspectMappings.map(latestMapping => {
      // Find previous mapping with the same key
      const prevMapping = previousMappings.find(p => p.aspect.key === latestMapping.aspect.key);

      if (prevMapping) {
        // For existing aspect
        return {
          aspect: {
            key: latestMapping.aspect.key,
            description: latestMapping.aspect.description, // Use new description
            impact: this.mergeImpactLevels([prevMapping.aspect.impact, latestMapping.aspect.impact])
          },
          files: [...new Set([...prevMapping.files, ...latestMapping.files])]
        };
      }
      // Add new aspect as is
      return latestMapping;
    });

    // Preserve aspects from previous mappings that are not referenced in current analysis
    const preservedMappings = previousMappings.filter(prev =>
      !latest.aspectMappings.some(curr => curr.aspect.key === prev.aspect.key)
    );

    return {
      description: latest.description,
      aspectMappings: [...preservedMappings, ...newAspectMappings],
      crossCuttingConcerns: latest.crossCuttingConcerns
    };
  }

  /**
   * Merge impact levels by selecting highest priority
   * Priority: high > medium > low
   */
  private mergeImpactLevels(impacts: ImpactLevel[]): ImpactLevel {
    if (impacts.includes(ImpactLevel.High)) return ImpactLevel.High;
    if (impacts.includes(ImpactLevel.Medium)) return ImpactLevel.Medium;
    return ImpactLevel.Low;
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
   * Format previous analysis result for next batch
   */
  private formatPreviousAnalysis(result: OverallSummary): string {
    return `Previous Batch Analysis:
{
  "description": "${result.description}",
  "aspectMappings": [
${result.aspectMappings.map(mapping => `    {
      "aspect": {
        "key": "${mapping.aspect.key}",
        "description": "${mapping.aspect.description}",
        "impact": "${mapping.aspect.impact}"
      },
      "files": ${JSON.stringify(mapping.files)}
    }`).join(',\n')}
  ],
  "crossCuttingConcerns": [
${result.crossCuttingConcerns?.map(concern => `    "${concern}"`).join(',\n') || '    // No concerns'}
  ]
}`;
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
