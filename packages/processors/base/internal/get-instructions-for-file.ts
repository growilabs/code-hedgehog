import type { PathInstruction, ReviewConfig } from '../deps.ts'; // FilePathInstruction を PathInstruction に修正
import { calculatePatternSpecificity } from './calculate-pattern-specificity.ts';
import { matchesGlobPattern } from './matches-glob-pattern.ts';

// テスト用のグローバル型拡張
declare global {
  // Biome: any を具体的な関数型に変更
  var __testMatchesGlobPattern: (filePath: string, pattern: string) => boolean;
}

/**
 * パスパターンに基づいてファイルのレビュー指示を取得
 * パターンマッチの優先順位:
 * 1. より具体的なパターン
 * 2. 設定ファイル内での順序
 * 3. マッチする全ての指示を結合
 */
export function getInstructionsForFile(filePath: string, config?: ReviewConfig): string {
  if (!config?.file_path_instructions || config.file_path_instructions.length === 0) {
    return '';
  }

  try {
    // モック用のグローバル関数があれば使用
    const matchFn: (filePath: string, pattern: string) => boolean = globalThis.__testMatchesGlobPattern || matchesGlobPattern;

    // マッチするパターンを抽出し、具体性でソート
    // 型注釈を追加
    const matchingInstructions = config.file_path_instructions
      .map((instruction: PathInstruction, index: number) => {
        // FilePathInstruction を PathInstruction に修正
        // instruction.path が string であることを前提とする (schema で必須のはず)
        const specificity = calculatePatternSpecificity(instruction.path);
        return {
          ...instruction,
          specificity,
          originalIndex: index,
        };
      })
      .filter((instruction: PathInstruction & { specificity: number; originalIndex: number }) => {
        // FilePathInstruction を PathInstruction に修正
        try {
          // instruction.path が undefined でないことを確認 (型安全のため)
          if (typeof instruction.path !== 'string') {
            // Biome: 不要なテンプレートリテラルを修正
            console.warn('Invalid path pattern found:', instruction);
            return false;
          }
          return matchFn(filePath, instruction.path);
        } catch (error: unknown) {
          // catch の error に unknown 型を明示
          // Biome: 不要なテンプレートリテラルを修正
          console.warn(`Error matching pattern ${instruction.path}:`, error instanceof Error ? error.message : error);
          return false;
        }
      })
      // 型注釈を追加
      .sort(
        (
          a: PathInstruction & { specificity: number; originalIndex: number }, // FilePathInstruction を PathInstruction に修正
          b: PathInstruction & { specificity: number; originalIndex: number }, // FilePathInstruction を PathInstruction に修正
        ) => {
          // 1. 具体性の高いパターンを優先
          if (a.specificity !== b.specificity) {
            return b.specificity - a.specificity;
          }
          // 2. 設定ファイル内の順序を維持
          return a.originalIndex - b.originalIndex;
        },
      );

    // マッチするパターンがない場合は空文字列を返す
    if (matchingInstructions.length === 0) {
      return '';
    }

    // 指示を結合
    return (
      matchingInstructions
        // instruction.instructions が string であることを前提とする (schema で必須のはず)
        .map((instruction) => instruction.instructions) // 型注釈は filter で代替
        .filter((instructions): instructions is string => typeof instructions === 'string') // instructions が string であることを保証
        .join('\n\n')
    );
  } catch (error: unknown) {
    // catch の error に unknown 型を明示
    // Biome: 不要なテンプレートリテラルを修正
    console.warn(`Error while getting instructions for ${filePath}:`, error instanceof Error ? error.message : error);
    return '';
  }
}
