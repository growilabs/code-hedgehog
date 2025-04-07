import { encode } from '../../deps.ts';

/**
 * Token estimation configuration
 */
export interface TokenConfig {
  /** Token margin to maintain */
  margin: number;
  /** モデルの最大トークン数 */
  maxTokens: number;
}

/**
 * Exception related to token estimation
 */
export class TokenEstimationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TokenEstimationError';
  }
}

/**
 * Calculate token count for given text
 *
 * @param text Text to calculate token count for
 * @returns Token count
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
 * Check if given text is within token limit
 *
 * @param text Text to check
 * @param config Token configuration
 * @returns true if text is within limit
 */
export function isWithinLimit(text: string, config: TokenConfig): boolean {
  const count = estimateTokenCount(text);
  return count <= (config.maxTokens - config.margin);
}

/**
 * Split text to fit within specified token limit
 *
 * @param text Text to split
 * @param config Token configuration
 * @returns Array of split text chunks
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