import type { IFileChange, IPullRequestInfo, IPullRequestProcessedResult, IReviewComment, ReviewConfig } from '../../core/mod.ts';
import { BaseProcessor } from '../base/mod.ts';
// Remove duplicate import below
// import { BaseProcessor } from '../base/mod.ts';
// Import OverallSummary from schema and SummarizeResult from types
import type { OverallSummary } from '../base/schema.ts';
import type { SummarizeResult } from '../base/types.ts';

export class AcmeProcessor extends BaseProcessor {
  /**
   * @inheritdoc
   */
  override async process(prInfo: IPullRequestInfo, files: IFileChange[]): Promise<IPullRequestProcessedResult> {
    // simply comment on each file
    const comments: IReviewComment[] = await Promise.all(
      files.map(async (file) => {
        const instructions = this.getInstructionsForFile(file.path);
        return {
          path: file.path,
          position: 1,
          body: `[ACME] Reviewed ${file.path}\n\nPR: ${prInfo.title}${instructions ? `\n\nInstructions:\n${instructions}` : ''}`,
          type: 'inline',
        };
      }),
    );

    return {
      comments,
    };
  }

  /**
   * @inheritdoc
   */
  // Correct the signature to match BaseProcessor
  override async generateOverallSummary(
    _prInfo: IPullRequestInfo,
    _files: IFileChange[],
    _config: ReviewConfig,
    summarizeResults: Map<string, SummarizeResult>, // Use Map<string, SummarizeResult>
  ): Promise<OverallSummary | undefined> {
    // Use OverallSummary here
    // TODO: Implement actual overall summary generation
    console.warn('[ACME] generateOverallSummary not implemented', summarizeResults); // Log summarizeResults for now
    return Promise.resolve(undefined); // Return undefined for now
  }

  /**
   * @inheritdoc
   */
  // Correct the signature to match BaseProcessor
  override async summarize(
    // summarize should take files array
    _prInfo: IPullRequestInfo,
    files: IFileChange[],
    _config?: ReviewConfig,
  ): Promise<Map<string, SummarizeResult>> {
    // TODO: Implement actual summarization
    console.warn('[ACME] summarize not implemented', files);
    return Promise.resolve(new Map<string, SummarizeResult>());
  }

  /**
   * @inheritdoc
   */
  // Correct the signature to match BaseProcessor
  override async review(
    // review needs summarizeResults and overallSummary
    _prInfo: IPullRequestInfo,
    _files: IFileChange[],
    _config: ReviewConfig,
    summarizeResults: Map<string, SummarizeResult>,
    _overallSummary?: OverallSummary, // Use OverallSummary here
  ): Promise<IPullRequestProcessedResult> {
    // TODO: Implement actual review generation
    console.warn('[ACME] review not implemented', summarizeResults);
    return Promise.resolve({ comments: [] });
  }
}
