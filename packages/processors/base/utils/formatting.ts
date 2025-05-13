import type { GroupedComment } from './group.ts';

/**
 * Generate an HTML collapsible section
 * @param summary Title of the collapsible element
 * @param content Content to be collapsed
 * @returns HTML string
 */
export function createCollapsibleSection(summary: string, content: string): string {
  return `\n\n<details>
<summary>${summary}</summary>\n\n${content}</details>`;
}

/**
 * Format grouped comments into Markdown
 * @param groups Array of comment groups
 * @returns Formatted Markdown string
 */
export function formatGroupedComments(groups: GroupedComment[]): string {
  return groups
    .map((group) => {
      const header = `**${group.filePath}**${group.lineNumber ? `:${group.lineNumber}` : ''}\n`;
      const comments = group.comments
        .map((comment) => {
          const suggestion = comment.suggestion ? `\n  - ${comment.suggestion}` : '';
          return `- ${comment.message}${suggestion}`;
        })
        .join('\n');
      return `${header}${comments}\n`;
    })
    .join('\n\n');
}

/**
 * Generate a collapsible section with item count
 * @param title Section title
 * @param count Number of items
 * @param content Content to be collapsed
 * @returns HTML string
 */
export function createCountedCollapsibleSection(title: string, count: number, content: string): string {
  return createCollapsibleSection(`${title} (${count})`, content);
}
