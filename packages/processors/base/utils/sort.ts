/**
 * Sort utilities for review processors
 */

/**
 * Sort items by file path using localeCompare
 */
export function sortByFilePath<T extends { filePath: string }>(items: T[]): T[] {
  return items.sort((a, b) => a.filePath.localeCompare(b.filePath));
}

/**
 * Sort items by line number, treating null as -1
 */
export function sortByLineNumber<T extends { lineNumber: number | null }>(items: T[]): T[] {
  return items.sort((a, b) => {
    const lineA = a.lineNumber ?? -1;
    const lineB = b.lineNumber ?? -1;
    return lineA - lineB;
  });
}

/**
 * Sort items by file path first, then by line number
 */
export function sortByFilePathAndLine<T extends { filePath: string; lineNumber: number | null }>(
  items: T[],
): T[] {
  return items.sort((a, b) => {
    const pathCompare = a.filePath.localeCompare(b.filePath);
    if (pathCompare !== 0) return pathCompare;

    const lineA = a.lineNumber ?? -1;
    const lineB = b.lineNumber ?? -1;
    return lineA - lineB;
  });
}