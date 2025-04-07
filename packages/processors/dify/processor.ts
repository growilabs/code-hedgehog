import type { TokenConfig, IFileChange, IPullRequestInfo, IPullRequestProcessedResult, IReviewComment, ReviewConfig, TriageResult } from './deps.ts';
import { BaseProcessor } from '../base/mod.ts';

export class DifyProcessor extends BaseProcessor {

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
      // Use BaseProcessor's common logic
      const result = await this.shouldPerformDetailedReview(file, { margin: 100, maxTokens: 4000 });
      results.set(file.path, result);
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

      if (!triageResult.needsReview) {
        // Add simple comment only
        comments.push({
          path: file.path,
          body: `Skipped detailed review: ${triageResult.reason}`,
          type: 'inline',
          position: 1,
        });
        continue;
      }

      const instructions = this.getInstructionsForFile(file.path, config);
      // TODO: Execute detailed review using Dify workflow
      comments.push({
        path: file.path,
        position: 1,
        body: `[DIFY] Processed ${file.path}\n\nPR: ${prInfo.title}${instructions ? `\n\nInstructions:\n${instructions}` : ''}`,
        type: 'inline',
      });
    }

    return {
      comments,
    };
  }
}
