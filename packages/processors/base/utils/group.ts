/**
 * Comment grouping utilities for review processors
 */

/**
 * Base interface for comments with file path and line number
 */
export interface CommentBase {
  filePath: string;
  lineNumber: number | null;
  target: string;
  issue: string;
  improvement: string;
}

/**
 * Interface for grouped comments
 */
export interface GroupedComment {
  filePath: string;
  lineNumber: number | null;
  comments: {
    target: string;
    issue: string;
    improvement: string;
  }[];
}

/**
 * Raw comment type from review
 */
export type RawComment = {
  target: string;
  issue: string;
  improvement: string;
  line_number?: number | null;
};

/**
 * Convert raw comments to a uniform format with file path and line number
 */
export function convertToCommentBase(fileComments: Record<string, RawComment[]>): CommentBase[] {
  const results: CommentBase[] = [];
  for (const [filePath, comments] of Object.entries(fileComments)) {
    for (const comment of comments) {
      results.push({
        filePath,
        lineNumber: comment.line_number || null,
        target: comment.target,
        issue: comment.issue,
        improvement: comment.improvement,
      });
    }
  }
  return results;
}

/**
 * Group comments by file path and line number
 */
export function groupCommentsByLocation(comments: CommentBase[]): GroupedComment[] {
  const groupMap = new Map<string, GroupedComment>();

  for (const { filePath, lineNumber, target, issue, improvement } of comments) {
    const key = `${filePath}:${lineNumber ?? 'null'}`;
    const group = groupMap.get(key);

    if (!group) {
      groupMap.set(key, {
        filePath,
        lineNumber,
        comments: [{ target, issue, improvement }],
      });
    } else {
      group.comments.push({ target, issue, improvement });
    }
  }

  return Array.from(groupMap.values());
}
