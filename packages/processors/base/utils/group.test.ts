import { expect } from '@std/expect';
import { test } from '@std/testing/bdd';
import { type CommentBase, type GroupedComment, type RawComment, convertToCommentBase, groupCommentsByLocation } from './group.ts';

test('convertToCommentBase: normal case', () => {
  const input: Record<string, RawComment[]> = {
    'a.ts': [
      { target: 'function', issue: 'm1', improvement: '', line_number: 1 },
      { target: 'code', issue: 'm2', improvement: 's2' },
    ],
    'b.ts': [{ target: 'method', issue: 'm3', improvement: 's3', line_number: null }],
  };
  const result = convertToCommentBase(input);
  expect(result).toEqual([
    { filePath: 'a.ts', lineNumber: 1, target: 'function', issue: 'm1', improvement: '' },
    { filePath: 'a.ts', lineNumber: null, target: 'code', issue: 'm2', improvement: 's2' },
    { filePath: 'b.ts', lineNumber: null, target: 'method', issue: 'm3', improvement: 's3' },
  ]);
});

test('convertToCommentBase: empty input', () => {
  expect(convertToCommentBase({})).toEqual([]);
});

test('convertToCommentBase: line_number=0', () => {
  const input: Record<string, RawComment[]> = {
    'foo.ts': [{ target: 'code', issue: 'zero', improvement: '', line_number: 0 }],
  };
  // 0は falsy なので null になる
  expect(convertToCommentBase(input)).toEqual([{ filePath: 'foo.ts', lineNumber: null, target: 'code', issue: 'zero', improvement: '' }]);
});

test('groupCommentsByLocation: group by file and line', () => {
  const comments: CommentBase[] = [
    { filePath: 'a.ts', lineNumber: 1, target: 'function', issue: 'm1', improvement: '' },
    { filePath: 'a.ts', lineNumber: 1, target: 'code', issue: 'm2', improvement: 's2' },
    { filePath: 'a.ts', lineNumber: 2, target: 'method', issue: 'm3', improvement: '' },
    { filePath: 'b.ts', lineNumber: null, target: 'code', issue: 'm4', improvement: '' },
  ];
  const grouped = groupCommentsByLocation(comments);
  expect(grouped.length).toBe(3);
  expect(grouped).toContainEqual({
    filePath: 'a.ts',
    lineNumber: 1,
    comments: [
      { target: 'function', issue: 'm1', improvement: '' },
      { target: 'code', issue: 'm2', improvement: 's2' },
    ],
  });
  expect(grouped).toContainEqual({
    filePath: 'a.ts',
    lineNumber: 2,
    comments: [{ target: 'method', issue: 'm3', improvement: '' }],
  });
  expect(grouped).toContainEqual({
    filePath: 'b.ts',
    lineNumber: null,
    comments: [{ target: 'code', issue: 'm4', improvement: '' }],
  });
});

test('groupCommentsByLocation: empty', () => {
  expect(groupCommentsByLocation([])).toEqual([]);
});

test('groupCommentsByLocation: all unique', () => {
  const comments: CommentBase[] = [
    { filePath: 'a.ts', lineNumber: 1, target: 'function', issue: 'm1', improvement: '' },
    { filePath: 'a.ts', lineNumber: 2, target: 'code', issue: 'm2', improvement: '' },
    { filePath: 'b.ts', lineNumber: 3, target: 'method', issue: 'm3', improvement: '' },
  ];
  const grouped = groupCommentsByLocation(comments);
  expect(grouped.length).toBe(3);
});
