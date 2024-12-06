export interface IFileChange {
  /** File path relative to the repository root */
  path: string;
  /** File content */
  content: string;
  /** Diff information in patch format */
  patch: string;
  /** File size in bytes */
  size: number;
}
