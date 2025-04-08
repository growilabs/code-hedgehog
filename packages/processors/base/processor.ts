import type {
  IFileChange,
  IPullRequestInfo,
  IPullRequestProcessor,
  IPullRequestProcessedResult,
  ReviewConfig,
  TokenConfig,
} from './deps.ts';
import { estimateTokenCount, isWithinLimit, matchesGlobPattern } from './deps.ts';

import type { TriageResult } from './types.ts';

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
        reason: "No changes detected in file"
      };
    }

    // Calculate patch token count
    const tokenCount = estimateTokenCount(file.patch);
    if (!isWithinLimit(file.patch, tokenConfig)) {
      return {
        needsReview: false,
        reason: `Token count (${tokenCount}) exceeds limit`
      };
    }

    // Determine if changes are simple
    const isSimpleChange = this.isSimpleChange(file.patch);
    if (isSimpleChange) {
      return {
        needsReview: false,
        reason: "Changes appear to be simple (formatting, comments, etc.)"
      };
    }

    return {
      needsReview: true,
      reason: "Changes require detailed review"
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
   * @returns Review comments and optionally updated PR info
   */
  abstract review(
    prInfo: IPullRequestInfo,
    files: IFileChange[],
    triageResults: Map<string, TriageResult>,
    config?: ReviewConfig
  ): Promise<IPullRequestProcessedResult>;

  /**
   * Main processing flow
   */
  async process(
    prInfo: IPullRequestInfo,
    files: IFileChange[],
    config?: ReviewConfig
  ): Promise<IPullRequestProcessedResult> {
    // 1. Execute triage
    const triageResults = await this.triage(prInfo, files, config);
    
    // 2. Execute review based on triage results
    return this.review(prInfo, files, triageResults, config);
  }
}
