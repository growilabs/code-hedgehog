import type {
  IFileChange,
  IPullRequestInfo,
  IPullRequestProcessor,
  IPullRequestProcessedResult,
  ReviewConfig,
  TokenConfig,
  TriageResult,
  OverallSummary,
} from './deps.ts';

import { matchesGlobPattern } from './deps.ts';

import {
  estimateTokenCount,
  isWithinLimit,
} from './utils/token.ts';

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
  protected async shouldPerformDetailedReview(
    file: IFileChange,
    tokenConfig: TokenConfig
  ): Promise<TriageResult> {
    // Check token count
    if (!file.patch) {
      return {
        needsReview: false,
        reason: "No changes detected in file",
        aspects: []
      };
    }

    // Calculate patch token count
    const tokenCount = estimateTokenCount(file.patch);
    if (!isWithinLimit(file.patch, tokenConfig)) {
      return {
        needsReview: false,
        reason: `Token count (${tokenCount}) exceeds limit`,
        aspects: []
      };
    }

    // Determine if changes are simple
    const isSimpleChange = this.isSimpleChange(file.patch);
    if (isSimpleChange) {
      return {
        needsReview: false,
        reason: "Changes appear to be simple (formatting, comments, etc.)",
        aspects: []
      };
    }

    return {
      needsReview: true,
      reason: "Changes require detailed review",
      aspects: []
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
   * Updates triage results with aspects from the overall summary
   */
  protected updateTriageResultsWithAspects(
    triageResults: Map<string, TriageResult>,
    overallSummary: OverallSummary
  ): void {
    // Update aspects based on the overall summary
    for (const summary of overallSummary.aspectSummaries) {
      const aspect = summary.aspect;
      // Find all files that relate to this aspect by checking their content
      for (const [filePath, result] of triageResults.entries()) {
        if (result.summary && this.isAspectRelevantToFile(aspect, result.summary)) {
          result.aspects.push(aspect);
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
    return searchTerms.some(term => normalizedSummary.includes(term));
  }

  /**
   * Generate summaries grouped by review aspects
   * @param prInfo Pull request information
   * @param files List of file changes to review
   * @param triageResults Previous triage results
   * @returns Overall summary of changes, or undefined if summary cannot be generated
   */
  protected abstract generateOverallSummary(
    prInfo: IPullRequestInfo,
    files: IFileChange[],
    triageResults: Map<string, TriageResult>
  ): Promise<OverallSummary | undefined>;

  /**
   * Triage phase - Lightly analyze file changes to determine if detailed review is needed
   *
   * @param prInfo Pull request information
   * @param files List of file changes to review
   * @param config Optional review configuration
   * @returns Map of file paths to triage results
   */
  abstract triage(
    prInfo: IPullRequestInfo,
    files: IFileChange[],
    config?: ReviewConfig
  ): Promise<Map<string, TriageResult>>;

  /**
   * Review phase - Execute detailed review based on triage results
   *
   * @param prInfo Pull request information
   * @param files List of file changes to review
   * @param triageResults Previous triage results
   * @param config Optional review configuration
   * @param overallSummary Overall summary of changes to provide context, if available
   * @returns Review comments and optionally updated PR info
   */
  abstract review(
    prInfo: IPullRequestInfo,
    files: IFileChange[],
    triageResults: Map<string, TriageResult>,
    config?: ReviewConfig,
    overallSummary?: OverallSummary
  ): Promise<IPullRequestProcessedResult>;

  /**
   * Main processing flow - now with 3 phases
   */
  async process(
    prInfo: IPullRequestInfo,
    files: IFileChange[],
    config?: ReviewConfig
  ): Promise<IPullRequestProcessedResult> {
    // 1. Execute triage
    const triageResults = await this.triage(prInfo, files, config);
    
    // 2. Generate overall summary
    const overallSummary = await this.generateOverallSummary(
      prInfo,
      files,
      triageResults
    );

    // 3. Update triage results with aspects if summary is available
    if (overallSummary != null) {
      this.updateTriageResultsWithAspects(triageResults, overallSummary);
    }
    
    // 4. Execute detailed review with context
    return this.review(prInfo, files, triageResults, config, overallSummary);
  }
}
