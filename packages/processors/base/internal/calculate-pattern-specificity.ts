/**
 * Calculates the specificity score for a given glob pattern.
 * Higher scores indicate more specific patterns.
 * - Longer path segments are prioritized.
 * - Fewer wildcards are prioritized.
 * - Specific extensions are prioritized.
 * @param pattern The glob pattern string.
 * @returns The specificity score.
 */
export function calculatePatternSpecificity(pattern: string): number {
  let score = 0;

  // Base score is the length of the pattern
  score += pattern.length;

  // Count double wildcards first
  const doubleWildcardCount = (pattern.match(/\*\*/g) || []).length;
  score -= doubleWildcardCount * 3;

  // Count single wildcards (excluding those part of double wildcards)
  // Match '*' that is not preceded or followed by another '*'
  const singleWildcardCount = (pattern.match(/(?<!\*)\*(?!\*)/g) || []).length;
  score -= singleWildcardCount * 2;

  // Specific extensions increase the score
  if (pattern.includes('.')) {
    score += 5;
  }

  // Extension groups in braces increase the score further
  if (pattern.includes('{')) {
    score += 3;
  }

  return score;
}