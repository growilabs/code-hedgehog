import type { IFileChange, IPullRequestInfo, IPullRequestProcessedResult, IPullRequestProcessor } from './deps.ts';
import type { ReviewConfig, TokenConfig } from './types.ts';
import { createHorizontalBatches, createVerticalBatches } from './utils/batch.ts';
import { createCountedCollapsibleSection, formatGroupedComments } from './utils/formatting.ts';
import { type GroupedComment, convertToCommentBase, groupCommentsByLocation } from './utils/group.ts';
import { sortByFilePathAndLine } from './utils/sort.ts';

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

  // Collection of low severity comments grouped by file path
  protected lowSeverityComments: Record<string, ReviewComment[]> = {};

  /**
   * Get severity threshold from config or use default (3)
   */
  protected getSeverityThreshold(config: ReviewConfig): number {
    return config.severityThreshold ?? 3;
  }

  /**
   * Determine if a comment should be treated as low severity
   */
  protected isLowSeverity(comment: ReviewComment, config: ReviewConfig): boolean {
    return comment.severity < this.getSeverityThreshold(config);
  }

  /**
   * Process a comment and collect it if it's low severity
   * Returns true if comment was collected as low severity
   */
  protected processComment(filePath: string, comment: ReviewComment, config: ReviewConfig): boolean {
    if (this.isLowSeverity(comment, config)) {
      if (!this.lowSeverityComments[filePath]) {
        this.lowSeverityComments[filePath] = [];
      }
      this.lowSeverityComments[filePath].push(comment);
      return true;
    }
    return false;
  }

  /**
   * Get collected low severity comments
   */
  protected getLowSeverityComments(): Record<string, ReviewComment[]> {
    return this.lowSeverityComments;
  }

  /**
   * Group comments by file path and line number
   */
  protected groupComments(): GroupedComment[] {
    // Convert comments to base format and group them
    const baseComments = convertToCommentBase(this.lowSeverityComments);
    const groupedComments = groupCommentsByLocation(baseComments);
    // Sort by file path and line number (null treated as -1)
    return sortByFilePathAndLine(groupedComments);
  }

  /**
   * Format low severity comments section
   */
  protected formatLowSeveritySection(): string {
    let lowSeveritySection = '';
    if (Object.keys(this.lowSeverityComments).length > 0) {
      // Get grouped and sorted comments
      const groupedComments = this.groupComments();
      // Count unique locations after grouping
      const suppressedCommentCount = groupedComments.length;
      const content = formatGroupedComments(groupedComments);
      lowSeveritySection = createCountedCollapsibleSection('Comments suppressed due to low severity', suppressedCommentCount, content);
    }
    return lowSeveritySection;
  }

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
    if (!this.config.path_filters) return false;

    const filters = this.config.path_filters
      .split('\n')
      .map((f: string) => f.trim())
      .filter(Boolean);

    return filters.some((filter: string) => {
      if (filter.startsWith('!')) {
        return matchesGlobPattern(filePath, filter.slice(1));
      }
      return false;
    });
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
    if (isSimpleChange && this.config.skip_simple_changes) {
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
    config: ReviewConfig,
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
  abstract summarize(prInfo: IPullRequestInfo, files: IFileChange[], config: ReviewConfig): Promise<Map<string, SummarizeResult>>;

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
    config: ReviewConfig,
    summarizeResults: Map<string, SummarizeResult>,
    overallSummary?: OverallSummary,
  ): Promise<IPullRequestProcessedResult>;

  /**
   * Main processing flow - now with 3 phases
   */
  async process(prInfo: IPullRequestInfo, files: IFileChange[]): Promise<IPullRequestProcessedResult> {
    // 0. Load base configuration
    await this.loadBaseConfig(); // Rename method call

    // 1. Execute summarize
    const summarizeResults = await this.summarize(prInfo, files, this.config);

    // 2. Generate overall summary
    const overallSummary = await this.generateOverallSummary(prInfo, files, this.config, summarizeResults);

    // 3. Execute detailed review with context
    return this.review(prInfo, files, this.config, summarizeResults, overallSummary);
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
