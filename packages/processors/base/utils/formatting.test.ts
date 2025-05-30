import { expect } from '@std/expect';
// deno-lint-ignore-file no-explicit-any
import { test } from '@std/testing/bdd';
import { createCollapsibleSection, createCountedCollapsibleSection, formatFileSummaryTable, formatGroupedComments } from './formatting.ts';

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
      comments: [{ message: 'msg' }],
    },
  ];
  const md = formatGroupedComments(groups);
  expect(md).toContain('**foo.ts**:10');
  expect(md).toContain('- msg');
});

test('formatGroupedComments: multiple groups, suggestions', () => {
  const groups: GroupedComment[] = [
    {
      filePath: 'a.ts',
      lineNumber: null,
      comments: [{ message: 'm1', suggestion: 'fix1' }, { message: 'm2' }],
    },
    {
      filePath: 'b.ts',
      lineNumber: 2,
      comments: [{ message: 'm3', suggestion: 'fix2' }],
    },
  ];
  const md = formatGroupedComments(groups);
  expect(md).toContain('**a.ts**');
  expect(md).toContain('- m1\n  - fix1');
  expect(md).toContain('- m2');
  expect(md).toContain('**b.ts**:2');
  expect(md).toContain('- m3\n  - fix2');
});

test('formatGroupedComments: empty', () => {
  expect(formatGroupedComments([])).toBe('');
});

test('formatFileSummaryTable: basic', () => {
  const map = new Map<string, string>([
    ['foo.ts', 'desc1'],
    ['bar.ts', 'desc2'],
  ]);
  const table = formatFileSummaryTable(map);
  expect(table).toContain('| File | Description |');
  expect(table).toContain('`foo.ts`');
  expect(table).toContain('desc1');
  expect(table).toContain('`bar.ts`');
  expect(table).toContain('desc2');
});

test('formatFileSummaryTable: summary with newline', () => {
  const map = new Map<string, string>([['foo.ts', 'line1\nline2']]);
  const table = formatFileSummaryTable(map);
  expect(table).toContain('line1 line2');
  expect(table).not.toContain('\nline2');
});

test('createCountedCollapsibleSection: delegates', () => {
  const html = createCountedCollapsibleSection('Title', 3, 'Body');
  expect(html).toContain('<summary>Title (3)</summary>');
  expect(html).toContain('Body</details>');
});
