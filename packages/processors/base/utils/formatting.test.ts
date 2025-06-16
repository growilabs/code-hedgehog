import { expect } from '@std/expect';
// deno-lint-ignore-file no-explicit-any
import { test } from '@std/testing/bdd';
import type { ReviewSummary } from '../schema.ts';
import {
  addLineNumbersToDiff,
  createCollapsibleSection,
  createCountedCollapsibleSection,
  formatFileSummaryTable,
  formatGroupedComments,
} from './formatting.ts';

import type { GroupedComment } from './group.ts';

test('createCollapsibleSection: basic', () => {
  const html = createCollapsibleSection('Summary', 'Content');
  expect(html).toContain('<details>');
  expect(html).toContain('<summary>Summary</summary>');
  expect(html).toContain('Content</details>');
});

test('formatGroupedComments: single group, single comment', () => {
  const groups: GroupedComment[] = [
    {
      filePath: 'foo.ts',
      lineNumber: 10,
      comments: [{ target: 'codeSection', issue: 'msg', improvement: 'needs to be improved' }],
    },
  ];
  const md = formatGroupedComments(groups);
  expect(md).toContain('**foo.ts**:10');
  expect(md).toContain('## Issue Location\ncodeSection\n\n## Reason\nmsg\n\n## Suggestion\nneeds to be improved');
});

test('formatGroupedComments: multiple groups, suggestions', () => {
  const groups: GroupedComment[] = [
    {
      filePath: 'a.ts',
      lineNumber: null,
      comments: [
        { target: 'function', issue: 'm1', improvement: 'fix1' },
        { target: 'code', issue: 'm2', improvement: 'needs refactoring' },
      ],
    },
    {
      filePath: 'b.ts',
      lineNumber: 2,
      comments: [{ target: 'method', issue: 'm3', improvement: 'fix2' }],
    },
  ];
  const md = formatGroupedComments(groups);
  expect(md).toContain('**a.ts**');
  // First comment
  expect(md).toContain('## Issue Location\nfunction\n\n## Reason\nm1\n\n## Suggestion\nfix1');
  // Second comment
  expect(md).toContain('## Issue Location\ncode\n\n## Reason\nm2\n\n## Suggestion\nneeds refactoring');
  // Third comment in different file
  expect(md).toContain('**b.ts**:2');
  expect(md).toContain('## Issue Location\nmethod\n\n## Reason\nm3\n\n## Suggestion\nfix2');
});

test('formatGroupedComments: empty', () => {
  expect(formatGroupedComments([])).toBe('');
});

test('formatFileSummaryTable: basic', () => {
  const map = new Map<string, ReviewSummary>([
    ['foo.ts', { positive: 'good points', negative: 'areas to improve' }],
    ['bar.ts', { positive: 'excellent work', negative: 'minor issues' }],
  ]);
  const table = formatFileSummaryTable(map);
  expect(table).toContain('| File | Description |');
  expect(table).toContain('`foo.ts`');
  expect(table).toContain('**👍 Positive Aspects**<br>');
  expect(table).toContain('good points');
  expect(table).toContain('**💡 Areas for Improvement**<br>');
  expect(table).toContain('areas to improve');
  expect(table).toContain('`bar.ts`');
  expect(table).toContain('excellent work');
  expect(table).toContain('minor issues');
});

test('formatFileSummaryTable: summary with newline', () => {
  const map = new Map<string, ReviewSummary>([
    ['foo.ts', { positive: 'line1\nline2', negative: 'issue1\nissue2' }]
  ]);
  const table = formatFileSummaryTable(map);
  // Check text content
  expect(table).toContain('line1 line2');
  expect(table).toContain('issue1 issue2');
  // Verify line break handling
  expect(table).not.toContain('\nline2');
  expect(table).not.toContain('\nissue2');
  // Verify section formatting
  expect(table).toMatch(/\*\*👍 Positive Aspects\*\*<br>.*line1 line2/);
  expect(table).toMatch(/\*\*💡 Areas for Improvement\*\*<br>.*issue1 issue2/);
  // Check HTML break tags
  expect(table).toContain('<br><br>'); // Empty line between sections
});

test('createCountedCollapsibleSection: delegates', () => {
  const html = createCountedCollapsibleSection('Title', 3, 'Body');
  expect(html).toContain('<summary>Title (3)</summary>');
  expect(html).toContain('Body</details>');
});

test("addLineNumbersToDiff returns 'No changes' for null", () => {
  expect(addLineNumbersToDiff(null)).toBe('No changes');
});

test('addLineNumbersToDiff adds line numbers to unified diff', () => {
  const diff = ['@@ -1,3 +1,4 @@', ' line1', '-line2', '+line2 modified', ' line3', '+line4', '', 'diff --git a/foo b/foo'].join('\n');
  const expected = ['@@ -1,3 +1,4 @@', '1:  line1', '2: -line2', '2: +line2 modified', '3:  line3', '4: +line4', '', 'diff --git a/foo b/foo'].join('\n');
  expect(addLineNumbersToDiff(diff)).toBe(expected);
});

test('addLineNumbersToDiff handles multiple hunks', () => {
  const diff = ['@@ -10,2 +10,3 @@', ' lineA', '-lineB', '+lineB changed', '@@ -20,1 +21,2 @@', '+added', ' lineC'].join('\n');
  const expected = ['@@ -10,2 +10,3 @@', '10:  lineA', '11: -lineB', '11: +lineB changed', '@@ -20,1 +21,2 @@', '21: +added', '22:  lineC'].join('\n');
  expect(addLineNumbersToDiff(diff)).toBe(expected);
});
