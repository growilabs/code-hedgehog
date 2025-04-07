import { encode } from '../../deps.ts';

/**
 * トークン推定の設定
 */
export interface TokenConfig {
  /** トークンの余裕を持たせる量 */
  margin: number;
  /** モデルの最大トークン数 */
  maxTokens: number;
}

/**
 * トークン推定に関する例外
 */
export class TokenEstimationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TokenEstimationError';
  }
}

/**
 * 与えられたテキストのトークン数を計算
 * 
 * @param text トークン数を計算するテキスト
 * @returns トークン数
 */
export function estimateTokenCount(text: string): number {
  try {
    const tokens = encode(text);
    return tokens.length;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new TokenEstimationError(`Failed to estimate tokens: ${message}`);
  }
}

/**
 * 与えられたテキストが制限内に収まるかチェック
 * 
 * @param text チェックするテキスト
 * @param config トークン設定
 * @returns 制限内に収まる場合はtrue
 */
export function isWithinLimit(text: string, config: TokenConfig): boolean {
  const count = estimateTokenCount(text);
  return count <= (config.maxTokens - config.margin);
}

/**
 * テキストを指定されたトークン制限に収まるように分割
 * 
 * @param text 分割するテキスト
 * @param config トークン設定
 * @returns 分割されたテキストの配列
 */
export function splitByTokenLimit(text: string, config: TokenConfig): string[] {
  const tokens = encode(text);
  const maxTokens = config.maxTokens - config.margin;
  const chunks: string[] = [];
  
  let currentChunkTokens: number[] = [];
  for (const token of tokens) {
    if (currentChunkTokens.length >= maxTokens) {
      const decoded = new TextDecoder().decode(new Uint8Array(currentChunkTokens));
      chunks.push(decoded);
      currentChunkTokens = [];
    }
    currentChunkTokens.push(token);
  }
  
  if (currentChunkTokens.length > 0) {
    const decoded = new TextDecoder().decode(new Uint8Array(currentChunkTokens));
    chunks.push(decoded);
  }
  
  return chunks;
}