import type { ReviewConfig } from '../deps.ts';
import { calculatePatternSpecificity } from './calculate-pattern-specificity.ts';
import { matchesGlobPattern } from './matches-glob-pattern.ts';

/**
 * パスパターンに基づいてファイルのレビュー指示を取得
 * パターンマッチの優先順位:
 * 1. より具体的なパターン
 * 2. 設定ファイル内での順序
 * 3. マッチする全ての指示を結合
 */
export function getInstructionsForFile(
  filePath: string,
  config?: ReviewConfig,
): string {
  if (!config?.file_path_instructions || config.file_path_instructions.length === 0) {
    return '';
  }

  try {
    // モック用のグローバル関数があれば使用
    // deno-lint-ignore no-explicit-any
    const matchFn = (globalThis as any).__testMatchesGlobPattern || matchesGlobPattern;

    // マッチするパターンを抽出し、具体性でソート
    const matchingInstructions = config.file_path_instructions
      .map((instruction, index) => {
        const specificity = calculatePatternSpecificity(instruction.path);
        return {
          ...instruction,
          specificity,
          originalIndex: index,
        };
      })
      .filter((instruction) => {
        try {
          return matchFn(filePath, instruction.path);
        } catch (error) {
          console.warn(`Error matching pattern ${instruction.path}:`, error);
          return false;
        }
      })
      .sort((a, b) => {
        // 1. 具体性の高いパターンを優先
        if (a.specificity !== b.specificity) {
          return b.specificity - a.specificity;
        }
        // 2. 設定ファイル内の順序を維持
        return a.originalIndex - b.originalIndex;
      });

    // マッチするパターンがない場合は空文字列を返す
    if (matchingInstructions.length === 0) {
      return '';
    }

    // 指示を結合
    return matchingInstructions
      .map((instruction) => instruction.instructions)
      .join('\n\n');
  } catch (error) {
    console.warn(`Error while getting instructions for ${filePath}:`, error);
    return '';
  }
}