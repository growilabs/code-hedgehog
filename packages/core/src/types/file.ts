/**
 * Represents a file change in a pull request
 */
export interface IFileChange {
  /**
   * File path relative to repository root
   */
  path: string;

  /**
   * Patch/diff information
   */
  patch: string | null;

  /**
   * Number of lines changed
   */
  changes: number;

  /**
   * Type of change
   */
  status: 'added' | 'modified' | 'removed' | 'renamed' | 'changed';
}
