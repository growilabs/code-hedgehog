/**
 * Utility functions for path matching
 */

/**
 * Simple glob pattern matching
 * TODO: Replace with proper glob matching library implementation
 * @param filePath Target file path
 * @param pattern Glob pattern to match against
 * @returns Whether the file path matches the pattern
 */
export function matchesGlobPattern(filePath: string, pattern: string): boolean {
  // TODO: Implement proper glob matching
  return filePath.includes(pattern.replace('*', ''));
}
