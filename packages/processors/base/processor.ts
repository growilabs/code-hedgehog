// NOTE: ReviewConfig is now imported from deps.ts which gets it from @code-hedgehog/core
import type { CommentInfo, IFileChange, IPullRequestInfo, IPullRequestProcessedResult, IPullRequestProcessor, ProcessInput, ReviewConfig } from './deps.ts';
import type { TokenConfig } from './types.ts'; // TokenConfig is specific to base processor
import { createHorizontalBatches, createVerticalBatches } from './utils/batch.ts';

import { DEFAULT_CONFIG, matchesGlobPattern } from './deps.ts';
import { getInstructionsForFile } from './internal/get-instructions-for-file.ts';
import { loadBaseConfig as loadExternalBaseConfig } from './internal/load-base-config.ts'; // Rename import and alias
import type { OverallSummary, ReviewComment } from './schema.ts';
import type { SummarizeResult } from './types.ts';
import { estimateTokenCount, isWithinLimit } from './utils/token.ts';

/**
 * Base class for pull request processors
 * Provides common functionality for reviewing pull requests
 */
export abstract class BaseProcessor implements IPullRequestProcessor {
  // Initialize config with DEFAULT_CONFIG, it will be updated by loadConfig
  private config: ReviewConfig = DEFAULT_CONFIG;

  /**
   * Load configuration using the external module.
   * This method now acts as a wrapper to update the instance's config.
   */
  protected async loadBaseConfig(configPath = '.coderabbitai.yaml'): Promise<void> {
    // Call the external function and update the instance's config
    this.config = await loadExternalBaseConfig(configPath); // Rename function call
  }

  /**
   * Get instructions for a specific file based on the path patterns
   */
  /**
   * パスパターンに基づいてファイルのレビュー指示を取得
   * パターンマッチの優先順位:
   * 1. より具体的なパターン
   * 2. 設定ファイル内での順序
   * 3. マッチする全ての指示を結合
   */
  protected getInstructionsForFile(filePath: string, config?: ReviewConfig): string {
    return getInstructionsForFile(filePath, config || this.config);
  }

  /**
   * Check if file should be filtered based on path_filters
   */
  protected isFileFiltered(filePath: string): boolean {
    // TODO: path_filters was part of the old schema.
    // The new ReviewConfig from @code-hedgehog/core has path_instructions which is an array of objects.
    // This filtering logic needs to be adapted to the new structure if path-based filtering is still desired.
    // For now, returning false to not filter anything based on old logic.
    // if (!this.config.path_instructions || this.config.path_instructions.length === 0) return false;
    //
    // const filters = this.config.path_instructions
    //   .map((pi) => pi.path) // Assuming we might want to filter based on the path patterns themselves
    //   .filter(Boolean);
    //
    // return filters.some((filter: string) => {
    //   if (filter.startsWith('!')) { // This logic might need to change based on how PathInstruction is used for filtering
    //     return matchesGlobPattern(filePath, filter.slice(1));
    //   }
    //   return false; // Or true depending on inclusive/exclusive logic
    // });
    return false; // Placeholder: not filtering for now
  }

  /**
   * Common triage logic
   * Determines need for detailed review based on token count and file characteristics
   */
  protected async shouldPerformDetailedReview(file: IFileChange, tokenConfig: TokenConfig): Promise<SummarizeResult> {
    // Check if file is filtered
    if (this.isFileFiltered(file.path)) {
      return {
        needsReview: false,
        reason: 'File path is filtered out',
        aspects: [],
      };
    }

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
    if (isSimpleChange && this.config.skipSimpleChanges) {
      // Changed to skipSimpleChanges
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
   * Create batches for given pass
   * @param entries Entries to batch
   * @param batchSize Size of each batch
   * @param pass Current pass number
   * @returns Batched entries
   */
  protected createBatchEntries(entries: [string, SummarizeResult][], batchSize: number, pass: number): [string, SummarizeResult][][] {
    if (pass === 1) {
      return createHorizontalBatches(entries, batchSize);
    }
    return createVerticalBatches(entries, batchSize);
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
    commentHistory?: CommentInfo[],
  ): Promise<OverallSummary | undefined>;

  /**
   * Summarize phase - Lightly analyze file changes to determine if detailed review is needed
   *
   * @param prInfo Pull request information
   * @param files List of file changes to review
   * @param config Optional review configuration
   * @param commentHistory Optional array of existing comments
   * @returns Map of file paths to summarized results
   */
  abstract summarize(
    prInfo: IPullRequestInfo,
    files: IFileChange[],
    config?: ReviewConfig,
    commentHistory?: CommentInfo[],
  ): Promise<Map<string, SummarizeResult>>;

  /**
   * Review phase - Execute detailed review based on summarized results
   *
   * @param prInfo Pull request information
   * @param files List of file changes to review
   * @param summarizeResults Previous summarized results
   * @param config Optional review configuration
   * @param overallSummary Overall summary of changes to provide context, if available
   * @param commentHistory Optional array of existing comments
   * @returns Review comments and optionally updated PR info
   */
  abstract review(
    prInfo: IPullRequestInfo,
    files: IFileChange[],
    summarizeResults: Map<string, SummarizeResult>,
    config?: ReviewConfig,
    overallSummary?: OverallSummary,
    commentHistory?: CommentInfo[],
  ): Promise<IPullRequestProcessedResult>;

  /**
   * Main processing flow - now with 3 phases
   */
  async process(input: ProcessInput): Promise<IPullRequestProcessedResult> {
    const { prInfo, files, config: inputConfig, commentHistory } = input;

    // 0. Load base configuration from .coderabbitai.yaml (or default path)
    // This sets `this.config`.
    await this.loadBaseConfig();

    // Determine the effective configuration to use.
    // If inputConfig is provided (e.g., from Action inputs), it might override or merge with `this.config`.
    // For now, we'll prioritize inputConfig if it exists, otherwise use the loaded `this.config`.
    // A more sophisticated merging strategy might be needed later.
    const effectiveConfig = inputConfig ?? this.config;

    // 1. Execute summarize
    const summarizeResults = await this.summarize(prInfo, files, effectiveConfig, commentHistory);

    // 2. Generate overall summary
    const overallSummary = await this.generateOverallSummary(prInfo, files, summarizeResults, commentHistory);

    // 3. Execute detailed review with context
    return this.review(prInfo, files, summarizeResults, effectiveConfig, overallSummary, commentHistory);
  }
  /**
   * Format review comment with suggestion
   */
  protected formatComment(comment: ReviewComment): string {
    let body = comment.message;
    if (comment.suggestion) {
      body += `\n\n**Suggestion:**\n${comment.suggestion}`;
    }
    return body;
  }

  /**
   * Add line numbers to diff text for GitHub 'POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews' API
   */
  protected addLineNumbersToDiff(diffText: string | null): string {
    if (diffText == null) {
      return 'No changes';
    }

    const lines = diffText.split('\n');
    const numberedLines = lines.map((line, index) => {
      return `${index}: ${line}`;
    });
    return numberedLines.join('\n');
  }
}
