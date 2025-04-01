import type { IFileChange, IPullRequestInfo, IPullRequestProcessedResult, IPullRequestProcessor, IReviewComment, ReviewConfig } from '../../core/mod.ts';
import { matchesGlobPattern } from '../../core/mod.ts';

/**
 * Base class for pull request processors
 * Provides common functionality for path-based instructions
 */
export abstract class BaseProcessor implements IPullRequestProcessor {
  /**
   * Get instructions for a specific file based on the path patterns
   * Can be overridden by derived classes if needed
   */
  protected getInstructionsForFile(filePath: string, config?: ReviewConfig): string {
    if (!config?.path_instructions) return '';

    const matchingInstructions = config.path_instructions
      .filter((instruction) => matchesGlobPattern(filePath, instruction.path))
      .map((instruction) => instruction.instructions);

    return matchingInstructions.join('\n\n');
  }

  abstract process(prInfo: IPullRequestInfo, files: IFileChange[], config?: ReviewConfig): Promise<IPullRequestProcessedResult>;
}
