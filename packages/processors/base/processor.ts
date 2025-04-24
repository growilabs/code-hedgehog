// Removed fs and parseYaml imports, they are now in load-config.ts
import type { IFileChange, IPullRequestInfo, IPullRequestProcessedResult, IPullRequestProcessor, ReviewConfig, TokenConfig } from './deps.ts';
import { DEFAULT_CONFIG } from './deps.ts'; // Keep DEFAULT_CONFIG if needed elsewhere, or remove if only used for initial value
import type { OverallSummary } from './schema.ts';
import type { SummarizeResult } from './types.ts';
import { estimateTokenCount, isWithinLimit } from './utils/token.ts';
import { loadConfig as loadExternalConfig } from './internal/load-config.ts'; // Import the new function

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
  protected async loadConfig(configPath = '.coderabbitai.yaml'): Promise<void> {
    // Call the external function and update the instance's config
    this.config = await loadExternalConfig(configPath);
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
    // 設定取得
    const instructions = config?.file_path_instructions || this.config.file_path_instructions || [];
    if (instructions.length === 0) {
      return '';
    }

    try {
      // マッチするパターンを抽出し、具体性でソート
      const matchingInstructions = instructions
        .map((instruction, index) => ({
          ...instruction,
          specificity: this.calculatePatternSpecificity(instruction.path),
          originalIndex: index,
        }))
        .filter((instruction) => this.matchesGlobPattern(filePath, instruction.path))
        .sort((a, b) => {
          // 1. 具体性の高いパターンを優先
          if (a.specificity !== b.specificity) {
            return b.specificity - a.specificity;
          }
          // 2. 設定ファイル内の順序を維持
          return a.originalIndex - b.originalIndex;
        });

      // 指示を結合
      return matchingInstructions.map((instruction) => instruction.instructions).join('\n\n');
    } catch (error) {
      console.warn(`Error while getting instructions for ${filePath}:`, error);
      return '';
    }
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
        return this.matchesGlobPattern(filePath, filter.slice(1));
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
  /**
   * パターンの具体性をスコア化
   * - より長いパス部分が優先
   * - ワイルドカードが少ないほど優先
   * - 拡張子指定があるほうが優先
   */
  private calculatePatternSpecificity(pattern: string): number {
    let score = 0;

    // 基本スコアはパスの長さ
    score += pattern.length;

    // ワイルドカードはスコアを下げる
    score -= (pattern.match(/\*/g) || []).length * 2;

    // **はさらにスコアを下げる
    score -= (pattern.match(/\*\*/g) || []).length * 3;

    // 拡張子指定があればスコアを上げる
    if (pattern.includes('.')) {
      score += 5;
    }

    // 波括弧による拡張子グループ指定があればさらにスコア上げる
    if (pattern.includes('{')) {
      score += 3;
    }

    return score;
  }

  /**
   * 指定されたファイルパスがGlobパターンにマッチするか確認
   */
  private matchesGlobPattern(filePath: string, pattern: string): boolean {
    // .や*などの特殊文字をエスケープ
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\{([^}]+)\}/g, '($1)') // {js,ts} => (js|ts)
      .replace(/\*\*/g, '.*') // ** => .*
      .replace(/\*/g, '[^/]*') // * => [^/]*
      .replace(/\?/g, '.') // ? => .
      .replace(/,/g, '|'); // カンマをORに変換

    try {
      return new RegExp(`^${regexPattern}$`).test(filePath);
    } catch (error) {
      console.warn(`Invalid pattern "${pattern}":`, error);
      return false;
    }
  }

  /**
   * パッチの内容がシンプルな変更かどうかを判定
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
   * Generate summaries grouped by review aspects
   */
  protected abstract generateOverallSummary(
    prInfo: IPullRequestInfo,
    files: IFileChange[],
    summarizeResults: Map<string, SummarizeResult>,
  ): Promise<OverallSummary | undefined>;

  /**
   * Summarize phase
   */
  abstract summarize(prInfo: IPullRequestInfo, files: IFileChange[], config?: ReviewConfig): Promise<Map<string, SummarizeResult>>;

  /**
   * Review phase
   */
  abstract review(
    prInfo: IPullRequestInfo,
    files: IFileChange[],
    summarizeResults: Map<string, SummarizeResult>,
    config?: ReviewConfig,
    overallSummary?: OverallSummary,
  ): Promise<IPullRequestProcessedResult>;

  /**
   * Main processing flow
   */
  async process(prInfo: IPullRequestInfo, files: IFileChange[], config?: ReviewConfig): Promise<IPullRequestProcessedResult> {
    // 0. Load configuration
    await this.loadConfig();

    // 1. Execute summarize
    const summarizeResults = await this.summarize(prInfo, files, config);

    // 2. Generate overall summary
    const overallSummary = await this.generateOverallSummary(prInfo, files, summarizeResults);

    // 3. Execute detailed review with context
    return this.review(prInfo, files, summarizeResults, config, overallSummary);
  }
}
