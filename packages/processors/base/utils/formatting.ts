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
          return `## Issue Location
${comment.target}

## Reason
${comment.issue}

## Suggestion
${comment.improvement}`;
        })
        .join('\n');
      return `${header}${comments}\n`;
    })
    .join('\n\n');
}

/**
 * Format file summaries into a markdown table
 * @param fileSummaries Map of file paths to their summaries
 * @returns Formatted markdown table string
 */
export function formatFileSummaryTable(fileSummaries: Map<string, string>): string {
  let table = '| File | Description |\n|------|-------------|';
  for (const [path, summary] of fileSummaries) {
    // Replace newlines with spaces for cleaner table display
    const formattedSummary = summary.replace(/\n/g, ' ');
    table += `\n| \`${path}\` | ${formattedSummary} |`;
  }
  return table;
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

/**
 * Add line numbers to diff text for GitHub 'POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews' API
 */
export function addLineNumbersToDiff(diffText: string | null): string {
  if (diffText == null) {
    return 'No changes';
  }

  const lines = diffText.split('\n');
  const numberedLines: string[] = [];
  let oldLineNumber = 0;
  let newLineNumber = 0;

  for (const line of lines) {
    if (line.startsWith('@@')) {
      // Extract starting line numbers from hunk header
      // Example: @@ -86,11 +88,11 @@ → old file starts at line 86, new file starts at line 88
      const match = line.match(/^@@ -(\d+),?\d* \+(\d+),?\d* @@/);
      if (match) {
        oldLineNumber = Number.parseInt(match[1], 10);
        newLineNumber = Number.parseInt(match[2], 10);
      }
      numberedLines.push(line);
    } else if (line.startsWith('-')) {
      numberedLines.push(`${oldLineNumber}: ${line}`);
      oldLineNumber++;
    } else if (line.startsWith('+')) {
      numberedLines.push(`${newLineNumber}: ${line}`);
      newLineNumber++;
    } else if (line.startsWith(' ') || line === '') {
      if (line.startsWith(' ')) {
        numberedLines.push(`${newLineNumber}: ${line}`);
      } else {
        numberedLines.push(line);
      }
      oldLineNumber++;
      newLineNumber++;
    } else {
      // Other lines (file headers, etc.)
      numberedLines.push(line);
    }
  }

  return numberedLines.join('\n');
}
