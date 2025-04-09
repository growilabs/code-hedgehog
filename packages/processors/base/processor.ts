import type { IFileChange, IPullRequestInfo, IPullRequestProcessedResult, IPullRequestProcessor, ReviewConfig, TokenConfig } from './deps.ts';

import { matchesGlobPattern } from './deps.ts';
import type { OverallSummary } from './schema.ts';
import type { SummarizeResult } from './types.ts';

import { estimateTokenCount, isWithinLimit } from './utils/token.ts';

/**
 * Base class for pull request processors
 * Provides common functionality for reviewing pull requests
 */
export abstract class BaseProcessor implements IPullRequestProcessor {
  /**
   * Get instructions for a specific file based on the path patterns
   */
  protected getInstructionsForFile(filePath: string, config?: ReviewConfig): string {
    if (!config?.path_instructions) return '';

    const matchingInstructions = config.path_instructions
      .filter((instruction) => matchesGlobPattern(filePath, instruction.path))
      .map((instruction) => instruction.instructions);

    return matchingInstructions.join('\n\n');
  }

  /**
   * Common triage logic
   * Determines need for detailed review based on token count and file characteristics
   */
  protected async shouldPerformDetailedReview(file: IFileChange, tokenConfig: TokenConfig): Promise<SummarizeResult> {
    // Check token count
    if (!file.patch) {
      return {
        needsReview: false,
        reason: 'No changes detected in file',
        aspects: [],
      };
    }

    // Calculate patch token count
    const tokenCount = estimateTokenCount(file.patch);
    if (!isWithinLimit(file.patch, tokenConfig)) {
      return {
        needsReview: false,
        reason: `Token count (${tokenCount}) exceeds limit`,
        aspects: [],
      };
    }

    // Determine if changes are simple
    const isSimpleChange = this.isSimpleChange(file.patch);
    if (isSimpleChange) {
      return {
        needsReview: false,
        reason: 'Changes appear to be simple (formatting, comments, etc.)',
        aspects: [],
      };
    }

    return {
      needsReview: true,
      reason: 'Changes require detailed review',
      aspects: [],
    };
  }

  /**
   * Determine if changes are simple (formatting, comments only, etc.)
   */
  protected isSimpleChange(patch: string): boolean {
    const lines = patch.split('\n');
    let hasSubstantiveChanges = false;

    for (const line of lines) {
      if (!line.startsWith('+') && !line.startsWith('-')) continue;

      const code = line.slice(1).trim();
      // Skip lines that are empty, comments, or indentation changes only
      if (code === '' || code.startsWith('//') || code.startsWith('/*') || code.startsWith('*')) {
        continue;
      }

      hasSubstantiveChanges = true;
      break;
    }

    return !hasSubstantiveChanges;
  }

  /**
   * Updates summarized results with aspects from the overall summary
   */
  protected updatesummarizeResultsWithAspects(summarizeResults: Map<string, SummarizeResult>, overallSummary: OverallSummary): void {
    // Update aspects based on the overall summary
    for (const summary of overallSummary.aspectMappings) {
      const aspect = summary.aspect;
      // Find all files that relate to this aspect by checking their content
      for (const [filePath, result] of summarizeResults.entries()) {
        if (summary.files.includes(filePath)) {
          // Add the aspect to the triage result if it's relevant
          result.aspects = Array.from(new Set([...result.aspects, aspect]));
        }
      }
    }
  }

  /**
   * Determines if an aspect is relevant to a file based on its summary
   * This is a basic implementation that can be overridden by processors
   */
  protected isAspectRelevantToFile(aspect: { key: string; description: string }, summary: string): boolean {
    const searchTerms = [aspect.key.toLowerCase(), ...aspect.description.toLowerCase().split(' ')];
    const normalizedSummary = summary.toLowerCase();
    return searchTerms.some((term) => normalizedSummary.includes(term));
  }

  /**
   * Generate summaries grouped by review aspects
   * @param prInfo Pull request information
   * @param files List of file changes to review
   * @param summarizeResults Previous summarized results
   * @returns Overall summary of changes, or undefined if summary cannot be generated
   */
  protected abstract generateOverallSummary(
    prInfo: IPullRequestInfo,
    files: IFileChange[],
    summarizeResults: Map<string, SummarizeResult>,
  ): Promise<OverallSummary | undefined>;

  /**
   * Summarize phase - Lightly analyze file changes to determine if detailed review is needed
   *
   * @param prInfo Pull request information
   * @param files List of file changes to review
   * @param config Optional review configuration
   * @returns Map of file paths to summarized results
   */
  abstract summarize(prInfo: IPullRequestInfo, files: IFileChange[], config?: ReviewConfig): Promise<Map<string, SummarizeResult>>;

  /**
   * Review phase - Execute detailed review based on summarized results
   *
   * @param prInfo Pull request information
   * @param files List of file changes to review
   * @param summarizeResults Previous summarized results
   * @param config Optional review configuration
   * @param overallSummary Overall summary of changes to provide context, if available
   * @returns Review comments and optionally updated PR info
   */
  abstract review(
    prInfo: IPullRequestInfo,
    files: IFileChange[],
    summarizeResults: Map<string, SummarizeResult>,
    config?: ReviewConfig,
    overallSummary?: OverallSummary,
  ): Promise<IPullRequestProcessedResult>;

  /**
   * Main processing flow - now with 3 phases
   */
  async process(prInfo: IPullRequestInfo, files: IFileChange[], config?: ReviewConfig): Promise<IPullRequestProcessedResult> {
    // 1. Execute summarize
    const summarizeResults = await this.summarize(prInfo, files, config);

    // 2. Generate overall summary
    const overallSummary = await this.generateOverallSummary(prInfo, files, summarizeResults);

    // 3. Update summarized results with aspects if summary is available
    if (overallSummary != null) {
      this.updatesummarizeResultsWithAspects(summarizeResults, overallSummary);
    }

    // 4. Execute detailed review with context
    return this.review(prInfo, files, summarizeResults, config, overallSummary);
  }
}
